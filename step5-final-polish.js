(function () {
  if (typeof window === 'undefined' || window.__STEP5_FINAL_POLISH__) return;
  window.__STEP5_FINAL_POLISH__ = true;

  const STEP5_SIGNATURE = 'STEP5_FINAL_DEMO_AGGREGATION';
  const STEP5_MODULE = 'STEP 5 Error Center';
  const STEP5_FEATURE = 'Bug Monitor 聚合验证';
  const STEP5_TYPE = 'JavaScript Error';
  const STEP5_MESSAGE = '模拟同类错误聚合验证';
  const STEP5_REQUEST_IDS = ['STEP5-DEMO-001', 'STEP5-DEMO-002'];

  const safeNow = () => Date.now();
  const clone = value => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);
  const escapeHtml = value => (window.Utils?.escape ? window.Utils.escape(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));
  const getUI = () => (typeof UI !== 'undefined' ? UI : window.UI);
  const getApp = () => window.App || (typeof App !== 'undefined' ? App : null);
  const getStore = () => window.Store || (typeof Store !== 'undefined' ? Store : null);

  function ensureState() {
    window.GlobalSystemState = window.GlobalSystemState && typeof window.GlobalSystemState === 'object'
      ? window.GlobalSystemState
      : { ocrResult: null, aiResult: null, systemHealth: {}, errorLog: [], runtime: null };
    window.GlobalSystemState.systemHealth = window.GlobalSystemState.systemHealth && typeof window.GlobalSystemState.systemHealth === 'object'
      ? window.GlobalSystemState.systemHealth
      : {};
    window.GlobalSystemState.systemHealth.checks = Array.isArray(window.GlobalSystemState.systemHealth.checks)
      ? window.GlobalSystemState.systemHealth.checks
      : [];
    if (!window.GlobalSystemState.errorLog) window.GlobalSystemState.errorLog = [];
  }

  function ensureStore() {
    const store = getStore();
    if (!store || !store.state) return false;
    store.state.bugAlerts = Array.isArray(store.state.bugAlerts) ? store.state.bugAlerts : [];
    store.state.repairRecords = Array.isArray(store.state.repairRecords) ? store.state.repairRecords : [];
    store.state.aiErrors = Array.isArray(store.state.aiErrors) ? store.state.aiErrors : [];
    store.state.errorLog = Array.isArray(store.state.errorLog) ? store.state.errorLog : [];
    store.state.systemHealth = store.state.systemHealth && typeof store.state.systemHealth === 'object' ? store.state.systemHealth : {};
    store.state.systemHealth.checks = Array.isArray(store.state.systemHealth.checks) ? store.state.systemHealth.checks : [];
    return true;
  }

  function ensureRecordAliases(item = {}) {
    if (!item || typeof item !== 'object') return item;
    if (item.signature === STEP5_SIGNATURE) item.step5Demo = true;
    if (item.step5Demo) item.signature = item.signature || STEP5_SIGNATURE;
    const first = Number(item.firstSeenAt || item.firstAt || item.time || safeNow());
    const last = Number(item.lastSeenAt || item.lastAt || item.time || first);
    item.firstSeenAt = first;
    item.lastSeenAt = last;
    item.firstAt = item.firstAt || first;
    item.lastAt = item.lastAt || last;
    item.count = Math.max(1, Number(item.count || 1));
    return item;
  }

  function normalizeCollections() {
    if (!ensureStore()) return;
    const store = getStore();
    store.state.bugAlerts = store.state.bugAlerts.map(alert => ensureRecordAliases(alert));
    store.state.repairRecords = store.state.repairRecords.map(record => {
      if (!record || typeof record !== 'object') return record;
      if (record.signature === STEP5_SIGNATURE) record.step5Demo = true;
      if (record.step5Demo) record.signature = record.signature || STEP5_SIGNATURE;
      record.firstSeenAt = Number(record.firstSeenAt || record.firstAt || record.time || record.confirmedAt || safeNow());
      record.lastSeenAt = Number(record.lastSeenAt || record.lastAt || record.time || record.confirmedAt || record.firstSeenAt);
      record.count = Math.max(1, Number(record.count || 1));
      return record;
    });
    store.state.aiErrors = store.state.aiErrors.map(entry => {
      if (entry && typeof entry === 'object' && entry.signature === STEP5_SIGNATURE) entry.step5Demo = true;
      return entry;
    });
    store.state.errorLog = store.state.errorLog.map(entry => {
      if (entry && typeof entry === 'object' && entry.signature === STEP5_SIGNATURE) entry.step5Demo = true;
      return entry;
    });
  }

  function step5Issues() {
    if (!ensureStore()) return [];
    const store = getStore();
    return store.state.bugAlerts
      .map(alert => ensureRecordAliases(clone(alert)))
      .filter(item => item.signature === STEP5_SIGNATURE && item.status !== '已忽略' && item.status !== '已修复');
  }

  function updateStep5Health() {
    if (!ensureStore()) return;
    const store = getStore();
    const issues = step5Issues();
    const checks = Array.isArray(store.state.systemHealth.checks) ? store.state.systemHealth.checks.slice() : [];
    const check = {
      name: 'STEP 5 Bug Monitor',
      status: '🟢 演示记录',
      reason: `STEP 5 聚合演示记录 ${issues.length} 条，仅用于验证，不计入当前系统健康。`,
      suggestion: '可在 STEP 5 演示面板查看测试证据；真实待处理问题请查看 Bug 监测。',
      time: safeNow()
    };
    const idx = checks.findIndex(item => item && item.name === 'STEP 5 Bug Monitor');
    if (idx >= 0) checks[idx] = check;
    else checks.unshift(check);
    store.state.systemHealth = { ...store.state.systemHealth, checks };
    window.GlobalSystemState.systemHealth = { ...(window.GlobalSystemState.systemHealth || {}), checks };
    store.save();
  }

  function renderDemoEntryCard() {
    return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>STEP 5 演示入口</h3>
          <p>Error Center / Bug Monitor 已收口，可直接进入监控页验证。</p>
        </div>
        <span class="status-pill success">STEP 5 Production Ready</span>
      </div>
      <div class="panel-body">
        <div class="button-row">
          <button class="secondary-btn" data-action="step5-go-monitoring">进入 STEP 5 演示：Error Center / Bug Monitor</button>
          <button class="primary-btn" data-action="step5-reset-demo">重置并生成演示数据</button>
        </div>
      </div>
    </section>`;
  }

  function renderValidationCard() {
    const issues = step5Issues();
    const checks = [
      ['错误聚合', '同类 signature 只保留一条记录，count 累加。'],
      ['时间字段', 'firstSeenAt 保留首次发生，lastSeenAt 更新最近发生。'],
      ['确认修复', '进入最近修复，并同步 Error Center fixed 状态。'],
      ['忽略逻辑', '已忽略项不再影响健康告警。'],
      ['当前健康影响', `${issues.length} 个未确认且未忽略问题会影响健康告警。`],
      ['项目口径', 'STEP 5 Production Ready；全项目仍为 Resume Demo / MVP 增强阶段。']
    ];
    return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>STEP 5 Final Validation</h3>
          <p>STEP 5 Production Ready</p>
        </div>
        <span class="status-pill success">STEP 5 Production Ready</span>
      </div>
      <div class="panel-body">
        <div class="kb-list">
          ${checks.map(([name, desc]) => `<article class="kb-item"><span>${window.icon ? window.icon('check') : '•'}</span><div><b>${escapeHtml(name)}</b><p>${escapeHtml(desc)}</p></div></article>`).join('')}
        </div>
        <div class="button-row" style="margin-top:12px">
          <button class="secondary-btn" data-action="step5-generate-errors">生成测试错误</button>
          <button class="secondary-btn" data-action="step5-clear-ignored">清空 STEP 5 已忽略</button>
          <button class="secondary-btn" data-action="step5-clear-repairs">清空 STEP 5 最近修复</button>
        </div>
      </div>
    </section>`;
  }

  function renderAggregationPanel() {
    if (!ensureStore()) return '';
    const bugs = Store.state.bugAlerts
      .map(alert => ensureRecordAliases(clone(alert)))
      .filter(item => item.signature === STEP5_SIGNATURE);
    const errors = [
      ...Store.state.errorLog.filter(item => item && item.signature === STEP5_SIGNATURE),
      ...Store.state.aiErrors.filter(item => item && item.signature === STEP5_SIGNATURE)
    ].map(item => ({ ...clone(item), count: item.count || 1, lastSeenAt: item.lastSeenAt || item.lastAt || item.time, fixed: Boolean(item.fixed) }));
    const repairs = Store.state.repairRecords
      .map(item => ensureRecordAliases(clone(item)))
      .filter(item => item.signature === STEP5_SIGNATURE);
    return `
    <section class="panel">
      <div class="panel-head"><div><h3>STEP 5 聚合演示面板</h3></div><span class="badge">${bugs.length}/${errors.length}/${repairs.length}</span></div>
      <div class="panel-body">
        <div class="home-grid" style="margin-top:0">
          <section class="panel">
            <div class="panel-head"><div><h3>Bug Monitor 聚合记录</h3></div><span class="badge">${bugs.length}</span></div>
            <div class="panel-body">${bugs.length ? `<div class="kb-list">${bugs.map(item => `
              <article class="kb-item">
                <span>${window.icon ? window.icon(item.status === '已修复' ? 'check' : item.status === '已忽略' ? 'dot' : 'shield') : '•'}</span>
                <div>
                  <b>${escapeHtml(item.module || '系统')} · ${escapeHtml(item.feature || item.type || '异常')}</b>
                  <p>${escapeHtml(item.message || item.description || '')}</p>
                  <small>count=${Number(item.count || 1)} · firstSeenAt=${window.Utils?.formatDate ? window.Utils.formatDate(item.firstSeenAt || item.firstAt || item.time, true) : (item.firstSeenAt || item.firstAt || item.time)} · lastSeenAt=${window.Utils?.formatDate ? window.Utils.formatDate(item.lastSeenAt || item.lastAt || item.time, true) : (item.lastSeenAt || item.lastAt || item.time)}</small>
                </div>
                <div class="table-actions">
                  <span class="status-pill ${item.status === '已修复' ? 'success' : item.status === '已忽略' ? '' : 'warning'}">${escapeHtml(item.status === '已修复' ? '已确认修复' : item.status === '已忽略' ? '已忽略' : '影响健康告警')}</span>
                  <button class="secondary-btn compact" data-action="bug-detail" data-id="${item.id}">查看详情</button>
                  ${item.status === '已修复' || item.status === '已忽略' ? '' : `<button class="secondary-btn compact" data-action="bug-confirm" data-id="${item.id}">修复</button><button class="secondary-btn compact" data-action="bug-ignore" data-id="${item.id}">忽略</button>`}
                </div>
              </article>`).join('')}</div>` : '<div class="empty-result"><span>•</span><b>暂无 STEP 5 聚合记录</b><small>点击上方“生成测试错误”创建演示数据</small></div>'}</div>
          </section>
          <section class="panel">
            <div class="panel-head"><div><h3>Error Center</h3></div><span class="badge">${errors.length}</span></div>
            <div class="panel-body">${errors.length ? `<div class="kb-list">${errors.map(item => `
              <article class="kb-item">
                <span>${window.icon ? window.icon(item.fixed ? 'check' : 'x') : '•'}</span>
                <div>
                  <b>${escapeHtml(item.message || '错误')}</b>
                  <p>${escapeHtml(item.module || item.context || 'system')}</p>
                  <small>count=${Number(item.count || 1)} · lastSeenAt=${window.Utils?.formatDate ? window.Utils.formatDate(item.lastSeenAt || item.lastAt || item.time, true) : (item.lastSeenAt || item.lastAt || item.time)} · ${item.fixed ? 'fixed=true' : 'fixed=false'}</small>
                </div>
              </article>`).join('')}</div>` : '<div class="empty-result"><span>•</span><b>暂无 Error Center 记录</b><small>生成测试错误后会显示在这里</small></div>'}</div>
          </section>
          <section class="panel">
            <div class="panel-head"><div><h3>最近修复</h3></div><span class="badge">${repairs.length}</span></div>
            <div class="panel-body">${repairs.length ? `<div class="kb-list">${repairs.map(item => `
              <article class="kb-item">
                <span>${window.icon ? window.icon('check') : '•'}</span>
                <div>
                  <b>${escapeHtml(item.module || '系统')} · ${escapeHtml(item.feature || item.type || '已确认修复')}</b>
                  <p>${escapeHtml(item.message || item.suggestion || '')}</p>
                  <small>count=${Number(item.count || 1)} · confirmedAt=${window.Utils?.formatDate ? window.Utils.formatDate(item.confirmedAt || item.time, true) : (item.confirmedAt || item.time)}</small>
                </div>
              </article>`).join('')}</div>` : '<div class="empty-result"><span>•</span><b>暂无最近修复</b><small>点击“确认修复”后会显示在这里</small></div>'}</div>
          </section>
        </div>
      </div>
    </section>`;
  }

  function patchUi() {
    const ui = getUI();
    if (!ui) return;
    const originalHome = ui.home?.bind(ui);
    const originalMonitoring = ui.monitoring?.bind(ui);
    const originalSystemcheck = ui.systemcheck?.bind(ui);
    ui.home = function (...args) {
      const html = originalHome ? originalHome(...args) : '';
      return `${html}${renderDemoEntryCard()}`;
    };
    ui.monitoring = function (...args) {
      const html = originalMonitoring ? originalMonitoring(...args) : '';
      return `${renderValidationCard()}${renderAggregationPanel()}${html}`;
    };
    ui.systemcheck = function (...args) {
      const html = originalSystemcheck ? originalSystemcheck(...args) : '';
      return `${renderValidationCard()}${renderAggregationPanel()}${html}`;
    };
  }

  function patchApp() {
    const app = getApp();
    if (!app) return;
    const originalReportBug = app.reportBug?.bind(app);
    const originalConfirmBugAlert = app.confirmBugAlert?.bind(app);
    const originalIgnoreBugAlert = app.ignoreBugAlert?.bind(app);
    const originalRunSystemCheck = app.runSystemCheck?.bind(app);
    const originalRenderBugMonitor = app.renderBugMonitor?.bind(app);

    app.reportBug = function (payload = {}) {
      const enhanced = {
        ...payload,
        step5Demo: payload.step5Demo || payload.signature === STEP5_SIGNATURE || (
          payload.module === STEP5_MODULE &&
          payload.feature === STEP5_FEATURE &&
          payload.type === STEP5_TYPE &&
          payload.message === STEP5_MESSAGE
        ),
        signature: payload.signature || ((payload.module === STEP5_MODULE && payload.feature === STEP5_FEATURE && payload.type === STEP5_TYPE && payload.message === STEP5_MESSAGE)
          ? STEP5_SIGNATURE
          : undefined)
      };
      const result = originalReportBug ? originalReportBug(enhanced) : null;
      normalizeCollections();
      if (result && result.signature === STEP5_SIGNATURE) {
        result.step5Demo = true;
        result.firstSeenAt = result.firstSeenAt || result.firstAt || result.time;
        result.lastSeenAt = result.lastSeenAt || result.lastAt || result.time;
      }
      updateStep5Health();
      return result;
    };

    app.confirmBugAlert = function (id) {
      const store = getStore();
      const before = (store.state.bugAlerts || []).find(item => item.id === id);
      const result = originalConfirmBugAlert ? originalConfirmBugAlert(id) : undefined;
      normalizeCollections();
      const after = (store.state.bugAlerts || []).find(item => item.id === id) || before;
      if (after && after.signature === STEP5_SIGNATURE) {
        after.step5Demo = true;
        after.firstSeenAt = after.firstSeenAt || after.firstAt || after.time;
        after.lastSeenAt = after.lastSeenAt || after.lastAt || after.time;
      }
      const repair = (store.state.repairRecords || []).find(item => item.bugId === id || item.signature === STEP5_SIGNATURE);
      if (repair && after && after.signature === STEP5_SIGNATURE) {
        repair.signature = repair.signature || STEP5_SIGNATURE;
        repair.step5Demo = true;
        repair.count = after.count || repair.count || 1;
        repair.firstSeenAt = after.firstSeenAt || after.firstAt || after.time;
        repair.lastSeenAt = after.lastSeenAt || after.lastAt || after.time;
      }
      updateStep5Health();
      if (['monitoring', 'systemcheck'].includes(app.route)) app.rerender();
      return result;
    };

    app.ignoreBugAlert = function (id) {
      const result = originalIgnoreBugAlert ? originalIgnoreBugAlert(id) : undefined;
      normalizeCollections();
      const store = getStore();
      const after = (store.state.bugAlerts || []).find(item => item.id === id);
      if (after && after.signature === STEP5_SIGNATURE) {
        after.step5Demo = true;
        after.firstSeenAt = after.firstSeenAt || after.firstAt || after.time;
        after.lastSeenAt = after.lastSeenAt || after.lastAt || after.time;
      }
      updateStep5Health();
      if (['monitoring', 'systemcheck'].includes(app.route)) app.rerender();
      return result;
    };

    app.runSystemCheck = async function (...args) {
      const result = originalRunSystemCheck ? await originalRunSystemCheck(...args) : undefined;
      updateStep5Health();
      if (['monitoring', 'systemcheck', 'aistatus'].includes(app.route)) app.rerender();
      return result;
    };

    app.renderBugMonitor = function (...args) {
      const result = originalRenderBugMonitor ? originalRenderBugMonitor(...args) : undefined;
      normalizeCollections();
      updateStep5Health();
      return result;
    };
  }

  function generateStep5DemoErrors({ reset = false } = {}) {
    if (!ensureStore()) return;
    const store = getStore();
    normalizeCollections();
    if (reset) {
      store.state.bugAlerts = store.state.bugAlerts.filter(item => item.signature !== STEP5_SIGNATURE);
      store.state.repairRecords = store.state.repairRecords.filter(item => item.signature !== STEP5_SIGNATURE && !item.step5Demo);
      store.state.aiErrors = store.state.aiErrors.filter(item => item.signature !== STEP5_SIGNATURE);
      store.state.errorLog = store.state.errorLog.filter(item => item.signature !== STEP5_SIGNATURE);
    }
    STEP5_REQUEST_IDS.forEach((requestId, index) => {
      const now = safeNow() + index;
      const payload = {
        module: STEP5_MODULE,
        feature: STEP5_FEATURE,
        type: STEP5_TYPE,
        message: STEP5_MESSAGE,
        description: STEP5_MESSAGE,
        suggestion: '请点击“确认修复”或“忽略”后再验证健康状态。',
        requestId,
        source: 'step5-demo',
        signature: STEP5_SIGNATURE,
        step5Demo: true,
        time: now
      };
      const app = getApp();
      const record = app?.reportBug ? app.reportBug(payload) : null;
      const normalized = record || (store.state.bugAlerts || []).find(item => item.signature === STEP5_SIGNATURE);
      if (normalized) {
        normalized.step5Demo = true;
        normalized.signature = STEP5_SIGNATURE;
        normalized.firstSeenAt = normalized.firstSeenAt || normalized.firstAt || now;
        normalized.lastSeenAt = now;
        normalized.firstAt = normalized.firstAt || now;
        normalized.lastAt = now;
        normalized.requestId = requestId;
      }
      store.state.aiErrors.unshift({
        id: `step5-ai-${index + 1}-${now}`,
        message: STEP5_MESSAGE,
        detail: STEP5_MESSAGE,
        context: STEP5_FEATURE,
        requestId,
        rawError: STEP5_MESSAGE,
        signature: STEP5_SIGNATURE,
        module: STEP5_MODULE,
        feature: STEP5_FEATURE,
        step5Demo: true,
        time: now,
        fixed: false
      });
      store.state.errorLog.unshift({
        id: `step5-log-${index + 1}-${now}`,
        time: now,
        module: STEP5_MODULE,
        feature: STEP5_FEATURE,
        message: STEP5_MESSAGE,
        requestId,
        suggestion: '请点击“确认修复”或“忽略”后再验证健康状态。',
        rawError: STEP5_MESSAGE,
        signature: STEP5_SIGNATURE,
        step5Demo: true,
        status: '待确认'
      });
    });
    store.state.aiErrors = store.state.aiErrors.slice(0, 50);
    store.state.errorLog = store.state.errorLog.slice(0, 100);
    store.save();
    normalizeCollections();
    updateStep5Health();
    const app = getApp();
    if (app?.rerender) app.rerender();
  }

  function clearStep5Ignored() {
    if (!ensureStore()) return;
    const store = getStore();
    store.state.bugAlerts = store.state.bugAlerts.map(item => {
      if (item.signature !== STEP5_SIGNATURE) return item;
      return {
        ...item,
        ignored: false,
        ignoredAt: 0,
        status: item.confirmed || item.fixed ? '已修复' : '待确认'
      };
    });
    store.state.aiErrors = store.state.aiErrors.map(item => item.signature === STEP5_SIGNATURE ? { ...item, ignored: false, ignoredAt: 0, status: item.fixed ? '已修复' : '待确认' } : item);
    store.state.errorLog = store.state.errorLog.map(item => item.signature === STEP5_SIGNATURE ? { ...item, ignored: false, ignoredAt: 0, status: item.fixed ? '已修复' : '待确认' } : item);
    store.save();
    normalizeCollections();
    updateStep5Health();
    const app = getApp();
    if (app?.rerender) app.rerender();
  }

  function clearStep5Repairs() {
    if (!ensureStore()) return;
    const store = getStore();
    store.state.repairRecords = store.state.repairRecords.filter(item => item.signature !== STEP5_SIGNATURE && !item.step5Demo);
    store.save();
    normalizeCollections();
    updateStep5Health();
    const app = getApp();
    if (app?.rerender) app.rerender();
  }

  function resetAndGenerate() {
    if (!ensureStore()) return;
    const store = getStore();
    store.state.bugAlerts = store.state.bugAlerts.filter(item => item.signature !== STEP5_SIGNATURE);
    store.state.repairRecords = store.state.repairRecords.filter(item => item.signature !== STEP5_SIGNATURE && !item.step5Demo);
    store.state.aiErrors = store.state.aiErrors.filter(item => item.signature !== STEP5_SIGNATURE);
    store.state.errorLog = store.state.errorLog.filter(item => item.signature !== STEP5_SIGNATURE);
    store.save();
    normalizeCollections();
    generateStep5DemoErrors({ reset: false });
  }

  function navigateMonitoring() {
    const app = getApp();
    if (app?.navigate) app.navigate('monitoring');
    else location.hash = '#/monitoring';
  }

  function onClick(event) {
    const action = event.target.closest?.('[data-action]');
    if (!action) return;
    const { action: name } = action.dataset || {};
    if (!name || !name.startsWith('step5-')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (name === 'step5-go-monitoring') {
      navigateMonitoring();
      return;
    }
    if (name === 'step5-reset-demo') {
      resetAndGenerate();
      navigateMonitoring();
      return;
    }
    if (name === 'step5-generate-errors') {
      generateStep5DemoErrors();
      navigateMonitoring();
      return;
    }
    if (name === 'step5-clear-ignored') {
      clearStep5Ignored();
      return;
    }
    if (name === 'step5-clear-repairs') {
      clearStep5Repairs();
      return;
    }
  }

  function bootstrap() {
    ensureState();
    patchUi();
    patchApp();
    normalizeCollections();
    updateStep5Health();
    document.addEventListener('click', onClick, true);
    const app = getApp();
    if (app?.route && window.AuthClient?.isLoggedIn?.()) {
      queueMicrotask(() => {
        const current = getApp();
        if (current?.rerender) current.rerender();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
