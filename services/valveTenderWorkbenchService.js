'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const parser = require('./valveReferenceDocxParserService');
const env = require('../config/env');
const deploymentReadiness = require('./deploymentReadinessService');

const CAPABILITY_ID = 'capability.valve.reference_workbench.read';

function fingerprint(hash) {
  const value = String(hash || '');
  return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-7)}` : 'NOT_AVAILABLE';
}

function safeError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function currentConfig(overrides = {}) {
  const production = deploymentReadiness.isProduction(env);
  return {
    sourcePath: overrides.sourcePath ?? process.env.VALVE_REFERENCE_DOCX_PATH ?? '',
    expectedHash: overrides.expectedHash ?? process.env.VALVE_REFERENCE_DOCX_SHA256 ?? (production ? '' : process.env.VALVE_REFERENCE_DOCX_EXPECTED_SHA256) ?? '',
    enterpriseId: String(overrides.enterpriseId ?? process.env.VALVE_REFERENCE_ENTERPRISE_ID ?? ''),
    privateRoot: overrides.privateRoot ?? process.env.VALVE_REFERENCE_PRIVATE_ROOT ?? '',
  };
}

function provenance(item = {}) {
  const sourceHash = String(item.source_hash || '');
  return {
    source_document_id: item.source_document_id || 'NOT_AVAILABLE',
    source_hash_fingerprint: fingerprint(item.source_hash),
    source_locator: String(item.source_locator || 'NOT_AVAILABLE').replace(sourceHash, fingerprint(sourceHash)),
    extraction_method: item.extraction_method || 'NOT_AVAILABLE',
  };
}

function project(parsed) {
  const document = parsed.reference_document || {};
  const structured = parsed.structured_document || {};
  const template = parsed.template || {};
  return {
    workspace_status: 'READY',
    reference_template: {
      template_id: template.template_id,
      template_name: template.template_name,
      template_status: template.status,
      source_document_id: document.reference_document_id,
      safe_source_filename: path.basename(document.filename || 'reference.docx'),
      source_hash_fingerprint: fingerprint(document.source_hash),
      confidentiality: document.confidentiality,
      parser_status: document.parse_status,
      foundation_status: 'VERIFIED',
      truth_scope: 'REFERENCE_ONLY',
    },
    source_document: {
      source_document_id: document.reference_document_id,
      safe_source_filename: path.basename(document.filename || 'reference.docx'),
      source_hash_fingerprint: fingerprint(document.source_hash),
      parser_name: structured.metadata?.parser_name,
      parser_version: structured.metadata?.parser_version,
      parser_schema_version: structured.metadata?.parser_schema_version,
    },
    parse_summary: {
      paragraph_count: Number(structured.counts?.paragraph_count || 0),
      table_count: Number(structured.counts?.table_count || 0),
      row_count: Number(structured.counts?.row_count || 0),
      merged_table_count: Number(structured.counts?.merged_table_count || 0),
      parser_name: structured.metadata?.parser_name,
      parser_version: structured.metadata?.parser_version,
      parser_schema_version: structured.metadata?.parser_schema_version,
    },
    sections: (parsed.sectionCandidates || []).map(section => ({
      section_id: section.section_id,
      heading: section.heading,
      level: section.level ?? 'INFERRED',
      truth_status: section.truth_status || 'INFERRED',
      review_status: 'NEEDS_REVIEW',
      ...provenance(section),
    })),
    tables: (parsed.tableCandidates || []).map(table => ({
      table_index: table.table_index,
      role_candidate: table.purpose || 'NEEDS_CLASSIFICATION',
      row_count: Number(table.row_count || 0),
      column_schema: (table.column_candidates || []).map(column => column.label || column.semantic_key).filter(Boolean),
      merged: Boolean(table.merged || table.grid?.has_merged_cells),
      truth_status: 'DOCUMENTED',
      review_status: 'NEEDS_REVIEW',
      ...provenance(table),
    })),
    fields: (parsed.fieldCandidates || []).map(field => ({
      field_id: field.field_id,
      label: field.label,
      semantic_key: field.semantic_key,
      datatype: field.datatype || 'string',
      unit: field.unit_candidate || field.unit || null,
      inheritance_policy: field.inheritance_policy,
      truth_status: field.semantic_status === 'DERIVED_DETERMINISTIC_LABEL_MAP' ? 'INFERRED' : 'DOCUMENTED',
      review_status: 'NEEDS_REVIEW',
      ...provenance(field),
    })),
    rules: (parsed.ruleCandidates || []).map(rule => ({
      rule_type: rule.rule_type,
      truth_scope: rule.truth_scope || 'REFERENCE_ONLY',
      status: rule.source_value_status || 'REFERENCE_ONLY',
      review_status: 'NEEDS_REVIEW',
      ...provenance(rule),
    })),
    review_items: [{ status: 'NEEDS_REVIEW', message: '参考结构已解析；未创建客户项目、报价或产品匹配。' }],
    capability_status: {
      real_docx_parsing: 'VERIFIED', reference_template_foundation: 'VERIFIED', legacy_doc: 'NOT_IMPLEMENTED',
      dwg_structured_extraction: 'NOT_VERIFIED', new_client_project: 'NOT_IMPLEMENTED', product_matching: 'NOT_IMPLEMENTED',
      quotation: 'NOT_IMPLEMENTED', sample_drawing: 'NOT_IMPLEMENTED', cloud: 'PAUSED',
    },
    security_status: {
      confidential_source: 'YES', raw_source_in_git: 'NO', external_ai_used: 'NO', parser_requires_network: 'NO', reference_auto_inheritance: 'BLOCKED',
    },
  };
}

async function readWorkbench({ user, config, parse = parser.parseDocx } = {}) {
  if (!user?.id) throw safeError('ACCESS_DENIED', '请先登录', 401);
  const resolved = currentConfig(config);
  if (deploymentReadiness.isProduction(env)) {
    const readiness = deploymentReadiness.valveProductionReadiness(env, resolved);
    if (!readiness.ready) throw safeError(readiness.failures.includes('SOURCE_PATH_NOT_APPROVED') ? 'SOURCE_PATH_NOT_APPROVED' : 'VALVE_WORKBENCH_NOT_CONFIGURED', '阀门参考工作台尚未完成生产配置', 503);
  }
  if (!resolved.enterpriseId || !resolved.sourcePath || !resolved.expectedHash) throw safeError('REFERENCE_SOURCE_UNAVAILABLE', '尚未配置参考标书', 503);
  if (String(user.enterprise_id || '') !== resolved.enterpriseId) throw safeError('ACCESS_DENIED', '无权访问该企业参考标书', 403);
  try {
    const parsed = await parse({
      filePath: resolved.sourcePath,
      enterpriseId: resolved.enterpriseId,
      expectedSourceHash: resolved.expectedHash,
      confidentiality: 'CONFIDENTIAL',
      sourceDocumentId: `approved:${resolved.expectedHash.slice(0, 12)}`,
    });
    const model = project(parsed);
    const responseHash = crypto.createHash('sha256').update(JSON.stringify(model)).digest('hex');
    return { ...model, realityos: { capability_id: CAPABILITY_ID, effect_class: 'OBSERVATION', response_hash_fingerprint: fingerprint(responseHash), status: 'NOT_VERIFIED_DURABLE_LINKAGE' } };
  } catch (error) {
    if (error.code === 'SOURCE_HASH_MISMATCH') throw safeError('SOURCE_IDENTITY_MISMATCH', '参考源身份校验失败', 409);
    if (/ENOENT|ENOTDIR/.test(String(error.code || ''))) throw safeError('REFERENCE_SOURCE_UNAVAILABLE', '参考源不可用', 503);
    throw safeError('REFERENCE_PARSE_FAILED', '参考模板解析失败', 422);
  }
}

module.exports = { CAPABILITY_ID, fingerprint, project, readWorkbench };
