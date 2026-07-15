import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('../services/securityPolicyService');
const permission = require('../services/permissionService');
const recovery = require('../services/taskRecoveryService');
const logger = require('../utils/logger');
const { executeTool } = require('../services/toolRegistry');
const workflow = require('../services/agentWorkflowService');

assert.equal(policy.normalizeRole('企业管理员'), 'admin');
assert.equal(policy.normalizeRole('访客'), 'viewer');
assert.equal(policy.isHighRisk('web_api_tool'), true);
assert.equal(policy.isHighRisk('excel_tool'), false);
assert.throws(() => permission.authorizeTool({ toolName: 'file_generate_tool', permissionLevel: 'admin' }, { role: 'viewer' }));
assert.equal(recovery.recoveryPlan('TIMEOUT', 0).retryable, true);
assert.equal(recovery.recoveryPlan('权限不足', 0).retryable, false);
assert.equal(logger.sanitize('Bearer abcdefghijklmnopqrstuvwxyz0123456789').includes('abcdefghijklmnopqrstuvwxyz'), false);
process.env.CAPABILITY_FILE_GENERATION = 'true';
const confirmation = await executeTool('file_generate_tool', { filename: 'report.txt', content: 'safe' }, { role: 'admin' });
assert.equal(confirmation.status, 'waiting_human');
const eightD = workflow.run8DWorkflow({ problem: '尺寸超差', owner: '质检员', containmentActions: ['隔离批次'], rootCauses: ['刀具磨损'], correctiveActions: ['更换刀具'], preventiveActions: ['增加首件确认'], evidence: ['首件检验合格'] });
assert.equal(eightD.canRequestClosure, true);
assert.equal(eightD.stages.at(-1).status, 'waiting_approval');
console.log('security self-test passed');
