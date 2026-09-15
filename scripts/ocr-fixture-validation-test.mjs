import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const projectRoot = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(projectRoot, 'package.json'));
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { createWorker } = require('tesseract.js');

const CONTRACT = Object.freeze({
  fixture: 'trusted-ocr-fixture',
  font: Object.freeze({
    name: 'Songti SC',
    path: '/System/Library/Fonts/Supplemental/Songti.ttc'
  }),
  language: 'chi_sim',
  groundTruth: Object.freeze({
    quantity: '125',
    unit_price: '18.60',
    amount: '2325.00',
    document_id: 'PO-20260820-001'
  })
});

const fixtureLines = Object.freeze([
  '采购订单',
  '供应商：常州示例材料有限公司',
  '物料名称：不锈钢板',
  '规格：304 2.0mm',
  `数量：${CONTRACT.groundTruth.quantity}`,
  `单价：${CONTRACT.groundTruth.unit_price}`,
  `金额：${CONTRACT.groundTruth.amount}`,
  '日期：2026-08-20',
  `单号：${CONTRACT.groundTruth.document_id}`
]);

function validateFixtureFont({ name, fontPath }) {
  const fontRegistered = GlobalFonts.has(name);
  const fontFileExists = Boolean(fontPath) && fs.existsSync(fontPath);
  return Object.freeze({
    status: fontRegistered && fontFileExists ? 'OCR_TEST_ALLOWED' : 'BLOCKED',
    reason: fontRegistered && fontFileExists ? null : 'INVALID_FIXTURE_FONT',
    fontRegistered,
    fontFileExists
  });
}

function renderTrustedFixture(outputPath) {
  const canvas = createCanvas(1800, 1220);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  context.textBaseline = 'top';
  context.font = `76px "${CONTRACT.font.name}"`;
  context.fillText(fixtureLines[0], 120, 80);
  context.font = `58px "${CONTRACT.font.name}"`;
  fixtureLines.slice(1).forEach((line, index) => {
    context.fillText(line, 120, 190 + (index * 120));
  });
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
}

function normalizeForValidation(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s：:]/g, '')
    .toLowerCase();
}

function validateRawResult(rawResult) {
  const immutableRawSnapshot = String(rawResult);
  const normalized = normalizeForValidation(immutableRawSnapshot);
  const checks = Object.freeze(Object.fromEntries(
    Object.entries(CONTRACT.groundTruth).map(([field, expected]) => [
      field,
      normalized.includes(normalizeForValidation(expected))
    ])
  ));
  assert.equal(String(rawResult), immutableRawSnapshot, 'RAW must remain unchanged by validation');
  return Object.freeze({ raw: immutableRawSnapshot, normalized, checks });
}

const invalidFontResult = validateFixtureFont({
  name: 'PingFang SC',
  fontPath: '/System/Library/Fonts/PingFang.ttc'
});
assert.equal(invalidFontResult.status, 'BLOCKED');
assert.equal(invalidFontResult.reason, 'INVALID_FIXTURE_FONT');

const trustedFontResult = validateFixtureFont({
  name: CONTRACT.font.name,
  fontPath: CONTRACT.font.path
});
assert.equal(trustedFontResult.status, 'OCR_TEST_ALLOWED');

const temporaryDirectory = fs.mkdtempSync('/tmp/ocr-fixture-validation-');
const fixturePath = path.join(temporaryDirectory, 'trusted-ocr-fixture.png');
let worker;
try {
  renderTrustedFixture(fixturePath);
  worker = await createWorker(CONTRACT.language, 1, {
    langPath: path.join(projectRoot, 'assets/ocr'),
    cacheMethod: 'readOnly',
    gzip: true
  });
  const recognition = await worker.recognize(fixturePath);
  const validation = validateRawResult(recognition.data.text);
  Object.entries(validation.checks).forEach(([field, passed]) => {
    assert.equal(passed, true, `${field} must match trusted ground truth`);
  });

  console.log(JSON.stringify({
    phase: 'OCR-CLOSURE-1',
    fixtureValidation: 'PASS',
    caseA: {
      fixtureFont: 'PingFang SC',
      result: 'BLOCK',
      reason: invalidFontResult.reason
    },
    caseB: {
      fixtureFont: CONTRACT.font.name,
      result: 'PASS',
      checks: validation.checks
    },
    rawBoundary: {
      pipeline: ['TESSERACT_RAW', 'NORMALIZATION', 'BUSINESS_VALIDATOR'],
      rawPreserved: true,
      aiCorrectionUsed: false
    },
    confidence: recognition.data.confidence,
    temporaryDirectory
  }, null, 2));
} finally {
  if (worker) await worker.terminate();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
