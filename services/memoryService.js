const { v4: uuidv4 } = require('uuid');
const memoryModel = require('../models/memoryModel');

function sanitizePayload(payload = {}) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  const walk = value => {
    if (!value || typeof value !== 'object') return value;
    for (const key of Object.keys(value)) {
      if (/api[_-]?key|token|secret|password/i.test(key)) value[key] = '';
      else if (typeof value[key] === 'string' && value[key].length > 4000) value[key] = value[key].slice(0, 4000);
      else walk(value[key]);
    }
    return value;
  };
  return walk(clone);
}

function remember({ enterpriseId, userId, type, key, payload }) {
  memoryModel.upsert({
    id: `${enterpriseId}:${userId}:${type}:${key}`,
    enterprise_id: enterpriseId,
    user_id: userId,
    memory_type: type,
    memory_key: key,
    payload: sanitizePayload(payload),
    created_at: new Date().toISOString()
  });
}

function list(enterpriseId) {
  return memoryModel.listByEnterprise(enterpriseId, 100);
}

function clear(enterpriseId, type = '') {
  memoryModel.removeByEnterprise(enterpriseId, type);
}

module.exports = {
  remember,
  list,
  clear
};
