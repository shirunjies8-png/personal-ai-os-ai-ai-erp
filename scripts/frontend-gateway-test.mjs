import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const configSource = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function loadConfig({ hostname, origin, protocol = 'https:', storedApiBase = '' }) {
  const window = {
    location: { hostname, origin, protocol },
    localStorage: { getItem: key => key === 'personal_ai_os_api_base_url' ? storedApiBase : null }
  };
  vm.runInNewContext(configSource, { window });
  return window.PERSONAL_AI_OS_CONFIG;
}

const pages = loadConfig({
  hostname: 'shirunjies8-png.github.io',
  origin: 'https://shirunjies8-png.github.io',
  storedApiBase: 'http://101.37.147.225'
});
assert.equal(pages.DEMO_LOGIN_ONLY, false);
assert.equal(pages.API_BASE_URL, 'https://101.37.147.225');
assert.equal(pages.BACKEND_REQUIRES_TAILSCALE, false);
assert.equal(pages.REQUEST_TIMEOUT_MS, 10000);
assert.doesNotMatch(pages.API_BASE_URL, /^http:/, 'Pages must not use a mixed-content HTTP API');

const pagesWithLegacyTailnet = loadConfig({
  hostname: 'shirunjies8-png.github.io',
  origin: 'https://shirunjies8-png.github.io',
  storedApiBase: 'https://izbp18qo46rh3fw5snh0giz.taild87352.ts.net'
});
assert.equal(pagesWithLegacyTailnet.API_BASE_URL, 'https://101.37.147.225');

const local = loadConfig({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:3000', protocol: 'http:' });
assert.equal(local.API_BASE_URL, 'http://127.0.0.1:3000');
assert.equal(local.DEMO_LOGIN_ONLY, false);

assert.match(coreSource, /meta\.baseUrl \|\| this\.resolveGatewayBase\(\)/);
assert.match(coreSource, /REQUEST_TIMEOUT_MS \|\| 10000/);
assert.match(coreSource, /async systemStatus[\s\S]{0,220}\/api\/self-test/);
assert.match(coreSource, /async ensureAiConfigured[\s\S]{0,220}AI 服务暂未配置/);
assert.match(coreSource, /HTTPS 后端未连接，已保留本地演示功能/);
assert.match(coreSource, /AI 服务暂未配置/);
assert.doesNotMatch(coreSource, /async health[\s\S]{0,160}isGitHubPagesHost/, 'Pages health must use the configured backend');
assert.match(appSource, /const health = await APIClient\.health\(\)/);
assert.match(appSource, /APIClient\.systemStatus\(apiUrl\)/);
assert.match(appSource, /message: 'AI 服务暂未配置'/);
assert.match(appSource, /allowAi: Boolean\(Store\.state\.aiServerStatus\?\.enabled/);

console.log('frontend HTTPS gateway, timeout, fallback and AI-disabled tests passed');
