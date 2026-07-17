(function setupPersonalAIOSConfig() {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';
  const isGithubPages = currentHost.includes('github.io');
  const isRender = currentHost.endsWith('.onrender.com') || currentHost.includes('render.com');

  const storedApiBase = typeof window !== 'undefined'
    ? window.localStorage.getItem('personal_ai_os_api_base_url')
    : '';
  const publicGatewayUrl = 'https://101.37.147.225';
  const deprecatedApiBases = new Set([
    'http://101.37.147.225',
    'https://izbp18qo46rh3fw5snh0giz.taild87352.ts.net'
  ]);
  const normalizeApiBase = value => String(value || '').trim().replace(/\/+$/, '');
  const isSafeApiBase = value => {
    const normalized = normalizeApiBase(value);
    if (!normalized) return false;
    if (!isGithubPages) return /^https?:\/\//i.test(normalized);
    return /^https:\/\//i.test(normalized);
  };
  const normalizedStoredApiBase = normalizeApiBase(storedApiBase);
  const safeStoredApiBase = isSafeApiBase(normalizedStoredApiBase) && !deprecatedApiBases.has(normalizedStoredApiBase)
    ? normalizedStoredApiBase
    : '';
  const runtimeApiBase = typeof window !== 'undefined' && isSafeApiBase(window.PERSONAL_AI_OS_API_BASE_URL)
    ? normalizeApiBase(window.PERSONAL_AI_OS_API_BASE_URL)
    : '';

  // GitHub Pages is HTTPS, so business persistence must use the public HTTPS gateway.
  // The gateway itself remains bound to loopback behind Nginx; no browser calls port 3100.
  const fallbackRemoteApi = isGithubPages ? publicGatewayUrl : '';

  const apiBaseUrl =
    safeStoredApiBase ||
    runtimeApiBase ||
    (isLocalhost ? currentOrigin : '') ||
    (isRender ? currentOrigin : '') ||
    (isGithubPages ? fallbackRemoteApi : '');

  window.PERSONAL_AI_OS_CONFIG = {
    API_BASE_URL: apiBaseUrl,
    DEMO_LOGIN_ENABLED: true,
    DEMO_LOGIN_ONLY: window.location.protocol === 'file:' || (isGithubPages && !apiBaseUrl),
    REQUEST_TIMEOUT_MS: 10000,
    BACKEND_REQUIRES_TAILSCALE: false,
    GITHUB_PAGES_URL: 'https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/',
    GATEWAY_BACKEND_URL: fallbackRemoteApi,
    RENDER_BACKEND_URL: fallbackRemoteApi,
    APP_NAME: 'Personal AI OS 企业人工智能操作系统'
  };
})();
