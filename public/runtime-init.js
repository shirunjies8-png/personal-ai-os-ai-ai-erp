(function () {
  if (window.runtime) return;
  const fallback = {
    ready: true,
    mode: 'fallback',
    state: 'fallback',
    get(name, fallbackValue) {
      return fallbackValue ?? null;
    },
    set() {},
    call(name, fallbackValue) {
      return typeof fallbackValue === 'function' ? fallbackValue() : (fallbackValue ?? null);
    }
  };
  window.runtime = fallback;
  window.GlobalRuntime = fallback;
})();
