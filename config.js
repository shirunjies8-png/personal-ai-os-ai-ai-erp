(function setupPersonalAIOSConfig() {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';
  const isGithubPages = currentHost.includes('github.io');
  const isRender = currentHost.endsWith('.onrender.com') || currentHost.includes('render.com');

  const storedApiBase = typeof window !== 'undefined'
    ? window.localStorage.getItem('personal_ai_os_api_base_url')
    : '';

  // GitHub Pages never guesses a backend URL: an operator must explicitly publish
  // the HTTPS gateway URL through the runtime config or local override.
  const fallbackRemoteApi = '';

  const apiBaseUrl =
    storedApiBase ||
    (typeof window !== 'undefined' && window.PERSONAL_AI_OS_API_BASE_URL) ||
    (isLocalhost ? currentOrigin : '') ||
    (isRender ? currentOrigin : '') ||
    (isGithubPages ? fallbackRemoteApi : '');

  window.PERSONAL_AI_OS_CONFIG = {
    API_BASE_URL: apiBaseUrl,
    DEMO_LOGIN_ENABLED: true,
    DEMO_LOGIN_ONLY: isGithubPages || window.location.protocol === 'file:',
    GITHUB_PAGES_URL: 'https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/',
    RENDER_BACKEND_URL: fallbackRemoteApi,
    APP_NAME: 'Personal AI OS 企业人工智能操作系统'
  };
})();
