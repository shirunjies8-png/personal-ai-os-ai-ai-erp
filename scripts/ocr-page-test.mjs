import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OCR = require('../ocr-provider.js');
global.OCRArchitecture = OCR;
global.Store = {
  state: {
    settings: { accessMode: 'local', apiEnabled: false, apiUrl: '' },
    ocrData: { providerConfig: { selectedProviderId: 'auto' }, errors: [], results: [], reviews: [], stats: {} }
  }
};
global.Utils = {
  escape(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); },
  textToHtml(value = '') { return String(value).replace(/\n/g, '<br>'); },
  formatBytes(value) { return `${value || 0} B`; },
  formatDate(value) { return String(value || ''); }
};
const normalized = OCR.normalizeResult({ rawText: '客户名称：演示客户\n数量：10', confidence: 0.58,
  fields: [{ key: 'customer_name', value: '演示客户', confidence: 0.9 }, { key: 'quantity', value: '10', confidence: 0.58 }],
  providerId: 'mock', providerName: '演示模式', status: 'fallback', fallbackUsed: true, warnings: ['演示数据'] });
const review = OCR.createReview(normalized);
global.App = {
  temp: { ocr: { file: null, url: '', result: normalized.rawText, original: normalized.rawText, progress: 1, status: '已使用降级模式',
    providerId: 'auto', providerResult: normalized, review, reviewZoom: 1, sourceFile: {}, engineStatus: {}, quality: {}, qaQuestion: '', analysis: '', qaAnswer: '', aiFix: '' } },
  setupOcrProviders() { return { list: () => [{ providerId: 'current', providerName: '当前 OCR', available: true }, { providerId: 'mock', providerName: '演示模式', available: true }] }; }
};
const UI = require('../ui.js');
const html = UI.ocr();

assert.match(html, /OCR识别与人工复核/);
assert.match(html, /Provider 与任务状态/);
assert.match(html, /原图对照/);
assert.match(html, /原始识别文本/);
assert.match(html, /结构化复核/);
assert.match(html, /低置信度/);
assert.match(html, /演示数据（非真实识别）/);
assert.match(html, /当前为演示数据，非真实 OCR 识别结果。/);
assert.match(html, /data-action="ocr-review-save"/);
assert.match(html, /data-action="ocr-review-approve"/);
assert.match(html, /data-action="ocr-review-reject"/);
assert.match(html, /data-action="ocr-txt"/);
assert.match(html, /data-action="ocr-word"/);
assert.match(html, /data-action="ocr-excel"/);
assert.match(html, /data-action="ocr-transfer-quotation" disabled/);
assert.match(html, /data-action="ocr-transfer-inquiry" disabled/);
assert.match(html, /data-ocr-review-field="customer_name"/);
assert.match(html, /OCR 文档会话/);
assert.match(html, /ocr-session-new/);

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('./sync-public.mjs', import.meta.url), 'utf8');
assert.match(indexSource, /ocr-provider\.js/);
assert.match(syncSource, /'ocr-provider\.js'/);
assert.match(appSource, /OCRArchitecture\.confirmedPayload/);
assert.match(appSource, /OCRArchitecture\.approveReview/);
assert.match(appSource, /restoreOcrSession\(\)/);
assert.match(appSource, /ocrResolveRecognitionConflict/);
assert.match(appSource, /upsertOcrDocumentTemplate/);
assert.match(appSource, /recognitionConflict/);
assert.match(appSource, /if \(o\.loading\)/);
assert.match(appSource, /OCR 识别正在进行，请勿重复提交。/);
assert.match(appSource, /o\.loading = true/);
assert.match(fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8'), /o\.loading \? 'disabled'/);
const ocrRunSource = appSource.slice(appSource.indexOf('async ocrRun('), appSource.indexOf('async ocrSummary('));
assert.doesNotMatch(ocrRunSource, /this\.recordTask\(/);
assert.match(ocrRunSource, /this\.upsertStabilityTask\(/);
assert.match(appSource, /if \(fields\.customer_name\) patch\.customerName/);
assert.match(appSource, /if \(!String\(action \|\| ''\)\.startsWith\('ocr-'\)\) console\.error/);
assert.match(appSource, /code: 'user_rejected'/);
assert.match(appSource, /data-ocr-review-field/);
assert.match(coreSource, /ocrData:/);
assert.match(coreSource, /documentSessions/);
assert.match(coreSource, /documentTemplates/);
assert.match(coreSource, /normalizeLegacyResult/);
assert.match(coreSource, /personal-ai-os-v1-migration-backup/);
assert.match(coreSource, /withoutKnownTesseractWarnings/);
assert.match(coreSource, /worker-wrapper\.js/);
assert.match(coreSource, /workerBlobURL: false/);
assert.match(fs.readFileSync(new URL('../vendor/tesseract/worker-wrapper.js', import.meta.url), 'utf8'), /Parameter not found/);
assert.match(indexSource, /rel="icon" href="data:image\/svg\+xml/);
assert.match(fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8'), /OCR Mock 状态/);
assert.match(fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8'), /todayRejectedOcrIds/);

console.log('ocr review page and business gating tests passed');
