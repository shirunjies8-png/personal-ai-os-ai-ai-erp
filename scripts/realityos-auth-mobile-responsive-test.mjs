import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const mobileStart = styles.indexOf('@media(max-width:768px){body.auth-route');
assert.ok(mobileStart >= 0, 'a dedicated <=768px auth breakpoint is required');
const mobile = styles.slice(mobileStart, styles.indexOf('\n', mobileStart) + 1);

for (const expected of [
  'body.auth-route{min-width:0;overflow-x:hidden}',
  'grid-template-columns:minmax(0,1fr)',
  '.auth-intro{max-width:none;display:grid;grid-template-columns:40px minmax(0,1fr)',
  '.auth-intro .eyebrow,.auth-intro small,.auth-intro>p:nth-of-type(3){display:none}',
  '.auth-card{width:100%;min-width:0;max-width:100%;margin:0}',
  '.auth-card .input{width:100%;min-width:0}',
  '.auth-button-row .primary-btn,.auth-button-row .ghost-btn{width:100%;min-width:0;min-height:42px}',
  '.auth-route .workspace{overflow-x:hidden}',
]) assert.ok(mobile.includes(expected), `missing mobile auth contract: ${expected}`);

assert.match(styles, /\.auth-shell\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(360px,460px\)/, 'desktop two-column auth layout must remain defined outside the mobile override');
console.log('RealityOS auth mobile responsive contract: PASS');
