const path = require('node:path');
const dotenv = require('dotenv');

// Isolated verification must never inherit a developer's database, port or
// credentials from local dotenv files. Production and normal local startup
// keep their existing dotenv behavior; the opt-in flag is only for hermetic
// test processes that provide their complete environment explicitly.
if (process.env.AI_OFFICE_SKIP_ENV_FILES !== '1') {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });
}

function normalizeDeepSeekKey(value) {
  const text = String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!text) return '';
  if (/^这里填写我的DeepSeekKey$/i.test(text)) return '';
  if (/^your[_\-\s]?key$/i.test(text)) return '';
  return text;
}

function normalizeEnvText(value, fallback = '') {
  const text = String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  return text || fallback;
}

function normalizeDeepSeekModel(value) {
  const text = normalizeEnvText(value, 'deepseek-v4-flash');
  if (/^deepseek-chat$/i.test(text) || /^deepseek-reasoner$/i.test(text)) return 'deepseek-v4-flash';
  return text || 'deepseek-v4-flash';
}

function numberEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://127.0.0.1:3000',
  corsAllowedOrigins: normalizeEnvText(process.env.CORS_ALLOWED_ORIGINS, process.env.APP_URL || 'http://127.0.0.1:3000').split(',').map(value => value.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'database', 'personal-ai-os.sqlite3'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
  logsDir: process.env.LOGS_DIR || path.join(process.cwd(), 'logs'),
  backupsDir: process.env.BACKUPS_DIR || path.join(process.cwd(), 'backups'),
  deepseekBaseUrl: normalizeEnvText(process.env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com'),
  deepseekApiKey: normalizeDeepSeekKey(process.env.DEEPSEEK_API_KEY),
  deepseekModel: normalizeDeepSeekModel(process.env.DEEPSEEK_MODEL),
  deepseekTimeoutMs: numberEnv('DEEPSEEK_TIMEOUT_MS', 60000, { min: 1000, max: 120000 }),
  deepseekMaxOutputTokens: numberEnv('DEEPSEEK_MAX_OUTPUT_TOKENS', 1500, { min: 1, max: 12000 }),
  deepseekMaxRetries: numberEnv('DEEPSEEK_MAX_RETRIES', 1, { min: 0, max: 1 }),
  deepseekDailyRequestLimit: numberEnv('DEEPSEEK_DAILY_REQUEST_LIMIT', 100, { min: 1 }),
  deepseekEnterpriseDailyRequestLimit: numberEnv('DEEPSEEK_ENTERPRISE_DAILY_REQUEST_LIMIT', 1000, { min: 1 }),
  deepseekDailyTokenLimit: numberEnv('DEEPSEEK_DAILY_TOKEN_LIMIT', 200000, { min: 1 }),
  deepseekDailyBudget: numberEnv('DEEPSEEK_DAILY_BUDGET', 10, { min: 0 }),
  deepseekMonthlyBudget: numberEnv('DEEPSEEK_MONTHLY_BUDGET', 50, { min: 0 }),
  deepseekSystemDailyTokenLimit: numberEnv('DEEPSEEK_SYSTEM_DAILY_TOKEN_LIMIT', 1000000, { min: 1 }),
  deepseekSystemDailyBudget: numberEnv('DEEPSEEK_SYSTEM_DAILY_BUDGET', 100, { min: 0 }),
  deepseekSystemMonthlyBudget: numberEnv('DEEPSEEK_SYSTEM_MONTHLY_BUDGET', 250, { min: 0 }),
  deepseekAgentDailyTokenLimit: numberEnv('DEEPSEEK_AGENT_DAILY_TOKEN_LIMIT', 100000, { min: 1 }),
  deepseekMaxInputChars: numberEnv('DEEPSEEK_MAX_INPUT_CHARS', 120000, { min: 1000 }),
  deepseekMaxContextTokens: numberEnv('DEEPSEEK_MAX_CONTEXT_TOKENS', 64000, { min: 1000 }),
  deepseekMaxRequestBytes: numberEnv('DEEPSEEK_MAX_REQUEST_BYTES', 1048576, { min: 4096 }),
  deepseekHighCostTokenThreshold: numberEnv('DEEPSEEK_HIGH_COST_TOKEN_THRESHOLD', 12000, { min: 1000 }),
  deepseekCacheTtlSeconds: numberEnv('DEEPSEEK_CACHE_TTL_SECONDS', 86400, { min: 0 }),
  deepseekCircuitFailureThreshold: numberEnv('DEEPSEEK_CIRCUIT_FAILURE_THRESHOLD', 3, { min: 1, max: 20 }),
  deepseekCircuitCooldownMs: numberEnv('DEEPSEEK_CIRCUIT_COOLDOWN_MS', 60000, { min: 1000, max: 3600000 }),
  aiIpRateLimit: numberEnv('AI_IP_RATE_LIMIT', 120, { min: 1, max: 10000 }),
  aiUsdToCnyRate: numberEnv('AI_USD_TO_CNY_RATE', 0, { min: 0, max: 100 }),
  aiUsdToCnyUpdatedAt: normalizeEnvText(process.env.AI_USD_TO_CNY_UPDATED_AT),
  capabilityAi: process.env.CAPABILITY_AI,
  capabilityAgents: process.env.CAPABILITY_AGENTS,
  capabilitySkills: process.env.CAPABILITY_SKILLS,
  capabilityWorkflows: process.env.CAPABILITY_WORKFLOWS,
  capabilityExternalNetwork: process.env.CAPABILITY_EXTERNAL_NETWORK,
  capabilityFileGeneration: process.env.CAPABILITY_FILE_GENERATION,
  mailAgentBaseUrl: process.env.MAIL_AGENT_BASE_URL || '',
  mailAgentApiKey: process.env.MAIL_AGENT_API_KEY || '',
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@personal-ai-os.local',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || '123456',
  defaultEnterpriseName: process.env.DEFAULT_ENTERPRISE_NAME || 'Personal AI OS Demo Enterprise'
};
