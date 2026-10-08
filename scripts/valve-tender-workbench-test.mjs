import assert from 'node:assert/strict';
import workbench from '../services/valveTenderWorkbenchService.js';

const parsed = {
  reference_document: { reference_document_id: 'refdoc_123456789abc', filename: 'private-reference.docx', source_hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', confidentiality: 'CONFIDENTIAL', parse_status: 'PARSED' },
  structured_document: { metadata: { parser_name: 'deterministic', parser_version: '1', parser_schema_version: '1' }, counts: { paragraph_count: 7, top_level_table_count: 2, top_level_row_count: 3, top_level_merged_table_count: 1 } },
  template: { template_id: 'tmpl_1', template_name: 'reference', status: 'REFERENCE_TEMPLATE_CANDIDATE' },
  sectionCandidates: [{ section_id: 's1', heading: '结构', source_document_id: 'refdoc_123456789abc', source_hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', source_locator: 'docx://safe/paragraph/1', extraction_method: 'OOXML' }],
  tableCandidates: [], fieldCandidates: [], referenceValues: [],
  ruleCandidates: [{ rule_type: 'CONTROL_PRICE_RULE', truth_scope: 'REFERENCE_ONLY', source_document_id: 'refdoc_123456789abc', source_hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', source_locator: 'docx://safe/paragraph/2', extraction_method: 'OOXML' }],
};

const model = workbench.project(parsed);
assert.equal(model.parse_summary.paragraph_count, 7);
assert.equal(model.rules[0].rule_type, 'CONTROL_PRICE_RULE');
assert.equal(model.reference_template.truth_scope, 'REFERENCE_ONLY');
assert.ok(!JSON.stringify(model).includes('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'));
await assert.rejects(
  () => workbench.readWorkbench({ user: { id: 'u', enterprise_id: 'e' }, config: { sourcePath: '', enterpriseId: 'e' } }),
  /尚未配置参考标书/,
);
console.log('VALVE_TENDER_WORKBENCH_CONTRACT: PASS');
