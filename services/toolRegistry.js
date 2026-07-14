const path = require('node:path');
const db = require('../database/client');
const logger = require('../logger');
const env = require('../config/env');
const permissionService = require('./permissionService');
const policy = require('./securityPolicyService');

const SAFE_SQL = /^(select|pragma\s+table_info|with)\b/i;
const MAX_TEXT = 120000;
const MAX_ROWS = 5000;
const CIRCUIT_BREAKER = new Map();

function now() {
  return Date.now();
}

function requestId() {
  return logger.requestId('tool');
}

function normalizeText(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function openCircuit(toolName) {
  const state = CIRCUIT_BREAKER.get(toolName) || { failures: 0, openUntil: 0 };
  return state.openUntil > now();
}

function registerFailure(toolName) {
  const state = CIRCUIT_BREAKER.get(toolName) || { failures: 0, openUntil: 0, lastFailureAt: 0, lastFailureType: '' };
  state.failures += 1;
  state.lastFailureAt = now();
  if (state.failures >= 3) state.openUntil = now() + 60 * 1000;
  CIRCUIT_BREAKER.set(toolName, state);
}

function clearFailures(toolName) {
  CIRCUIT_BREAKER.set(toolName, { failures: 0, openUntil: 0, lastFailureAt: 0, lastFailureType: '' });
}

function classifyFailure(value = '') {
  const text = String(value || '');
  if (/TIMEOUT|timeout|超时|AbortError/i.test(text)) return 'timeout';
  if (/NETWORK|fetch|network|ECONN|ENOTFOUND|连接/i.test(text)) return 'network';
  if (/权限不足|unauthorized|401|forbidden|403/i.test(text)) return 'auth';
  if (/参数缺失|类型错误|边界错误|格式不支持|VALIDATION/i.test(text)) return 'validation';
  if (/工具不可用|熔断|circuit/i.test(text)) return 'circuit_open';
  if (/文件过大|输入过大/i.test(text)) return 'input_too_large';
  return text ? 'runtime' : '';
}

function setFailureType(toolName, failureType) {
  const state = CIRCUIT_BREAKER.get(toolName) || { failures: 0, openUntil: 0, lastFailureAt: 0, lastFailureType: '' };
  state.lastFailureType = failureType || state.lastFailureType || '';
  state.lastFailureAt = state.lastFailureAt || now();
  CIRCUIT_BREAKER.set(toolName, state);
}

function circuitState(toolName) {
  const state = CIRCUIT_BREAKER.get(toolName) || { failures: 0, openUntil: 0, lastFailureAt: 0, lastFailureType: '' };
  return {
    state: state.openUntil > now() ? 'open' : state.failures > 0 ? 'half_open' : 'closed',
    failures: Number(state.failures || 0),
    openUntil: Number(state.openUntil || 0),
    lastFailureAt: Number(state.lastFailureAt || 0),
    lastFailureType: state.lastFailureType || ''
  };
}

function validationError(message) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  error.status = 'failed';
  return error;
}

function timeoutError() {
  const error = new Error('执行超时');
  error.code = 'TIMEOUT';
  error.status = 'timeout';
  return error;
}

function ensureRequired(input, required = []) {
  for (const field of required) {
    const value = input[field];
    if (value == null || value === '') throw validationError(`参数缺失：${field}`);
  }
}

function ensureString(input, field, { max = 40000, min = 0 } = {}) {
  if (input[field] == null) return;
  if (typeof input[field] !== 'string') throw validationError(`类型错误：${field} 需要字符串`);
  if (input[field].length < min) throw validationError(`参数缺失：${field}`);
  if (input[field].length > max) throw validationError(`输入过大：${field} 超过 ${max} 个字符`);
}

function ensureNumber(input, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (input[field] == null || input[field] === '') return;
  const num = Number(input[field]);
  if (!Number.isFinite(num)) throw validationError(`类型错误：${field} 需要数字`);
  if (num < min || num > max) throw validationError(`边界错误：${field} 需在 ${min} 到 ${max} 之间`);
}

function ensureArray(input, field, { max = 1000 } = {}) {
  if (input[field] == null) return;
  if (!Array.isArray(input[field])) throw validationError(`类型错误：${field} 需要数组`);
  if (input[field].length > max) throw validationError(`输入过大：${field} 超过 ${max} 项`);
}

function ensureFileName(name = '', allowed = []) {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (!allowed.includes(ext)) throw validationError(`格式不支持：${ext || '未知类型'}`);
}

function ensureSafePath(target = '') {
  const normalized = path.normalize(String(target || ''));
  if (!normalized || normalized.includes('..')) throw validationError('路径安全校验失败');
}

function csvRowsFromText(text = '') {
  return normalizeText(text).split('\n').map(line => line.split(',').map(item => item.trim())).filter(row => row.some(Boolean));
}

function summarizeTable(rows = []) {
  if (!rows.length) return { rowCount: 0, columns: [], numericTotal: 0 };
  const columns = rows[0];
  const numericTotal = rows.slice(1)
    .flatMap(row => row.map(cell => Number(String(cell).replace(/[^\d.-]/g, ''))))
    .filter(Number.isFinite)
    .reduce((sum, num) => sum + num, 0);
  return { rowCount: rows.length - 1, columns, numericTotal: Number(numericTotal.toFixed(2)) };
}

const tools = {
  excel_tool: {
    toolName: 'excel_tool',
    description: '分析 Excel 抽取后的文本或二维数组，输出行数、列名和数值汇总',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, rows: { type: 'array' }, filename: { type: 'string' } } },
    required: ['filename'],
    permissionLevel: 'operator',
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 1, retryOn: ['TIMEOUT', 'NETWORK'] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'filename', { max: 255, min: 1 });
      ensureFileName(input.filename, ['.xlsx', '.xls', '.csv', '.tsv']);
      if (!input.text && !input.rows) throw validationError('参数缺失：text 或 rows 至少提供一个');
      ensureString(input, 'text', { max: MAX_TEXT });
      ensureArray(input, 'rows', { max: MAX_ROWS });
    },
    async execute(input) {
      const rows = Array.isArray(input.rows) && input.rows.length ? input.rows : csvRowsFromText(input.text || '');
      const summary = summarizeTable(rows);
      return {
        ok: true,
        data: {
          rowCount: summary.rowCount,
          columns: summary.columns,
          numericTotal: summary.numericTotal,
          preview: rows.slice(0, 12)
        },
        confidence: 0.86,
        source: summary.rowCount ? 'table' : 'none'
      };
    }
  },
  csv_tool: {
    toolName: 'csv_tool',
    description: '解析 CSV 文本，输出字段摘要和记录数量',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, filename: { type: 'string' } } },
    required: ['text', 'filename'],
    permissionLevel: 'operator',
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 1, retryOn: ['TIMEOUT'] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'text', { max: MAX_TEXT, min: 1 });
      ensureString(input, 'filename', { max: 255, min: 1 });
      ensureFileName(input.filename, ['.csv', '.tsv']);
    },
    async execute(input) {
      const rows = csvRowsFromText(input.text);
      const summary = summarizeTable(rows);
      return {
        ok: true,
        data: {
          rowCount: summary.rowCount,
          columns: summary.columns,
          preview: rows.slice(0, 20)
        },
        confidence: 0.9,
        source: 'csv'
      };
    }
  },
  pdf_tool: {
    toolName: 'pdf_tool',
    description: '对 PDF 抽取文本进行总结和重点提取',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, filename: { type: 'string' } } },
    required: ['text', 'filename'],
    permissionLevel: 'operator',
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 1, retryOn: ['TIMEOUT'] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'text', { max: MAX_TEXT, min: 1 });
      ensureString(input, 'filename', { max: 255, min: 1 });
      ensureFileName(input.filename, ['.pdf']);
    },
    async execute(input) {
      const lines = normalizeText(input.text).split('\n').map(line => line.trim()).filter(Boolean);
      return {
        ok: true,
        data: {
          summary: lines.slice(0, 12).join('\n'),
          keyPoints: lines.filter(line => /客户|金额|数量|交期|风险|建议|条款/.test(line)).slice(0, 10)
        },
        confidence: 0.82,
        source: 'pdf-text'
      };
    }
  },
  ocr_tool: {
    toolName: 'ocr_tool',
    description: '整理 OCR 文本，输出原文、结构化字段与低置信度提示',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, filename: { type: 'string' } } },
    required: ['text'],
    permissionLevel: 'operator',
    timeoutMs: 60000,
    retryPolicy: { maxRetries: 1, retryOn: ['TIMEOUT'] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'text', { max: MAX_TEXT, min: 1 });
      if (input.filename) ensureString(input, 'filename', { max: 255 });
    },
    async execute(input) {
      const text = normalizeText(input.text);
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      const lowConfidence = /�|□|�/.test(text) || lines.filter(line => line.length <= 1).length > Math.max(3, Math.round(lines.length * 0.2));
      const fields = {};
      lines.forEach(line => {
        const match = line.match(/^([^:：]{2,20})[:：]\s*(.+)$/);
        if (match) fields[match[1].trim()] = match[2].trim();
      });
      return {
        ok: true,
        data: {
          original: text,
          structured: fields,
          lowConfidence,
          message: lowConfidence ? '当前 OCR 结果置信度较低，请上传更清晰图片或使用 PDF/Excel 原文件。' : 'OCR 结构化完成'
        },
        confidence: lowConfidence ? 0.45 : 0.78,
        source: 'ocr'
      };
    }
  },
  sqlite_query_tool: {
    toolName: 'sqlite_query_tool',
    description: '执行只读 SQLite 查询，限制为白名单查询',
    inputSchema: { type: 'object', properties: { sql: { type: 'string' } } },
    required: ['sql'],
    permissionLevel: 'viewer',
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 0, retryOn: [] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'sql', { max: 5000, min: 1 });
      const sql = normalizeText(input.sql);
      if (!SAFE_SQL.test(sql)) throw validationError('权限不足：仅允许只读 SQL 查询');
      if (/[;].+\S/.test(sql)) throw validationError('格式不支持：不允许多语句查询');
    },
    async execute(input) {
      const rows = db.prepare(input.sql).all();
      return {
        ok: true,
        data: {
          rowCount: rows.length,
          rows: rows.slice(0, 100)
        },
        confidence: 0.93,
        source: 'sqlite'
      };
    }
  },
  file_generate_tool: {
    toolName: 'file_generate_tool',
    description: '生成文本文件内容，属于高风险写文件工具',
    inputSchema: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' } } },
    required: ['filename', 'content'],
    permissionLevel: 'admin',
    highRisk: true,
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 0, retryOn: [] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'filename', { max: 255, min: 1 });
      ensureString(input, 'content', { max: MAX_TEXT, min: 1 });
      ensureSafePath(input.filename);
    },
    async execute(input) {
      return {
        ok: true,
        data: {
          filename: input.filename,
          preview: normalizeText(input.content).slice(0, 500),
          generated: true
        },
        confidence: 0.74,
        source: 'generator'
      };
    }
  },
  web_api_tool: {
    toolName: 'web_api_tool',
    description: '调用外部 Web/API，只允许 GET，属于高风险外部访问工具',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
    required: ['url'],
    permissionLevel: 'admin',
    highRisk: true,
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 1, retryOn: ['NETWORK', 'TIMEOUT'] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'url', { max: 2048, min: 8 });
      if (!/^https?:\/\//i.test(input.url)) throw validationError('格式不支持：仅允许 http/https 地址');
    },
    async execute(input) {
      const response = await fetch(input.url, { method: 'GET', signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      return {
        ok: response.ok,
        data: {
          httpStatus: response.status,
          preview: text.slice(0, 800)
        },
        confidence: response.ok ? 0.7 : 0.2,
        source: 'web'
      };
    }
  },
  human_approval_tool: {
    toolName: 'human_approval_tool',
    description: '生成人工审批请求，用于高风险动作的断点控制',
    inputSchema: { type: 'object', properties: { actionLabel: { type: 'string' }, reason: { type: 'string' } } },
    required: ['actionLabel'],
    permissionLevel: 'operator',
    highRisk: true,
    timeoutMs: 10000,
    retryPolicy: { maxRetries: 0, retryOn: [] },
    validate(input) {
      ensureRequired(input, this.required);
      ensureString(input, 'actionLabel', { max: 200, min: 1 });
      ensureString(input, 'reason', { max: 2000 });
    },
    async execute(input) {
      return {
        ok: true,
        data: {
          actionLabel: input.actionLabel,
          reason: input.reason || '高风险动作需要人工审批'
        },
        confidence: 0.99,
        source: 'approval'
      };
    }
  }
};

function mapRole(role = '') {
  const text = String(role || '').toLowerCase();
  if (/admin|企业管理员|管理员/.test(text)) return 'admin';
  if (/viewer|只读|访客/.test(text)) return 'viewer';
  return 'operator';
}

function checkPermission(tool, role = 'viewer') {
  return permissionService.authorizeTool(tool, { role });
}

async function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(timeoutError()), timeoutMs);
    })
  ]);
}

async function executeTool(toolName, input = {}, context = {}) {
  const tool = tools[toolName];
  const reqId = context.requestId || requestId();
  const startedAt = now();
  if (!tool) {
    return {
      ok: false,
      data: null,
      error: '工具不可用',
      requestId: reqId,
      toolName,
      durationMs: 0,
      failureType: 'tool_missing',
      circuitState: 'missing',
      status: 'failed',
      retryCount: 0
    };
  }
  if (openCircuit(toolName)) {
    const circuit = circuitState(toolName);
    return {
      ok: false,
      data: null,
      error: '工具不可用：该工具连续失败，当前已进入熔断保护',
      requestId: reqId,
      toolName,
      durationMs: 0,
      failureType: 'circuit_open',
      circuitState: circuit.state,
      circuit,
      status: 'failed',
      retryCount: 0
    };
  }
  let retryCount = 0;
  const maxRetries = Number(tool.retryPolicy?.maxRetries || 0);
  try {
    tool.validate?.(input);
    checkPermission(tool, context.role);
    if (policy.isHighRisk(toolName) && context.requireApproval !== false) {
      return {
        ok: true,
        data: { approvalRequired: true, actionLabel: context.actionLabel || tool.description },
        error: '',
        requestId: reqId,
        toolName,
        durationMs: now() - startedAt,
        failureType: '',
        circuitState: circuitState(toolName).state,
        circuit: circuitState(toolName),
        status: 'waiting_human',
        retryCount: 0
      };
    }
    for (;;) {
      try {
        const result = await withTimeout(Promise.resolve(tool.execute(input, context)), Number(tool.timeoutMs || 30000));
        clearFailures(toolName);
        logger.info('Tool 执行完成', {
          requestId: reqId,
          module: context.module || 'agent-runtime',
          action: 'tool_execute',
          toolName,
          provider: '',
          model: '',
          success: true,
          httpStatus: 200,
          latencyMs: now() - startedAt,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        });
        return {
          ok: Boolean(result?.ok),
          data: result?.data ?? null,
          error: result?.ok ? '' : (result?.error || '工具执行失败'),
          requestId: reqId,
          toolName,
          durationMs: now() - startedAt,
          failureType: '',
          circuitState: circuitState(toolName).state,
          circuit: circuitState(toolName),
          status: result?.ok ? 'success' : 'failed',
          retryCount,
          confidence: Number(result?.confidence || 0),
          source: result?.source || 'tool'
        };
      } catch (error) {
        const code = error.code || '';
        const retryable = code === 'TIMEOUT' || code === 'NETWORK';
        if (retryable && retryCount < maxRetries) {
          retryCount += 1;
          continue;
        }
        registerFailure(toolName);
        const failureType = classifyFailure(error.message || error.code || '');
        setFailureType(toolName, failureType);
        logger.error('Tool 执行失败', {
          requestId: reqId,
          module: context.module || 'agent-runtime',
          action: 'tool_execute',
          toolName,
          success: false,
          httpStatus: 500,
          latencyMs: now() - startedAt,
          errorMessage: error.message,
          rawError: safeJson({ code: error.code || '', message: error.message || '' })
        });
        return {
          ok: false,
          data: null,
          error: error.message || '工具执行失败',
          requestId: reqId,
          toolName,
          durationMs: now() - startedAt,
          failureType,
          circuitState: circuitState(toolName).state,
          circuit: circuitState(toolName),
          status: error.status || 'failed',
          retryCount
        };
      }
    }
  } catch (error) {
    registerFailure(toolName);
    const failureType = classifyFailure(error.message || error.code || '');
    setFailureType(toolName, failureType);
    return {
      ok: false,
      data: null,
      error: error.message || '工具执行失败',
      requestId: reqId,
      toolName,
      durationMs: now() - startedAt,
      failureType,
      circuitState: circuitState(toolName).state,
      circuit: circuitState(toolName),
      status: error.status || 'failed',
      retryCount
    };
  }
}

function listTools() {
  return Object.values(tools).map(tool => ({
    toolName: tool.toolName,
    description: tool.description,
    inputSchema: tool.inputSchema,
    required: tool.required || [],
    permissionLevel: tool.permissionLevel || 'viewer',
    timeoutMs: tool.timeoutMs || 30000,
    retryPolicy: tool.retryPolicy || { maxRetries: 0, retryOn: [] },
    highRisk: Boolean(tool.highRisk),
    circuit: circuitState(tool.toolName),
    circuitState: circuitState(tool.toolName).state,
    lastFailureAt: circuitState(tool.toolName).lastFailureAt,
    lastFailureType: circuitState(tool.toolName).lastFailureType
  }));
}

function detectTool(prompt = '') {
  const text = normalizeText(prompt);
  if (!text) return null;
  if (/excel|xlsx|表格|汇总|统计/i.test(text)) return 'excel_tool';
  if (/csv/i.test(text)) return 'csv_tool';
  if (/pdf|文档总结|提取pdf/i.test(text)) return 'pdf_tool';
  if (/ocr|识别图片|发货单|扫描件|采购单/i.test(text)) return 'ocr_tool';
  if (/sql|查询数据库|sqlite/i.test(text)) return 'sqlite_query_tool';
  if (/生成文件|导出文件|写文件/i.test(text)) return 'file_generate_tool';
  if (/接口|调用api|webhook|http/i.test(text)) return 'web_api_tool';
  if (/审批|人工确认|批准|拒绝/i.test(text)) return 'human_approval_tool';
  return null;
}

function maybeRunTool(messages = [], module = 'general') {
  const prompt = messages.map(item => `${item.role || 'user'}：${item.content || ''}`).join('\n');
  const toolName = detectTool(prompt);
  if (!toolName) return null;
  const inputMap = {
    excel_tool: { text: prompt, filename: `${module}.xlsx` },
    csv_tool: { text: prompt, filename: `${module}.csv` },
    pdf_tool: { text: prompt, filename: `${module}.pdf` },
    ocr_tool: { text: prompt, filename: `${module}.png` },
    sqlite_query_tool: { sql: 'SELECT name FROM sqlite_master WHERE type = "table"' },
    file_generate_tool: { filename: `${module}.txt`, content: prompt },
    web_api_tool: { url: 'https://example.com' },
    human_approval_tool: { actionLabel: prompt.slice(0, 120), reason: '检测到高风险动作' }
  };
  const resultPromise = executeTool(toolName, inputMap[toolName] || { text: prompt }, { module, role: 'admin' });
  return resultPromise;
}

module.exports = {
  tools,
  listTools,
  executeTool,
  detectTool,
  maybeRunTool,
  mapRole,
  classifyFailure,
  circuitState
};
