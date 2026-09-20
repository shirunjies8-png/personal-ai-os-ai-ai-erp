import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const registry = require('../registry/realityos-module-registry.js');

const ids = new Set();
const names = new Set();
const sourceOwners = new Map();

assert.equal(registry.modules.length, 21, 'RealityOS registry must contain exactly 21 canonical modules');

for (const module of registry.modules) {
  assert.ok(module.moduleId, 'moduleId is required');
  assert.ok(!ids.has(module.moduleId), `duplicate moduleId: ${module.moduleId}`);
  ids.add(module.moduleId);

  assert.ok(module.canonicalName, `canonicalName is required for ${module.moduleId}`);
  assert.ok(!names.has(module.canonicalName), `duplicate canonicalName: ${module.canonicalName}`);
  names.add(module.canonicalName);

  assert.ok(registry.WAVES.includes(module.wave), `invalid wave for ${module.moduleId}: ${module.wave}`);
  assert.ok(registry.STATUS.includes(module.currentStatus), `invalid status for ${module.moduleId}: ${module.currentStatus}`);
  assert.ok(Array.isArray(module.sourceOfTruthFor) && module.sourceOfTruthFor.length > 0, `${module.moduleId} must own at least one concept`);

  for (const concept of module.sourceOfTruthFor) {
    assert.ok(!sourceOwners.has(concept), `duplicate concept owner for ${concept}`);
    sourceOwners.set(concept, module.moduleId);
  }

  for (const dependency of module.dependsOn || []) {
    assert.ok(ids.has(dependency.moduleId) || registry.modules.some(item => item.moduleId === dependency.moduleId), `dangling dependency ${dependency.moduleId} from ${module.moduleId}`);
    assert.ok(registry.DEPENDENCY_TYPES.includes(dependency.type), `invalid dependency type ${dependency.type} from ${module.moduleId}`);
    assert.notEqual(dependency.moduleId, module.moduleId, `${module.moduleId} cannot depend on itself`);
  }

  if (module.moduleId === '21-domain-runtime') {
    for (const forbidden of ['Authority', 'Canonical Effect', 'Evidence', 'Verification Result']) {
      assert.ok(!module.sourceOfTruthFor.includes(forbidden), `Domain Runtime must not copy core responsibility ${forbidden}`);
    }
  }
}

assert.equal(registry.ownership.Provenance, '13-evidence-runtime', 'Evidence Runtime must be canonical provenance owner');
assert.equal(registry.ownership.Lineage, '13-evidence-runtime', 'Evidence Runtime must be canonical lineage owner');
assert.equal(registry.ownership.Authority, '04-authority', 'Authority must own authority');
assert.equal(registry.ownership['Human Takeover'], '17-human-control', 'Human Control must own takeover request semantics');
assert.equal(registry.ownership['Canonical Effect'], '11-effect-runtime', 'Effect Runtime must own canonical effects');
assert.equal(registry.ownership['Authoritative Readback'], '12-reality-runtime', 'Reality Runtime must own authoritative readback');
assert.equal(registry.ownership['Verification Result'], '14-verification-runtime', 'Verification Runtime must own verification result');
assert.equal(registry.ownership.GEO, '21-domain-runtime', 'GEO must map to Domain Runtime, not a new top-level runtime');
assert.equal(registry.ownership.FINANCIAL_EFFECT, '11-effect-runtime', 'Agent Economy/payment effects must map to Effect Runtime financial effects');

for (const required of ['OCR', 'PDF', 'Word', 'Excel', 'PPT', 'Email', 'Translation', 'Writing', 'Knowledge Product', 'Contract', 'Tender', 'Quote', 'Procurement', 'Sales', 'Production', 'Shipping', 'Warehouse', 'Quality', 'ERP', 'MES', 'Equipment', 'Data Analysis', 'GEO', 'WorkBuddy', 'Agent Economy', 'Robot', 'Physical AI', 'Effect Reality Closure Demo']) {
  assert.ok(registry.productValidationBacklog.some(item => item.item === required), `missing product validation backlog item: ${required}`);
}

assert.equal(registry.currentMinimumClosedLoop.status, 'DEFINED');
assert.ok(registry.currentMinimumClosedLoop.detail.some(step => step.step === 'Effect Authority'));
assert.deepEqual(registry.targetW1KernelLoop.slice(0, 3), ['Mission', 'Goal / Task', 'Identity']);
assert.ok(registry.targetW1KernelLoop.includes('Recovery if needed'));

console.log(JSON.stringify({
  moduleCount: registry.modules.length,
  duplicateConceptOwner: 0,
  provenanceOwner: registry.ownership.Provenance,
  dependencyConflicts: 0,
  productValidationBacklogCount: registry.productValidationBacklog.length,
  currentMinimumClosedLoop: registry.currentMinimumClosedLoop.status,
  targetW1KernelLoop: 'DEFINED',
}, null, 2));
console.log('realityos W0 architecture governance registry tests passed');
