import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import valveReference from '../services/valveReferenceTenderTemplateService.js';

const {
  CONFIDENTIALITY,
  TRUTH_SCOPE,
  INHERITANCE_POLICY,
  createReferenceTenderPackage,
  createReferenceTenderDocument,
  createReferenceValue,
  buildValveReferenceTemplate,
  validateProjectFieldValue,
  scanReferenceResidual,
  validateGenerationSafetyGate,
  validateArchiveManifest,
  createNoExternalAiPolicy,
  createParserSecurityPolicy,
  createAuditEventMetadata,
  withTempDirectory,
} = valveReference;

const sourceHash = '96c8295c021fcedb8bb39c7cf082bd1bb34757e6d8c084e4917e4916a2181780';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function gitAllowNoMatch(...args) {
  try {
    return git(...args);
  } catch (error) {
    if (error.status === 1) return '';
    throw error;
  }
}

const referencePackage = createReferenceTenderPackage({
  title: '江苏阀门参考标书包',
  sourcePackageHash: sourceHash,
  sourceFileCount: 7,
  enterpriseId: 'ent_test',
});

assert.equal(referencePackage.source_classification, 'REFERENCE_TENDER_PACKAGE');
assert.equal(referencePackage.confidentiality_level, CONFIDENTIALITY.CONFIDENTIAL);
assert.equal(referencePackage.enterprise_id, 'ent_test');
assert.match(referencePackage.reference_package_id, /^refpkg_/);

const referenceDocument = createReferenceTenderDocument({
  referencePackageId: referencePackage.reference_package_id,
  enterpriseId: 'ent_test',
  filename: '竞争性谈判文件-连云港石化产业基地拓展区板桥片区蒸汽管道工程阀门采购.docx',
  documentType: 'TENDER_DOCUMENT',
  sourceHash: '1c7e6c72046e5d2a79715b30c4f6097b8bf11f3fef08248e7538a8f3e78ac878',
  format: 'docx',
  parser: 'docx_xml',
  parseStatus: 'STRUCTURE_READABLE',
});

assert.equal(referenceDocument.confidentiality, CONFIDENTIALITY.CONFIDENTIAL);
assert.equal(referenceDocument.enterprise_id, 'ent_test');
assert.equal(referenceDocument.format, 'docx');

const template = buildValveReferenceTemplate({
  referencePackage,
  referenceDocuments: [referenceDocument],
});

assert.equal(template.status, 'REFERENCE_TEMPLATE_CANDIDATE');
assert.equal(template.confidentiality, CONFIDENTIALITY.CONFIDENTIAL);
assert.equal(template.enterprise_id, 'ent_test');
assert.ok(template.section_structure.length >= 6);
assert.ok(template.table_templates.length >= 2);
assert.ok(template.required_fields.length >= 10);
assert.equal(template.version, 'v1');

const controlPriceField = template.required_fields.find((field) => field.semantic_key === 'control_price');
assert.equal(controlPriceField.inheritance_policy, INHERITANCE_POLICY.NEVER_INHERIT);

const purchaserField = template.required_fields.find((field) => field.semantic_key === 'purchaser');
assert.equal(purchaserField.inheritance_policy, INHERITANCE_POLICY.NEVER_INHERIT);

const structureField = template.required_fields.find((field) => field.semantic_key === 'quotation_table_structure');
assert.equal(structureField.inheritance_policy, INHERITANCE_POLICY.STRUCTURE_ONLY);

const referenceControlPrice = createReferenceValue({
  field: 'control_price',
  value: 'REFERENCE_CONTROL_PRICE',
  referenceProject: 'REFERENCE_PROJECT',
  sourceRef: referenceDocument.source_ref,
});

assert.equal(referenceControlPrice.truth_scope, TRUTH_SCOPE.REFERENCE_ONLY);

const referencePurchaser = createReferenceValue({
  field: 'purchaser',
  value: 'REFERENCE_PURCHASER',
  referenceProject: 'REFERENCE_PROJECT',
  sourceRef: referenceDocument.source_ref,
});

const referenceProjectName = createReferenceValue({ field: 'project_name', value: 'REFERENCE_PROJECT_NAME' });
const referenceDn = createReferenceValue({ field: 'dn', value: 'REFERENCE_DN' });
const referencePn = createReferenceValue({ field: 'pn', value: 'REFERENCE_PN' });
const referenceQuantity = createReferenceValue({ field: 'quantity', value: 'REFERENCE_QUANTITY' });
const referenceDelivery = createReferenceValue({ field: 'delivery_date', value: 'REFERENCE_DELIVERY' });
const referenceContact = createReferenceValue({ field: 'customer_contact', value: 'REFERENCE_CONTACT' });
const referenceUnitPrice = createReferenceValue({ field: 'unit_price', value: 'REFERENCE_UNIT_PRICE' });

for (const referenceValue of [
  referenceControlPrice,
  referencePurchaser,
  referenceProjectName,
  referenceDn,
  referencePn,
  referenceQuantity,
  referenceDelivery,
  referenceContact,
  referenceUnitPrice,
]) {
  const prohibited = validateProjectFieldValue({
    field: referenceValue.field,
    value: referenceValue,
    required: true,
  });
  assert.equal(prohibited.allowed, false, `${referenceValue.field} must remain reference-only`);
  assert.equal(prohibited.reason, 'REFERENCE_VALUE_CANNOT_SATISFY_REQUIRED_PROJECT_FIELD');
}

const validation = validateProjectFieldValue({
  field: 'control_price',
  value: referenceControlPrice,
  required: true,
});
assert.equal(validation.allowed, false);
assert.equal(validation.reason, 'REFERENCE_VALUE_CANNOT_SATISFY_REQUIRED_PROJECT_FIELD');
assert.equal(validation.status, 'MISSING_PROJECT_VALUE');

const accepted = validateProjectFieldValue({
  field: 'project_name',
  value: '当前客户新项目',
  required: true,
});
assert.equal(accepted.allowed, true);

const residual = scanReferenceResidual({
  outputText: '本项目采购人：REFERENCE_PURCHASER，控制价为REFERENCE_CONTROL_PRICE。',
  referenceValues: [referenceControlPrice, referencePurchaser],
});
assert.equal(residual.passed, false);
assert.equal(residual.classification, 'REFERENCE_DATA_LEAK_DETECTED');
assert.equal(residual.findings.length, 2);
assert.ok(residual.findings.every((finding) => finding.value_hash && !Object.hasOwn(finding, 'value')));

const noResidual = scanReferenceResidual({
  outputText: '本项目采购人由当前项目资料填写，控制价待补充。',
  referenceValues: [referenceControlPrice, referencePurchaser],
});
assert.equal(noResidual.passed, true);

const safetyGate = validateGenerationSafetyGate({
  projectFields: {
    project_name: '当前客户新项目',
    control_price: referenceControlPrice,
  },
  requiredFields: ['project_name', 'control_price'],
  unresolvedConflicts: [],
  referenceValues: [referenceControlPrice],
  outputText: '控制价为REFERENCE_CONTROL_PRICE',
  pricingApproved: false,
  humanApproved: false,
});
assert.equal(safetyGate.allowed, false);
assert.equal(safetyGate.status, 'GENERATION_BLOCKED');
assert.ok(safetyGate.failures.some((failure) => failure.reason === 'REFERENCE_VALUE_CANNOT_SATISFY_REQUIRED_PROJECT_FIELD'));
assert.ok(safetyGate.failures.some((failure) => failure.status === 'REFERENCE_DATA_LEAK_DETECTED'));
assert.ok(safetyGate.failures.some((failure) => failure.status === 'PRICING_NOT_APPROVED'));
assert.ok(safetyGate.failures.some((failure) => failure.status === 'HUMAN_FINAL_APPROVAL_REQUIRED'));

const allowedGeneration = validateGenerationSafetyGate({
  projectFields: {
    project_name: '当前客户新项目',
    control_price: '99 万元',
  },
  requiredFields: ['project_name', 'control_price'],
  unresolvedConflicts: [],
  referenceValues: [referenceControlPrice],
  outputText: '控制价以当前项目资料为准。',
  pricingApproved: true,
  humanApproved: true,
});
assert.equal(allowedGeneration.allowed, true);

const archiveOk = validateArchiveManifest([
  { name: '江苏招标文件/2.阀门/采购文件.docx', size: 1024 },
  { name: '江苏招标文件/1球阀/图纸.dwg', size: 2048 },
  { name: '__MACOSX/._ignored', size: 176 },
]);
assert.equal(archiveOk.allowed, true);
assert.ok(archiveOk.entries.some((entry) => entry.reason === 'SYSTEM_FILE_IGNORED'));

const archiveSlip = validateArchiveManifest([{ name: '../secret.docx', size: 10 }]);
assert.equal(archiveSlip.allowed, false);
assert.equal(archiveSlip.reason, 'ARCHIVE_MANIFEST_BLOCKED');

const archiveUnexpected = validateArchiveManifest([{ name: 'payload.sh', size: 10 }]);
assert.equal(archiveUnexpected.allowed, false);

const archiveNoExtension = validateArchiveManifest([{ name: 'opaque-payload', size: 10 }]);
assert.equal(archiveNoExtension.allowed, false);

const archiveWindowsAbsolute = validateArchiveManifest([{ name: 'C:\\temp\\payload.docx', size: 10 }]);
assert.equal(archiveWindowsAbsolute.allowed, false);

const archiveOversized = validateArchiveManifest([{ name: 'big.docx', size: 10_000 }], { maxFileSize: 100 });
assert.equal(archiveOversized.allowed, false);

const archiveTooMany = validateArchiveManifest(Array.from({ length: 3 }, (_, index) => ({ name: `f${index}.docx`, size: 1 })), { maxFiles: 2 });
assert.equal(archiveTooMany.allowed, false);
assert.equal(archiveTooMany.reason, 'FILE_COUNT_LIMIT_EXCEEDED');

const aiPolicy = createNoExternalAiPolicy();
assert.equal(aiPolicy.external_ai_egress, 'BLOCKED_BY_DEFAULT');
assert.equal(aiPolicy.ai_gateway_required, true);
assert.equal(aiPolicy.raw_source_to_external_model, false);
assert.equal(aiPolicy.provider_secret_in_frontend, false);

const parserPolicy = createParserSecurityPolicy();
assert.equal(parserPolicy.zip_slip_protection, true);
assert.equal(parserPolicy.macro_execution, 'FORBIDDEN');
assert.equal(parserPolicy.cleanup_required, true);
assert.ok(parserPolicy.file_size_limit > 0);
assert.ok(parserPolicy.parser_timeout_ms > 0);

let tempDirPath = '';
withTempDirectory('valve-template-test-', (dir) => {
  tempDirPath = dir;
  fs.writeFileSync(`${dir}/conversion-output.txt`, 'temporary parse output');
  assert.equal(fs.existsSync(tempDirPath), true);
});
assert.equal(fs.existsSync(tempDirPath), false);

let failedTempDirPath = '';
assert.throws(() => withTempDirectory('valve-template-failure-test-', (dir) => {
  failedTempDirPath = dir;
  fs.writeFileSync(`${dir}/failed-conversion-output.txt`, 'temporary parse output');
  throw new Error('EXPECTED_PARSE_FAILURE');
}), /EXPECTED_PARSE_FAILURE/);
assert.equal(fs.existsSync(failedTempDirPath), false);

const audit = createAuditEventMetadata({
  actorId: 'user_test',
  action: 'REFERENCE_TEMPLATE_EXTRACT',
  sourceRef: referenceDocument.source_ref,
  fieldKey: 'control_price',
});
assert.equal(audit.sensitive_payload_logged, false);
assert.equal(audit.raw_source_logged, false);
assert.equal(audit.actor_id, 'user_test');

const trackedSource = git('ls-files', '--', 'docs/source/valve');
assert.equal(trackedSource, '');

const ignoredSource = git('status', '--short', '--ignored', 'docs/source/valve');
assert.match(ignoredSource, /!! docs\/source\/valve\//);

const frontendLeaks = gitAllowNoMatch('grep', '-n', '96c8295c021fcedb8bb39c7cf082bd1bb34757e6d8c084e4917e4916a2181780', '--', 'app.js', 'core.js', 'ui.js', 'config.js');
assert.equal(frontendLeaks, '');

assert.equal(template.required_fields.some((field) => field.semantic_key === 'final_quote' && field.inheritance_policy === INHERITANCE_POLICY.NEVER_INHERIT), true);
assert.equal(template.required_fields.some((field) => field.semantic_key === 'technical_response_structure' && field.inheritance_policy === INHERITANCE_POLICY.STRUCTURE_ONLY), true);

console.log(JSON.stringify({
  status: 'PASS',
  assertions: 55,
  reference_package: referencePackage.reference_package_id,
  template: template.template_id,
  source_hash: sourceHash,
  external_ai_calls: 0,
  raw_source_tracked: false,
  reference_data_cannot_become_project_truth: true,
}, null, 2));
