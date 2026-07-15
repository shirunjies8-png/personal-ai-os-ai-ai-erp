import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = require('../apqp-workspace.js');
global.APQPWorkspace = workspace;
global.Utils = {
  escape(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); },
  textToHtml(value = '') { return String(value).replace(/\n/g, '<br>'); },
  isGitHubPagesHost() { return true; }
};
const demo = workspace.demoProject();
global.App = { temp: { apqp: { open: true, projects: [demo], selectedId: demo.id, project: demo, error: '' } } };
const UI = require('../ui.js');

const qualitySource = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('./sync-public.mjs', import.meta.url), 'utf8');

assert.match(qualitySource, /data-action="apqp-open"/);
assert.match(indexSource, /apqp-workspace\.js/);
assert.match(syncSource, /'apqp-workspace\.js'/);

const html = UI.apqpWorkspace();
assert.match(html, /APQP 项目列表/);
assert.match(html, /APQP-DEMO-001/);
assert.match(html, /项目详情/);
assert.match(html, /五阶段进度/);
assert.match(html, /总进度/);
assert.match(html, /24%/);
assert.match(html, /阻塞项与下一步/);
assert.match(html, /缺少交付物证据/);
assert.match(html, /交付物/);
assert.match(html, /证据记录/);
assert.match(html, /风险/);
assert.match(html, /任务/);
assert.match(html, /审批与操作历史/);
assert.match(html, new RegExp(workspace.STATIC_NOTICE));

assert.deepEqual(workspace.validateProject({ project_name: '', project_owner: '' }), ['项目名称不能为空', '项目负责人不能为空']);
assert.deepEqual(workspace.validateProject({ project_name: '项目', project_owner: '负责人', planned_start_date: '2026-12-31', planned_end_date: '2026-01-01' }), ['计划完成日期不能早于开始日期']);
assert.deepEqual(workspace.validateEvidenceDelete(''), ['删除证据必须填写原因']);
assert.deepEqual(workspace.validateEvidenceDelete('版本错误'), []);

const snapshot = JSON.stringify(demo);
assert.throws(() => workspace.assertWritable(true), error => {
  assert.equal(error.code, 'APQP_STATIC_READ_ONLY');
  assert.equal(error.message, workspace.STATIC_NOTICE);
  return true;
});
assert.equal(JSON.stringify(demo), snapshot, '静态写入阻断不得修改演示数据');
assert.doesNotThrow(() => workspace.assertWritable(false));

for (const action of ['evidence-delete', 'risk-accept', 'risk-close', 'stage-submit', 'stage-approve', 'stage-reject', 'project-close', 'project-owner', 'project-due-date', 'project-importance']) {
  assert.equal(workspace.requiresConfirmation(action), true, `缺少二次确认：${action}`);
}
assert.match(appSource, /APQPWorkspace\.assertWritable\(this\.apqpIsStatic\(\)\)/);
assert.match(appSource, /Utils\.friendlyErrorMessage/);
assert.match(appSource, /权限不足|state\.error/);
assert.match(appSource, /window\.confirm/);
assert.match(appSource, /请输入证据软删除原因/);
assert.doesNotMatch(appSource, /current_stage\s*:/, '页面写操作不得构造 current_stage');
assert.doesNotMatch(appSource, /overall_progress\s*:/, '页面写操作不得构造 overall_progress');

console.log('apqp page and static boundary tests passed');
