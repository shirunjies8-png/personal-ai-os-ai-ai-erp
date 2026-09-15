import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../realityos-core.js');
const rapidOcrService = require('../services/rapidOcrService.js');

const registry = new Core.CapabilityRegistry();
const capability = registry.register({
  capabilityId: 'document.ocr',
  name: 'Document OCR',
  category: 'document-processing',
  providerIds: ['rapidocr-local'],
  dependencies: [
    { dependencyId: 'python-runtime', type: 'runtime', required: true, status: 'READY' },
    { dependencyId: 'optional-debug-telemetry', type: 'service', required: false, status: 'BLOCKED' },
  ],
  dataPolicy: { classification: 'CONFIDENTIAL', requiredPlacement: 'LOCAL_ONLY' },
  readiness: 'READY',
});

assert.equal(registry.get('document.ocr').capabilityId, 'document.ocr');
assert.equal(registry.list().length, 1);
assert.equal(capability.dataPolicy.classification, 'CONFIDENTIAL');

assert.equal(Core.normalizePlacement('LOCAL'), 'LOCAL_ONLY');
assert.equal(Core.summarizeDependencyStatus(capability.dependencies), 'DEGRADED');
assert.equal(Core.summarizeDependencyStatus([{ dependencyId: 'required-runtime', required: true, status: 'BLOCKED' }]), 'BLOCKED');

const localPolicy = Core.evaluateDataPolicy(
  { classification: 'CONFIDENTIAL', requiredPlacement: 'LOCAL_ONLY', allowedPlacements: ['LOCAL_ONLY'] },
  { actualPlacement: 'LOCAL_ONLY', externalUpload: false, externalAI: false }
);
assert.equal(localPolicy.status, 'READY');

const blockedPolicy = Core.evaluateDataPolicy(
  { classification: 'CONFIDENTIAL', requiredPlacement: 'LOCAL_ONLY', allowedPlacements: ['LOCAL_ONLY'] },
  { actualPlacement: 'EXTERNAL', externalUpload: true, externalAI: true }
);
assert.equal(blockedPolicy.status, 'BLOCKED');
assert.ok(blockedPolicy.blockingReasons.includes('PLACEMENT_NOT_ALLOWED'));
assert.ok(blockedPolicy.blockingReasons.includes('CONFIDENTIAL_EXTERNAL_UPLOAD_BLOCKED'));

const routed = Core.routeProvider({
  requestedProvider: 'auto',
  dataPolicy: { classification: 'CONFIDENTIAL', requiredPlacement: 'LOCAL_ONLY', allowedPlacements: ['LOCAL_ONLY'] },
  requiresChinese: true,
  requiresLayout: true,
  providers: [
    { providerId: 'cloud-ocr', readiness: 'READY', placement: 'EXTERNAL', externalUpload: true, supportsLayout: true, supportsChinese: true, routingPriority: 100 },
    { providerId: 'rapidocr-local', readiness: 'READY', placement: 'LOCAL_ONLY', externalUpload: false, supportsLayout: true, supportsChinese: true, routingPriority: 90 },
  ],
});
assert.equal(routed.status, 'READY');
assert.equal(routed.selectedProvider, 'rapidocr-local');
assert.equal(routed.attempts[0].providerId, 'cloud-ocr');
assert.equal(routed.attempts[0].result, 'SKIPPED');

const preflight = Core.preflight({
  capability,
  providerReadiness: 'READY',
  executionContext: { actualPlacement: 'LOCAL_ONLY', externalUpload: false, externalAI: false },
});
assert.equal(preflight.status, 'DEGRADED');
assert.ok(preflight.warnings.includes('OPTIONAL_DEPENDENCY_DEGRADED'));

const provenance = Core.createExecutionProvenance({
  executionId: 'run-1',
  capabilityId: 'document.ocr',
  requestedProvider: 'auto',
  actualProvider: 'rapidocr-local',
  providerVersion: '3.9.2',
  runtimeIdentity: { runtime: 'Python / ONNX Runtime', runtimeVersion: '1.29.0' },
  executionPlacement: 'LOCAL',
  inputIdentity: { sha256: 'input-hash' },
  outputIdentity: { sha256: 'result-hash' },
  fallbackUsed: false,
  status: 'success',
});
assert.equal(provenance.executionPlacement, 'LOCAL_ONLY');
assert.equal(provenance.actualProvider, 'rapidocr-local');

const expectedActual = Core.compareExpectedActual({
  requestedProvider: 'rapidocr-local',
  requestedPlacement: 'LOCAL_ONLY',
  expectedRuntime: 'Python / ONNX Runtime',
  fallbackExpected: false,
}, {
  actualProvider: 'rapidocr-local',
  actualPlacement: 'LOCAL_ONLY',
  actualRuntime: 'Python / ONNX Runtime',
  fallbackUsed: false,
});
assert.equal(expectedActual.status, 'MATCH');

const health = Core.projectCapabilityHealth({
  capabilityId: 'document.ocr',
  readiness: 'READY',
  dependencies: [{ dependencyId: 'runtime', required: true, status: 'READY' }],
  provider: { providerId: 'rapidocr-local' },
});
assert.equal(health.status, 'READY');

const rapidContract = rapidOcrService.providerContract('READY');
assert.equal(rapidContract.capabilityId, 'document.ocr');
assert.equal(rapidContract.dataPolicy.classification, 'CONFIDENTIAL');
assert.equal(rapidContract.dataPolicy.requiredPlacement, 'LOCAL_ONLY');
assert.equal(rapidContract.capabilityHealth.status, 'READY');
assert.ok(Array.isArray(rapidContract.dependencyEvidence));

console.log('realityos core v1 contract tests passed');
