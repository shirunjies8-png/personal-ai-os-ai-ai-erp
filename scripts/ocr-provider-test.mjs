import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OCR = require('../ocr-provider.js');

const logs = [];
const registry = new OCR.ProviderRegistry({ onLog: entry => logs.push(entry) });
registry.register(OCR.createCurrentProvider({
  recognize: async (_file, onProgress) => {
    onProgress(0.5, '识别中');
    return {
      engineRawText: '客户名称：测试客户\n发货 数量：1 O',
      normalizedText: '客户名称：测试客户\n发货数量：1 0',
      engineRawLength: 20, normalizedLength: 18, engineRawHash: 'fixture-raw', normalizedHash: 'fixture-normalized',
      normalizationChanged: true, engineRawContainsChinese: true, normalizedContainsChinese: true,
      normalizationRuleVersion: 'OCRService.correct/v1'
    };
  },
  structure: () => ({ template: '发货单', fields: { '客户名称': '测试客户', '单据编号': 'SO-001', '日期': '2026-07-15', '产品名称': '连接件', '数量': '10' }, quality: { score: 92 } })
}));
registry.register(OCR.createPlaceholderProvider('local', '本地 OCR', 'local'));
registry.register(OCR.createMockProvider());

assert.equal(registry.list().length, 3);
assert.equal(registry.getCapabilities('current').supportsLocal, true);
assert.equal((await registry.healthCheck('local')).available, false);

const result = await registry.run({ providerId: 'current', file: { name: 'test.png' }, timeoutMs: 100 });
assert.equal(result.schemaVersion, 2);
assert.equal(result.providerId, 'current');
assert.equal(result.documentType, '发货单');
assert.equal(result.fields.find(field => field.key === 'customer_name').value, '测试客户');
assert.ok(['success', 'partial_success'].includes(result.status));
assert.ok(result.confidence >= 0 && result.confidence <= 1);
assert.equal(result.engineRawText, '客户名称：测试客户\n发货 数量：1 O', 'A: engine raw text must survive unchanged');
assert.equal(result.normalizedText, '客户名称：测试客户\n发货数量：1 0', 'B: normalization output must be separate');
assert.equal(result.rawText, result.normalizedText, 'legacy rawText remains normalized text');
assert.equal(result.textEvidence.normalizationChanged, true);
assert.equal(result.structuredSourceStage, 'NORMALIZED_TEXT', 'E: structured extraction source is explicit');
assert.equal(result.aiProcessedResult, null);
assert.equal(result.aiProcessingStatus, 'NOT_USED');
assert.ok(logs.some(entry => entry.textEvidence?.engineRawHash === 'fixture-raw'), 'F: provenance metadata is logged');
assert.equal(JSON.stringify(logs).includes(result.engineRawText), false, 'G: normal logs must not dump engine raw text');
assert.equal(JSON.stringify(logs).includes(result.normalizedText), false, 'G: normal logs must not dump normalized text');

const unavailableErrors = [];
const unavailableLogs = [];
const unavailableRegistry = new OCR.ProviderRegistry({ onError: entry => unavailableErrors.push(entry), onLog: entry => unavailableLogs.push(entry) });
unavailableRegistry.register(OCR.createPlaceholderProvider('local', '本地 OCR', 'local'));
await assert.rejects(() => unavailableRegistry.run({ providerId: 'local', file: {}, timeoutMs: 20 }), error => error.code === 'CAPABILITY_NOT_READY');
assert.equal(unavailableErrors[0].error.code, 'CAPABILITY_NOT_READY');
assert.equal(unavailableLogs[0].status, 'failed');

const timeoutRegistry = new OCR.ProviderRegistry();
timeoutRegistry.register(OCR.createCurrentProvider({ recognize: () => new Promise(() => {}) }));
await assert.rejects(() => timeoutRegistry.run({ providerId: 'current', file: {}, timeoutMs: 10 }), error => error.code === 'request_timeout');

const emptyRegistry = new OCR.ProviderRegistry();
emptyRegistry.register(OCR.createCurrentProvider({ recognize: async () => '' }));
await assert.rejects(() => emptyRegistry.run({ providerId: 'current', file: {}, timeoutMs: 50 }), error => error.code === 'empty_result');

const fallbackLogs = [];
const fallbackErrors = [];
const fallbackRegistry = new OCR.ProviderRegistry({ onLog: entry => fallbackLogs.push(entry), onError: entry => fallbackErrors.push(entry) });
fallbackRegistry.register(OCR.createCurrentProvider({ recognize: async () => { throw Object.assign(new Error('模型不可用'), { code: 'model_unavailable' }); } }));
fallbackRegistry.register(OCR.createMockProvider());
await assert.rejects(() => fallbackRegistry.run({ providerId: 'auto', file: {}, timeoutMs: 50 }), error => error.code === 'model_unavailable');
assert.equal(fallbackErrors.length, 1);
assert.equal(fallbackErrors[0].error.code, 'model_unavailable');
const mock = await fallbackRegistry.run({ providerId: 'mock', file: { name: 'demo.png' }, timeoutMs: 50 });
assert.equal(mock.status, 'success');
assert.equal(mock.fields.find(field => field.key === 'customer_name').value, '示例客户');
assert.equal(mock.fields.find(field => field.key === 'quantity').status, 'low_confidence');

const routedRegistry = new OCR.ProviderRegistry();
routedRegistry.register(OCR.createRapidOcrProvider({
  healthCheck: async () => ({ available: true, status: 'READY', executionProvider: 'CPUExecutionProvider' }),
  recognize: async () => ({
    text: '发货单\n数量 120', engineRawText: '发货单\n数量 120', normalizedText: '发货单\n数量 120',
    regions: [{ text: '发货单', confidence: 0.99, polygon: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
    executionMetadata: { engine: 'RapidOCR', engineVersion: '3.9.2', executionProvider: 'CPUExecutionProvider', inputHash: 'fixture-hash', regionCount: 1 },
  })
}));
routedRegistry.register(OCR.createCurrentProvider({ recognize: async () => 'Tesseract fallback' }));
const routed = await routedRegistry.run({
  providerId: 'auto', file: { name: 'confidential.png' }, timeoutMs: 100,
  context: { inputPolicy: { classification: 'CONFIDENTIAL', placement: 'LOCAL_ONLY', requiresChinese: true, requiresLayout: true } }
});
assert.equal(routed.providerId, 'rapidocr-local');
assert.equal(routed.routingEvidence.actualProvider, 'rapidocr-local');
assert.equal(routed.routingEvidence.fallbackOccurred, false);
assert.equal(routed.routingEvidence.preflightStatus, 'READY');
assert.equal(routed.routingEvidence.policyResult.status, 'READY');
assert.equal(routed.routingEvidence.expectedActual.status, 'MATCH');
assert.equal(routed.executionMetadata.executionProvider, 'CPUExecutionProvider');
assert.equal(routed.executionProvenance.capabilityId, 'document.ocr');
assert.equal(routed.executionProvenance.actualProvider, 'rapidocr-local');
assert.equal(routed.executionProvenance.executionPlacement, 'LOCAL_ONLY');
assert.equal(routedRegistry.getCapabilities('rapidocr-local').externalUpload, false);
assert.equal(routedRegistry.getCapabilities('rapidocr-local').placement, 'LOCAL_ONLY');

const degradedRegistry = new OCR.ProviderRegistry();
degradedRegistry.register(OCR.createRapidOcrProvider({ healthCheck: async () => ({ available: false, status: 'BLOCKED', message: '依赖未就绪' }) }));
degradedRegistry.register(OCR.createCurrentProvider({ recognize: async () => ({ engineRawText: '本地降级', normalizedText: '本地降级' }) }));
const degraded = await degradedRegistry.run({
  providerId: 'auto', file: { name: 'confidential.png' }, timeoutMs: 100,
  context: { inputPolicy: { classification: 'CONFIDENTIAL', placement: 'LOCAL_ONLY', requiresChinese: true, requiresLayout: true } }
});
assert.equal(degraded.providerId, 'current');
assert.equal(degraded.routingEvidence.fallbackOccurred, true);
assert.match(degraded.routingEvidence.fallbackReason, /rapidocr-local/);
assert.equal(degraded.fallbackUsed, false, '真实 Tesseract 降级不得标成演示数据');

let fallbackWasInvoked = false;
const noFallbackRegistry = new OCR.ProviderRegistry();
noFallbackRegistry.register(OCR.createRapidOcrProvider({
  healthCheck: async () => ({ available: true, status: 'READY' }),
  recognize: async () => { throw Object.assign(new Error('RapidOCR 执行失败'), { code: 'OCR_EXECUTION_FAILED' }); }
}));
noFallbackRegistry.register(OCR.createCurrentProvider({
  recognize: async () => { fallbackWasInvoked = true; return '不得执行'; }
}));
await assert.rejects(() => noFallbackRegistry.run({
  providerId: 'auto', file: { name: 'confidential.png' }, allowFallback: false, timeoutMs: 100,
  context: { inputPolicy: { classification: 'CONFIDENTIAL', placement: 'LOCAL_ONLY', requiresChinese: true, requiresLayout: true } }
}), error => error.code === 'OCR_EXECUTION_FAILED');
assert.equal(fallbackWasInvoked, false, 'fallback policy must block a second provider attempt');

const policyRegistry = new OCR.ProviderRegistry();
policyRegistry.register(OCR.createPlaceholderProvider('external-ocr', '外部 OCR', 'cloud', { available: true, supportsCloud: true, externalUpload: true, supportsLayout: true }));
await assert.rejects(() => policyRegistry.run({
  providerId: 'external-ocr', file: {}, context: { inputPolicy: { classification: 'CONFIDENTIAL', placement: 'LOCAL_ONLY' } }
}), error => error.code === 'PROVIDER_BLOCKED_BY_POLICY');

const garbled = OCR.detectGarbled('<html><body>error</body></html>��������');
assert.equal(garbled.garbled, true);
assert.ok(garbled.reasons.length > 0);

const lowResult = OCR.normalizeResult({ rawText: '客户：甲\n数量：abc', confidence: 0.42,
  fields: [{ key: 'quantity', value: 'abc', confidence: 0.42 }] }, {}, { providerId: 'test', providerName: '测试' });
assert.equal(lowResult.fields.find(field => field.key === 'quantity').status, 'suspicious');
assert.ok(lowResult.fields.find(field => field.key === 'quantity').warnings.some(item => item.includes('数字格式')));
assert.ok(lowResult.warnings.some(item => item.includes('必填字段缺失')));

let review = OCR.createReview(result);
review = OCR.updateReviewField(review, 'customer_name', '人工修正客户');
assert.equal(review.status, 'reviewing');
assert.equal(review.modifications.length, 1);
assert.equal(review.fields.find(field => field.key === 'customer_name').status, 'manually_corrected');
assert.throws(() => OCR.confirmedPayload(review, result), error => error.code === 'review_not_approved');
review = OCR.approveReview(review, '测试员');
const payload = OCR.confirmedPayload(review, result);
assert.equal(payload.fields.customer_name, '人工修正客户');
assert.equal('contact' in payload.fields, false, '未识别空字段不得冒充已确认数据');
assert.equal(payload.reviewStatus, 'approved');
assert.equal(payload.fieldDetails.find(field => field.key === 'customer_name').manuallyEdited, true);
assert.equal(payload.fieldDetails.find(field => field.key === 'customer_name').sourceText, '测试客户');
assert.equal(payload.modifications.length, 1);
assert.ok(payload.confidence >= 0 && payload.confidence <= 1);
assert.equal(OCR.reviewSummary(review).canTransferToQuotation, true);
assert.throws(() => OCR.rejectReview(review, ''), error => error.code === 'review_reason_required');

const legacy = OCR.normalizeLegacyResult({ text: '客户名称：旧数据', fields: { '客户名称': '旧客户' }, imageMeta: { name: 'old.png' } });
assert.equal(legacy.schemaVersion, 2);
assert.equal(legacy.fields.find(field => field.key === 'customer_name').value, '旧客户');
assert.equal(legacy.sourceFile.name, 'old.png');

const sanitized = OCR.sanitizeDiagnostics({ apiKey: 'secret-value', authorization: 'Bearer abc', nested: { token: 'token-123456789' }, message: 'key-abcdefghijk' });
assert.equal(sanitized.apiKey, '[REDACTED]');
assert.equal(sanitized.authorization, '[REDACTED]');
assert.equal(sanitized.nested.token, '[REDACTED]');
assert.match(sanitized.message, /\[REDACTED\]/);
const privateDiagnostic = OCR.sanitizeDiagnostics({
  rawError: '手机13812345678 身份证11010519491231002X 银行卡6222021234567890123 路径/Users/demo/Documents/customer.png',
  rawText: '客户完整截图原文', screenshot: 'base64-customer-image'
});
assert.doesNotMatch(privateDiagnostic.rawError, /13812345678|11010519491231002X|6222021234567890123|\/Users\/demo/);
assert.equal(privateDiagnostic.rawText, '[REDACTED_CONTENT]');
assert.equal(privateDiagnostic.screenshot, '[REDACTED_CONTENT]');

console.log('ocr provider, review, fallback and diagnostics tests passed');
