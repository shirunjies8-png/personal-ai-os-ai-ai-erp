const env = require('../config/env');

const RANK = Object.freeze({ viewer: 1, operator: 2, admin: 3 });
const HIGH_RISK_ACTIONS = new Set(['file_generate_tool', 'web_api_tool', 'human_approval_tool', '8d_closure']);

function bool(value, fallback = true) {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function normalizeRole(role = '') {
  const text = String(role).toLowerCase();
  if (/admin|企业管理员|管理员/.test(text)) return 'admin';
  if (/operator|操作员|业务员/.test(text)) return 'operator';
  return 'viewer';
}

function flags() {
  return {
    ai: bool(process.env.CAPABILITY_AI ?? env.capabilityAi, true),
    agents: bool(process.env.CAPABILITY_AGENTS ?? env.capabilityAgents, true),
    skills: bool(process.env.CAPABILITY_SKILLS ?? env.capabilitySkills, true),
    workflows: bool(process.env.CAPABILITY_WORKFLOWS ?? env.capabilityWorkflows, true),
    externalNetwork: bool(process.env.CAPABILITY_EXTERNAL_NETWORK ?? env.capabilityExternalNetwork, false),
    fileGeneration: bool(process.env.CAPABILITY_FILE_GENERATION ?? env.capabilityFileGeneration, false)
  };
}

function requireCapability(name) {
  if (!flags()[name]) {
    const error = new Error(`能力未启用：${name}`);
    error.code = 'CAPABILITY_DISABLED';
    error.status = 403;
    throw error;
  }
}

function requireRole(actual, required = 'viewer') {
  if ((RANK[normalizeRole(actual)] || 0) < (RANK[normalizeRole(required)] || 0)) {
    const error = new Error('权限不足');
    error.code = 'FORBIDDEN';
    error.status = 403;
    throw error;
  }
}

function isHighRisk(action) {
  return HIGH_RISK_ACTIONS.has(String(action || ''));
}

module.exports = { RANK, flags, normalizeRole, requireCapability, requireRole, isHighRisk };
