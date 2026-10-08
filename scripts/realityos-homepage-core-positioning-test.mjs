import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const start = ui.indexOf('  realityosHomeSurface() {');
const end = ui.indexOf('  home() {', start);
assert.ok(start >= 0 && end > start, 'RealityOS homepage surface must be isolated from the legacy home body');
const surface = ui.slice(start, end);

for (const label of [
  'RealityOS · AI 企业智能运行操作系统',
  '身份、权限、效果、证据、验证与人工控制',
  '查看真实工作台',
  'data-route="valve-tender"',
  '目标', '身份', '权限', '执行', '现实回读', '证据', '验证', '结果', '恢复',
  'Discovery', 'Constraint', 'Memory', 'Proof',
  '模型输出是候选证据，不是权限或最终结论',
  'Valve template foundation', 'Valve DOCX parser', 'Reference data isolation', 'Provenance', 'Valve governed runtime',
  'REFERENCE / VERIFIED AT CURRENT LEVEL', 'INTEGRATING', 'NOT_IMPLEMENTED', 'NOT_VERIFIED',
  'Raw source Git：NO', 'External AI parser：0',
  'NO_GOVERNED_RUNS_YET / AS AVAILABLE',
  '自动重试仍未就绪',
]) assert.ok(surface.includes(label), `missing truth-only homepage content: ${label}`);

assert.ok(!/Active Runs|Effect Unknown|Evidence Receipt Count/.test(surface), 'homepage surface must not introduce synthetic runtime metrics');
assert.ok(!/[a-f0-9]{64}/i.test(surface), 'homepage surface must not disclose a full source hash');
assert.ok(!/\/Users\/|docs\/source\/valve\/private/.test(surface), 'homepage surface must not disclose private source locations');
assert.ok(app.includes("'home-realityos-scroll': () => document.getElementById('realityos-core')?.scrollIntoView"), 'secondary CTA must scroll to the evidence chain');
assert.ok(styles.includes('.realityos-home-hero'), 'homepage surface requires responsive styling');
assert.ok(styles.includes('@media(max-width:650px){.realityos-home-hero'), 'homepage surface requires a mobile layout rule');

console.log('RealityOS homepage core positioning: PASS');
