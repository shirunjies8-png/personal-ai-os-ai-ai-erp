const policy = require('./securityPolicyService');

function authorizeTool(tool, context = {}) {
  policy.requireCapability('skills');
  policy.requireRole(context.role, tool.permissionLevel || 'viewer');
  if (tool.toolName === 'web_api_tool') policy.requireCapability('externalNetwork');
  if (tool.toolName === 'file_generate_tool') policy.requireCapability('fileGeneration');
  return true;
}

function authorizeAgent(context = {}) {
  policy.requireCapability('agents');
  policy.requireRole(context.role, 'operator');
  return true;
}

function authorizeApproval(context = {}) {
  policy.requireRole(context.role, 'admin');
  return true;
}

function authorizeBusiness(context = {}, required = 'operator') {
  policy.requireRole(context.role, required);
  return true;
}

module.exports = { authorizeTool, authorizeAgent, authorizeApproval, authorizeBusiness };
