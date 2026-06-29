window.PERSONAL_AI_OS_CONFIG = {
  API_BASE_URL:
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost'
      ? window.location.origin
      : 'https://your-vercel-backend.vercel.app',
  DEMO_LOGIN_ENABLED: true,
  DEMO_LOGIN_ONLY:
    window.location.hostname.includes('github.io') ||
    window.location.protocol === 'file:',
  GITHUB_PAGES_URL: 'https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/',
  APP_NAME: 'Personal AI OS 企业人工智能操作系统'
};
