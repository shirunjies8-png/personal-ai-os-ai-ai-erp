import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gateway = require('../services/aiGateway');
const costs = require('../services/costControlService');
const redaction = require('../services/aiRedactionService');
const db = require('../database/init');

const tenant = 'ai-test-tenant';
const otherTenant = 'ai-test-other';
costs.cacheDelete({ enterpriseId: tenant });
costs.cacheDelete({ enterpriseId: otherTenant });
db.prepare("DELETE FROM ai_usage_records WHERE request_id LIKE 'test-ai-%'").run();
gateway.resetCircuitForTests();

const base = (suffix, extra = {}) => ({
  requestId: `test-ai-${suffix}`, enterpriseId: tenant, userId: 'test-user', role: 'admin',
  agentId: 'agent-runtime', module: 'ocr', taskType: 'correct', promptVersion: 'test-v1',
  messages: [{ role: 'user', content: `测试任务 ${suffix}` }], maxTokens: 100, forceRegenerate: true,
  ...extra
});
const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) });
const successFetch = async () => jsonResponse({ choices: [{ message: { content: '仅为测试响应' }, finish_reason: 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18, prompt_cache_hit_tokens: 0 } });

assert.deepEqual(costs.PRICING_USD_PER_MILLION['deepseek-v4-flash'], {
  currency: 'USD', inputCacheHitPerMillionUsd: 0.0028, inputCacheMissPerMillionUsd: 0.14, outputPerMillionUsd: 0.28
});
assert.equal(costs.estimateCost({ model: 'unsupported-model', inputTokens: 1, outputTokens: 1 }), null);

const disabled = await gateway.chat(base('disabled'), { apiKey: '' });
assert.equal(disabled.status, 'disabled');
assert.equal(disabled.content, '');
assert.match(disabled.errors[0], /未配置真实 DeepSeek/);

const unsupportedModel = costs.preflight({ enterpriseId: tenant, userId: 'test-user', model: 'unsupported-model', messages: [{ role: 'user', content: 'test' }], maxOutputTokens: 10 });
assert.equal(unsupportedModel.allowed, false);
assert.equal(unsupportedModel.code, 'UNSUPPORTED_MODEL');

const mock = await gateway.chat(base('mock', { demoMode: true, provider: 'mock' }), { apiKey: '' });
assert.equal(mock.status, 'mock_completed');
assert.match(mock.content, /Mock 演示数据/);
assert.equal(mock.estimatedCost, 0);

let capturedRequest;
const live = await gateway.chat(base('live', { messages: [{ role: 'user', content: '客户姓名：张三 手机号 13812345678 邮箱 user@example.com' }] }), {
  apiKey: 'test-only-key', fetchImpl: async (_url, options) => { capturedRequest = JSON.parse(options.body); return successFetch(); }
});
assert.equal(live.status, 'success');
assert.equal(live.inputTokens, 11);
assert.equal(live.outputTokens, 7);
assert.ok(live.estimatedCost > 0);
assert.doesNotMatch(JSON.stringify(capturedRequest), /张三|13812345678|user@example\.com/);
assert.match(JSON.stringify(capturedRequest), /REDACTED_CUSTOMER_NAME|REDACTED_PHONE|REDACTED_EMAIL/);

const protectedData = redaction.protectMessages([{ role: 'user', content: 'Authorization: Bearer secret-123456789\n客户企业：真实客户有限公司\n设备编号：EQ-001\n/Users/demo/private/a.txt' }]);
assert.equal(protectedData.total >= 4, true);
assert.doesNotMatch(JSON.stringify(protectedData.messages), /secret-123456789|真实客户有限公司|\/Users\/demo/);
assert.throws(() => redaction.protectMessages([{ role: 'user', content: '手机号 13812345678' }], { mode: 'block' }), /敏感内容/);
assert.throws(() => redaction.protectMessages([{ role: 'user', content: '普通内容' }], { mode: 'raw_confirmed' }), /明确确认/);

const empty = await gateway.chat(base('empty'), { apiKey: 'test', fetchImpl: async () => jsonResponse({ choices: [{ message: { content: '' } }] }), maxRetries: 0 });
assert.equal(empty.status, 'empty_response');
assert.equal(empty.content, '');

const invalid = await gateway.chat(base('invalid'), { apiKey: 'test', fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'text/plain' }, text: async () => 'not-json Authorization: Bearer secret-value' }), maxRetries: 0 });
assert.equal(invalid.status, 'failed');
assert.doesNotMatch(JSON.stringify(invalid), /secret-value/);

const auth = await gateway.chat(base('auth'), { apiKey: 'test', fetchImpl: async () => jsonResponse({ error: { message: 'invalid api key secret-value' } }, 401), maxRetries: 0 });
assert.equal(auth.status, 'failed');
assert.match(auth.errors[0], /认证失败/);
assert.doesNotMatch(JSON.stringify(auth), /secret-value/);

const rate = await gateway.chat(base('rate'), { apiKey: 'test', fetchImpl: async () => jsonResponse({ error: { message: 'rate limit' } }, 429), maxRetries: 0 });
assert.equal(rate.status, 'rate_limited');

const timeoutError = Object.assign(new Error('request timeout'), { name: 'AbortError' });
const timeout = await gateway.chat(base('timeout'), { apiKey: 'test', fetchImpl: async () => { throw timeoutError; }, maxRetries: 0 });
assert.equal(timeout.status, 'timeout');

gateway.resetCircuitForTests();
let retryCalls = 0;
const retried = await gateway.chat(base('retry'), { apiKey: 'test', fetchImpl: async () => { retryCalls += 1; return retryCalls === 1 ? jsonResponse({ error: { message: 'temporary unavailable' } }, 503) : successFetch(); }, maxRetries: 1, retryDelayMs: 0 });
assert.equal(retried.status, 'success');
assert.equal(retried.retryCount, 1);
assert.equal(retryCalls, 2);

gateway.resetCircuitForTests();
for (let index = 0; index < 3; index += 1) {
  await gateway.chat(base(`circuit-${index}`), { apiKey: 'test', fetchImpl: async () => { throw new Error('network failure'); }, maxRetries: 0 });
}
const circuitOpen = await gateway.chat(base('circuit-open'), { apiKey: 'test', fetchImpl: successFetch, maxRetries: 0 });
assert.equal(circuitOpen.status, 'circuit_open');
gateway._circuit.openedAt = Date.now() - 120000;
const recovered = await gateway.chat(base('circuit-recovered'), { apiKey: 'test', fetchImpl: successFetch, maxRetries: 0 });
assert.equal(recovered.status, 'success');
assert.equal(gateway._circuit.state, 'closed');

const limited = await gateway.chat(base('budget', { highCostConfirmed: false }), { apiKey: 'test', fetchImpl: successFetch, limits: { highCostTokenThreshold: 1 } });
assert.equal(limited.status, 'budget_blocked');
assert.equal(limited.budgetStatus, 'blocked');

const contextLimited = await gateway.chat(base('context-limit'), { apiKey: 'test', fetchImpl: successFetch, limits: { maxContextTokens: 2 } });
assert.equal(contextLimited.status, 'budget_blocked');
assert.match(contextLimited.errors[0], /上下文/);

gateway.resetCircuitForTests();
let cacheCalls = 0;
const cacheInput = base('cache-first', { forceRegenerate: false, messages: [{ role: 'user', content: '唯一缓存测试内容' }] });
const firstCache = await gateway.chat(cacheInput, { apiKey: 'test', fetchImpl: async () => { cacheCalls += 1; return successFetch(); } });
const secondCache = await gateway.chat({ ...cacheInput, requestId: 'test-ai-cache-second' }, { apiKey: 'test', fetchImpl: async () => { cacheCalls += 1; return successFetch(); } });
assert.equal(firstCache.cached, false);
assert.equal(secondCache.cached, true);
assert.equal(cacheCalls, 1);
const otherCache = await gateway.chat({ ...cacheInput, requestId: 'test-ai-cache-other', enterpriseId: otherTenant }, { apiKey: 'test', fetchImpl: async () => { cacheCalls += 1; return successFetch(); } });
assert.equal(otherCache.cached, false);
assert.equal(cacheCalls, 2);

const usage = costs.usage({ enterpriseId: tenant, isAdmin: true });
assert.ok(usage.today.requests > 0);
assert.ok(usage.today.inputTokens >= 11);
assert.ok(usage.byModule.some(item => item.name === 'ocr'));
assert.ok(usage.byAgent.some(item => item.name === 'agent-runtime'));
assert.ok(usage.byUser.some(item => item.name === 'test-user'));
assert.ok(usage.byProvider.some(item => item.name === 'deepseek'));
assert.ok(usage.byModel.some(item => item.name === 'deepseek-v4-flash'));
assert.ok(usage.byTaskType.some(item => item.name === 'correct'));
assert.ok(usage.byStatus.some(item => item.name === 'success'));
assert.ok(usage.byEnterprise.some(item => item.name === tenant));
assert.ok(usage.cache.hits >= 1);
assert.equal(usage.budget.ratio >= 0 && usage.budget.ratio <= 1, true);

const safe = gateway.getStatus({ enterpriseId: tenant });
const safeJson = JSON.stringify(safe);
assert.doesNotMatch(safeJson, /apiKey|Authorization|\/Users\//i);
assert.equal(typeof safe.timeoutMs, 'number');
assert.equal(typeof safe.maxOutputTokens, 'number');
assert.equal(typeof safe.maxContextTokens, 'number');

const frontend = ['core.js', 'app.js', 'ui.js', 'index.html', 'config.js'].map(file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
assert.doesNotMatch(frontend, /id=["']apiKey["']|DEEPSEEK_API_KEY\s*=\s*[^\s<"']+/i);
assert.match(frontend, /GitHub Pages 静态安全模式/);
assert.match(frontend, /\/api\/ai\/chat/);
assert.equal(frontend.includes('https://api.deepseek.com/v1/chat/completions'), false);
assert.match(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), /aiSuggestionMeta/);
assert.match(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), /allowMockFallback: false/);
const legacyPythonProxy = fs.readFileSync(new URL('../server.py', import.meta.url), 'utf8');
assert.doesNotMatch(legacyPythonProxy, /OPENAI_API_KEY|api\.openai\.com/);
assert.match(legacyPythonProxy, /Legacy AI proxy is disabled/);
const indexRoutes = fs.readFileSync(new URL('../routes/index.js', import.meta.url), 'utf8');
assert.match(indexRoutes, /requireAuthenticatedAi/);

const { signToken } = require('../utils/jwt');
const { authRequired } = require('../middleware/auth');
const aiController = require('../controllers/aiController');
const apiTenant = 'ai-test-api-tenant';
const apiUser = 'ai-test-api-user';
const now = new Date().toISOString();
db.prepare('DELETE FROM users WHERE id = ?').run(apiUser);
db.prepare('DELETE FROM enterprises WHERE id = ?').run(apiTenant);
db.prepare('INSERT INTO enterprises (id,name,logo_url,contact_name,contact_phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(apiTenant, 'AI Test', '', '', '', now, now);
db.prepare('INSERT INTO users (id,enterprise_id,email,password_hash,name,role,status,department,team,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(apiUser, apiTenant, 'ai-test-api@example.invalid', 'not-used', 'AI Test Admin', '企业管理员', '启用', '', '', now, now);
const token = signToken({ userId: apiUser, enterpriseId: apiTenant, role: '企业管理员' });
const responseMock = () => ({ statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } });
const noAuthRes = responseMock();
authRequired({ headers: {} }, noAuthRes, () => assert.fail('Unauthenticated request must not continue'));
assert.equal(noAuthRes.statusCode, 401);
const authReq = { headers: { authorization: `Bearer ${token}` } };
let authPassed = false;
authRequired(authReq, responseMock(), () => { authPassed = true; });
assert.equal(authPassed, true);
const safeRes = responseMock();
aiController.configSafe({ user: authReq.user }, safeRes);
const safePayload = safeRes.payload;
assert.equal(safeRes.statusCode, 200);
assert.equal(safePayload.ok, true);
assert.doesNotMatch(JSON.stringify(safePayload), /apiKey|Authorization|\/Users\//i);
const apiMockRes = responseMock();
await aiController.execute('correct')({ user: authReq.user, body: { demoMode: true, module: 'ocr', messages: [{ role: 'user', content: '测试 OCR 建议' }] } }, apiMockRes, error => { throw error; });
const apiMock = apiMockRes.payload;
assert.equal(apiMock.status, 'mock_completed');
assert.match(apiMock.content, /非真实 DeepSeek/);
db.prepare('DELETE FROM ai_usage_records WHERE enterprise_id = ?').run(apiTenant);
db.prepare('DELETE FROM logs WHERE enterprise_id = ?').run(apiTenant);
db.prepare('DELETE FROM users WHERE id = ?').run(apiUser);
db.prepare('DELETE FROM enterprises WHERE id = ?').run(apiTenant);

costs.cacheDelete({ enterpriseId: tenant });
costs.cacheDelete({ enterpriseId: otherTenant });
db.prepare("DELETE FROM ai_usage_records WHERE request_id LIKE 'test-ai-%'").run();
gateway.resetCircuitForTests();
console.log('AI gateway tests passed');
