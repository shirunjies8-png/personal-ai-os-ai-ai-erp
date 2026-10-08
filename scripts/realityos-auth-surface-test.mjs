import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const ui = read('ui.js');
const app = read('app.js');
const index = read('index.html');
const styles = read('styles.css');
const loginStart = ui.indexOf('  login() {');
const loginEnd = ui.indexOf('  realityosHomeSurface()', loginStart);
assert.ok(loginStart >= 0 && loginEnd > loginStart, 'login surface must be independently reviewable');
const loginSurface = ui.slice(loginStart, loginEnd);

for (const expected of ['RealityOS', 'AI 企业智能运行操作系统', 'data-action="auth-login"', 'data-action="auth-register"', 'data-action="auth-show-register"', 'data-action="auth-show-login"']) {
  assert.ok(loginSurface.includes(expected), `missing formal auth surface content: ${expected}`);
}
for (const forbidden of ['Industrial AI OS', 'RFQ Demo', 'Personal AI OS Demo Enterprise', 'admin@personal-ai-os.local', 'id="accountRole"', '123456']) {
  assert.ok(!loginSurface.includes(forbidden), `demo or privilege selector leaked into auth surface: ${forbidden}`);
}
assert.match(loginSurface, /registering \?/, 'login and registration must be distinct UI states');
assert.match(app, /body\.classList\.toggle\('auth-route', this\.route === 'login'\)/, 'login route must activate the minimal auth shell');
assert.match(app, /method: 'POST',\s*body: JSON\.stringify\(\{ email, password \}\)/s, 'existing login API payload must remain intact');
assert.match(app, /APIClient\.request\('\/api\/auth\/register'/, 'existing registration API endpoint must remain intact');
assert.match(app, /this\.navigate\('home'\)/, 'successful authentication must retain the RealityOS homepage destination');
assert.match(index, /<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
assert.match(index, /<title>RealityOS · AI 企业智能运行操作系统<\/title>/);
assert.match(styles, /body\.auth-route \.sidebar.*display:none!important/);
assert.match(styles, /@media\(max-width:768px\).*\.auth-shell/s);
assert.match(styles, /\.auth-route \.workspace\{overflow-x:hidden\}/);
assert.match(styles, /\.auth-intro \.eyebrow,\.auth-intro small,\.auth-intro>p:nth-of-type\(3\)\{display:none\}/, 'mobile auth must compact the desktop-only brand copy');
assert.match(styles, /\.auth-shell\{width:100%;min-width:0;.*grid-template-columns:minmax\(0,1fr\)/s, 'mobile auth must use a width-safe single-column shell');
assert.match(styles, /\.auth-card\{width:100%;min-width:0;max-width:100%/, 'mobile auth card must remain viewport-safe');
assert.match(styles, /\.auth-card \.input\{width:100%;min-width:0\}/, 'mobile auth inputs must remain viewport-safe');
assert.match(styles, /\.auth-button-row \.primary-btn,\.auth-button-row \.ghost-btn\{width:100%;min-width:0;min-height:42px\}/, 'mobile auth buttons must be full-width and touch-safe');

console.log('RealityOS auth surface formalization: PASS');
