(() => {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args) => {
    const message = args.map(item => String(item || '')).join(' ');
    if (/^Warning:\s*Parameter not found:/i.test(message)) return;
    originalWarn(...args);
  };
  importScripts('./worker.min.js');
})();
