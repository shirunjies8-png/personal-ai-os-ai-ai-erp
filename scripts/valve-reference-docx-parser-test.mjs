#!/usr/bin/env node

/*
 * Local/private contract test for the deterministic OOXML parser.
 * It creates only synthetic redacted fixtures. A real-source check is opt-in
 * and receives both path and full approved SHA-256 from its caller.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const parser = require('../services/valveReferenceDocxParserService');
const foundation = require('../services/valveReferenceTenderTemplateService');

const PREFIX = '[valve-reference-docx-parser-test]';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, content, method = 8 } of entries) {
    const filename = Buffer.from(name, 'utf8');
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compressed = method === 0 ? raw : zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.concat([
      Buffer.from('504b0304', 'hex'), writeUInt16(20), writeUInt16(0), writeUInt16(method),
      writeUInt16(0), writeUInt16(0), writeUInt32(crc), writeUInt32(compressed.length), writeUInt32(raw.length),
      writeUInt16(filename.length), writeUInt16(0), filename, compressed,
    ]);
    localParts.push(local);
    const central = Buffer.concat([
      Buffer.from('504b0102', 'hex'), writeUInt16(20), writeUInt16(20), writeUInt16(0), writeUInt16(method),
      writeUInt16(0), writeUInt16(0), writeUInt32(crc), writeUInt32(compressed.length), writeUInt32(raw.length),
      writeUInt16(filename.length), writeUInt16(0), writeUInt16(0), writeUInt16(0), writeUInt16(0), writeUInt32(0),
      writeUInt32(offset), filename,
    ]);
    centralParts.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    central,
    Buffer.from('504b0506', 'hex'), writeUInt16(0), writeUInt16(0),
    writeUInt16(entries.length), writeUInt16(entries.length), writeUInt32(central.length), writeUInt32(offset), writeUInt16(0),
  ]);
}

const CONTENT_TYPES = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';
const STYLES = `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`;
const NUMBERING = '<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>';
const RELATIONSHIPS = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdExternal" Type="https://example.invalid/reference" Target="https://example.invalid/private" TargetMode="External"/>
</Relationships>`;
const DOCUMENT = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>一、项目概况</w:t></w:r></w:p>
  <w:p><w:r><w:t>项目名称：合成阀门参考项目</w:t></w:r></w:p>
  <w:tbl>
    <w:tr><w:tc><w:p><w:r><w:t>物料名称</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>数量</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>单价</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>控制价</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1000</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge/></w:tcPr><w:p><w:r><w:t>报价超过控制价的，按无效处理</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>参考</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>nested</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:tc></w:tr>
  </w:tbl>
  <w:p/>
  <w:p><w:r><w:t>清单与图纸不一致时，以清单为准。</w:t></w:r></w:p>
</w:body></w:document>`;

function syntheticEntries(overrides = []) {
  return [
    { name: '[Content_Types].xml', content: CONTENT_TYPES },
    { name: 'word/document.xml', content: DOCUMENT },
    { name: 'word/styles.xml', content: STYLES },
    { name: 'word/numbering.xml', content: NUMBERING },
    { name: 'word/_rels/document.xml.rels', content: RELATIONSHIPS },
    ...overrides,
  ];
}

async function expectCode(action, code) {
  await assert.rejects(action, (error) => error?.code === code);
}

async function withTempDirectory(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'valve-docx-parser-test-'));
  try {
    return await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
    assert.equal(await fs.access(directory).then(() => true).catch(() => false), false, 'temporary test directory must be removed');
  }
}

async function writeFixture(directory, filename, entries) {
  const target = path.join(directory, filename);
  await fs.writeFile(target, createZip(entries));
  return target;
}

function safeSummary(result) {
  const counts = result.structured_document.counts;
  return {
    source_hash: result.structured_document.source.source_hash,
    paragraph_count: counts.paragraph_count,
    top_level_table_count: counts.table_count,
    total_row_count: counts.row_count,
    merged_table_count: counts.merged_table_count,
    rule_types: [...new Set(result.ruleCandidates.map((candidate) => candidate.rule_type))].sort(),
  };
}

async function runSyntheticContract() {
  let failedCleanupDirectory = null;
  await assert.rejects(() => withTempDirectory(async (directory) => {
    failedCleanupDirectory = directory;
    throw new Error('synthetic cleanup failure path');
  }), /synthetic cleanup failure path/);
  assert.equal(await fs.access(failedCleanupDirectory).then(() => true).catch(() => false), false, 'failure path temporary directory must be removed');

  await withTempDirectory(async (directory) => {
    const fixturePath = await writeFixture(directory, 'synthetic-reference.docx', syntheticEntries());
    const expectedHash = crypto.createHash('sha256').update(await fs.readFile(fixturePath)).digest('hex');
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => logs.push(args);
    console.error = (...args) => logs.push(args);
    let result;
    try {
      result = await parser.parseDocx({ filePath: fixturePath, expectedSourceHash: expectedHash, enterpriseId: 'enterprise-test' });
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    assert.deepEqual(logs, [], 'parser must not log confidential source content');
    const document = result.structured_document;
    assert.equal(document.source.source_hash, expectedHash);
    assert.equal(document.metadata.parser_name, parser.PARSER_NAME);
    assert.equal(document.metadata.parser_version, parser.PARSER_VERSION);
    assert.equal(document.metadata.temp_storage, 'MEMORY_ONLY');
    assert.equal(document.blocks.map((block) => block.type).join(','), 'PARAGRAPH,PARAGRAPH,TABLE,PARAGRAPH,PARAGRAPH');
    assert.equal(document.paragraphs.length, 12, 'paragraph nodes include table-cell, nested-table, and empty body paragraphs');
    assert.equal(document.tables.length, 2, 'all body-descendant tables are retained, including nested tables');
    assert.deepEqual(document.counts, {
      paragraph_count: 12,
      table_count: 1,
      row_count: 3,
      merged_table_count: 1,
      nested_table_count: 1,
      all_table_row_count: 4,
      all_merged_table_count: 1,
    });
    assert.equal(document.paragraphs[0].heading_candidate, true);
    assert.equal(document.paragraphs[0].heading_source, 'STYLE');
    assert.equal(document.paragraphs[0].source_locator, `docx://${expectedHash}/paragraph/0`);
    const table = document.tables[0];
    assert.equal(table.is_top_level, true);
    assert.equal(document.tables[1].is_top_level, false);
    assert.equal(table.rows.length, 3);
    assert.equal(table.rows[1].cells[0].grid_span, 2);
    assert.equal(table.rows[1].cells[0].vertical_merge, 'RESTART');
    assert.equal(table.rows[2].cells[0].vertical_merge, 'CONTINUE');
    assert.equal(table.rows[2].cells[0].source_locator, `docx://${expectedHash}/table/0/row/2/cell/0`);
    assert.equal(table.grid.has_merged_cells, true);
    assert.deepEqual(document.relationships, [{
      relationship_id: 'rIdExternal', relationship_type: 'reference', target_mode: 'External', external_reference_only: true, target: null,
    }]);
    assert.equal(result.reference_package.source_classification, 'REFERENCE_TENDER_PACKAGE');
    const canonicalProvenance = [
      ...result.sectionCandidates,
      ...result.tableCandidates,
      ...result.fieldCandidates,
      ...result.referenceValues,
      ...result.ruleCandidates,
    ];
    assert.ok(canonicalProvenance.length > 0);
    for (const candidate of canonicalProvenance) {
      assert.equal(candidate.source_document_id, result.reference_document.reference_document_id);
      assert.equal(candidate.source_hash, expectedHash);
      assert.match(candidate.source_locator, new RegExp(`^docx://${expectedHash}/`));
      assert.match(candidate.extraction_method, /^DETERMINISTIC_OOXML_/);
      assert.equal(JSON.stringify(candidate).includes(directory), false, 'provenance cannot contain a local path');
    }
    assert.ok(result.referenceValues.every((value) => value.truth_scope === foundation.TRUTH_SCOPE.REFERENCE_ONLY));
    assert.ok(result.ruleCandidates.some((candidate) => candidate.rule_type === 'CONTROL_PRICE_RULE'));
    assert.ok(result.ruleCandidates.some((candidate) => candidate.rule_type === 'INVALID_ABOVE_CONTROL_PRICE_RULE'));
    assert.ok(result.ruleCandidates.some((candidate) => candidate.rule_type === 'SOURCE_PRIORITY_RULE'));
    const referenceProjectName = result.referenceValues.find((value) => value.field === 'project_name');
    assert.ok(referenceProjectName);
    assert.equal(foundation.validateProjectFieldValue({ field: 'project_name', value: referenceProjectName }).allowed, false);
    assert.equal(foundation.scanReferenceResidual({ outputText: referenceProjectName.value, referenceValues: [referenceProjectName] }).passed, false);

    const repeated = await parser.parseDocx({ filePath: fixturePath, expectedSourceHash: expectedHash, enterpriseId: 'enterprise-test' });
    assert.equal(repeated.reference_document.reference_document_id, result.reference_document.reference_document_id, 'same source must retain a stable document identity');
    const differentFixturePath = await writeFixture(directory, 'different-reference.docx', syntheticEntries().map((entry) => entry.name === 'word/document.xml'
      ? { ...entry, content: DOCUMENT.replace('合成阀门参考项目', '不同合成参考项目') }
      : entry));
    const different = await parser.parseDocx({ filePath: differentFixturePath });
    assert.notEqual(different.reference_document.reference_document_id, result.reference_document.reference_document_id, 'different source hashes cannot reuse a document identity');

    await expectCode(() => parser.parseDocx({ filePath: fixturePath, expectedSourceHash: '0'.repeat(64) }), 'SOURCE_HASH_MISMATCH');
    await expectCode(() => parser.parseDocx({ filePath: fixturePath, limits: { maxSourceFileSize: 1 } }), 'SOURCE_FILE_TOO_LARGE');
    await expectCode(() => parser.parseDocx({ filePath: path.join(directory, 'not-docx.txt') }), 'UNSUPPORTED_SOURCE_TYPE');

    const malformedZip = path.join(directory, 'malformed.docx');
    await fs.writeFile(malformedZip, 'not a zip');
    await expectCode(() => parser.parseDocx({ filePath: malformedZip }), 'DOCX_ARCHIVE_OPEN_FAILED');

    const traversal = await writeFixture(directory, 'traversal.docx', syntheticEntries([{ name: '../escape.xml', content: 'blocked' }]));
    await expectCode(() => parser.parseDocx({ filePath: traversal }), 'ARCHIVE_PATH_TRAVERSAL_BLOCKED');
    const missingDocument = await writeFixture(directory, 'missing-document.docx', [{ name: '[Content_Types].xml', content: CONTENT_TYPES }]);
    await expectCode(() => parser.parseDocx({ filePath: missingDocument }), 'REQUIRED_OOXML_PART_MISSING');
    const entries = await writeFixture(directory, 'entries.docx', syntheticEntries([{ name: 'word/x1.xml', content: '1' }, { name: 'word/x2.xml', content: '2' }]));
    await expectCode(() => parser.parseDocx({ filePath: entries, limits: { maxEntries: 2 } }), 'ZIP_ENTRY_LIMIT_EXCEEDED');
    await expectCode(() => parser.parseDocx({ filePath: fixturePath, limits: { maxEntryUncompressedSize: 20 } }), 'ZIP_ENTRY_SIZE_LIMIT_EXCEEDED');
    await expectCode(() => parser.parseDocx({ filePath: fixturePath, limits: { maxTotalUncompressedSize: 20 } }), 'ZIP_TOTAL_UNCOMPRESSED_SIZE_LIMIT_EXCEEDED');
    const malformedXml = await writeFixture(directory, 'malformed-xml.docx', syntheticEntries().map((entry) => entry.name === 'word/document.xml'
      ? { ...entry, content: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' }
      : entry));
    await expectCode(() => parser.parseDocx({ filePath: malformedXml }), 'OOXML_PARSE_FAILED');
    const doctype = await writeFixture(directory, 'doctype.docx', syntheticEntries().map((entry) => entry.name === 'word/document.xml'
      ? { ...entry, content: '<!DOCTYPE x [<!ENTITY y "no">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&y;</w:t></w:r></w:p></w:body></w:document>' }
      : entry));
    await expectCode(() => parser.parseDocx({ filePath: doctype }), 'UNSAFE_XML_DECLARATION');
    const ratio = await writeFixture(directory, 'ratio.docx', syntheticEntries([{ name: 'word/large.txt', content: 'a'.repeat(20_000) }]));
    await expectCode(() => parser.parseDocx({ filePath: ratio, limits: { maxCompressionRatio: 2 } }), 'ZIP_COMPRESSION_RATIO_LIMIT_EXCEEDED');
    const macro = await writeFixture(directory, 'macro.docx', syntheticEntries([{ name: 'word/vbaProject.bin', content: 'not-executed', method: 0 }]));
    const macroResult = await parser.parseDocx({ filePath: macro });
    assert.equal(macroResult.structured_document.parser_metadata.macro_execution, 'IMPOSSIBLE_BY_DESIGN');
    assert.equal(macroResult.structured_document.parser_metadata.ignored_unsafe_entries[0].category, 'MACRO');
    const executable = await writeFixture(directory, 'executable.docx', syntheticEntries([{ name: 'word/embeddings/unsafe.exe', content: 'not-executed', method: 0 }]));
    const executableResult = await parser.parseDocx({ filePath: executable });
    assert.equal(executableResult.structured_document.parser_metadata.ignored_unsafe_entries[0].category, 'UNSAFE_EMBEDDED_CONTENT');
  });
}

async function runOptionalRealSourceIntegration() {
  const filePath = process.env.VALVE_REFERENCE_DOCX_PATH;
  const expectedSourceHash = process.env.VALVE_REFERENCE_DOCX_EXPECTED_SHA256;
  if (!filePath && !expectedSourceHash) return { status: 'NOT_REQUESTED' };
  assert.ok(filePath && expectedSourceHash, 'real integration requires both VALVE_REFERENCE_DOCX_PATH and VALVE_REFERENCE_DOCX_EXPECTED_SHA256');
  assert.match(expectedSourceHash, /^[a-f0-9]{64}$/);
  const result = await parser.parseDocx({ filePath, expectedSourceHash });
  const summary = safeSummary(result);
  assert.equal(summary.source_hash, expectedSourceHash);
  assert.equal(summary.paragraph_count, 969);
  assert.equal(summary.top_level_table_count, 5);
  assert.equal(summary.total_row_count, 75);
  assert.equal(summary.merged_table_count, 2);
  for (const ruleType of ['CONTROL_PRICE_RULE', 'INVALID_ABOVE_CONTROL_PRICE_RULE', 'SOURCE_PRIORITY_RULE']) {
    assert.ok(summary.rule_types.includes(ruleType), `missing expected deterministic rule candidate: ${ruleType}`);
  }
  const canonicalProvenance = [
    ...result.sectionCandidates,
    ...result.tableCandidates,
    ...result.fieldCandidates,
    ...result.referenceValues,
    ...result.ruleCandidates,
  ];
  assert.ok(canonicalProvenance.length > 0, 'real source must produce provenance-bearing candidates');
  for (const candidate of canonicalProvenance) {
    assert.equal(candidate.source_document_id, result.reference_document.reference_document_id);
    assert.equal(candidate.source_hash, expectedSourceHash);
    assert.match(candidate.source_locator, new RegExp(`^docx://${expectedSourceHash}/`));
    assert.match(candidate.extraction_method, /^DETERMINISTIC_OOXML_/);
  }
  for (const ruleType of ['CONTROL_PRICE_RULE', 'INVALID_ABOVE_CONTROL_PRICE_RULE', 'SOURCE_PRIORITY_RULE']) {
    const candidates = result.ruleCandidates.filter((candidate) => candidate.rule_type === ruleType);
    assert.ok(candidates.length > 0, `missing expected real provenance for ${ruleType}`);
    assert.ok(candidates.every((candidate) => candidate.source_document_id && candidate.source_hash && candidate.source_locator && candidate.extraction_method));
  }
  assert.ok(result.referenceValues.every((value) => value.truth_scope === foundation.TRUTH_SCOPE.REFERENCE_ONLY));
  const trackedSourceFiles = execFileSync('git', ['ls-files', '--', 'docs/source/valve'], { encoding: 'utf8' }).trim();
  assert.equal(trackedSourceFiles, '', 'private source documents must remain untracked');
  return { status: 'PASS', summary };
}

await runSyntheticContract();
const integration = await runOptionalRealSourceIntegration();
console.log(`${PREFIX} synthetic=PASS real_integration=${integration.status}`);
if (integration.status === 'PASS') console.log(`${PREFIX} real_summary=${JSON.stringify(integration.summary)}`);
