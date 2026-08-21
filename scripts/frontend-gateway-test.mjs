import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const configSource = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function loadConfig({ hostname, origin, protocol = 'https:', storedApiBase = '', runtimeApiBase = '' }) {
  const window = {
    location: { hostname, origin, protocol },
    localStorage: { getItem: key => key === 'personal_ai_os_api_base_url' ? storedApiBase : null },
    PERSONAL_AI_OS_API_BASE_URL: runtimeApiBase
  };
  vm.runInNewContext(configSource, { window });
  return window.PERSONAL_AI_OS_CONFIG;
}

const pages = loadConfig({
  hostname: 'shirunjies8-png.github.io',
  origin: 'https://shirunjies8-png.github.io',
  storedApiBase: 'https://legacy.example.invalid'
});
assert.equal(pages.STATIC_DEMO_ONLY, true);
assert.equal(pages.DEMO_LOGIN_ONLY, true);
assert.equal(pages.API_BASE_URL, '', 'Pages must not implicitly probe a stored backend URL');
assert.equal(pages.GATEWAY_BACKEND_URL, '');
assert.equal(pages.BACKEND_REQUIRES_TAILSCALE, false);
assert.equal(pages.REQUEST_TIMEOUT_MS, 10000);

const pagesWithLegacyTailnet = loadConfig({
  hostname: 'shirunjies8-png.github.io',
  origin: 'https://shirunjies8-png.github.io',
  storedApiBase: 'https://izbp18qo46rh3fw5snh0giz.taild87352.ts.net'
});
assert.equal(pagesWithLegacyTailnet.STATIC_DEMO_ONLY, true);
assert.equal(pagesWithLegacyTailnet.API_BASE_URL, '', 'Deprecated Pages targets must not become an implicit fallback');

const pagesWithExplicitGateway = loadConfig({
  hostname: 'shirunjies8-png.github.io',
  origin: 'https://shirunjies8-png.github.io',
  runtimeApiBase: 'https://gateway.example.test/'
});
assert.equal(pagesWithExplicitGateway.STATIC_DEMO_ONLY, false);
assert.equal(pagesWithExplicitGateway.DEMO_LOGIN_ONLY, false);
assert.equal(pagesWithExplicitGateway.API_BASE_URL, 'https://gateway.example.test');
assert.equal(pagesWithExplicitGateway.GATEWAY_BACKEND_URL, 'https://gateway.example.test');

const pagesWithInsecureGateway = loadConfig({
  hostname: 'shirunjies8-png.github.io',
  origin: 'https://shirunjies8-png.github.io',
  runtimeApiBase: 'http://gateway.example.test'
});
assert.equal(pagesWithInsecureGateway.STATIC_DEMO_ONLY, true);
assert.equal(pagesWithInsecureGateway.API_BASE_URL, '', 'Pages must fail closed for a mixed-content gateway');

const local = loadConfig({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:3000', protocol: 'http:' });
assert.equal(local.API_BASE_URL, 'http://127.0.0.1:3000');
assert.equal(local.DEMO_LOGIN_ONLY, false);
assert.equal(local.STATIC_DEMO_ONLY, false);

const localWithInvalidStoredTarget = loadConfig({
  hostname: '127.0.0.1',
  origin: 'http://127.0.0.1:3000',
  protocol: 'http:',
  storedApiBase: 'javascript:alert(1)'
});
assert.equal(localWithInvalidStoredTarget.API_BASE_URL, 'http://127.0.0.1:3000', 'Invalid external targets must fail closed');

assert.match(coreSource, /meta\.baseUrl \|\| this\.resolveGatewayBase\(\)/);
assert.match(coreSource, /REQUEST_TIMEOUT_MS \|\| 10000/);
assert.match(coreSource, /async systemStatus[\s\S]{0,220}\/api\/self-test/);
assert.match(coreSource, /async ensureAiConfigured[\s\S]{0,220}AI 服务暂未配置/);
assert.match(coreSource, /HTTPS 后端未连接，已保留本地演示功能/);
assert.match(coreSource, /AI 服务暂未配置/);
assert.match(coreSource, /isDisplayMode\(\)\s*\{\s*return this\.isGitHubPagesHost\(\) && !String\(RuntimeConfig\.API_BASE_URL \|\| ''\)\.trim\(\);/, 'Display mode must be derived from the single runtime gateway decision');
assert.match(appSource, /const health = await APIClient\.health\(\)/);
assert.match(appSource, /APIClient\.systemStatus\(apiUrl\)/);
assert.match(appSource, /message: 'AI 服务暂未配置'/);
assert.match(appSource, /allowAi: Boolean\(Store\.state\.aiServerStatus\?\.enabled/);

console.log('frontend gateway contract tests passed (Pages static-by-default, explicit HTTPS gateway opt-in, local gateway retained)');
