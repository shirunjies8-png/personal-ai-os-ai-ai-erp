import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('../services/securityPolicyService');
const redaction = require('../services/aiRedactionService');
const gateway = require('../services/aiGateway');

const explicitPolicy = ({ classification = 'PUBLIC', purpose = 'classify', scope = 'enterprise:security-test', tool = 'external_connector' } = {}) => ({
  id: `policy-${classification.toLowerCase()}`,
  outboundAllowed: true,
  allowedClassifications: [classification],
  allowedDestinations: ['EXTERNAL'],
  allowedPurposes: [purpose],
  allowedDataScopes: [scope],
  allowedTools: [tool]
});
const actor = {
  id: 'security-test-human',
  type: 'HUMAN',
  authority: { allowedActions: ['READ', 'SEND', 'DELETE'], allowedResources: ['document', 'external_connector'], allowedScopes: ['enterprise:security-test'] }
};
const outbound = (extra = {}) => ({ classification: 'PUBLIC', destination: 'EXTERNAL', purpose: 'classify', dataScope: 'enterprise:security-test', redactionStatus: 'NOT_REDACTED', actor, tool: 'external_connector', policy: explicitPolicy(), ...extra });

// 1–3: classification and explicit policy behavior.
assert.equal(policy.evaluateOutboundDecision(outbound({ classification: 'UNKNOWN' })).decision, 'DENY');
assert.equal(policy.canSendToExternalAI(outbound({ classification: 'SENSITIVE', redactionStatus: 'REDACTED', policy: explicitPolicy({ classification: 'SENSITIVE' }) })).decision, 'DENY');
assert.equal(policy.canSendToExternalAI(outbound()).decision, 'ALLOW');
assert.equal(policy.canSendToExternalAI(outbound({ classification: 'INTERNAL', redactionStatus: 'REDACTED', policy: explicitPolicy({ classification: 'INTERNAL' }) })).decision, 'ALLOW');
assert.equal(policy.canSendToExternalAI(outbound({ classification: 'CONFIDENTIAL', redactionStatus: 'REDACTED', policy: null })).decision, 'DENY');

// 4–7: authority is action and scope specific; it never inherits write access.
assert.equal(policy.evaluateAuthority({ actor: { ...actor, authority: { ...actor.authority, allowedActions: ['READ'] } }, action: 'DELETE', resource: 'document', scope: 'enterprise:security-test' }).decision, 'DENY');
assert.equal(policy.evaluateAuthority({ actor, action: 'READ', resource: 'document' }).decision, 'DENY');
assert.equal(policy.evaluateAuthority({ actor, action: 'READ', resource: 'document', scope: 'global' }).decision, 'DENY');
assert.equal(policy.evaluateAuthority({ actor, action: 'READ', resource: 'document', scope: 'enterprise:security-test' }).decision, 'ALLOW');

// 8–9: logs and audit views may preserve metadata but never credentials.
const secretInput = {
  Authorization: 'Bearer abc123secret',
  nested: { password: 'p@ssword' },
  note: 'Authorization: Bearer abc123secret password=plain123secret sk-testsecret123 abcdefgh.ijklmnop.qrstuvwx'
};
const safeLog = redaction.sanitizeForLog(secretInput);
const safeAudit = redaction.sanitizeAuditRecord({ actor: 'user-1', action: 'SEND', decision: 'DENY', classification: 'SENSITIVE', destination: 'EXTERNAL', requestId: 'req-security', Authorization: 'Bearer abc123secret', containsSecrets: true });
assert.doesNotMatch(JSON.stringify(safeLog), /abc123secret|p@ssword|plain123secret|sk-testsecret123|abcdefgh|ijklmnop|qrstuvwx/);
assert.doesNotMatch(JSON.stringify(safeAudit), /abc123secret/);
assert.equal(safeAudit.credentialPresent, true);

// 10–11: high risk waits for a distinct human approver; unknown approval fails closed.
const highRisk = policy.ToolGuard.evaluate({ ...outbound({ outbound: false }), permissionDecision: 'ALLOW', action: 'DELETE', resource: 'document', scope: 'enterprise:security-test', approval: { status: 'UNKNOWN' } });
assert.equal(highRisk.decision, 'REQUIRE_APPROVAL');
const agentSelfApproval = policy.ToolGuard.evaluate({ ...outbound({ outbound: false }), permissionDecision: 'ALLOW', action: 'DELETE', resource: 'document', scope: 'enterprise:security-test', actor: { ...actor, id: 'agent-1', type: 'AI_AGENT' }, approval: { status: 'APPROVED', approver: { id: 'agent-1', type: 'AI_AGENT' } } });
assert.equal(agentSelfApproval.decision, 'DENY');
assert.equal(agentSelfApproval.reason, 'AI_AGENT_CANNOT_SELF_APPROVE');
assert.equal(policy.ToolGuard.evaluate({ ...outbound({ outbound: false }), permissionDecision: 'UNKNOWN', action: 'READ', resource: 'document', scope: 'enterprise:security-test' }).decision, 'DENY');

// Privacy minimization keeps a reference, or a selected allow-list, never an entire source object.
assert.deepEqual(policy.minimizePayload({ title: 'safe', rawDocument: 'do-not-send' }, { allowedFields: ['title'] }), { title: 'safe' });
assert.deepEqual(policy.minimizePayload({ rawDocument: 'do-not-send' }, { referenceId: 'doc-1' }), { referenceId: 'doc-1' });

// 12: the only live egress entry is blocked before its supplied fetch implementation can run.
let egressCalled = false;
const blocked = await gateway.chat({
  requestId: 'security-gate-blocked', enterpriseId: 'security-test', userId: 'security-test-human', taskType: 'correct', module: 'ocr',
  messages: [{ role: 'user', content: 'external payload' }], dataClassification: 'UNKNOWN', dataScope: 'enterprise:security-test', actor: { id: 'security-test-human' }
}, { apiKey: 'test-only', fetchImpl: async () => { egressCalled = true; throw new Error('must not be called'); } });
assert.equal(blocked.status, 'security_blocked');
assert.equal(egressCalled, false);

console.log('security privacy gate tests passed (12+ fail-closed cases)');
