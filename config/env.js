const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });

function normalizeDeepSeekKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^这里填写我的DeepSeekKey$/i.test(text)) return '';
  if (/^your[_\-\s]?key$/i.test(text)) return '';
  return text;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://127.0.0.1:3000',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'database', 'personal-ai-os.sqlite3'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
  logsDir: process.env.LOGS_DIR || path.join(process.cwd(), 'logs'),
  backupsDir: process.env.BACKUPS_DIR || path.join(process.cwd(), 'backups'),
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  deepseekApiKey: normalizeDeepSeekKey(process.env.DEEPSEEK_API_KEY),
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
  mailAgentBaseUrl: process.env.MAIL_AGENT_BASE_URL || '',
  mailAgentApiKey: process.env.MAIL_AGENT_API_KEY || '',
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@personal-ai-os.local',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || '123456',
  defaultEnterpriseName: process.env.DEFAULT_ENTERPRISE_NAME || 'Personal AI OS Demo Enterprise'
};
