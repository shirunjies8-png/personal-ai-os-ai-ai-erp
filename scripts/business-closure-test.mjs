import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-office-business-'));
const dbPath = path.join(tempRoot, 'business.sqlite3');
const originalCwd = process.cwd();

process.chdir(tempRoot);
process.env.DB_PATH = dbPath;
process.env.UPLOADS_DIR = path.join(tempRoot, 'uploads');
process.env.LOGS_DIR = path.join(tempRoot, 'logs');
process.env.BACKUPS_DIR = path.join(tempRoot, 'backups');

const require = createRequire(import.meta.url);
const db = require(path.join(projectRoot, 'database/client.js'));
db.exec(`
  CREATE TABLE enterprises (id TEXT PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE app_states (
    enterprise_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
  );
`);
db.prepare('INSERT INTO enterprises (id, name) VALUES (?, ?)').run('tenant-a', '企业 A');
db.prepare('INSERT INTO enterprises (id, name) VALUES (?, ?)').run('tenant-b', '企业 B');

const stateService = require(path.join(projectRoot, 'services/stateService.js'));
const initial = {
  workspaces: { quotation: { rfqSavedDrafts: [{ id: 'quote-1', draft: '报价草稿 A' }] } },
  ocrInquiries: [{ id: 'inquiry-1', customerName: '客户 A', productName: '产品 A' }],
  ocrData: { schemaVersion: 2, reviews: [{ requestId: 'ocr-1', status: 'approved' }] },
  taskRecords: [{ id: 'task-1', status: 'success' }],
  bugAlerts: [{ id: 'bug-1', message: '演示异常' }],
  systemHealth: { status: 'healthy', source: 'server' }
};

stateService.saveState('tenant-a', initial);
stateService.saveState('tenant-b', { ocrInquiries: [{ id: 'tenant-b-only' }] });
assert.deepEqual(stateService.getState('tenant-a').ocrInquiries, initial.ocrInquiries);
assert.equal(stateService.getState('tenant-a').ocrData.reviews[0].status, 'approved');
assert.equal(stateService.getState('tenant-b').ocrInquiries[0].id, 'tenant-b-only');
assert.equal(stateService.getState('tenant-b').workspaces, undefined, '企业之间不得共享报价数据');

stateService.saveState('tenant-a', {
  ocrInquiries: [{ id: 'inquiry-1', customerName: '客户 A', productName: '产品 A 修改版' }]
});
assert.equal(stateService.getState('tenant-a').ocrInquiries[0].productName, '产品 A 修改版');
stateService.saveState('tenant-a', { ocrInquiries: [] });
assert.deepEqual(stateService.getState('tenant-a').ocrInquiries, [], '删除后的空集合必须持久化');

const raw = db.prepare('SELECT payload FROM app_states WHERE enterprise_id = ?').get('tenant-a');
const persisted = JSON.parse(raw.payload);
assert.equal(persisted.workspaces.quotation.rfqSavedDrafts[0].id, 'quote-1');
assert.equal(persisted.ocrData.schemaVersion, 2);
assert.equal(persisted.taskRecords[0].id, 'task-1');
assert.equal(persisted.bugAlerts[0].id, 'bug-1');
assert.equal(persisted.systemHealth.source, 'server');

const coreSource = fs.readFileSync(path.join(projectRoot, 'core.js'), 'utf8');
const appSource = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(projectRoot, 'ui.js'), 'utf8');
assert.match(coreSource, /async flushSync\(\)/);
assert.match(coreSource, /SQLite 已同步/);
assert.match(coreSource, /sensitiveKey/);
assert.match(appSource, /async tryPromoteDemoSession/);
assert.match(appSource, /async inquirySave\(\)/);
assert.match(appSource, /async inquiryDelete\(id\)/);
assert.match(appSource, /async ocrTransferInquiry\(\)/);
assert.match(uiSource, /id: 'inquiries'/);
assert.match(uiSource, /inquiries\(\)/);
assert.match(uiSource, /localStorage 演示降级/);
assert.match(uiSource, /暂无询盘/);
assert.doesNotMatch(appSource.slice(appSource.indexOf('async inquirySave()'), appSource.indexOf('async inquiryDelete')), /DeepSeek|APIClient\.ai/);

global.Store = {
  state: { ocrInquiries: [{ id: 'render-1', customerName: '渲染客户', productName: '渲染产品', status: 'draft', source: 'manual', createdAt: Date.now() }] },
  syncStatus: { mode: 'server', message: 'SQLite 已同步' },
  canSyncToServer() { return true; }
};
global.App = { temp: { inquirySelectedId: '', inquirySearch: '', inquiryLoading: false } };
global.Utils = {
  escape(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); },
  formatDate(value) { return new Date(value).toISOString(); }
};
const UI = require(path.join(projectRoot, 'ui.js'));
const inquiryHtml = UI.inquiries();
assert.match(inquiryHtml, /询盘管理/);
assert.match(inquiryHtml, /渲染客户/);
assert.match(inquiryHtml, /新建询盘/);
assert.match(inquiryHtml, /企业 SQLite 持久化/);
assert.match(inquiryHtml, /data-action="inquiry-edit"/);
assert.match(inquiryHtml, /data-action="inquiry-delete"/);

db.close();
process.chdir(originalCwd);
fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('non-AI business SQLite persistence, tenant isolation, CRUD and fallback tests passed');
