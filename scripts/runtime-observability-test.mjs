import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-runtime-observability-'));
process.env.DB_PATH = path.join(root, 'runtime.sqlite3');
process.env.UPLOADS_DIR = path.join(root, 'uploads');
process.env.LOGS_DIR = path.join(root, 'logs');
process.env.BACKUPS_DIR = path.join(root, 'backups');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const require = createRequire(import.meta.url);
const db = require('../database/init');
const service = require('../services/runtimeObservabilityService');
const routes = require('../routes/runtimeObservabilityRoutes');
const controller = require('../controllers/runtimeObservabilityController');
const appSource = fs.readFileSync(path.resolve(process.cwd(), 'app.js'), 'utf8');
const uiSource = fs.readFileSync(path.resolve(process.cwd(), 'ui.js'), 'utf8');

const now = new Date().toISOString();
for (const id of ['obs-tenant-a', 'obs-tenant-b']) db.prepare('INSERT INTO enterprises(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(id, id, now, now);
const userA = { id: 'obs-user-a', enterprise_id: 'obs-tenant-a', role: '企业管理员' };
const userB = { id: 'obs-user-b', enterprise_id: 'obs-tenant-b', role: '企业管理员' };
function invoke(handler, { user = userA, params = {}, body = {}, query = {} } = {}) {
  let status = 200; let payload;
  handler({ user, params, body, query }, { status(code) { status = code; return this; }, json(value) { payload = value; } });
  return { status, payload };
}

try {
  const paths = routes.stack.filter(layer => layer.route).map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  for (const expected of ['GET /components', 'GET /runs', 'GET /runs/:id', 'POST /runs', 'PATCH /runs/:id']) assert.ok(paths.includes(expected), `缺少运行监控 API：${expected}`);
  service.registerDefaults({ deepseekConfigured: false });
  const started = invoke(controller.start, { body: { component_id: 'ocr-current', component_type: 'LOCAL_RUNTIME', task_type: 'ocr_recognition', request_id: 'req-observe-1', execution_mode: 'LOCAL_RUNTIME', input_summary: '图片:测试.png api_key=secret' } });
  assert.equal(started.status, 200);
  const run = started.payload.data.item;
  assert.equal(run.execution_status, 'RUNNING');
  assert.ok(!run.input_summary.includes('secret'), '运行摘要必须脱敏');
  assert.equal(invoke(controller.finish, { params: { id: run.run_id }, body: { execution_status: 'TIMEOUT', verification_status: 'NOT_VERIFIED', error_code: 'request_timeout', error_message: 'Bearer super-secret' } }).status, 200);
  const own = invoke(controller.get, { params: { id: run.run_id } });
  assert.equal(own.payload.data.item.execution_status, 'TIMEOUT');
  assert.ok(!own.payload.data.item.error_message.includes('super-secret'));
  assert.equal(invoke(controller.get, { user: userB, params: { id: run.run_id } }).status, 404, '运行记录必须企业隔离');
  assert.equal(invoke(controller.start, { body: { component_id: 'not-registered', task_type: 'x' } }).status, 400, '未注册组件不得写入 Trace');
  const component = service.components().find(item => item.id === 'ocr-current');
  assert.equal(component.timeout_count, 1);
  assert.equal(component.failure_count, 1);
  assert.ok(component.average_duration_ms >= 0);
  assert.match(appSource, /recordRuntimeStart/, 'OCR 前端必须创建运行 Trace');
  assert.match(appSource, /recordRuntimeFinish/, 'OCR 前端必须结束运行 Trace');
  assert.match(appSource, /HUMAN_REVIEW_REQUIRED/, 'OCR 结果必须进入人工验证门禁');
  assert.match(uiSource, /Agent \/ Skill 运行监控/, 'AI 状态中心必须呈现运行监控区块');
  assert.match(uiSource, /静态 Pages 不伪造运行数据/, '静态边界必须明确不伪造数据');
} finally {
  await new Promise(resolve => setTimeout(resolve, 350));
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('runtime observability registry, trace, redaction and tenant isolation tests passed');
