import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../ui.js', import.meta.url), 'utf8');

assert.match(core, /reusableSessions: \{ excel: \[\], word: \[\], pdf: \[\], cost: \[\] \}/);
assert.match(core, /activeReusableSessionIds/);
assert.match(app, /restoreReusableSessions\(\)/);
assert.match(app, /saveReusableSession\(module, action = 'saved'\)/);
assert.match(app, /selectReusableSession\(module, id\)/);
assert.match(app, /copyReusableSession\(module, id\)/);
assert.match(app, /sourceFile: x\.file \? \{ name: x\.file\.name/);
assert.doesNotMatch(app, /snapshot:\s*file\b/);
assert.match(app, /costImportCurrentRfq\(\)/);
assert.match(app, /sourceMode: 'rfq'/);
assert.match(app, /未提供的数据保持为空，不会自动编造/);
assert.match(app, /if \(module === 'cost'\) return structuredClone\(this\.getWorkspace\('cost'\)\)/);
assert.match(ui, /可重复使用会话/);
assert.match(ui, /data-action="reusable-session-select"/);
assert.match(ui, /data-action="reusable-session-copy"/);
assert.match(ui, /从当前 RFQ 带入/);
assert.match(ui, /人工录入的确定性计算工具/);

console.log('reusable Excel, Word, PDF and cost session tests passed');
