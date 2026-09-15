import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../realityos-core.js');

const allowBrowserRead = {
  id: 'rule-browser-read-public-doc',
  policy: 'effect-governance-v1',
  resource: 'browser.resource',
  verb: 'READ',
  effectClass: 'OBSERVATION',
  decision: 'ALLOW',
  reason: 'Browser read-only observation is allowed for public resource inspection.',
};

const denyPurchaseOrderCreation = {
  id: 'rule-create-po-deny',
  policy: 'effect-governance-v1',
  canonicalEffect: 'CREATE_PURCHASE_ORDER',
  decision: 'DENY',
  reason: 'Purchase order creation is not authorized by this contract fixture.',
};

const authorityContext = {
  principal: { id: 'test-user', role: 'operator' },
  policy: 'effect-governance-v1',
  rules: [allowBrowserRead, denyPurchaseOrderCreation],
};

// Case A: same browser tool, read-only observation is authorized.
const browserRead = Core.validateEffect({
  effectRequest: {
    resource: 'browser.resource',
    verb: 'READ',
    target: 'https://example.invalid/status',
    purpose: 'DOCUMENT_ANALYSIS',
    effectClass: 'OBSERVATION',
    canonicalEffect: 'BROWSER_READ_STATUS',
  },
  authorityContext,
  actualEffect: {
    observedResource: 'browser.resource',
    observedVerb: 'READ',
    observedTarget: 'https://example.invalid/status',
    observedEffectClass: 'OBSERVATION',
    canonicalEffect: 'BROWSER_READ_STATUS',
    evidence: { httpMethod: 'GET' },
  },
  policyVersion: 'effect-governance-v1',
});
assert.equal(browserRead.status, 'ALLOWED');
assert.equal(browserRead.authorityDecision.decision, 'ALLOW');
assert.equal(browserRead.comparison.status, 'MATCH');

// Case B: browser capability exists, but POST persistent external mutation is not authorized.
const browserPost = Core.validateEffect({
  effectRequest: {
    resource: 'browser.resource',
    verb: 'POST',
    target: 'https://example.invalid/api/purchase-orders',
    purpose: 'PROCUREMENT_EXECUTION',
    effectClass: 'PERSISTENT_EXTERNAL_MUTATION',
    canonicalEffect: 'CREATE_PURCHASE_ORDER',
  },
  authorityContext,
});
assert.equal(browserPost.status, 'BLOCKED');
assert.equal(browserPost.authorityDecision.decision, 'DENY');
assert.ok(browserPost.blockingReasons.includes('EFFECT_AUTHORITY_DENIED'));

// Case C: high-risk upload with unknown authority must fail closed as approval required.
const browserUploadUnknown = Core.validateEffect({
  effectRequest: {
    resource: 'browser.resource',
    verb: 'UPLOAD',
    target: 'https://example.invalid/upload',
    purpose: 'DOCUMENT_EXPORT',
    effectClass: 'PERSISTENT_EXTERNAL_MUTATION',
    canonicalEffect: 'UPLOAD_CONFIDENTIAL_DOCUMENT',
  },
  authorityContext: { principal: { id: 'test-user' }, rules: [] },
});
assert.equal(browserUploadUnknown.status, 'BLOCKED');
assert.equal(browserUploadUnknown.authorityDecision.decision, 'REQUIRE_APPROVAL');
assert.ok(browserUploadUnknown.blockingReasons.includes('EFFECT_REQUIRES_APPROVAL'));

// Case D/E: two alternate capability paths map to the same canonical business effect,
// and the same denied authority applies to both.
const erpApiCreatePo = Core.validateEffect({
  effectRequest: {
    resource: 'erp.purchaseOrder',
    verb: 'CREATE',
    target: 'purchaseOrder:PO-123',
    purpose: 'PROCUREMENT_EXECUTION',
    effectClass: 'PERSISTENT_EXTERNAL_MUTATION',
    canonicalEffect: 'CREATE_PURCHASE_ORDER',
    metadata: { capabilityId: 'erp.api.createPurchaseOrder' },
  },
  authorityContext,
});
const csvImportCreatePo = Core.validateEffect({
  effectRequest: {
    resource: 'filesystem.file',
    verb: 'UPLOAD',
    target: 'csv:po-import.csv',
    purpose: 'PROCUREMENT_EXECUTION',
    effectClass: 'PERSISTENT_EXTERNAL_MUTATION',
    canonicalEffect: 'CREATE_PURCHASE_ORDER',
    metadata: { capabilityId: 'browser.csvImport' },
  },
  authorityContext,
});
assert.equal(erpApiCreatePo.status, 'BLOCKED');
assert.equal(csvImportCreatePo.status, 'BLOCKED');
assert.equal(erpApiCreatePo.authorityDecision.ruleRef, 'rule-create-po-deny');
assert.equal(csvImportCreatePo.authorityDecision.ruleRef, 'rule-create-po-deny');

// Expected effect ↔ actual effect comparison.
const expectedActualMatch = Core.compareExpectedActualEffect({
  resource: 'filesystem.file',
  verb: 'READ',
  target: 'file:invoice.png',
  purpose: 'DOCUMENT_ANALYSIS',
  effectClass: 'OBSERVATION',
  canonicalEffect: 'READ_DOCUMENT',
}, {
  observedResource: 'filesystem.file',
  observedVerb: 'READ',
  observedTarget: 'file:invoice.png',
  observedEffectClass: 'OBSERVATION',
  canonicalEffect: 'READ_DOCUMENT',
});
assert.equal(expectedActualMatch.status, 'MATCH');

const expectedActualUnknown = Core.compareExpectedActualEffect({
  resource: 'email.message',
  verb: 'SEND',
  target: 'email:draft-1',
  purpose: 'CUSTOMER_COMMUNICATION',
  effectClass: 'COMMUNICATION',
  canonicalEffect: 'SEND_EMAIL',
}, {
  observedResource: 'email.message',
  observedVerb: 'UNKNOWN',
  observedTarget: 'email:draft-1',
  observedEffectClass: 'UNKNOWN',
  canonicalEffect: 'SEND_EMAIL',
});
assert.equal(expectedActualUnknown.status, 'UNKNOWN');

// Capability semantic divergence: declared web read actually performs a POST/upload.
const divergence = Core.detectCapabilitySemanticDivergence({
  expectedEffect: {
    resource: 'browser.resource',
    verb: 'READ',
    target: 'https://example.invalid/report',
    purpose: 'DOCUMENT_ANALYSIS',
    effectClass: 'OBSERVATION',
    canonicalEffect: 'WEB_READ',
  },
  actualEffect: {
    observedResource: 'browser.resource',
    observedVerb: 'POST',
    observedTarget: 'https://example.invalid/upload',
    observedEffectClass: 'PERSISTENT_EXTERNAL_MUTATION',
    canonicalEffect: 'WEB_UPLOAD',
    evidence: { method: 'POST', responseCode: 201 },
  },
});
assert.equal(divergence.status, 'DIVERGED');
assert.ok(divergence.divergenceTypes.includes('CAPABILITY_SEMANTIC_DIVERGENCE'));
assert.ok(divergence.divergenceTypes.includes('EFFECT_AUTHORITY_DIVERGENCE'));

// Tool name is not an effect class: browser can be observation or mutation based on verb/effect.
assert.equal(browserRead.effectClassification.effectClass, 'OBSERVATION');
assert.equal(browserPost.effectClassification.effectClass, 'PERSISTENT_EXTERNAL_MUTATION');

// OCR remains a local transform, not an external mutation.
const ocrLocalTransform = Core.validateEffect({
  effectRequest: {
    resource: 'document.image',
    verb: 'EXECUTE',
    target: 'local:image-sha256',
    purpose: 'DOCUMENT_ANALYSIS',
    effectClass: 'LOCAL_TRANSFORM',
    canonicalEffect: 'LOCAL_OCR_RECOGNITION',
    externalMutation: false,
  },
  authorityContext: {
    rules: [{
      id: 'rule-local-ocr',
      canonicalEffect: 'LOCAL_OCR_RECOGNITION',
      decision: 'ALLOW',
      reason: 'Local-only document transform is permitted.',
    }],
  },
  actualEffect: {
    observedResource: 'document.image',
    observedVerb: 'EXECUTE',
    observedTarget: 'local:image-sha256',
    observedEffectClass: 'LOCAL_TRANSFORM',
    canonicalEffect: 'LOCAL_OCR_RECOGNITION',
    evidence: { placement: 'LOCAL_ONLY', externalUpload: false, externalAI: false },
  },
});
assert.equal(ocrLocalTransform.status, 'ALLOWED');
assert.equal(ocrLocalTransform.effectClassification.externalMutation, false);

console.log('effect governance contract v1 tests passed');
