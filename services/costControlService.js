const { v4: uuidv4 } = require('uuid');
const db = require('../database/init');
const env = require('../config/env');

const PRICING_USD_PER_MILLION = Object.freeze({
  'deepseek-v4-flash': Object.freeze({
    currency: 'USD', inputCacheHitPerMillionUsd: 0.0028, inputCacheMissPerMillionUsd: 0.14, outputPerMillionUsd: 0.28
  }),
  'deepseek-v4-pro': Object.freeze({
    currency: 'USD', inputCacheHitPerMillionUsd: 0.003625, inputCacheMissPerMillionUsd: 0.435, outputPerMillionUsd: 0.87
  })
});

function clamp(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function datePrefix(now = new Date()) { return now.toISOString().slice(0, 10); }
function monthPrefix(now = new Date()) { return now.toISOString().slice(0, 7); }
function estimate(messages = []) {
  const text = JSON.stringify(messages || []);
  let tokens = 0;
  for (const char of text) tokens += /[\u3400-\u9fff]/.test(char) ? 0.6 : 0.3;
  return Math.max(1, Math.ceil(tokens));
}

function estimateCost({ model, inputTokens = 0, outputTokens = 0, cachedInputTokens = 0 } = {}) {
  const price = PRICING_USD_PER_MILLION[model];
  if (!price) return null;
  const hit = clamp(cachedInputTokens, 0, inputTokens);
  const miss = Math.max(0, clamp(inputTokens) - hit);
  return Number(((miss * price.inputCacheMissPerMillionUsd + hit * price.inputCacheHitPerMillionUsd + clamp(outputTokens) * price.outputPerMillionUsd) / 1000000).toFixed(10));
}

function getPrice(model) { return PRICING_USD_PER_MILLION[model] || null; }
function estimateCny(usd) {
  if (!Number.isFinite(Number(usd)) || !env.aiUsdToCnyRate) return null;
  return Number((Number(usd) * env.aiUsdToCnyRate).toFixed(8));
}
function costView(usd) {
  return { usd: Number(usd || 0), cnyEstimate: estimateCny(usd), exchangeRate: env.aiUsdToCnyRate || null, exchangeRateUpdatedAt: env.aiUsdToCnyUpdatedAt || '' };
}

function configuredLimits(overrides = {}) {
  return {
    maxInputChars: overrides.maxInputChars ?? env.deepseekMaxInputChars,
    maxRequestBytes: overrides.maxRequestBytes ?? env.deepseekMaxRequestBytes,
    maxOutputTokens: overrides.maxOutputTokens ?? env.deepseekMaxOutputTokens,
    maxContextTokens: overrides.maxContextTokens ?? env.deepseekMaxContextTokens,
    dailyRequestLimit: overrides.dailyRequestLimit ?? env.deepseekDailyRequestLimit,
    enterpriseDailyRequestLimit: overrides.enterpriseDailyRequestLimit ?? env.deepseekEnterpriseDailyRequestLimit,
    enterpriseDailyTokenLimit: overrides.enterpriseDailyTokenLimit ?? env.deepseekDailyTokenLimit,
    enterpriseDailyBudget: overrides.enterpriseDailyBudget ?? env.deepseekDailyBudget,
    agentDailyTokenLimit: overrides.agentDailyTokenLimit ?? env.deepseekAgentDailyTokenLimit,
    systemDailyTokenLimit: overrides.systemDailyTokenLimit ?? env.deepseekSystemDailyTokenLimit,
    systemDailyBudget: overrides.systemDailyBudget ?? env.deepseekSystemDailyBudget,
    enterpriseMonthlyBudget: overrides.enterpriseMonthlyBudget ?? env.deepseekMonthlyBudget,
    systemMonthlyBudget: overrides.systemMonthlyBudget ?? env.deepseekSystemMonthlyBudget,
    highCostTokenThreshold: overrides.highCostTokenThreshold ?? env.deepseekHighCostTokenThreshold
  };
}

function sum(where, params = []) {
  return db.prepare(`SELECT COUNT(*) request_count, COALESCE(SUM(total_tokens), 0) total_tokens, COALESCE(SUM(estimated_cost), 0) estimated_cost FROM ai_usage_records WHERE ${where}`).get(...params);
}

function budgetStatus(used, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return 'normal';
  const ratio = used / limit;
  if (ratio >= 1) return 'blocked';
  if (ratio >= 0.9) return 'critical';
  if (ratio >= 0.75) return 'warning';
  return 'normal';
}

function preflight(context = {}, overrides = {}) {
  const limits = configuredLimits(overrides);
  const messages = Array.isArray(context.messages) ? context.messages : [];
  const serialized = JSON.stringify(messages);
  const inputChars = messages.reduce((sumValue, item) => sumValue + String(item?.content || '').length, 0);
  const bodyBytes = Buffer.byteLength(serialized, 'utf8');
  const estimatedInputTokens = estimate(messages);
  const maxOutputTokens = clamp(context.maxOutputTokens || limits.maxOutputTokens, 1, limits.maxOutputTokens);
  if (inputChars > limits.maxInputChars) return { allowed: false, code: 'CONTEXT_TOO_LARGE', status: 'blocked', reason: 'AI 输入超过最大长度限制。' };
  if (bodyBytes > limits.maxRequestBytes) return { allowed: false, code: 'REQUEST_TOO_LARGE', status: 'blocked', reason: 'AI 请求体超过大小限制。' };
  if (estimatedInputTokens + maxOutputTokens > limits.maxContextTokens) return { allowed: false, code: 'CONTEXT_TOKEN_LIMIT', status: 'blocked', reason: 'AI 上下文预计 Token 超过限制。' };
  if (estimatedInputTokens + maxOutputTokens > limits.highCostTokenThreshold && !context.highCostConfirmed) {
    return { allowed: false, code: 'HIGH_COST_CONFIRMATION_REQUIRED', status: 'critical', reason: '本次任务预计消耗较高，需要人工确认。' };
  }
  const day = `${datePrefix(context.now)}%`;
  const month = `${monthPrefix(context.now)}%`;
  const userDaily = sum("user_id = ? AND created_at LIKE ? AND cached = 0 AND request_status NOT IN ('disabled','mock_completed','budget_blocked','circuit_open')", [context.userId, day]);
  const enterpriseDaily = sum('enterprise_id = ? AND created_at LIKE ?', [context.enterpriseId, day]);
  const agentDaily = context.agentId ? sum('agent_id = ? AND enterprise_id = ? AND created_at LIKE ?', [context.agentId, context.enterpriseId, day]) : { total_tokens: 0 };
  const systemDaily = sum('created_at LIKE ?', [day]);
  const enterpriseMonthly = sum('enterprise_id = ? AND created_at LIKE ?', [context.enterpriseId, month]);
  const systemMonthly = sum('created_at LIKE ?', [month]);
  const estimatedCostForRequest = estimateCost({ model: context.model, inputTokens: estimatedInputTokens, outputTokens: maxOutputTokens });
  if (estimatedCostForRequest == null) return { allowed: false, code: 'UNSUPPORTED_MODEL', status: 'blocked', reason: '当前模型未配置受控价格，已阻止调用。', estimatedInputTokens, maxOutputTokens };
  const blocks = [
    [userDaily.request_count >= limits.dailyRequestLimit, 'USER_DAILY_REQUEST_LIMIT', '用户今日 AI 请求次数已达上限。'],
    [enterpriseDaily.request_count >= limits.enterpriseDailyRequestLimit, 'ENTERPRISE_DAILY_REQUEST_LIMIT', '企业今日 AI 请求次数已达上限。'],
    [enterpriseDaily.total_tokens + estimatedInputTokens > limits.enterpriseDailyTokenLimit, 'ENTERPRISE_DAILY_TOKEN_LIMIT', '企业今日 AI Token 已达上限。'],
    [context.agentId && agentDaily.total_tokens + estimatedInputTokens > limits.agentDailyTokenLimit, 'AGENT_DAILY_TOKEN_LIMIT', 'Agent 今日 AI Token 已达上限。'],
    [systemDaily.total_tokens + estimatedInputTokens > limits.systemDailyTokenLimit, 'SYSTEM_DAILY_TOKEN_LIMIT', '系统今日 AI Token 已达上限。'],
    [limits.enterpriseDailyBudget > 0 && enterpriseDaily.estimated_cost + estimatedCostForRequest > limits.enterpriseDailyBudget, 'ENTERPRISE_DAILY_BUDGET', '企业今日 AI 预算已达上限。'],
    [limits.systemDailyBudget > 0 && systemDaily.estimated_cost + estimatedCostForRequest > limits.systemDailyBudget, 'SYSTEM_DAILY_BUDGET', '系统今日 AI 预算已达上限。'],
    [limits.enterpriseMonthlyBudget > 0 && enterpriseMonthly.estimated_cost >= limits.enterpriseMonthlyBudget, 'ENTERPRISE_MONTHLY_BUDGET', '企业月度 AI 预算已达上限。'],
    [limits.systemMonthlyBudget > 0 && systemMonthly.estimated_cost >= limits.systemMonthlyBudget, 'SYSTEM_MONTHLY_BUDGET', '系统月度 AI 预算已达上限。']
  ];
  const blocked = blocks.find(([condition]) => condition);
  const status = budgetStatus(enterpriseMonthly.estimated_cost, limits.enterpriseMonthlyBudget);
  if (blocked) return { allowed: false, code: blocked[1], status: 'blocked', reason: blocked[2], estimatedInputTokens, estimatedCostForRequest, maxOutputTokens };
  return { allowed: true, code: '', status, reason: '', estimatedInputTokens, estimatedCostForRequest, maxOutputTokens, limits };
}

function record(entry = {}) {
  const now = entry.createdAt || new Date().toISOString();
  db.prepare(`INSERT OR REPLACE INTO ai_usage_records (
    id, request_id, enterprise_id, user_id, agent_id, module, provider, model, task_type,
    input_tokens, output_tokens, total_tokens, estimated_cost, duration_ms, cached, retry_count,
    request_status, budget_status, error_signature, redaction_count, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(entry.id || uuidv4(), entry.requestId, entry.enterpriseId, entry.userId, entry.agentId || '', entry.module || 'general', entry.provider || 'deepseek', entry.model || '', entry.taskType || 'chat', clamp(entry.inputTokens), clamp(entry.outputTokens), clamp(entry.totalTokens), clamp(entry.estimatedCost), clamp(entry.durationMs), entry.cached ? 1 : 0, clamp(entry.retryCount), entry.requestStatus || 'failed', entry.budgetStatus || 'normal', entry.errorSignature || '', clamp(entry.redactionCount), now);
}

function grouped(field, where, params) {
  const allowed = new Set(['module', 'agent_id', 'enterprise_id', 'user_id', 'provider', 'model', 'task_type', 'request_status']);
  if (!allowed.has(field)) throw new Error('不支持的统计维度');
  return db.prepare(`SELECT ${field} name, COUNT(*) requestCount, COALESCE(SUM(total_tokens),0) totalTokens, COALESCE(SUM(estimated_cost),0) estimatedCost FROM ai_usage_records WHERE ${where} GROUP BY ${field} ORDER BY totalTokens DESC LIMIT 20`).all(...params);
}

function usage(context = {}, now = new Date()) {
  const day = `${datePrefix(now)}%`;
  const month = `${monthPrefix(now)}%`;
  const tenantWhere = context.enterpriseId ? 'enterprise_id = ? AND ' : '';
  const tenantParams = context.enterpriseId ? [context.enterpriseId] : [];
  const today = sum(`${tenantWhere}created_at LIKE ?`, [...tenantParams, day]);
  const monthly = sum(`${tenantWhere}created_at LIKE ?`, [...tenantParams, month]);
  const detailed = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN created_at LIKE ? THEN input_tokens ELSE 0 END),0) today_input_tokens,
    COALESCE(SUM(CASE WHEN created_at LIKE ? THEN output_tokens ELSE 0 END),0) today_output_tokens,
    COALESCE(SUM(CASE WHEN created_at LIKE ? AND cached = 1 THEN 1 ELSE 0 END),0) cache_hits,
    COALESCE(SUM(CASE WHEN created_at LIKE ? AND request_status = 'failed' THEN 1 ELSE 0 END),0) failures,
    COALESCE(SUM(CASE WHEN created_at LIKE ? AND request_status = 'timeout' THEN 1 ELSE 0 END),0) timeouts,
    COALESCE(SUM(CASE WHEN created_at LIKE ? AND request_status = 'rate_limited' THEN 1 ELSE 0 END),0) rate_limited,
    COALESCE(SUM(CASE WHEN created_at LIKE ? AND request_status = 'circuit_open' THEN 1 ELSE 0 END),0) circuit_open
    ,COALESCE(AVG(CASE WHEN created_at LIKE ? AND request_status IN ('success', 'partial_success') THEN duration_ms END),0) average_duration_ms
    FROM ai_usage_records WHERE ${context.enterpriseId ? 'enterprise_id = ?' : '1=1'}`)
    .get(day, day, day, day, day, day, day, day, ...(context.enterpriseId ? [context.enterpriseId] : []));
  const limits = configuredLimits();
  return {
    today: { requests: today.request_count, inputTokens: detailed.today_input_tokens, outputTokens: detailed.today_output_tokens, totalTokens: today.total_tokens, estimatedCost: today.estimated_cost, cost: costView(today.estimated_cost) },
    month: { requests: monthly.request_count, totalTokens: monthly.total_tokens, estimatedCost: monthly.estimated_cost, cost: costView(monthly.estimated_cost) },
    budget: { status: budgetStatus(monthly.estimated_cost, limits.enterpriseMonthlyBudget), used: monthly.estimated_cost, limit: limits.enterpriseMonthlyBudget, ratio: limits.enterpriseMonthlyBudget > 0 ? Math.min(1, monthly.estimated_cost / limits.enterpriseMonthlyBudget) : 0 },
    cache: { hits: detailed.cache_hits, savedRequests: detailed.cache_hits },
    failures: { failed: detailed.failures, timeout: detailed.timeouts, rateLimited: detailed.rate_limited, circuitOpen: detailed.circuit_open, averageDurationMs: Math.round(Number(detailed.average_duration_ms || 0)) },
    byModule: grouped('module', `${tenantWhere}created_at LIKE ?`, [...tenantParams, month]),
    byAgent: grouped('agent_id', `${tenantWhere}created_at LIKE ? AND agent_id <> ''`, [...tenantParams, month]),
    byUser: grouped('user_id', `${tenantWhere}created_at LIKE ? AND user_id <> ''`, [...tenantParams, month]),
    byProvider: grouped('provider', `${tenantWhere}created_at LIKE ?`, [...tenantParams, month]),
    byModel: grouped('model', `${tenantWhere}created_at LIKE ?`, [...tenantParams, month]),
    byTaskType: grouped('task_type', `${tenantWhere}created_at LIKE ?`, [...tenantParams, month]),
    byStatus: grouped('request_status', `${tenantWhere}created_at LIKE ?`, [...tenantParams, month]),
    byEnterprise: context.isAdmin ? grouped('enterprise_id', 'created_at LIKE ?', [month]) : [],
    highestCost: db.prepare(`SELECT request_id requestId, module, task_type taskType, total_tokens totalTokens, estimated_cost estimatedCost, created_at createdAt FROM ai_usage_records WHERE ${tenantWhere}created_at LIKE ? ORDER BY estimated_cost DESC LIMIT 1`).get(...tenantParams, month) || null
  };
}

function cacheGet(cacheKey, enterpriseId, now = new Date()) {
  const row = db.prepare('SELECT * FROM ai_cache_entries WHERE cache_key = ? AND enterprise_id = ? AND expires_at > ?').get(cacheKey, enterpriseId, now.toISOString());
  if (!row) return null;
  try { return { ...JSON.parse(row.payload), cacheCreatedAt: row.created_at }; } catch { return null; }
}

function cacheSet(entry = {}) {
  const createdAt = entry.createdAt || new Date().toISOString();
  const expiresAt = entry.expiresAt || new Date(Date.parse(createdAt) + env.deepseekCacheTtlSeconds * 1000).toISOString();
  db.prepare(`INSERT OR REPLACE INTO ai_cache_entries (cache_key, enterprise_id, user_scope, module, task_type, provider, model, mode, payload, sensitive, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(entry.cacheKey, entry.enterpriseId, entry.userScope, entry.module, entry.taskType, entry.provider, entry.model, entry.mode, JSON.stringify(entry.payload), entry.sensitive ? 1 : 0, createdAt, expiresAt);
}

function cacheDelete({ enterpriseId, cacheKey = '', sensitiveOnly = false } = {}) {
  if (cacheKey) return db.prepare('DELETE FROM ai_cache_entries WHERE enterprise_id = ? AND cache_key = ?').run(enterpriseId, cacheKey).changes;
  if (sensitiveOnly) return db.prepare('DELETE FROM ai_cache_entries WHERE enterprise_id = ? AND sensitive = 1').run(enterpriseId).changes;
  return db.prepare('DELETE FROM ai_cache_entries WHERE enterprise_id = ?').run(enterpriseId).changes;
}

function resetForTests() {
  db.prepare("DELETE FROM ai_usage_records WHERE request_id LIKE 'test-%'").run();
  db.prepare("DELETE FROM ai_cache_entries WHERE cache_key LIKE 'test-%'").run();
}

module.exports = { PRICING_USD_PER_MILLION, getPrice, estimate, estimateCost, estimateCny, costView, configuredLimits, preflight, record, usage, cacheGet, cacheSet, cacheDelete, resetForTests, budgetStatus };
