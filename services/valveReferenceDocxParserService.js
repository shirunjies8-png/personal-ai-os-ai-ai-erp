'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const unzipper = require('unzipper');
const { SaxesParser } = require('saxes');

const foundation = require('./valveReferenceTenderTemplateService');

const PARSER_NAME = 'valveReferenceDocxParserService';
const PARSER_VERSION = '1.0.0';
const PARSER_SCHEMA_VERSION = '1.0.0';
const DEFAULT_LIMITS = Object.freeze({
  maxSourceFileSize: 50 * 1024 * 1024,
  maxEntries: 200,
  maxEntryUncompressedSize: 50 * 1024 * 1024,
  maxTotalUncompressedSize: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
});

const REQUIRED_PARTS = Object.freeze(['word/document.xml']);
const OPTIONAL_PARTS = Object.freeze([
  'word/styles.xml',
  'word/numbering.xml',
  'word/_rels/document.xml.rels',
  '[Content_Types].xml',
]);
const SAFE_PARTS = new Set([...REQUIRED_PARTS, ...OPTIONAL_PARTS]);

function parserError(code, message, details = {}) {
  const error = new Error(message || code);
  error.code = code;
  error.details = details;
  return error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedArchivePath(entryPath) {
  return String(entryPath || '').replace(/\\/g, '/');
}

function isSafeArchivePath(entryPath) {
  const normalized = normalizedArchivePath(entryPath);
  const parts = normalized.split('/').filter(Boolean);
  return Boolean(
    normalized
      && !normalized.startsWith('/')
      && !/^[a-zA-Z]:/.test(normalized)
      && !parts.includes('..'),
  );
}

function isUnsafeExecutableEntry(entryPath) {
  const normalized = normalizedArchivePath(entryPath).toLowerCase();
  return normalized.endsWith('.exe')
    || normalized.endsWith('.dll')
    || normalized.endsWith('.bat')
    || normalized.endsWith('.cmd')
    || normalized.endsWith('.sh')
    || normalized.endsWith('.js')
    || normalized.endsWith('.vbs')
    || normalized.includes('/embeddings/');
}

function isMacroEntry(entryPath) {
  return normalizedArchivePath(entryPath).toLowerCase().endsWith('vbaproject.bin');
}

function readAttribute(attributes, localName) {
  return attributes[localName]
    || attributes[`w:${localName}`]
    || Object.entries(attributes).find(([key]) => key.endsWith(`:${localName}`))?.[1]
    || null;
}

function attributeValue(attribute) {
  if (attribute && typeof attribute === 'object' && Object.hasOwn(attribute, 'value')) {
    return attribute.value;
  }
  return attribute;
}

function localTagName(tag) {
  const name = typeof tag === 'string' ? tag : tag?.name;
  return String(name || '').split(':').at(-1);
}

function sourceLocator(sourceHash, kind, indexes) {
  if (kind === 'paragraph') {
    return `docx://${sourceHash}/paragraph/${indexes.paragraph_index}`;
  }
  return `docx://${sourceHash}/table/${indexes.table_index}/row/${indexes.row_index}/cell/${indexes.xml_cell_index}`;
}

function createFieldSemanticCandidate(label) {
  const normalizedLabel = String(label || '').trim().replace(/\s+/g, '');
  const mappings = new Map([
    ['项目名称', 'project_name'],
    ['采购人', 'purchaser'],
    ['招标人', 'purchaser'],
    ['项目编号', 'project_no'],
    ['采购编号', 'project_no'],
    ['招标编号', 'project_no'],
    ['控制价', 'control_price'],
    ['最高限价', 'control_price'],
    ['数量', 'quantity'],
    ['工程量', 'quantity'],
    ['单价', 'unit_price'],
    ['总价', 'final_quote'],
    ['合价', 'final_quote'],
    ['金额', 'final_quote'],
    ['DN', 'dn'],
    ['PN', 'pn'],
    ['材质', 'material'],
    ['材料', 'material'],
    ['联系人', 'customer_contact'],
    ['地址', 'address'],
    ['交货期', 'delivery_date'],
    ['供货期', 'delivery_date'],
  ]);
  const semanticKey = mappings.get(normalizedLabel);
  if (semanticKey) {
    return { semantic_key: semanticKey, semantic_status: 'DERIVED_DETERMINISTIC_LABEL_MAP' };
  }
  return {
    semantic_key: `unknown_field_${sha256(normalizedLabel || 'empty').slice(0, 12)}`,
    semantic_status: 'UNKNOWN',
  };
}

function assertSafeXml(xml, partName) {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw parserError('UNSAFE_XML_DECLARATION', 'DOCTYPE and ENTITY declarations are forbidden', { part: partName });
  }
}

function parseWithSaxes(xml, partName, register) {
  assertSafeXml(xml, partName);
  const parser = new SaxesParser({ xmlns: false });
  let parseFailure = null;
  parser.on('error', (error) => {
    parseFailure = error;
  });
  register(parser);
  try {
    parser.write(xml).close();
  } catch (error) {
    throw parserError('OOXML_PARSE_FAILED', 'OOXML parser rejected the document part', { part: partName });
  }
  if (parseFailure) {
    throw parserError('OOXML_PARSE_FAILED', 'OOXML parser rejected the document part', { part: partName });
  }
}

function parseStyleNames(xml) {
  const styles = new Map();
  let activeStyleId = null;
  parseWithSaxes(xml, 'word/styles.xml', (parser) => {
    parser.on('opentag', (tag) => {
      if (localTagName(tag) === 'style') {
        activeStyleId = attributeValue(readAttribute(tag.attributes, 'styleId')) || null;
      }
      if (localTagName(tag) === 'name' && activeStyleId) {
        styles.set(activeStyleId, attributeValue(readAttribute(tag.attributes, 'val')) || '');
      }
    });
    parser.on('closetag', (tag) => {
      if (localTagName(tag) === 'style') activeStyleId = null;
    });
  });
  return styles;
}

function parseRelationships(xml) {
  const relationships = [];
  parseWithSaxes(xml, 'word/_rels/document.xml.rels', (parser) => {
    parser.on('opentag', (tag) => {
      if (localTagName(tag) !== 'Relationship') return;
      const targetMode = attributeValue(readAttribute(tag.attributes, 'TargetMode')) || 'Internal';
      relationships.push({
        relationship_id: attributeValue(readAttribute(tag.attributes, 'Id')) || null,
        relationship_type: String(attributeValue(readAttribute(tag.attributes, 'Type')) || '').split('/').at(-1) || null,
        target_mode: targetMode,
        external_reference_only: targetMode === 'External',
        target: null,
      });
    });
  });
  return relationships;
}

function parseDocumentXml(xml, sourceHash, styles) {
  const paragraphs = [];
  const tables = [];
  const blocks = [];
  const sourceNodes = [];
  const stack = [];
  const tableStack = [];
  const rowStack = [];
  const cellStack = [];
  let currentParagraph = null;
  let textDepth = 0;
  let inBody = false;

  function activeTable() {
    return tableStack.at(-1) || null;
  }
  function activeRow() {
    return rowStack.at(-1) || null;
  }
  function activeCell() {
    return cellStack.at(-1) || null;
  }

  parseWithSaxes(xml, 'word/document.xml', (parser) => {
    parser.on('opentag', (tag) => {
      const name = localTagName(tag);
      const parent = stack.at(-1) || null;
      if (name === 'body') inBody = true;

      if (name === 'tbl' && inBody) {
        const isTopLevel = parent === 'body';
        const table = {
          table_index: tables.length,
          block_index: isTopLevel ? blocks.length : null,
          is_top_level: isTopLevel,
          source_locator: `docx://${sourceHash}/table/${tables.length}`,
          rows: [],
          grid: { has_merged_cells: false },
        };
        tables.push(table);
        tableStack.push(table);
        if (isTopLevel) blocks.push({ type: 'TABLE', block_index: blocks.length, table_index: table.table_index });
      }

      if (name === 'tr' && activeTable()) {
        const row = { row_index: activeTable().rows.length, source_locator: null, cells: [], logical_cursor: 0 };
        row.source_locator = `docx://${sourceHash}/table/${activeTable().table_index}/row/${row.row_index}`;
        activeTable().rows.push(row);
        rowStack.push(row);
      }

      if (name === 'tc' && activeRow()) {
        const row = activeRow();
        const table = activeTable();
        const cell = {
          xml_cell_index: row.cells.length,
          logical_column_start: row.logical_cursor,
          grid_span: 1,
          vertical_merge: 'NONE',
          text_parts: [],
          source_locator: sourceLocator(sourceHash, 'cell', {
            table_index: table.table_index,
            row_index: row.row_index,
            xml_cell_index: row.cells.length,
          }),
        };
        row.cells.push(cell);
        cellStack.push(cell);
      }

      if (name === 'p' && inBody) {
        const paragraph = {
          paragraph_index: paragraphs.length,
          block_index: parent === 'body' ? blocks.length : null,
          text_parts: [],
          style_id: null,
          numbering: { num_id: null, level: null },
          heading_candidate: false,
          heading_source: 'NONE',
          truth_status: 'DOCUMENTED',
          source_locator: sourceLocator(sourceHash, 'paragraph', { paragraph_index: paragraphs.length }),
        };
        paragraphs.push(paragraph);
        currentParagraph = paragraph;
        if (parent === 'body') blocks.push({ type: 'PARAGRAPH', block_index: blocks.length, paragraph_index: paragraph.paragraph_index });
      }

      if (name === 'pStyle' && currentParagraph) {
        currentParagraph.style_id = attributeValue(readAttribute(tag.attributes, 'val')) || null;
      }
      if (name === 'numId' && currentParagraph) {
        currentParagraph.numbering.num_id = attributeValue(readAttribute(tag.attributes, 'val')) || null;
      }
      if (name === 'ilvl' && currentParagraph) {
        currentParagraph.numbering.level = attributeValue(readAttribute(tag.attributes, 'val')) || null;
      }
      if (name === 'gridSpan' && activeCell()) {
        activeCell().grid_span = Number(attributeValue(readAttribute(tag.attributes, 'val')) || 1);
        activeTable().grid.has_merged_cells = activeCell().grid_span > 1 || activeTable().grid.has_merged_cells;
      }
      if (name === 'vMerge' && activeCell()) {
        activeCell().vertical_merge = attributeValue(readAttribute(tag.attributes, 'val')) === 'restart' ? 'RESTART' : 'CONTINUE';
        activeTable().grid.has_merged_cells = true;
      }
      if (name === 't') textDepth += 1;
      stack.push(name);
    });

    parser.on('text', (text) => {
      if (!textDepth) return;
      if (currentParagraph) currentParagraph.text_parts.push(text);
      if (activeCell()) activeCell().text_parts.push(text);
    });

    parser.on('closetag', (tag) => {
      const name = localTagName(tag);
      if (name === 't') textDepth = Math.max(0, textDepth - 1);
      if (name === 'p' && currentParagraph) {
        currentParagraph.text = currentParagraph.text_parts.join('');
        delete currentParagraph.text_parts;
        sourceNodes.push({ type: 'PARAGRAPH', text: currentParagraph.text, source_locator: currentParagraph.source_locator });
        currentParagraph = null;
      }
      if (name === 'tc' && activeCell()) {
        const cell = activeCell();
        cell.text = cell.text_parts.join('');
        delete cell.text_parts;
        sourceNodes.push({ type: 'TABLE_CELL', text: cell.text, source_locator: cell.source_locator });
        activeRow().logical_cursor += cell.grid_span;
        cellStack.pop();
      }
      if (name === 'tr' && activeRow()) rowStack.pop();
      if (name === 'tbl' && activeTable()) tableStack.pop();
      if (name === 'body') inBody = false;
      stack.pop();
    });
  });

  for (const paragraph of paragraphs) {
    const styleName = styles.get(paragraph.style_id) || '';
    if (/heading|标题/i.test(styleName)) {
      paragraph.heading_candidate = true;
      paragraph.heading_source = 'STYLE';
      paragraph.truth_status = 'DOCUMENTED';
    } else if (paragraph.numbering.num_id !== null) {
      paragraph.heading_candidate = true;
      paragraph.heading_source = 'NUMBERING';
      paragraph.truth_status = 'INFERRED';
    } else if (/^(第[一二三四五六七八九十0-9]+[章节部分]|[一二三四五六七八九十]+[、.]|\d+(?:\.\d+)*[、.])/.test(paragraph.text)) {
      paragraph.heading_candidate = true;
      paragraph.heading_source = 'HEURISTIC';
      paragraph.truth_status = 'INFERRED';
    }
  }

  const topLevelTables = tables.filter((table) => table.is_top_level);
  const sumRows = (items) => items.reduce((sum, table) => sum + table.rows.length, 0);
  const countMergedTables = (items) => items.filter((table) => table.grid.has_merged_cells).length;
  return {
    blocks,
    paragraphs,
    tables,
    sourceNodes,
    counts: {
      paragraph_count: paragraphs.length,
      table_count: topLevelTables.length,
      row_count: sumRows(topLevelTables),
      merged_table_count: countMergedTables(topLevelTables),
      nested_table_count: tables.length - topLevelTables.length,
      all_table_row_count: sumRows(tables),
      all_merged_table_count: countMergedTables(tables),
    },
  };
}

function extractTemplateCandidates({ structuredDocument, referencePackage, referenceDocument }) {
  const templateId = `tmpl_${referencePackage.reference_package_id}`;
  const provenanceFor = (sourceLocator, extractionMethod) => foundation.createReferenceProvenance({
    referenceDocument,
    sourceLocator,
    extractionMethod,
  });
  const sectionCandidates = structuredDocument.paragraphs
    .filter((paragraph) => paragraph.heading_candidate && paragraph.text)
    .map((paragraph, index) => {
      const provenance = provenanceFor(paragraph.source_locator, `DETERMINISTIC_OOXML_${paragraph.heading_source}`);
      return {
        ...foundation.createTemplateSection({
        templateId,
        order: index + 1,
        heading: paragraph.text,
        purpose: 'NEEDS_CLASSIFICATION',
        sourceRef: provenance,
        }),
        ...provenance,
        level: paragraph.numbering.level,
        heading_source: paragraph.heading_source,
        truth_status: paragraph.truth_status,
      };
    });

  const fieldCandidates = [];
  const tableCandidates = structuredDocument.tables.filter((table) => table.is_top_level).map((table) => {
    const headerRow = table.rows.find((row) => row.cells.some((cell) => cell.text)) || null;
    const columns = (headerRow?.cells || []).map((cell) => cell.text).filter(Boolean);
    const columnCandidates = (headerRow?.cells || []).filter((cell) => cell.text).map((cell, columnIndex) => {
      const semantic = createFieldSemanticCandidate(cell.text);
      const provenance = provenanceFor(cell.source_locator, 'DETERMINISTIC_OOXML_TABLE_HEADER');
      const field = foundation.createTemplateField({
        fieldId: `field_${table.table_index}_${columnIndex}`,
        semanticKey: semantic.semantic_key,
        label: cell.text,
        sourceRef: provenance,
      });
      field.semantic_status = semantic.semantic_status;
      Object.assign(field, provenance);
      fieldCandidates.push(field);
      return {
        column_index: columnIndex,
        header_text: cell.text,
        semantic_key_candidate: semantic.semantic_key,
        semantic_status: semantic.semantic_status,
        datatype_candidate: 'UNKNOWN',
        unit_candidate: null,
        inheritance_policy: field.inheritance_policy,
        ...provenance,
      };
    });
    const tableProvenance = provenanceFor(table.source_locator, 'DETERMINISTIC_OOXML_TABLE');
    const tableCandidate = foundation.createTemplateTable({
      tableId: `${templateId}_table_${table.table_index}`,
      purpose: 'NEEDS_CLASSIFICATION',
      columns,
      requiredColumns: [],
      rowSemantics: 'REFERENCE_ROWS_ONLY',
      sourceRef: tableProvenance,
    });
    Object.assign(tableCandidate, tableProvenance);
    tableCandidate.table_index = table.table_index;
    tableCandidate.block_index = table.block_index;
    tableCandidate.column_candidates = columnCandidates;
    tableCandidate.historical_rows_scope = foundation.TRUTH_SCOPE.REFERENCE_ONLY;
    return tableCandidate;
  });

  const referenceValues = [];
  for (const node of structuredDocument.sourceNodes) {
    const pair = /^\s*([^:：]{1,40})\s*[:：]\s*(.+?)\s*$/.exec(node.text);
    if (!pair) continue;
    const semantic = createFieldSemanticCandidate(pair[1]);
    if (semantic.semantic_status === 'UNKNOWN') continue;
    const provenance = provenanceFor(node.source_locator, 'DETERMINISTIC_OOXML_LABEL_VALUE_PAIR');
    referenceValues.push({
      ...foundation.createReferenceValue({
        field: semantic.semantic_key,
        value: pair[2],
        sourceRef: provenance,
      }),
      ...provenance,
    });
  }
  for (const table of structuredDocument.tables) {
    for (const row of table.rows) {
      for (let index = 0; index < row.cells.length - 1; index += 1) {
        const label = row.cells[index].text.trim();
        const value = row.cells[index + 1].text.trim();
        const semantic = createFieldSemanticCandidate(label);
        if (!label || !value || semantic.semantic_status === 'UNKNOWN') continue;
        const provenance = provenanceFor(row.cells[index + 1].source_locator, 'DETERMINISTIC_OOXML_TABLE_LABEL_VALUE_PAIR');
        referenceValues.push({
          ...foundation.createReferenceValue({
            field: semantic.semantic_key,
            value,
            sourceRef: provenance,
          }),
          ...provenance,
        });
      }
    }
  }

  const ruleCandidates = [];
  const addRule = (ruleType, node, extractionMethod) => {
    const provenance = provenanceFor(node.source_locator, extractionMethod);
    ruleCandidates.push({
      rule_type: ruleType,
      ...provenance,
      truth_scope: foundation.TRUTH_SCOPE.REFERENCE_ONLY,
      source_value_status: 'REFERENCE_ONLY',
    });
  };
  for (const node of structuredDocument.sourceNodes) {
    const text = node.text;
    if (text.includes('控制价') || text.includes('最高限价')) addRule('CONTROL_PRICE_RULE', node, 'DETERMINISTIC_OOXML_TEXT_PATTERN');
    if ((text.includes('报价') || text.includes('投标报价')) && (text.includes('无效') || text.includes('否决'))) addRule('INVALID_ABOVE_CONTROL_PRICE_RULE', node, 'DETERMINISTIC_OOXML_TEXT_PATTERN');
    if (text.includes('清单') && text.includes('图纸') && (text.includes('不一致') || text.includes('不符'))) addRule('SOURCE_PRIORITY_RULE', node, 'DETERMINISTIC_OOXML_TEXT_PATTERN');
    if ((text.includes('二次报价') || text.includes('最终报价')) && text.length > 0) addRule('QUOTE_ROUND_RULE', node, 'DETERMINISTIC_OOXML_TEXT_PATTERN');
  }

  const template = foundation.createReferenceTenderTemplate({
    referencePackage,
    referenceDocuments: [referenceDocument],
    templateId,
    sections: sectionCandidates,
    tables: tableCandidates,
    fields: fieldCandidates,
    referenceValues,
    ruleCandidates,
  });
  return { template, sectionCandidates, tableCandidates, fieldCandidates, referenceValues, ruleCandidates };
}

async function validateArchive(buffer, limits) {
  let archive;
  try {
    archive = await unzipper.Open.buffer(buffer);
  } catch {
    throw parserError('DOCX_ARCHIVE_OPEN_FAILED', 'DOCX archive could not be opened');
  }
  if (archive.files.length > limits.maxEntries) {
    throw parserError('ZIP_ENTRY_LIMIT_EXCEEDED', 'DOCX archive has too many entries');
  }
  let totalUncompressed = 0;
  const ignoredUnsafeEntries = [];
  for (const entry of archive.files) {
    if (!isSafeArchivePath(entry.path)) {
      throw parserError('ARCHIVE_PATH_TRAVERSAL_BLOCKED', 'DOCX archive contains an unsafe entry path');
    }
    const uncompressedSize = Number(entry.uncompressedSize || 0);
    const compressedSize = Number(entry.compressedSize || 0);
    totalUncompressed += uncompressedSize;
    if (uncompressedSize > limits.maxEntryUncompressedSize) {
      throw parserError('ZIP_ENTRY_SIZE_LIMIT_EXCEEDED', 'DOCX archive entry is too large');
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > limits.maxCompressionRatio) {
      throw parserError('ZIP_COMPRESSION_RATIO_LIMIT_EXCEEDED', 'DOCX archive compression ratio is suspicious');
    }
    if (isUnsafeExecutableEntry(entry.path) || isMacroEntry(entry.path)) {
      ignoredUnsafeEntries.push({ entry_name: path.basename(entry.path), category: isMacroEntry(entry.path) ? 'MACRO' : 'UNSAFE_EMBEDDED_CONTENT' });
    }
  }
  if (totalUncompressed > limits.maxTotalUncompressedSize) {
    throw parserError('ZIP_TOTAL_UNCOMPRESSED_SIZE_LIMIT_EXCEEDED', 'DOCX archive total uncompressed content is too large');
  }
  const entries = new Map(archive.files.map((entry) => [entry.path, entry]));
  for (const requiredPart of REQUIRED_PARTS) {
    if (!entries.has(requiredPart)) {
      throw parserError('REQUIRED_OOXML_PART_MISSING', 'Required DOCX part is missing', { part: requiredPart });
    }
  }
  const parts = {};
  for (const partName of SAFE_PARTS) {
    if (!entries.has(partName)) continue;
    parts[partName] = (await entries.get(partName).buffer()).toString('utf8');
  }
  return {
    parts,
    archiveSecurity: {
      entry_count: archive.files.length,
      total_uncompressed_size: totalUncompressed,
      ignored_unsafe_entries: ignoredUnsafeEntries,
      macro_execution: 'IMPOSSIBLE_BY_DESIGN',
      compression_ratio_protection: true,
      path_traversal_protection: true,
    },
  };
}

async function parseDocx({
  filePath,
  enterpriseId = null,
  expectedSourceHash = null,
  confidentiality = foundation.CONFIDENTIALITY.CONFIDENTIAL,
  sourceDocumentId = null,
  limits = {},
}) {
  if (!filePath || path.extname(filePath).toLowerCase() !== '.docx') {
    throw parserError('UNSUPPORTED_SOURCE_TYPE', 'Only .docx input is supported');
  }
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const stat = await fs.stat(filePath);
  if (stat.size > resolvedLimits.maxSourceFileSize) {
    throw parserError('SOURCE_FILE_TOO_LARGE', 'Source DOCX exceeds the configured size limit');
  }
  const sourceBuffer = await fs.readFile(filePath);
  const sourceHash = sha256(sourceBuffer);
  if (expectedSourceHash && sourceHash !== expectedSourceHash) {
    throw parserError('SOURCE_HASH_MISMATCH', 'Source DOCX hash does not match the approved input');
  }
  const archive = await validateArchive(sourceBuffer, resolvedLimits);
  const styles = archive.parts['word/styles.xml'] ? parseStyleNames(archive.parts['word/styles.xml']) : new Map();
  const relationships = archive.parts['word/_rels/document.xml.rels'] ? parseRelationships(archive.parts['word/_rels/document.xml.rels']) : [];
  const parsed = parseDocumentXml(archive.parts['word/document.xml'], sourceHash, styles);
  const filename = path.basename(filePath);
  const referencePackage = foundation.createReferenceTenderPackage({
    title: 'Valve reference tender package',
    sourcePackageHash: sourceHash,
    sourceFileCount: 1,
    enterpriseId,
    parserVersion: PARSER_VERSION,
  });
  const referenceDocument = foundation.createReferenceTenderDocument({
    referencePackageId: referencePackage.reference_package_id,
    enterpriseId,
    filename,
    documentType: 'TENDER_DOCUMENT',
    sourceHash,
    format: 'docx',
    parser: PARSER_NAME,
    parserVersion: PARSER_VERSION,
    parseStatus: 'STRUCTURED_LOCAL_CANDIDATE',
    sourceRef: { source_hash: sourceHash, external_source_reference_id: sourceDocumentId || null },
  });
  const structuredDocument = {
    source: {
      source_document_id: referenceDocument.reference_document_id,
      filename,
      source_hash: sourceHash,
      size: stat.size,
      confidentiality,
      enterprise_id: enterpriseId,
    },
    metadata: {
      parser_name: PARSER_NAME,
      parser_version: PARSER_VERSION,
      parser_schema_version: PARSER_SCHEMA_VERSION,
      parsed_at: new Date().toISOString(),
      parse_status: 'PARSED',
      temp_storage: 'MEMORY_ONLY',
      external_relationship_policy: 'EXTERNAL_REFERENCE_ONLY',
      xml_security: 'DOCTYPE_AND_ENTITY_REJECTED_NO_EXTERNAL_RESOLVER',
    },
    blocks: parsed.blocks,
    paragraphs: parsed.paragraphs,
    tables: parsed.tables,
    counts: parsed.counts,
    relationships,
    parser_metadata: archive.archiveSecurity,
    sourceNodes: parsed.sourceNodes,
  };
  const candidates = extractTemplateCandidates({ structuredDocument, referencePackage, referenceDocument });
  return {
    structured_document: structuredDocument,
    reference_package: referencePackage,
    reference_document: referenceDocument,
    ...candidates,
  };
}

module.exports = {
  PARSER_NAME,
  PARSER_VERSION,
  PARSER_SCHEMA_VERSION,
  DEFAULT_LIMITS,
  parseDocx,
  sourceLocator,
};
