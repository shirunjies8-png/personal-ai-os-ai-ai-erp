const fs = require('node:fs');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

fs.mkdirSync(env.logsDir, { recursive: true });

const SENSITIVE_KEY = /api[-_]?key|authorization|password|token|secret|cookie|credential|session|private.?key/i;

function sanitize(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[已脱敏]';
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [已脱敏]')
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[已脱敏]')
      .replace(/([?&](?:api[-_]?key|token|secret|password)=)[^&\s]+/gi, '$1[已脱敏]')
      .replace(/\b[A-Za-z0-9+/_-]{32,}\.[A-Za-z0-9+/_-]{8,}\.[A-Za-z0-9+/_-]{16,}\b/g, '[JWT已脱敏]');
  }
  if (Array.isArray(value)) return value.map(item => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

function writeLog(level, message, meta = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    requestId: meta.requestId || uuidv4(),
    level,
    message: sanitize(message),
    ...sanitize(meta)
  });
  fs.appendFileSync(path.join(env.logsDir, 'app.log'), `${line}\n`, 'utf8');
}

function readLines(limit = 500) {
  const file = path.join(env.logsDir, 'app.log');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-Math.max(1, limit))
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function recentAiStats(limit = 500) {
  const logs = readLines(limit).filter(item => item.requestId && (item.module || item.action || /ai/i.test(item.message || '')));
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter(item => String(item.time || '').startsWith(today));
  const failed = todayLogs.filter(item => item.level === 'error' || item.success === false);
  const avgLatency = todayLogs.length
    ? Math.round(todayLogs.reduce((sum, item) => sum + Number(item.latencyMs || item.duration || 0), 0) / todayLogs.length)
    : 0;
  return {
    todayCount: todayLogs.length,
    todayFailedCount: failed.length,
    lastError: [...logs].reverse().find(item => item.level === 'error' || item.success === false) || null,
    avgLatency,
    latest: [...logs].reverse().find(item => item.module || item.action) || null
  };
}

module.exports = {
  info(message, meta) {
    writeLog('info', message, meta);
  },
  error(message, meta) {
    writeLog('error', message, meta);
  },
  sanitize,
  writeLog,
  readLines,
  recentAiStats,
  requestId(prefix = 'req') {
    return `${prefix}-${uuidv4().slice(0, 8)}`;
  }
};
