import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
global.Store = { state: { inventory: [{ id: 'inv-1', product_code: 'MAT-001', product_name: '测试材料', stock_quantity: 100, safety_stock: 20, version: 0 }] } };
global.Utils = { escape(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); } };
global.icon = name => `<i data-icon="${name}"></i>`;
global.App = { temp: { materialIssue: { preparationId: 'prep-1', requisitions: [{ business_operation_id: 'ISSUE-001', quantity: 30, status: 'WAITING_APPROVAL', preparation_status: 'WAITING_APPROVAL', preparation_id: 'prep-1', updated_at: '2026-07-29' }], detail: { preparation: { status: 'WAITING_APPROVAL', expired_at: '2026-07-30', snapshot_source: 'inventory', expected_version: 0 }, approval_card: { type: 'PASSED', current_stock: 100, requested_quantity: 30, remaining_stock: 70, safety_stock: 20, reason: '预检查通过', override_allowed: false } } } } };
const UI = require('../ui.js'); const html = UI.inventory();
for (const text of ['真实领料申请', '审批卡（Validator JSON）', '发起受控领料', '静态/演示模式不会伪造领料成功', '最近真实领料申请']) assert.match(html, new RegExp(text));
assert.match(html, /material-issue-prepare/); assert.match(html, /material-issue-approve/);
const uiSource = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8'); const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'); const routes = fs.readFileSync(new URL('../routes/transactionSafetyRoutes.js', import.meta.url), 'utf8');
assert.match(uiSource, /material-issue-execute/);
assert.match(app, /真实领料申请需连接本地或生产服务/); assert.match(app, /refreshMaterialIssue/); assert.match(app, /transaction-safety\/preparations/); assert.match(app, /重新验证版本、库存、安全库存、TTL 和 Reservation/);
assert.match(routes, /router\.get\('\/requisitions'/);
console.log('real material issue page, API boundary and action rendering tests passed');
