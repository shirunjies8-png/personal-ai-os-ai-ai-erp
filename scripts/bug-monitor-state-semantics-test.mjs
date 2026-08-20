import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace('App.init();', 'globalThis.__bugMonitorApp = App;');
const context = vm.createContext({
  AIOfficeContracts: { ocr: { timeoutMs: 120000 } },
  ManufacturingWorkspace: { emptyState: () => ({}) },
  location: { hostname: 'shirunjies8-png.github.io' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { removeItem: () => {} },
  document: { addEventListener: () => {} },
  console,
  setTimeout,
  clearTimeout,
  structuredClone,
  globalThis: null
});
context.globalThis = context;
context.window = context;
vm.runInContext(`${source}\nglobalThis.__bugMonitorStability = Stability;`, context, { filename: 'core.js' });
vm.runInContext(appSource, context, { filename: 'app.js' });
const Stability = context.__bugMonitorStability;
const App = context.__bugMonitorApp;

const fixture = [
  { id: 'current-1', module: 'global', feature: 'window.onunhandledrejection', type: '系统错误', message: '登录已失效', source: 'system-error', lifecycle: 'active' },
  { id: 'degraded-1', module: 'OCR', feature: 'AI 纠错建议', type: 'deepseek-not-configured', message: '静态演示降级', source: 'frontend', lifecycle: 'active' },
  { id: 'guidance-1', module: 'pdf-extract', feature: 'AI 调用', type: 'AI错误', message: '扫描 PDF 指引', source: 'ai-error', eventKind: 'GUIDANCE', lifecycle: 'active' },
  { id: 'test-1', module: 'STEP 5 Error Center', feature: 'Bug Monitor 聚合验证', type: 'JavaScript Error', message: '测试', source: 'step5-demo', signature: 'STEP5_FINAL_DEMO_AGGREGATION', lifecycle: 'active' },
  { id: 'history-1', module: 'global', feature: 'old', type: '系统错误', message: '已修复', source: 'system-error', lifecycle: 'resolved' }
];

const normalized = fixture.map(item => Stability.normalizeError(item));
assert.deepEqual(
  normalized.map(item => Stability.bugAlertSemantics(item, { isGitHubPages: true })),
  ['CURRENT_BUG', 'EXPECTED_DEGRADED', 'GUIDANCE', 'SYNTHETIC_TEST', 'HISTORICAL_RESOLVED']
);
assert.equal(normalized.length, fixture.length, 'classification must not delete historical evidence');
const current = normalized.filter(item => Stability.bugAlertSemanticsModel(item, { isGitHubPages: true }).isCurrentPending);
assert.equal(current.length, 1, 'only the unresolved current bug enters the current pending set');
assert.equal(Stability.buildHealthSnapshot({ errors: normalized, bugAlertContext: { isGitHubPages: true } }).errorSummary.active, 1, 'only current pending alerts impact health');

const countFixture = [
  ...Array.from({ length: 4 }, (_, index) => ({ id: `count-${index}`, module: 'global', feature: 'runtime', type: '系统错误', message: `运行错误 ${index}`, source: 'system-error', lifecycle: 'active' })),
  fixture[1], fixture[2], fixture[3], fixture[4]
].map(item => Stability.normalizeError(item));
const countPending = countFixture.filter(item => Stability.bugAlertSemanticsModel(item, { isGitHubPages: true }).isCurrentPending);
const preview = countPending.slice(0, 3);
assert.equal(countPending.length, 4, 'full pending count must use the complete semantic set');
assert.equal(preview.length, 3, 'preview remains bounded independently from the total');

const unknown = Stability.normalizeError({
  id: 'unknown-1',
  module: 'unclassified-runtime',
  feature: 'evidence-pending',
  type: 'unclassified-event',
  message: '测试专用未知状态',
  source: 'fixture',
  eventKind: 'UNKNOWN',
  lifecycle: 'active'
});
const unknownModel = Stability.bugAlertSemanticsModel(unknown, { isGitHubPages: true });
const historyWithUnknown = [...normalized, unknown];
assert.equal(unknownModel.classification, 'UNKNOWN', 'UNKNOWN_FAILS_CLOSED: unclassified evidence must remain UNKNOWN');
assert.equal(unknownModel.isCurrentPending, true, 'UNKNOWN_REMAINS_ACTIONABLE: unresolved unknown evidence needs review');
assert.equal(unknownModel.impactsHealth, true, 'UNKNOWN_IMPACTS_HEALTH: unknown evidence must not be treated as healthy');
assert.ok(historyWithUnknown.some(item => item.id === unknown.id), 'UNKNOWN_HISTORY_PRESERVED: selection must not delete the original record');
assert.equal(
  Stability.buildHealthSnapshot({ errors: historyWithUnknown, bugAlertContext: { isGitHubPages: true } }).errorSummary.active,
  2,
  'UNKNOWN_IMPACTS_HEALTH: current bug plus UNKNOWN remain health concerns'
);

vm.runInContext(`Store.state = { bugAlerts: ${JSON.stringify(countFixture)} };`, context);
const appModel = App.getBugMonitorModel();
assert.equal(appModel.totalPendingCount, 4, 'Bug Monitor total is independent from its three-item preview');
assert.equal(appModel.previewAlerts.length, 3, 'Bug Monitor preview remains bounded to three records');

const detailFixture = {
  id: 'detail-action-1',
  module: 'global',
  feature: 'window.onerror',
  type: 'JavaScript Error',
  message: '详情动作测试',
  source: 'system-error',
  lifecycle: 'active',
  time: Date.now()
};
vm.runInContext(`Store.state = { bugAlerts: [${JSON.stringify(detailFixture)}], aiErrors: [], repairRecords: [] };`, context);
let detailActionError = null;
let openedDetailHtml = '';
App.recordAiError = (error, action) => {
  detailActionError = { action, message: error?.message || String(error) };
  return detailActionError.message;
};
App.toast = () => {};
App.openModal = html => { openedDetailHtml = html; };
await App.handleAction('bug-detail', { dataset: { id: detailFixture.id } });
assert.equal(detailActionError, null, 'Bug Monitor detail action must not raise a runtime error');
assert.match(openedDetailHtml, /问题详情/, 'Bug Monitor detail action must open the existing detail modal');
assert.match(openedDetailHtml, /详情动作测试/, 'Bug Monitor detail modal must display the selected historical record');
assert.equal(context.Store.state.bugAlerts.length, 1, 'opening details must preserve the original Bug Monitor history');
assert.equal(context.Store.state.aiErrors.length, 0, 'opening details must not create a new error record');

console.log('bug-monitor-state-semantics-test: PASS (6 semantic fixture cases; UNKNOWN assertions=5; detail action=1)');
