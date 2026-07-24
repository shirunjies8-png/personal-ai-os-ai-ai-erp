import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = require('../manufacturing-workspace.js');
global.ManufacturingWorkspace = workspace;
global.Store = {
  state: { ocrInquiries: [] },
  syncStatus: { mode: 'server', message: 'SQLite 已同步' },
  canSyncToServer() { return true; }
};
global.Utils = {
  escape(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); },
  formatDate(value) { return String(value || ''); },
  textToHtml(value = '') { return String(value).replace(/\n/g, '<br>'); }
};
global.icon = name => `<i data-icon="${name}"></i>`;

const assessment = {
  missing_fields: [{ key: 'material', label: '材料' }],
  open_blocking_risks: [{ id: 'risk-1', title: '交期过紧' }],
  blockers: [
    { type: 'missing_field', message: '缺少材料' },
    { type: 'open_risk', message: '交期过紧尚未关闭或接受' }
  ],
  approval_status: 'not_requested',
  next_actions: ['补充材料'],
  can_submit_review: false,
  can_convert_to_quotation: false
};
const customer = { id: 'customer-1', customer_no: 'CUS-2026-000001', name: '测试客户', level: 'important', owner: '业务员', status: 'active', version: 1, project_count: 1, rfq_count: 1, contacts: [] };
const project = { id: 'project-1', project_no: 'PRJ-2026-000001', customer_id: customer.id, customer_name: customer.name, name: '新能源项目', owner: '项目经理', status: 'active', version: 1, rfqs: [] };
const rfq = {
  id: 'rfq-1', rfq_no: 'RFQ-202607-000001', customer_id: customer.id, project_id: project.id,
  customer_name: customer.name, product_name: '精密支架', status: 'draft', status_label: '草稿', version: 1,
  requirements: [{ id: 'req-1', label: '材料', value: '', required: 1, confirmed: 0, source: 'manual' }],
  risks: [{ id: 'risk-1', title: '交期过紧', risk_level: 'high', risk_score: 16, is_blocking: 1, status: 'open', owner: '项目经理' }],
  followups: [], history: [{ created_at: '2026-07-17', action: 'create', title: '创建 RFQ', result: 'success' }], assessment
};
global.App = {
  temp: {
    inquirySelectedId: '', inquirySearch: '', inquiryLoading: false,
    manufacturing: {
      ...workspace.emptyState(), loaded: true, mode: 'server',
      customers: [customer], projects: [project], rfqs: [{ ...rfq, assessment }],
      selectedCustomerId: customer.id, selectedProjectId: project.id, selectedRfqId: rfq.id,
      customer, project, rfq
    }
  }
};

const UI = require('../ui.js');
const customerHtml = UI.crm();
assert.match(customerHtml, /客户档案/);
assert.match(customerHtml, /测试客户/);
assert.match(customerHtml, /manufacturing-customer-save/);
assert.match(customerHtml, /manufacturing-contact-save/);
assert.match(customerHtml, /企业 SQLite 持久化/);

const projectHtml = UI.project();
assert.match(projectHtml, /项目档案/);
assert.match(projectHtml, /新能源项目/);
assert.match(projectHtml, /manufacturing-project-save/);

const rfqHtml = UI.inquiries();
for (const text of ['RFQ 客户需求闭环', '缺失项与风险检查', '缺少材料', '需求结构化清单', '提交评审', '转入现有报价模块', '操作日志']) {
  assert.match(rfqHtml, new RegExp(text));
}
assert.match(rfqHtml, /manufacturing-rfq-save/);
assert.match(rfqHtml, /manufacturing-requirement-save/);
assert.match(rfqHtml, /manufacturing-risk-save/);
assert.match(rfqHtml, /disabled/);

assert.deepEqual(workspace.validateCustomer({ name: '' }), ['客户名称不能为空']);
assert.deepEqual(workspace.validateProject({ customer_id: '', name: '' }), ['请选择所属客户', '项目名称不能为空']);
assert.deepEqual(workspace.validateRfq({ customer_id: '', product_name: '', quantity: -1 }), ['请选择 RFQ 客户', '产品名称不能为空', '数量不能为负数']);
assert.throws(() => workspace.assertServerWritable('fallback'), error => error.code === 'MANUFACTURING_OFFLINE_READ_ONLY' && error.message === workspace.OFFLINE_NOTICE);

App.temp.manufacturing.mode = 'fallback';
Store.state.ocrInquiries = [{ id: 'local-1', customerName: '本地演示客户', productName: '演示产品', status: 'draft', source: 'manual', createdAt: Date.now() }];
const fallbackHtml = UI.inquiries();
assert.match(fallbackHtml, /localStorage 演示降级/);
assert.match(fallbackHtml, /本地演示客户/);
assert.doesNotMatch(fallbackHtml, /评审状态已更新/);

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const routeSource = fs.readFileSync(new URL('../routes/manufacturingRoutes.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSource = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(indexSource, /manufacturing-workspace\.js/);
for (const fragment of ['/customers', '/projects', '/rfqs', '/submit-review', '/transition', '/convert-to-quotation']) assert.match(routeSource, new RegExp(fragment.replaceAll('/', '\\/')));
assert.match(appSource, /ManufacturingWorkspace\.assertServerWritable/);
assert.match(appSource, /assessment/);
assert.match(appSource, /getQuotationWorkspace\(\)/);
assert.match(appSource, /manufacturingImportApprovedOcr/);
assert.match(appSource, /reviewStatus !== 'approved'/);
assert.match(appSource, /OCR 导入字段冲突/);
assert.match(appSource, /manufacturingCreateKey/);
assert.match(appSource, /idempotency_key/);
assert.match(appSource, /制造.*保存失败|保存失败/);
assert.match(customerHtml, /制造.*创建项目|为该客户创建项目/);
assert.match(projectHtml, /项目详情与下一步/);
assert.match(projectHtml, /未关闭阻断风险/);
assert.match(stylesSource, /@media\(max-width:650px\)\{\.manufacturing-tabs/);
assert.match(stylesSource, /\[data-manufacturing-workspace\] \.panel-body\{overflow:hidden\}/);
assert.match(stylesSource, /\.workflow-next/);
const manufacturingSlice = appSource.slice(appSource.indexOf('async loadManufacturingData'), appSource.indexOf('inquiryNew()'));
assert.doesNotMatch(manufacturingSlice, /DeepSeek|APIClient\.chat|api\.deepseek\.com/);

console.log('manufacturing customer, project, RFQ workspace and offline boundary tests passed');
