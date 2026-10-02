'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CONFIDENTIALITY = Object.freeze({
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED',
});

const TRUTH_SCOPE = Object.freeze({
  REFERENCE_ONLY: 'REFERENCE_ONLY',
  PROJECT_TRUTH: 'PROJECT_TRUTH',
});

const INHERITANCE_POLICY = Object.freeze({
  STRUCTURE_ONLY: 'STRUCTURE_ONLY',
  USER_INPUT_REQUIRED: 'USER_INPUT_REQUIRED',
  PROJECT_SOURCE_REQUIRED: 'PROJECT_SOURCE_REQUIRED',
  PRODUCT_MASTER_REQUIRED: 'PRODUCT_MASTER_REQUIRED',
  CALCULATED: 'CALCULATED',
  HUMAN_APPROVAL_REQUIRED: 'HUMAN_APPROVAL_REQUIRED',
  NEVER_INHERIT: 'NEVER_INHERIT',
});

const DEFAULT_NEVER_INHERIT_KEYS = Object.freeze([
  'purchaser',
  'client',
  'project_name',
  'project_no',
  'control_price',
  'final_quote',
  'unit_price',
  'quantity',
  'delivery_date',
  'tax_rate',
  'customer_contact',
  'address',
  'dn',
  'pn',
  'material',
  'actuator',
  'dimension',
  'drawing_value',
]);

const ALLOWED_SOURCE_EXTENSIONS = Object.freeze(['.doc', '.docx', '.dwg']);
const DEFAULT_MAX_FILES = 200;
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSemanticKey(key) {
  return String(key || '').trim().toLowerCase();
}

function policyForSemanticKey(key) {
  const normalized = normalizeSemanticKey(key);
  if (DEFAULT_NEVER_INHERIT_KEYS.includes(normalized)) {
    return INHERITANCE_POLICY.NEVER_INHERIT;
  }
  if (normalized.includes('price') || normalized.includes('quote')) {
    return INHERITANCE_POLICY.HUMAN_APPROVAL_REQUIRED;
  }
  if (normalized.includes('product_')) {
    return INHERITANCE_POLICY.PRODUCT_MASTER_REQUIRED;
  }
  if (normalized.includes('calculated')) {
    return INHERITANCE_POLICY.CALCULATED;
  }
  return INHERITANCE_POLICY.STRUCTURE_ONLY;
}

function createReferenceTenderPackage({
  title,
  sourcePackageHash,
  sourceFileCount,
  enterpriseId = null,
  parserVersion = 'valve-reference-template-v1',
  importedAt = nowIso(),
  status = 'REFERENCE_IMPORTED',
}) {
  if (!sourcePackageHash) {
    throw new Error('sourcePackageHash is required');
  }
  return {
    reference_package_id: `refpkg_${sourcePackageHash.slice(0, 12)}`,
    title: title || 'Valve reference tender package',
    source_package_hash: sourcePackageHash,
    source_file_count: Number(sourceFileCount || 0),
    source_classification: 'REFERENCE_TENDER_PACKAGE',
    confidentiality_level: CONFIDENTIALITY.CONFIDENTIAL,
    enterprise_id: enterpriseId,
    imported_at: importedAt,
    parser_version: parserVersion,
    status,
  };
}

function createReferenceTenderDocument({
  referencePackageId,
  enterpriseId = null,
  filename,
  documentType,
  sourceHash,
  format,
  parser = 'metadata',
  parserVersion = 'valve-reference-template-v1',
  parseStatus = 'METADATA_ONLY',
  sourceRef,
}) {
  if (!referencePackageId || !filename || !sourceHash) {
    throw new Error('referencePackageId, filename, and sourceHash are required');
  }
  return {
    reference_document_id: `refdoc_${sourceHash.slice(0, 12)}`,
    reference_package_id: referencePackageId,
    filename,
    document_type: documentType || 'UNKNOWN',
    source_hash: sourceHash,
    format: format || path.extname(filename).toLowerCase().replace('.', ''),
    parser,
    parser_version: parserVersion,
    parse_status: parseStatus,
    confidentiality: CONFIDENTIALITY.CONFIDENTIAL,
    enterprise_id: enterpriseId,
    source_ref: sourceRef || { filename, source_hash: sourceHash },
  };
}

function createReferenceProvenance({ referenceDocument, sourceLocator, extractionMethod }) {
  if (!referenceDocument?.reference_document_id || !referenceDocument?.source_hash) {
    throw new Error('referenceDocument.reference_document_id and referenceDocument.source_hash are required');
  }
  if (!sourceLocator || !extractionMethod) {
    throw new Error('sourceLocator and extractionMethod are required');
  }
  return {
    source_document_id: referenceDocument.reference_document_id,
    source_hash: referenceDocument.source_hash,
    source_locator: sourceLocator,
    extraction_method: extractionMethod,
  };
}

function createTemplateField({
  fieldId,
  semanticKey,
  label,
  datatype = 'string',
  unit = null,
  required = false,
  applicableContext = 'REFERENCE_TEMPLATE',
  sourceRef,
  inheritancePolicy,
}) {
  const key = normalizeSemanticKey(semanticKey);
  return {
    field_id: fieldId || `field_${key}`,
    semantic_key: key,
    label: label || semanticKey,
    datatype,
    unit,
    required: Boolean(required),
    applicable_context: applicableContext,
    source_ref: sourceRef || null,
    inheritance_policy: inheritancePolicy || policyForSemanticKey(key),
  };
}

function createReferenceValue({ field, value, sourceRef, referenceProject }) {
  return {
    field: normalizeSemanticKey(field),
    value,
    source_ref: sourceRef || null,
    reference_project: referenceProject || null,
    truth_scope: TRUTH_SCOPE.REFERENCE_ONLY,
  };
}

function createTemplateSection({
  sectionId,
  templateId,
  order,
  heading,
  purpose,
  mandatory = false,
  repeatable = false,
  sourceRef,
}) {
  return {
    section_id: sectionId || `${templateId}_section_${order}`,
    template_id: templateId,
    order,
    heading,
    purpose,
    mandatory: Boolean(mandatory),
    repeatable: Boolean(repeatable),
    source_ref: sourceRef || null,
  };
}

function createTemplateTable({
  tableId,
  purpose,
  columns,
  requiredColumns = [],
  rowSemantics,
  repeatable = true,
  sourceRef,
}) {
  return {
    table_id: tableId,
    purpose,
    columns: Array.from(columns || []),
    required_columns: Array.from(requiredColumns || []),
    row_semantics: rowSemantics,
    repeatable: Boolean(repeatable),
    source_ref: sourceRef || null,
  };
}

function createReferenceTenderTemplate({
  referencePackage,
  referenceDocuments = [],
  templateId,
  templateName = 'Valve tender reference template',
  sections = [],
  tables = [],
  fields = [],
  referenceValues = [],
  ruleCandidates = [],
  status = 'REFERENCE_TEMPLATE_CANDIDATE',
}) {
  if (!referencePackage?.reference_package_id) {
    throw new Error('referencePackage.reference_package_id is required');
  }
  const resolvedTemplateId = templateId || `tmpl_${referencePackage.reference_package_id}`;
  return {
    template_id: resolvedTemplateId,
    template_name: templateName,
    status,
    confidentiality: CONFIDENTIALITY.CONFIDENTIAL,
    enterprise_id: referencePackage.enterprise_id || null,
    source_refs: referenceDocuments.map((document) => document.source_ref).filter(Boolean),
    section_candidates: sections,
    table_candidates: tables,
    field_candidates: fields,
    reference_value_candidates: referenceValues,
    rule_candidates: ruleCandidates,
  };
}

function buildValveReferenceTemplate({ referencePackage, referenceDocuments }) {
  if (!referencePackage) {
    throw new Error('referencePackage is required');
  }
  const templateId = `tmpl_${referencePackage.reference_package_id}`;
  const firstSource = referenceDocuments?.[0]?.source_ref || null;

  const fields = [
    createTemplateField({ semanticKey: 'project_name', label: '项目名称', required: true, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'purchaser', label: '采购人', required: true, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'control_price', label: '控制价', datatype: 'money', required: true, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'valve_type', label: '阀门类型', required: true, inheritancePolicy: INHERITANCE_POLICY.PROJECT_SOURCE_REQUIRED, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'dn', label: 'DN', required: true, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'pn', label: 'PN', required: true, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'quantity', label: '数量', datatype: 'number', required: true, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'standard_requirement', label: '执行标准', required: false, inheritancePolicy: INHERITANCE_POLICY.PROJECT_SOURCE_REQUIRED, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'certificate_requirement', label: '证书/质量文件要求', required: false, inheritancePolicy: INHERITANCE_POLICY.PROJECT_SOURCE_REQUIRED, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'technical_response_structure', label: '技术响应结构', required: true, inheritancePolicy: INHERITANCE_POLICY.STRUCTURE_ONLY, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'quotation_table_structure', label: '报价表结构', required: true, inheritancePolicy: INHERITANCE_POLICY.STRUCTURE_ONLY, sourceRef: firstSource }),
    createTemplateField({ semanticKey: 'final_quote', label: '最终报价', datatype: 'money', required: true, sourceRef: firstSource }),
  ];

  return {
    template_id: templateId,
    template_name: 'Valve tender reference template',
    applicable_valve_types: ['截止阀', '球阀', '蝶阀', '闸阀', '止回阀', '疏水阀', '旋转补偿器'],
    procurement_method: ['竞争性谈判', '竞争性磋商'],
    section_structure: [
      createTemplateSection({ templateId, order: 1, heading: '项目概况', purpose: 'capture project facts', mandatory: true, sourceRef: firstSource }),
      createTemplateSection({ templateId, order: 2, heading: '工程量清单 / 采购清单', purpose: 'capture valve requirement items', mandatory: true, repeatable: true, sourceRef: firstSource }),
      createTemplateSection({ templateId, order: 3, heading: '报价规则', purpose: 'capture quotation constraints', mandatory: true, sourceRef: firstSource }),
      createTemplateSection({ templateId, order: 4, heading: '技术规格 / 技术响应', purpose: 'capture technical requirements and response matrix', mandatory: true, repeatable: true, sourceRef: firstSource }),
      createTemplateSection({ templateId, order: 5, heading: '资格 / 证书 / 质量文件', purpose: 'capture required certifications and deliverables', mandatory: true, repeatable: true, sourceRef: firstSource }),
      createTemplateSection({ templateId, order: 6, heading: '图纸 / 小样图信息', purpose: 'capture drawing references without inheriting dimensions', mandatory: false, repeatable: true, sourceRef: firstSource }),
    ],
    table_templates: [
      createTemplateTable({
        tableId: `${templateId}_boq_table`,
        purpose: 'valve requirement BOQ structure',
        columns: ['序号', '项目名称', '规格型号', '计量单位', '工程量', '综合单价', '综合合价', '备注'],
        requiredColumns: ['项目名称', '规格型号', '计量单位', '工程量'],
        rowSemantics: 'one valve or accessory requirement per row',
        sourceRef: firstSource,
      }),
      createTemplateTable({
        tableId: `${templateId}_technical_response_table`,
        purpose: 'technical compliance response structure',
        columns: ['招标要求', '我方响应', '偏离情况', '来源', '备注'],
        requiredColumns: ['招标要求', '我方响应', '偏离情况'],
        rowSemantics: 'one technical requirement per row',
        sourceRef: firstSource,
      }),
    ],
    required_fields: fields,
    response_structure: 'STRUCTURE_ONLY',
    quotation_structure: 'STRUCTURE_ONLY',
    compliance_structure: 'STRUCTURE_ONLY',
    certificate_structure: 'STRUCTURE_ONLY',
    delivery_structure: 'STRUCTURE_ONLY',
    drawing_requirement_structure: 'STRUCTURE_ONLY',
    source_refs: referenceDocuments?.map((doc) => doc.source_ref).filter(Boolean) || [],
    version: 'v1',
    status: 'REFERENCE_TEMPLATE_CANDIDATE',
    confidentiality: CONFIDENTIALITY.CONFIDENTIAL,
    enterprise_id: referencePackage.enterprise_id || null,
  };
}

function isReferenceValue(value) {
  return Boolean(value && typeof value === 'object' && value.truth_scope === TRUTH_SCOPE.REFERENCE_ONLY);
}

function validateProjectFieldValue({ field, value, required = false }) {
  if (isReferenceValue(value)) {
    return {
      allowed: false,
      status: 'MISSING_PROJECT_VALUE',
      reason: 'REFERENCE_VALUE_CANNOT_SATISFY_REQUIRED_PROJECT_FIELD',
      field: normalizeSemanticKey(field),
    };
  }
  if (required && (value === undefined || value === null || value === '')) {
    return {
      allowed: false,
      status: 'MISSING_PROJECT_VALUE',
      reason: 'PROJECT_VALUE_REQUIRED',
      field: normalizeSemanticKey(field),
    };
  }
  return {
    allowed: true,
    status: 'PROJECT_VALUE_ACCEPTED',
    field: normalizeSemanticKey(field),
  };
}

function scanReferenceResidual({ outputText, referenceValues = [] }) {
  const text = String(outputText || '');
  const findings = [];
  for (const ref of referenceValues) {
    if (!isReferenceValue(ref)) continue;
    const value = String(ref.value || '').trim();
    if (!value || value.length < 2) continue;
    if (text.includes(value)) {
      findings.push({
        field: ref.field,
        value_hash: sha256Buffer(Buffer.from(value)),
        source_ref: ref.source_ref || null,
        classification: 'REFERENCE_DATA_LEAK_DETECTED',
      });
    }
  }
  return {
    passed: findings.length === 0,
    classification: findings.length === 0 ? 'NO_REFERENCE_RESIDUAL' : 'REFERENCE_DATA_LEAK_DETECTED',
    findings,
  };
}

function validateGenerationSafetyGate({
  projectFields = {},
  requiredFields = [],
  unresolvedConflicts = [],
  referenceValues = [],
  outputText = '',
  pricingApproved = false,
  humanApproved = false,
}) {
  const failures = [];
  for (const field of requiredFields) {
    const validation = validateProjectFieldValue({
      field,
      value: projectFields[field],
      required: true,
    });
    if (!validation.allowed) failures.push(validation);
  }
  if (unresolvedConflicts.length > 0) {
    failures.push({ status: 'UNRESOLVED_CRITICAL_CONFLICTS', count: unresolvedConflicts.length });
  }
  const residual = scanReferenceResidual({ outputText, referenceValues });
  if (!residual.passed) failures.push({ status: residual.classification, findings: residual.findings });
  if (!pricingApproved) failures.push({ status: 'PRICING_NOT_APPROVED' });
  if (!humanApproved) failures.push({ status: 'HUMAN_FINAL_APPROVAL_REQUIRED' });
  return {
    allowed: failures.length === 0,
    status: failures.length === 0 ? 'GENERATION_ALLOWED' : 'GENERATION_BLOCKED',
    failures,
  };
}

function validateArchiveEntry(entryName, options = {}) {
  const maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
  const fileSize = Number(options.fileSize || 0);
  const normalized = String(entryName || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || parts.includes('..')) {
    return { allowed: false, reason: 'ZIP_SLIP_BLOCKED' };
  }
  if (parts.some((part) => part.startsWith('._')) || parts.includes('__MACOSX') || parts.includes('.DS_Store')) {
    return { allowed: false, reason: 'SYSTEM_FILE_IGNORED' };
  }
  if (fileSize > maxFileSize) {
    return { allowed: false, reason: 'FILE_SIZE_LIMIT_EXCEEDED' };
  }
  const ext = path.extname(normalized).toLowerCase();
  if (!ext || !ALLOWED_SOURCE_EXTENSIONS.includes(ext)) {
    return { allowed: false, reason: 'UNEXPECTED_EXTENSION_REJECTED' };
  }
  return { allowed: true, normalized_path: normalized };
}

function validateArchiveManifest(entries, options = {}) {
  const maxFiles = options.maxFiles || DEFAULT_MAX_FILES;
  if (!Array.isArray(entries)) {
    throw new Error('entries must be an array');
  }
  if (entries.length > maxFiles) {
    return { allowed: false, reason: 'FILE_COUNT_LIMIT_EXCEEDED', entries: [] };
  }
  const results = entries.map((entry) => validateArchiveEntry(entry.name || entry.path || entry, {
    fileSize: entry.size || entry.fileSize || 0,
    maxFileSize: options.maxFileSize,
  }));
  const blocked = results.filter((result) => !result.allowed && result.reason !== 'SYSTEM_FILE_IGNORED');
  return {
    allowed: blocked.length === 0,
    reason: blocked.length === 0 ? 'ARCHIVE_MANIFEST_ALLOWED' : 'ARCHIVE_MANIFEST_BLOCKED',
    entries: results,
  };
}

function createNoExternalAiPolicy() {
  return {
    external_ai_egress: 'BLOCKED_BY_DEFAULT',
    ai_gateway_required: true,
    minimum_necessary_disclosure: true,
    raw_source_to_external_model: false,
    provider_secret_in_frontend: false,
  };
}

function createParserSecurityPolicy() {
  return {
    zip_slip_protection: true,
    file_size_limit: DEFAULT_MAX_FILE_SIZE,
    file_count_limit: DEFAULT_MAX_FILES,
    unexpected_extension_rejection: true,
    parser_timeout_ms: 30_000,
    macro_execution: 'FORBIDDEN',
    temp_directory_isolation: true,
    cleanup_required: true,
  };
}

function withTempDirectory(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  let cleanupStatus = 'NOT_RUN';
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    cleanupStatus = fs.existsSync(dir) ? 'FAILED' : 'PASS';
    if (cleanupStatus !== 'PASS') {
      throw new Error('TEMP_FILE_CLEANUP_FAILED');
    }
  }
}

function createAuditEventMetadata({ actorId, action, sourceRef, fieldKey }) {
  return {
    actor_id: actorId || 'NOT_AVAILABLE',
    action,
    source_ref: sourceRef || null,
    field_key: fieldKey || null,
    sensitive_payload_logged: false,
    raw_source_logged: false,
    timestamp: nowIso(),
  };
}

module.exports = {
  CONFIDENTIALITY,
  TRUTH_SCOPE,
  INHERITANCE_POLICY,
  DEFAULT_NEVER_INHERIT_KEYS,
  createReferenceTenderPackage,
  createReferenceTenderDocument,
  createReferenceProvenance,
  createTemplateField,
  createTemplateSection,
  createTemplateTable,
  createReferenceTenderTemplate,
  createReferenceValue,
  buildValveReferenceTemplate,
  validateProjectFieldValue,
  scanReferenceResidual,
  validateGenerationSafetyGate,
  validateArchiveEntry,
  validateArchiveManifest,
  createNoExternalAiPolicy,
  createParserSecurityPolicy,
  createAuditEventMetadata,
  withTempDirectory,
};
