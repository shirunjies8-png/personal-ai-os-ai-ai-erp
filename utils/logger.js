const fs = require('node:fs');
const path = require('node:path');
const env = require('../config/env');

fs.mkdirSync(env.logsDir, { recursive: true });

function writeLog(level, message, meta = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...meta
  });
  fs.appendFileSync(path.join(env.logsDir, 'app.log'), `${line}\n`, 'utf8');
}

module.exports = {
  info(message, meta) {
    writeLog('info', message, meta);
  },
  error(message, meta) {
    writeLog('error', message, meta);
  }
};
