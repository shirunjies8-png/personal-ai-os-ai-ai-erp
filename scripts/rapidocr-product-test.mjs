import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const inputPath = process.env.RAPIDOCR_TEST_INPUT;
const expectedHash = process.env.RAPIDOCR_TEST_SHA256;

assert.ok(inputPath, 'RAPIDOCR_TEST_INPUT must be explicitly provided; directory scanning is forbidden');
assert.ok(expectedHash, 'RAPIDOCR_TEST_SHA256 must be explicitly provided');

const service = require('../services/rapidOcrService');
const health = service.readiness();
assert.equal(health.readiness, 'READY');
assert.equal(health.available, true);
assert.equal(health.executionMetadata.executionProvider, 'CPUExecutionProvider');

const result = await service.recognize({
  buffer: fs.readFileSync(inputPath),
  mimeType: 'image/png',
  inputHash: expectedHash,
  classification: 'CONFIDENTIAL',
  placement: 'LOCAL_ONLY',
});

const anchors = ['发货单', 'FH-20240627-001', '120', '产品名称', '数量', '单价', '金额', '合计金额'];
const anchorEvidence = Object.fromEntries(anchors.map(anchor => [anchor, result.text.includes(anchor)]));
assert.equal(result.inputHash, expectedHash);
assert.equal(result.provider, 'rapidocr-local');
assert.equal(result.executionProvider, 'CPUExecutionProvider');
assert.equal(result.regionCount, 87);
assert.equal(result.externalUpload, false);
assert.ok(Object.values(anchorEvidence).every(Boolean));

console.log(JSON.stringify({
  readiness: health.readiness,
  provider: result.provider,
  engineVersion: result.engineVersion,
  runtimeVersion: result.runtimeVersion,
  executionProvider: result.executionProvider,
  inputHash: result.inputHash,
  resultProvenanceHash: result.resultProvenanceHash,
  latencyMs: result.latencyMs,
  regionCount: result.regionCount,
  anchors: anchorEvidence,
  classification: result.classification,
  placement: result.placement,
  externalUpload: result.externalUpload,
}));
