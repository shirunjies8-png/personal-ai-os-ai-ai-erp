if (typeof window !== 'undefined') {
  window.GlobalSystemState = window.GlobalSystemState && typeof window.GlobalSystemState === 'object' ? window.GlobalSystemState : {
    ocrResult: null,
    aiResult: null,
    systemHealth: {},
    errorLog: [],
    runtime: null
  };
  if (!window.EventBus) {
    window.EventBus = {
      events: {},
      on(event, fn) {
        (this.events[event] ||= []).push(fn);
      },
      emit(event, data) {
        (this.events[event] || []).forEach(fn => {
          try {
            fn(data);
          } catch (error) {
            console.error('[EventBus]', event, error);
          }
        });
      }
    };
  }
  if (!window.runtime) window.runtime = createRuntimeFallback();
  window.GlobalSystemState.runtime = window.runtime;
}

function syncGlobalSystemState(patch = {}) {
  if (typeof window === 'undefined') return;
  const current = window.GlobalSystemState && typeof window.GlobalSystemState === 'object'
    ? window.GlobalSystemState
    : { ocrResult: null, aiResult: null, systemHealth: {}, errorLog: [], runtime: null };
  window.GlobalSystemState = {
    ocrResult: current.ocrResult ?? null,
    aiResult: current.aiResult ?? null,
    systemHealth: current.systemHealth ?? {},
    errorLog: Array.isArray(current.errorLog) ? current.errorLog : [],
    runtime: current.runtime ?? window.runtime ?? null,
    ...patch
  };
}

syncGlobalSystemState({ runtime: window.runtime });
Store.load();

const App = {
  route: 'home',
  temp: {
    excel: {
      file: null,
      workbook: null,
      rows: [],
      sheetName: '',
      result: '',
      records: [],
      summary: null,
      meta: {},
      schema: {},
      loadedFromFileId: null
    },
    word: JSON.parse(localStorage.getItem('personal-ai-os-word-draft') || '{"title":"","content":"","sourceFile":null}'),
    pdf: {
      files: [],
      result: '',
      extracted: '',
      qaQuestion: '',
      qaAnswer: '',
      analysis: '',
      tableText: '',
      scanMode: '',
      fileInfos: [],
      loadedFromFileId: null
    },
    ocr: {
      file: null,
      url: '',
      result: '',
      original: '',
      progress: 0,
      status: '',
      structured: '',
      template: '通用',
      quality: null,
      aiFix: '',
      aiMode: 'mock',
      aiError: '',
      edited: false,
      qaQuestion: '',
      qaAnswer: '',
      analysis: '',
      providerId: 'auto',
      providerResult: null,
      review: null,
      diagnostics: null,
      sourceFile: {},
      reviewZoom: 1,
      fieldDrafts: [],
      confirmedFields: JSON.parse(localStorage.getItem('personal-ai-os-ocr-confirmed-fields') || 'null'),
      demoFields: null
    },
    sql: { dialect: 'MySQL', prompt: '', output: '', explanation: '' },
    writing: JSON.parse(localStorage.getItem('personal-ai-os-writing-draft') || '{"type":"日报","prompt":"","output":""}'),
    image: { file: null, url: '', result: '', outputBlob: null, imageType: '', ocrText: '' },
    fileSearch: '',
    fileCategory: '全部',
    fileSort: 'updated_desc',
    kbSearch: '',
    kbQuestion: '',
    kbAnswer: '',
    settingsTab: 'account',
    chatSearch: '',
    chatSending: false,
    chatContextFiles: [],
    skillHub: JSON.parse(localStorage.getItem('personal-ai-os-skill-hub') || '{"category":"全部","query":"","selectedId":"","recent":[],"copied":[],"preview":""}'),
    downloadCache: {},
    taskSelectedId: '',
    downloadSelectedId: '',
    approvalSelectedId: '',
    toolSelectedName: '',
    integrationSelectedId: 'erp',
    inquirySelectedId: '',
    inquirySearch: '',
    inquiryLoading: false,
    manufacturing: ManufacturingWorkspace.emptyState(),
    apqp: { open: false, loading: false, projects: [], selectedId: '', project: null, error: '' },
    agent: {
      goal: '',
      steps: [],
      logs: [],
      result: '',
      running: false,
      status: '等待中',
      currentRunId: null,
      cancelRequested: false
    }
  },
  saveTimer: null,
  agentTimer: null,
  chatLayoutObserver: null,
  chatResizeRaf: null,
  chatScrollRaf: null,
  chatResizeFallbackBound: false,
  chatMutationObserver: null,
  chatAutoScrollUntil: 0,
  chatAutoScrollBound: false,

  async init() {
    if (!Store.state.chats.length) this.createChat(false);
    // 先绑定交互事件，避免状态同步较慢时聊天提交被丢失。
    this.bindGlobalEvents();
    if (AuthClient.isDemo()) await this.tryPromoteDemoSession();
    await Store.hydrateFromServer();
    this.setupOcrProviders();
    this.restoreOcrSession();
    this.restoreReusableSessions();
    if (!AuthClient.isLoggedIn() && window.PERSONAL_AI_OS_CONFIG?.DEMO_LOGIN_ONLY) {
      AuthClient.save({
        token: 'demo-local-session',
        demo: true,
        user: {
          id: 'demo-admin',
          enterpriseId: 'demo-enterprise',
          email: DEMO_ACCOUNT.email,
          name: DEMO_ACCOUNT.name,
          role: DEMO_ACCOUNT.role,
          status: '启用'
        },
        enterprise: {
          id: 'demo-enterprise',
          name: DEMO_ACCOUNT.enterpriseName
        }
      });
    }
    this.normalizeBugAlerts();
    this.applyTheme();
    this.renderNav();
    this.bindGlobalErrors();
    const initialRoute = AuthClient.isLoggedIn() ? (location.hash.replace('#/', '') || 'home') : 'login';
    this.navigate(initialRoute, false);
    await this.updateStorage();
    this.updateApiState();
    this.renderBugMonitor();
    if (AuthClient.isLoggedIn()) {
      await this.refreshDashboard();
      await this.refreshOrders();
      await this.refreshInventory();
      await this.refreshAgentRuntime();
    }
  },

  renderNav() {
    const nav = document.getElementById('mainNav');
    const modeToggle = document.getElementById('workspaceModeToggle');
    if (!AuthClient.isLoggedIn()) {
      nav.innerHTML = `<span class="nav-group-label">账户</span><button class="nav-link active" data-route="login">${icon('lock')}<span>登录</span></button>`;
      if (modeToggle) modeToggle.hidden = true;
      return;
    }
    const workspaceMode = this.getWorkspaceMode();
    const renderModule = module => `<button class="nav-link" data-route="${module.id}">${icon(module.icon)}<span>${module.name}</span>${module.id === 'chat' ? `<span class="nav-count">${Store.state.chats.length}</span>` : ''}${workspaceMode === 'lab' && !isCoreModule(module.id) ? '<span class="nav-count lab">实验</span>' : ''}</button>`;
    if (workspaceMode === 'user') {
      nav.innerHTML = CORE_NAVIGATION.map(([group, ids]) => `<span class="nav-group-label">${group}</span>${ids.map(id => moduleById(id)).map(renderModule).join('')}`).join('');
    } else {
      const visibleModules = MODULES.filter(item => !item.hidden);
      const coreModules = visibleModules.filter(item => isCoreModule(item.id));
      const labModules = visibleModules.filter(item => !isCoreModule(item.id));
      const groups = [...new Set(labModules.map(item => item.group))];
      nav.innerHTML = `<span class="nav-group-label">核心业务</span>${coreModules.map(renderModule).join('')}${groups.map(group => `<span class="nav-group-label">实验室 · ${group}</span>${labModules.filter(module => module.group === group).map(renderModule).join('')}`).join('')}`;
    }
    if (modeToggle) {
      modeToggle.hidden = false;
      modeToggle.classList.toggle('lab-active', workspaceMode === 'lab');
      modeToggle.innerHTML = `${icon(workspaceMode === 'lab' ? 'apps' : 'flask')}<span><b>${workspaceMode === 'lab' ? '实验室模式' : '用户模式'}</b><small>${workspaceMode === 'lab' ? '显示全部原有功能' : '仅显示核心业务'}</small></span><em>${workspaceMode === 'lab' ? '返回' : '进入'}</em>`;
    }
  },

  getWorkspaceMode() {
    return Store.state?.settings?.workspaceMode === 'lab' ? 'lab' : 'user';
  },

  toggleWorkspaceMode() {
    const nextMode = this.getWorkspaceMode() === 'lab' ? 'user' : 'lab';
    Store.state.settings.workspaceMode = nextMode;
    Store.save();
    this.renderNav();
    this.toast(nextMode === 'lab' ? '已进入实验室模式：原有扩展功能均明确标注为实验或演示。' : '已切回用户模式：仅显示核心 RFQ 业务路径。');
  },

  navigate(route, updateHash = true, options = {}) {
    const preserveScroll = options.preserveScroll === true;
    const previousScrollY = preserveScroll ? window.scrollY : 0;
    if (!AuthClient.isLoggedIn() && route !== 'login') route = 'login';
    this.route = moduleById(route).id;
    if (this.route === 'ocr' && !this.temp.ocr.providerResult) this.restoreOcrSession();
    if (updateHash) history.replaceState(null, '', `#/${this.route}`);
    document.getElementById('topTitle').textContent = moduleById(this.route).name;
    document.getElementById('workspace').innerHTML = UI.render(this.route);
    document.querySelectorAll('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === this.route));
    document.body.classList.remove('sidebar-open');
    this.renderStaticIcons();
    this.afterRender();
    this.renderBugMonitor();
    if (preserveScroll) {
      requestAnimationFrame(() => window.scrollTo({ top: previousScrollY, behavior: 'auto' }));
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  rerender() {
    this.navigate(this.route, false, { preserveScroll: true });
  },

  renderStaticIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      if (!el.dataset.drawn) {
        el.innerHTML = icon(el.dataset.icon);
        el.dataset.drawn = '1';
      }
    });
  },

  bindGlobalEvents() {
    const refreshMonitor = () => {
      if (['monitoring', 'systemcheck', 'aistatus'].includes(this.route)) this.rerender();
    };
    document.addEventListener('click', event => {
      const route = event.target.closest('[data-route]');
      if (route) {
        event.preventDefault();
        this.navigate(route.dataset.route);
        return;
      }
      const action = event.target.closest('[data-action]');
      if (action) {
        event.preventDefault();
        this.handleAction(action.dataset.action, action);
      }
    });
    document.addEventListener('change', event => {
      const input = event.target.closest('[data-input]');
      if (input) this.handleFileInput(input.dataset.input, [...input.files]);
      if (event.target.dataset.mailField) this.handleInput(event.target);
      if (event.target.name === 'writingType') {
        this.temp.writing.type = event.target.value;
        this.saveWritingDraft();
      }
      if (event.target.id === 'sqlDialect') this.temp.sql.dialect = event.target.value;
      if (event.target.id === 'fileCategory') {
        this.temp.fileCategory = event.target.value;
        this.rerender();
      }
      if (event.target.id === 'fileSort') {
        this.temp.fileSort = event.target.value;
        this.rerender();
      }
      if (event.target.id === 'apiProvider') this.applyProviderPreset(event.target.value);
    });
    document.addEventListener('input', event => this.handleInput(event.target));
    document.addEventListener('submit', event => {
      if (event.target.dataset.form === 'chat') {
        event.preventDefault();
        this.sendChat();
      }
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.openCommand();
      }
      if (event.key === 'Escape') this.closeModal();
      if (event.target.id === 'chatInput' && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendChat();
      }
    });
    document.addEventListener('app:saved', () => {
      const el = document.getElementById('saveIndicator');
      if (!el) return;
      el.classList.add('saving');
      el.innerHTML = '<i></i> 正在保存';
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        el.classList.remove('saving');
        el.innerHTML = '<i></i> 已保存到本地';
      }, 450);
      this.updateStorage();
    });
    on('ocr:completed', data => {
      if (!data || typeof data !== 'object') return;
      Store.state.ocrResult = {
        text: String(data.text || ''),
        table: data.table ?? null,
        imageMeta: data.imageMeta && typeof data.imageMeta === 'object' ? data.imageMeta : {},
        status: data.status || 'success'
      };
      Store.save();
      refreshMonitor();
    });
    on('ai:completed', () => refreshMonitor());
    on('error:created', error => {
      if (!error) return;
      refreshMonitor();
    });
    window.addEventListener('hashchange', () => this.navigate(location.hash.replace('#/', '') || 'home', false));
    document.getElementById('modalLayer').addEventListener('click', e => {
      if (e.target.id === 'modalLayer') this.closeModal();
    });
  },

  bindGlobalErrors() {
    if (this._errorsBound) return;
    this._errorsBound = true;
    window.addEventListener('error', event => {
      this.recordSystemError(event.error || event.message || '未知错误', 'window.onerror', 'global');
      this.rerender();
    });
    window.addEventListener('unhandledrejection', event => {
      this.recordSystemError(event.reason || 'Promise 拒绝', 'window.onunhandledrejection', 'global');
      this.rerender();
    });
  },

  renderBugMonitor() {
    const dock = document.getElementById('bugMonitorDock');
    if (!dock) return;
    if (this.route === 'chat') {
      dock.innerHTML = '';
      dock.hidden = true;
      return;
    }
    const alerts = this.getVisibleBugAlerts().filter(item => !item.confirmed && !item.fixed && !item.ignored).slice(0, 3);
    if (!alerts.length) {
      dock.innerHTML = '';
      dock.hidden = true;
      return;
    }
    dock.hidden = false;
    dock.innerHTML = `<section class="bug-monitor-card"><div class="bug-monitor-head"><div><strong>Bug 监测</strong><small>${alerts.length} 个待处理问题</small></div><span class="status-pill warning">智能诊断</span></div>${alerts.map(item => this.renderBugAlertCard(item, true)).join('')}</section>`;
  },

  bugAlertSignature(payload = {}) {
    return [
      payload.module || 'system',
      payload.feature || '',
      payload.type || '异常',
      payload.message || payload.description || '检测到异常'
    ].join('|');
  },

  bugAlertLifecycle(item = {}) {
    if (item.lifecycle === 'ignored' || item.status === '已忽略' || item.ignored) return 'ignored';
    if (item.lifecycle === 'resolved' || item.status === '已修复' || item.confirmed || item.fixed) return 'resolved';
    return 'active';
  },

  bugAlertStatusLabel(item = {}) {
    const lifecycle = this.bugAlertLifecycle(item);
    if (lifecycle === 'ignored') return '已忽略';
    if (lifecycle === 'resolved') return '已修复';
    return item.status === '待修复' ? '待修复' : '待确认';
  },

  normalizeBugAlert(item = {}) {
    return Stability.normalizeError({
      ...item,
      signature: item.signature || this.bugAlertSignature(item),
      lifecycle: item.lifecycle || this.bugAlertLifecycle(item),
      status: item.status || this.bugAlertStatusLabel(item)
    });
  },

  getVisibleBugAlerts() {
    const list = Array.isArray(Store.state.bugAlerts) ? Store.state.bugAlerts : [];
    const merged = new Map();
    list.map(item => this.normalizeBugAlert(item)).forEach(item => {
      const existing = merged.get(item.signature);
      if (!existing) {
        merged.set(item.signature, { ...item });
        return;
      }
      existing.count = Math.max(1, Number(existing.count || 1)) + Math.max(1, Number(item.count || 1));
      existing.firstAt = Math.min(existing.firstAt || item.firstAt || item.time, item.firstAt || item.time || existing.firstAt || Date.now());
      existing.lastAt = Math.max(existing.lastAt || existing.time || 0, item.lastAt || item.time || 0);
      existing.time = existing.firstAt || existing.time || item.time || Date.now();
      existing.message = existing.message || item.message;
      existing.description = existing.description || item.description;
      existing.suggestion = item.suggestion || existing.suggestion;
      existing.requestId = item.requestId || existing.requestId;
      existing.rawError = item.rawError || existing.rawError;
      const priority = { active: 2, resolved: 1, ignored: 0 };
      const currentPriority = priority[existing.lifecycle || this.bugAlertLifecycle(existing)] ?? 1;
      const nextPriority = priority[item.lifecycle || this.bugAlertLifecycle(item)] ?? 1;
      if (nextPriority > currentPriority) {
        existing.lifecycle = item.lifecycle || this.bugAlertLifecycle(item);
        existing.status = this.bugAlertStatusLabel({ ...existing, ...item, lifecycle: existing.lifecycle });
        existing.confirmed = existing.lifecycle === 'resolved';
        existing.confirmedAt = item.confirmedAt || existing.confirmedAt || (existing.lifecycle === 'resolved' ? existing.lastAt : 0);
        existing.fixed = existing.lifecycle === 'resolved';
        existing.fixedAt = item.fixedAt || existing.fixedAt || (existing.lifecycle === 'resolved' ? existing.lastAt : 0);
        existing.ignored = existing.lifecycle === 'ignored';
        existing.ignoredAt = item.ignoredAt || existing.ignoredAt || (existing.lifecycle === 'ignored' ? existing.lastAt : 0);
      }
    });
    return Array.from(merged.values()).sort((a, b) => (b.lastAt || b.time || 0) - (a.lastAt || a.time || 0));
  },

  normalizeBugAlerts() {
    Store.state.bugAlerts = this.getVisibleBugAlerts();
    Store.state.errorLog = (Store.state.errorLog || []).map(item => Stability.normalizeError(item));
    this.updateStabilityHealthSnapshot('error-normalize');
    Store.save();
  },

  persistBugAlerts(alerts = []) {
    const merged = new Map();
    alerts.map(item => this.normalizeBugAlert(item)).forEach(item => {
      const existing = merged.get(item.signature);
      if (!existing) {
        merged.set(item.signature, { ...item });
        return;
      }
      existing.count = Math.max(1, Number(existing.count || 1)) + Math.max(1, Number(item.count || 1));
      existing.firstAt = Math.min(existing.firstAt || item.firstAt || item.time, item.firstAt || item.time || existing.firstAt || Date.now());
      existing.lastAt = Math.max(existing.lastAt || existing.time || 0, item.lastAt || item.time || 0);
      existing.time = existing.firstAt || existing.time || item.time || Date.now();
      existing.message = existing.message || item.message;
      existing.description = existing.description || item.description;
      existing.suggestion = item.suggestion || existing.suggestion;
      existing.requestId = item.requestId || existing.requestId;
      existing.rawError = item.rawError || existing.rawError;
      const priority = { active: 2, resolved: 1, ignored: 0 };
      if ((priority[item.lifecycle] ?? 1) > (priority[existing.lifecycle] ?? 1)) {
        existing.lifecycle = item.lifecycle;
        existing.status = this.bugAlertStatusLabel({ ...existing, ...item, lifecycle: item.lifecycle });
        existing.confirmed = item.lifecycle === 'resolved';
        existing.confirmedAt = item.confirmedAt || existing.confirmedAt || (item.lifecycle === 'resolved' ? existing.lastAt : 0);
        existing.fixed = item.lifecycle === 'resolved';
        existing.fixedAt = item.fixedAt || existing.fixedAt || (item.lifecycle === 'resolved' ? existing.lastAt : 0);
        existing.ignored = item.lifecycle === 'ignored';
        existing.ignoredAt = item.ignoredAt || existing.ignoredAt || (item.lifecycle === 'ignored' ? existing.lastAt : 0);
      }
    });
    Store.state.bugAlerts = Array.from(merged.values())
      .sort((a, b) => (b.lastAt || b.time || 0) - (a.lastAt || a.time || 0))
      .slice(0, 20);
    Store.save();
    this.renderBugMonitor();
  },

  renderBugAlertCard(item, compact = false) {
    const lifecycle = item.lifecycle || this.bugAlertLifecycle(item);
    const statusLabel = lifecycle === 'resolved' ? '已修复' : lifecycle === 'ignored' ? '已忽略' : '待确认';
    const badgeClass = lifecycle === 'resolved'
      ? 'success'
      : lifecycle === 'ignored'
        ? ''
        : 'warning';
    return `<div class="bug-monitor-body"><div class="bug-row"><b>${Utils.escape(item.module || '系统')}</b><small>${Utils.escape(item.feature || item.type || '未知功能')}</small></div><div class="bug-detail">${Utils.escape(item.type || '异常')}：${Utils.escape(item.message || item.description || '已检测到问题')}</div><div class="bug-suggestion">${Utils.escape(item.suggestion || '请根据错误信息修复')}</div><div class="bug-meta">首次：${Utils.formatDate(item.firstAt || item.time, true)} · 最近：${Utils.formatDate(item.lastAt || item.time, true)} · 次数：${item.count || 1}${item.requestId ? ` · ${Utils.escape(item.requestId)}` : ''}</div><div class="button-row"><button class="secondary-btn compact" data-action="bug-detail" data-id="${item.id}">查看详情</button>${lifecycle === 'resolved' ? '' : lifecycle === 'ignored' ? `<button class="secondary-btn compact" data-action="bug-restore" data-id="${item.id}">恢复</button>` : `<button class="secondary-btn compact" data-action="bug-confirm" data-id="${item.id}">确认修复</button><button class="secondary-btn compact" data-action="bug-ignore" data-id="${item.id}">忽略</button>`}</div><div class="table-actions"><span class="status-pill${badgeClass ? ` ${badgeClass}` : ''}">${statusLabel}</span></div></div>`;
  },

  reportBug(payload = {}) {
    const record = this.normalizeBugAlert({
      ...payload,
      time: Date.now(),
      status: payload.status || '待确认'
    });
    Store.state.bugAlerts = Array.isArray(Store.state.bugAlerts) ? Store.state.bugAlerts.map(item => this.normalizeBugAlert(item)) : [];
    const signature = record.signature;
    const existing = Store.state.bugAlerts.find(item => item.signature === signature);
    if (existing) {
      existing.count = Math.max(1, Number(existing.count || 1)) + 1;
      existing.lastAt = record.time;
      existing.time = existing.firstAt || existing.time || record.time;
      existing.message = record.message || existing.message;
      existing.description = record.description || existing.description;
      existing.suggestion = record.suggestion || existing.suggestion;
      existing.requestId = record.requestId || existing.requestId;
      existing.rawError = record.rawError || existing.rawError;
      if ((existing.lifecycle || this.bugAlertLifecycle(existing)) !== 'ignored') {
        existing.lifecycle = 'active';
        existing.status = '待确认';
        existing.confirmed = false;
        existing.confirmedAt = 0;
        existing.fixed = false;
        existing.fixedAt = 0;
      }
      Store.state.bugAlerts = Store.state.bugAlerts.sort((a, b) => (b.lastAt || b.time || 0) - (a.lastAt || a.time || 0));
      Store.save();
      if (['monitoring', 'systemcheck'].includes(this.route)) this.rerender();
      else this.renderBugMonitor();
      return existing;
    }
    Store.state.bugAlerts.unshift(record);
    Store.state.bugAlerts = Store.state.bugAlerts
      .map(item => this.normalizeBugAlert(item))
      .sort((a, b) => (b.lastAt || b.time || 0) - (a.lastAt || a.time || 0))
      .slice(0, 20);
    this.updateStabilityHealthSnapshot('error-created');
    Store.save();
    if (['monitoring', 'systemcheck'].includes(this.route)) this.rerender();
    else this.renderBugMonitor();
    return record;
  },

  confirmBugAlert(id) {
    const item = (Store.state.bugAlerts || []).find(alert => alert.id === id);
    if (!item) return;
    const now = Date.now();
    item.lifecycle = 'resolved';
    item.status = '已修复';
    item.confirmed = true;
    item.fixed = true;
    item.confirmedAt = now;
    item.fixedAt = now;
    item.ignored = false;
    item.ignoredAt = 0;
    Store.state.repairRecords = Store.state.repairRecords || [];
    Store.state.repairRecords.unshift({
      id: uid(),
      bugId: item.id,
      module: item.module || 'system',
      feature: item.feature || item.type || '异常',
      type: item.type || '异常',
      message: item.message || item.description || '检测到问题',
      suggestion: item.suggestion || '请根据错误信息修复',
      requestId: item.requestId || '',
      time: now,
      confirmedAt: item.confirmedAt
    });
    Store.state.repairRecords = Store.state.repairRecords.slice(0, 20);
    (Store.state.aiErrors || []).forEach(error => {
      if ((error.requestId && error.requestId === item.requestId) || `${error.message || ''}` === `${item.message || ''}`) {
        error.fixed = true;
        error.fixedAt = now;
        error.status = '已修复';
      }
    });
    (Store.state.errorLog || []).forEach(entry => {
      if ((entry.requestId && entry.requestId === item.requestId) || `${entry.message || ''}` === `${item.message || ''}`) {
        entry.fixed = true;
        entry.fixedAt = now;
        entry.status = '已修复';
      }
    });
    this.updateStabilityHealthSnapshot('error-resolved');
    Store.save();
    this.toast('已记录该问题，请开发者根据错误信息修复。');
    if (['monitoring', 'systemcheck'].includes(this.route)) this.rerender();
    else this.renderBugMonitor();
  },

  ignoreBugAlert(id) {
    const item = (Store.state.bugAlerts || []).find(alert => alert.id === id);
    if (!item) return;
    const now = Date.now();
    item.lifecycle = 'ignored';
    item.status = '已忽略';
    item.ignored = true;
    item.ignoredAt = now;
    item.confirmed = false;
    item.confirmedAt = 0;
    item.fixed = false;
    item.fixedAt = 0;
    (Store.state.aiErrors || []).forEach(error => {
      if ((error.requestId && error.requestId === item.requestId) || `${error.message || ''}` === `${item.message || ''}`) {
        error.ignored = true;
        error.ignoredAt = now;
        error.status = '已忽略';
      }
    });
    (Store.state.errorLog || []).forEach(entry => {
      if ((entry.requestId && entry.requestId === item.requestId) || `${entry.message || ''}` === `${item.message || ''}`) {
        entry.ignored = true;
        entry.ignoredAt = now;
        entry.status = '已忽略';
      }
    });
    this.updateStabilityHealthSnapshot('error-ignored');
    Store.save();
    this.toast('已忽略该问题，系统健康状态不再受其影响。');
    if (['monitoring', 'systemcheck'].includes(this.route)) this.rerender();
    else this.renderBugMonitor();
  },

  restoreBugAlert(id) {
    const item = (Store.state.bugAlerts || []).find(alert => alert.id === id);
    if (!item) return;
    const now = Date.now();
    item.lifecycle = 'active';
    item.status = '待确认';
    item.ignored = false;
    item.ignoredAt = 0;
    item.confirmed = false;
    item.confirmedAt = 0;
    item.fixed = false;
    item.fixedAt = 0;
    (Store.state.aiErrors || []).forEach(error => {
      if ((error.requestId && error.requestId === item.requestId) || `${error.message || ''}` === `${item.message || ''}`) {
        error.ignored = false;
        error.ignoredAt = 0;
        error.status = '待确认';
      }
    });
    (Store.state.errorLog || []).forEach(entry => {
      if ((entry.requestId && entry.requestId === item.requestId) || `${entry.message || ''}` === `${item.message || ''}`) {
        entry.ignored = false;
        entry.ignoredAt = 0;
        entry.status = '待确认';
      }
    });
    this.updateStabilityHealthSnapshot('error-restored');
    Store.save();
    this.toast('已恢复该问题，重新计入待处理。');
    if (['monitoring', 'systemcheck'].includes(this.route)) this.rerender();
    else this.renderBugMonitor();
  },

  runErrorCenterSelfTest() {
    const signature = 'SelfTest|error-center-lifecycle|JavaScript Error|Error Center lifecycle self test';
    const before = {
      bugAlerts: Array.isArray(Store.state.bugAlerts) ? Store.state.bugAlerts.length : 0,
      aiErrors: Array.isArray(Store.state.aiErrors) ? Store.state.aiErrors.length : 0,
      errorLog: Array.isArray(Store.state.errorLog) ? Store.state.errorLog.length : 0,
      repairRecords: Array.isArray(Store.state.repairRecords) ? Store.state.repairRecords.length : 0
    };
    const cleanup = () => {
      Store.state.bugAlerts = (Store.state.bugAlerts || []).filter(item => item.signature !== signature);
      Store.state.aiErrors = (Store.state.aiErrors || []).filter(item => item.signature !== signature);
      Store.state.errorLog = (Store.state.errorLog || []).filter(item => item.signature !== signature);
      Store.state.repairRecords = (Store.state.repairRecords || []).filter(item => item.signature !== signature && item.bugId !== `selftest-${signature}`);
    };
    cleanup();
    const now = Date.now();
    const first = this.reportBug({
      id: `selftest-${signature}`,
      module: 'SelfTest',
      feature: 'error-center-lifecycle',
      type: 'JavaScript Error',
      message: 'Error Center lifecycle self test',
      detail: 'Self test detail for error center lifecycle.',
      description: 'Error Center lifecycle self test',
      suggestion: '检查查看详情、忽略、恢复和确认修复按钮。',
      stack: 'SelfTestStack',
      source: 'self-test',
      signature,
      requestId: 'STEP5-SELFTEST-001',
      time: now
    });
    const second = this.reportBug({
      id: `selftest-${signature}-2`,
      module: 'SelfTest',
      feature: 'error-center-lifecycle',
      type: 'JavaScript Error',
      message: 'Error Center lifecycle self test',
      detail: 'Self test detail for error center lifecycle repeated.',
      description: 'Error Center lifecycle self test',
      suggestion: '检查查看详情、忽略、恢复和确认修复按钮。',
      stack: 'SelfTestStack',
      source: 'self-test',
      signature,
      requestId: 'STEP5-SELFTEST-002',
      time: now + 1
    });
    const merged = (Store.state.bugAlerts || []).find(item => item.signature === signature);
    const beforeErrorCount = before.errorLog;
    let detailOk = false;
    try {
      this.openBugDetail(merged?.id || first?.id || second?.id);
      detailOk = Array.isArray(Store.state.errorLog) && Store.state.errorLog.length === beforeErrorCount;
    } catch {
      detailOk = false;
    }
    this.ignoreBugAlert(merged?.id || first?.id || second?.id);
    const afterIgnore = (Store.state.bugAlerts || []).find(item => item.signature === signature);
    const ignoreOk = Boolean(afterIgnore && afterIgnore.lifecycle === 'ignored' && afterIgnore.ignored);
    const activeAfterIgnore = (Store.state.bugAlerts || []).filter(item => (item.lifecycle || this.bugAlertLifecycle(item)) === 'active' && item.signature === signature).length === 0;
    this.restoreBugAlert(merged?.id || first?.id || second?.id);
    const afterRestore = (Store.state.bugAlerts || []).find(item => item.signature === signature);
    const restoreOk = Boolean(afterRestore && (afterRestore.lifecycle || this.bugAlertLifecycle(afterRestore)) === 'active');
    this.confirmBugAlert(merged?.id || first?.id || second?.id);
    const afterConfirm = (Store.state.bugAlerts || []).find(item => item.signature === signature);
    const confirmOk = Boolean(afterConfirm && (afterConfirm.lifecycle || this.bugAlertLifecycle(afterConfirm)) === 'resolved');
    const healthChecks = Array.isArray(Store.state.systemHealth?.checks) ? Store.state.systemHealth.checks : [];
    const healthItem = healthChecks.find(item => item.name === 'STEP 5 Bug Monitor');
    const healthOk = Boolean(healthItem && healthItem.status && !/待处理|异常/.test(healthItem.status));
    const aggregationOk = Boolean(afterConfirm && Number(afterConfirm.count || 0) >= 2 && afterConfirm.firstAt <= afterConfirm.lastAt);
    const jsErrorOk = Array.isArray(Store.state.errorLog) && Store.state.errorLog.length >= beforeErrorCount;
    const report = [
      { label: '查看详情', ok: detailOk },
      { label: '忽略', ok: ignoreOk && activeAfterIgnore },
      { label: '恢复', ok: restoreOk },
      { label: '确认修复', ok: confirmOk },
      { label: '健康统计', ok: healthOk },
      { label: '错误聚合', ok: aggregationOk },
      { label: '是否产生新增 JS 报错', ok: jsErrorOk }
    ];
    cleanup();
    Store.save();
    App.temp.errorCenterSelfTest = {
      time: now,
      signature,
      report,
      passed: report.every(item => item.ok),
      note: '本自检仅用于演示和开发验证，不影响真实 Bug Monitor 数据。'
    };
    this.rerender();
    return App.temp.errorCenterSelfTest;
  },

  openBugDetail(id) {
    const bugAlerts = Array.isArray(Store.state.bugAlerts) ? Store.state.bugAlerts : [];
    const aiErrors = Array.isArray(Store.state.aiErrors) ? Store.state.aiErrors : [];
    const repairRecords = Array.isArray(Store.state.repairRecords) ? Store.state.repairRecords : [];
    const item = bugAlerts.find(alert => alert.id === id)
      || aiErrors.find(entry => entry.id === id || entry.requestId === id)
      || repairRecords.find(entry => entry.id === id || entry.bugId === id);
    if (!item) {
      this.toast('未找到问题详情', 'error');
      return;
    }
    const status = item.status || (item.confirmed || item.fixed ? '已修复' : item.ignored ? '已忽略' : '待确认');
    const confirmedAt = item.confirmedAt || item.fixedAt || item.ignoredAt || item.time || 0;
    const lines = [
      `模块：${item.module || item.context || '系统'}`,
      `功能：${item.feature || item.context || item.type || '未知功能'}`,
      `类型：${item.type || '异常'}`,
      `状态：${status}`,
      `首次发生：${Utils.formatDate(item.firstAt || item.time, true)}`,
      `最近发生：${Utils.formatDate(item.lastAt || item.time, true)}`,
      `发生次数：${item.count || 1}`,
      `requestId：${item.requestId || '无'}`,
      `错误说明：${item.description || item.message || '已检测到问题'}`,
      `修复建议：${item.suggestion || '请根据错误信息修复'}`,
      item.detail ? `detail：${item.detail}` : '',
      item.stack ? `stack：${item.stack}` : '',
      `确认时间：${confirmedAt ? Utils.formatDate(confirmedAt, true) : '无'}`,
      item.rawError ? `Raw Error：${item.rawError}` : '',
      repairRecords.some(entry => entry.id === item.id || entry.bugId === item.id) ? '来源：最近修复' : ''
    ].filter(Boolean).join('\n');
    this.modal({
      title: '问题详情',
      body: `<pre class="log-box">${Utils.escape(lines)}</pre>`,
      actions: `<button class="secondary-btn" data-action="modal-close">关闭</button>`
    });
  },

  afterRender() {
    if (['home', 'crm', 'project', 'inquiries'].includes(this.route)
      && !this.temp.manufacturing.loaded && !this.temp.manufacturing.loading) {
      this.loadManufacturingData({ silent: true });
    }
    if (this.route === 'chat') {
      const active = Store.state.chats.find(chat => chat.id === Store.state.activeChatId);
      const assistantMessages = (active?.messages || []).filter(message => message.role === 'assistant');
      document.querySelectorAll('.message:not(.user) .message-content').forEach((node, index) => {
        const message = assistantMessages[index];
        if (message && message.mode !== 'loading') node.innerHTML = Utils.markdownToHtml(message.content);
      });
      const input = document.getElementById('chatInput');
      const submit = document.querySelector('[data-form="chat"] button[type="submit"]');
      if (input) input.disabled = this.temp.chatSending;
      if (submit) {
        submit.disabled = this.temp.chatSending;
        submit.lastChild.textContent = this.temp.chatSending ? '生成中...' : '发送';
      }
      this.bindChatLayoutObserver();
      this.bindChatMessageObserver();
      this.scrollChatToBottom('auto');
      requestAnimationFrame(() => this.scrollChatToBottom('auto'));
      setTimeout(() => this.scrollChatToBottom('auto'), 60);
      setTimeout(() => this.scrollChatToBottom('auto'), 220);
    }
  },

  bindChatLayoutObserver() {
    const main = document.querySelector('.chat-main');
    const composer = document.querySelector('.chat-composer');
    const messages = document.getElementById('chatMessages');
    if (!main || !composer || !messages) return;
    const update = () => {
      const height = Math.max(96, Math.ceil(composer.getBoundingClientRect().height || 0));
      main.style.setProperty('--chat-composer-height', `${height}px`);
      messages.style.setProperty('--chat-composer-height', `${height}px`);
      messages.style.paddingBottom = `calc(${height}px + 80px + var(--chat-bottom-gap, 0px) + env(safe-area-inset-bottom))`;
      messages.style.scrollPaddingBottom = `calc(${height}px + 88px + var(--chat-bottom-gap, 0px) + env(safe-area-inset-bottom))`;
    };
    update();
    if (this.chatLayoutObserver) this.chatLayoutObserver.disconnect();
    if ('ResizeObserver' in window) {
      this.chatLayoutObserver = new ResizeObserver(() => {
        if (this.chatResizeRaf) cancelAnimationFrame(this.chatResizeRaf);
        this.chatResizeRaf = requestAnimationFrame(() => {
          update();
          this.scrollChatToBottom('auto');
        });
      });
      this.chatLayoutObserver.observe(composer);
      this.chatLayoutObserver.observe(messages);
    } else {
    if (!this.chatResizeFallbackBound) {
        window.addEventListener('resize', update, { passive: true });
        this.chatResizeFallbackBound = true;
      }
    }
  },

  bindChatMessageObserver() {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;
    if (this.chatAutoScrollBound) return;
    this.chatAutoScrollBound = true;
    if ('MutationObserver' in window) {
      this.chatMutationObserver = new MutationObserver(() => {
        if (this.temp.chatSending || Date.now() <= this.chatAutoScrollUntil) {
          this.scrollChatToBottom('auto');
        }
      });
      this.chatMutationObserver.observe(messages, { childList: true, subtree: true, characterData: true });
    }
  },

  scrollChatToBottom(behavior = 'auto') {
    if (this.chatScrollRaf) cancelAnimationFrame(this.chatScrollRaf);
    this.chatScrollRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const box = document.getElementById('chatMessages');
        if (!box) return;
        const target = Math.max(0, box.scrollHeight - box.clientHeight);
        box.scrollTop = target;
        if (typeof box.scrollTo === 'function') box.scrollTo({ top: target, behavior });
      });
    });
  },

  handleInput(target) {
    if (target.id === 'wordTitle' || target.id === 'wordContent') {
      this.temp.word.title = document.getElementById('wordTitle')?.value || '';
      this.temp.word.content = document.getElementById('wordContent')?.value || '';
      localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveReusableSession('word', 'autosaved'), 400);
    }
    if (target.id === 'writingPrompt') {
      this.temp.writing.prompt = target.value;
      this.saveWritingDraft();
    }
    if (target.id === 'writingOutput') {
      this.temp.writing.output = target.value;
      this.saveWritingDraft();
    }
    if (target.id === 'sqlPrompt') this.temp.sql.prompt = target.value;
    if (target.id === 'sqlOutput') this.temp.sql.output = target.value;
    if (target.id === 'ocrResult') this.temp.ocr.result = target.value;
    if (target.id === 'ocrFixResult') this.temp.ocr.aiFix = target.value;
    if (target.dataset.ocrField) {
      this.temp.ocr.fieldDrafts = this.temp.ocr.fieldDrafts || this.buildOcrFieldDrafts(window.GlobalSystemState?.ocrResult?.text || this.temp.ocr.result || '', this.temp.ocr.quality || OCRService.assessQuality(window.GlobalSystemState?.ocrResult?.text || this.temp.ocr.result || ''), this.temp.ocr.demoFields?.fields || {});
      this.temp.ocr.fieldDrafts.fields = this.temp.ocr.fieldDrafts.fields || {};
      this.temp.ocr.fieldDrafts.fields[target.dataset.ocrField] = target.value;
      this.temp.ocr.fieldDrafts.rows = this.getOcrFieldOrder().map(field => ({
        field,
        value: this.temp.ocr.fieldDrafts.fields[field] || '待补充',
        status: field === '可信度'
          ? this.temp.ocr.fieldDrafts.fields[field] || '低'
          : (this.temp.ocr.fieldDrafts.fields[field] && this.temp.ocr.fieldDrafts.fields[field] !== '待补充' ? '已识别' : '未识别')
      }));
      if (target.dataset.ocrField !== '缺失字段' && target.dataset.ocrField !== '可信度') {
        const missing = this.getOcrFieldOrder()
          .filter(field => field !== '可信度' && field !== '缺失字段')
          .filter(field => String(this.temp.ocr.fieldDrafts.fields[field] || '待补充').trim() === '待补充');
        this.temp.ocr.fieldDrafts.fields['缺失字段'] = missing.length ? missing.join('、') : '无';
      }
    }
    if (target.id === 'ocrProviderSelect') {
      this.temp.ocr.providerId = target.value;
      Store.state.ocrData.providerConfig.selectedProviderId = target.value;
      Store.save();
      this.rerender();
    }
    if (target.dataset.ocrReviewField && this.temp.ocr.review) {
      this.saveOcrReview(OCRArchitecture.updateReviewField(this.temp.ocr.review, target.dataset.ocrReviewField, target.value));
    }
    if (target.id === 'agentGoal') this.temp.agent.goal = target.value;
    if (target.id === 'kbQuestion') this.temp.kbQuestion = target.value;
    if (target.id === 'pdfQuestion') this.temp.pdf.qaQuestion = target.value;
    if (target.id === 'ocrQuestion') this.temp.ocr.qaQuestion = target.value;
    if (target.id === 'chatSearch') {
      this.temp.chatSearch = target.value;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.rerender(), 180);
    }
    if (target.id === 'fileSearch') {
      this.temp.fileSearch = target.value;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.rerender();
        document.getElementById('fileSearch')?.focus();
      }, 180);
    }
    if (target.id === 'skillSearch') {
      this.temp.skillHub = this.temp.skillHub || {};
      this.temp.skillHub.query = target.value;
      localStorage.setItem('personal-ai-os-skill-hub', JSON.stringify(this.temp.skillHub));
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.rerender(), 160);
    }
    if (target.id === 'kbSearch') {
      this.temp.kbSearch = target.value;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.rerender();
        document.getElementById('kbSearch')?.focus();
      }, 180);
    }
    if (target.dataset.wsField && target.dataset.module) {
      const ws = this.getWorkspace(target.dataset.module);
      ws[target.dataset.wsField] = target.value;
      if (target.dataset.module === 'cost' && ['productName', 'productCode', 'customerName', 'quoteDate', 'quantity', 'unit', 'materialName', 'materialUnitPrice', 'materialUsage', 'materialLossRate', 'processType', 'unitProcessTime', 'equipmentHourCost', 'processLossRate', 'laborWage', 'unitLaborTime', 'packagingCost', 'transportCost', 'managementFee', 'otherFee', 'targetProfitRate', 'minimumProfitRate', 'rush', 'rushMultiplier'].includes(target.dataset.wsField)) {
        const plan = this.buildCostPlan(ws);
        ws.costPlan = plan;
        ws.result = plan.summary;
        if (plan.error) {
          ws.costStatus = '⚠️ 输入异常';
          this.reportBug({
            module: '成本核算助手',
            feature: '输入校验',
            type: '输入异常',
            message: plan.error,
            description: '成本核算助手检测到异常输入，请修正后再计算。',
            suggestion: '请检查数量、单价、材料用量、损耗率、利润率和加急倍率是否为有效数字。',
            source: 'business-detection'
          });
        } else {
          ws.costStatus = '✅ Production Ready';
          this.detectCostCalculationBug({ ...ws, costPlan: plan });
        }
      }
      Store.save();
      if (target.dataset.module === 'cost' && this.route === 'cost') this.rerender();
    }
    if (target.dataset.mailField) {
      const ws = this.getWorkspace('mail');
      ws[target.dataset.mailField] = target.type === 'checkbox' ? target.checked : target.value;
      ws.updatedAt = Date.now();
      Store.save();
    }
  },

  async handleAction(action, el) {
    const handlers = {
      'open-sidebar': () => document.body.classList.add('sidebar-open'),
      'close-sidebar': () => document.body.classList.remove('sidebar-open'),
      'toggle-theme': () => this.toggleTheme(),
      'toggle-workspace-mode': () => this.toggleWorkspaceMode(),
      'open-settings': () => this.navigate('settings'),
      'open-command': () => this.openCommand(),
      'quick-new': () => this.openQuickNew(),
      'clear-activities': () => { Store.update(s => { s.activities = []; }); this.rerender(); },
      'chat-new': () => { this.createChat(); this.rerender(); },
      'chat-open': () => { Store.state.activeChatId = el.dataset.id; Store.save(); this.rerender(); },
      'chat-clear': () => this.clearChat(),
      'chat-demo-fill': () => {
        if (el.dataset.prompt) {
          const input = document.getElementById('chatInput');
          if (input) {
            input.value = el.dataset.prompt;
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          this.toast('已填入快捷提示词');
          return;
        }
        this.chatFillDemoConversation();
      },
      'chat-copy': () => this.copy(decodeURIComponent(el.dataset.text || '')),
      'chat-attach-file': () => this.openChatFilePicker(),
      'copy-text': () => this.copy(decodeURIComponent(el.dataset.text || '')),
      'copy-result': () => this.copyResult(el.dataset.source),
      'excel-sample': () => this.excelSample(),
      'excel-classify': () => this.excelClassify(),
      'excel-dedupe': () => this.excelDedupe(),
      'excel-stats': () => this.excelStats(),
      'excel-analyze': () => this.excelAnalyze(el),
      'excel-export': () => this.excelExport(),
      'word-new': () => this.wordNew(),
      'word-ai': () => this.wordAI(el.dataset.mode, el),
      'word-export': () => this.wordExport(),
      'word-pdf': () => this.wordPdf(el),
      'pdf-summary': () => this.pdfSummary(el),
      'pdf-sample': () => this.pdfSample(el),
      'pdf-ocr': () => this.pdfToOcr(el),
      'pdf-translate': () => this.pdfTranslate(el),
      'pdf-extract': () => this.pdfExtract(el),
      'pdf-split': () => this.pdfSplit(el),
      'pdf-merge': () => this.pdfMerge(el),
      'pdf-word': () => this.pdfWord(el),
      'pdf-export': () => this.pdfExport(el),
      'pdf-qa': () => this.pdfAsk(el),
      'pdf-table': () => this.pdfTableExtract(el),
      'ocr-sample': () => this.ocrSample(el),
      'ocr-session-select': () => this.ocrSelectDocumentSession(el.dataset.sessionId),
      'ocr-session-new': () => this.ocrNewDocumentSession(),
      'ocr-conflict-keep': () => this.ocrResolveRecognitionConflict('keep_human'),
      'ocr-conflict-adopt': () => this.ocrResolveRecognitionConflict('adopt_new_ocr'),
      'ocr-run': () => this.ocrRun(el),
      'ocr-summary': () => this.ocrSummary(el),
      'ocr-translate': () => this.ocrTranslate(el),
      'ocr-qa': () => this.ocrAsk(el),
      'ocr-ai-fix': () => this.ocrAIFix(el),
      'ocr-ai-table': () => this.ocrAITable(el),
      'ocr-ai-save': () => this.ocrAISave(el),
      'ocr-review-save': () => this.ocrSaveReviewDraft(),
      'ocr-review-approve': () => this.ocrApproveReview(),
      'ocr-review-reject': () => this.ocrRejectReview(),
      'ocr-review-retry': () => this.ocrRun(el, true),
      'ocr-provider-refresh': () => this.ocrRefreshProviders(),
      'ocr-diagnostics-copy': () => this.ocrCopyDiagnostics(),
      'ocr-transfer-quotation': () => this.ocrTransferQuotation(),
      'ocr-transfer-inquiry': () => this.ocrTransferInquiry(),
      'ocr-review-export': () => this.ocrExportReview(el),
      'ocr-zoom': () => this.ocrZoom(Number(el.dataset.delta || 0)),
      'ocr-copy': () => this.ocrCopy(el),
      'ocr-txt': () => this.ocrTxt(el),
      'ocr-ai-txt': () => this.ocrAiTxt(el),
      'ocr-confirmed-txt': () => this.ocrConfirmedTxt(el),
      'ocr-excel': () => this.ocrExcel(el),
      'ocr-ai-excel': () => this.ocrAiExcel(el),
      'ocr-confirmed-excel': () => this.ocrConfirmedExcel(el),
      'ocr-word': () => this.ocrWord(el),
      'ocr-ai-word': () => this.ocrAiWord(el),
      'ocr-confirmed-word': () => this.ocrConfirmedWord(el),
      'ocr-confirm-fields': () => this.ocrConfirmFields(el),
      'ocr-load-demo-fields': () => this.ocrLoadDemoFields(el),
      'ppt-generate': () => this.pptGenerate(el),
      'sql-generate': () => this.sqlGenerate(el),
      'sql-optimize': () => this.sqlOptimize(el),
      'sql-explain': () => this.sqlExplain(el),
      'sql-copy': () => this.copy(this.temp.sql.output),
      'writing-generate': () => this.writingGenerate(el),
      'writing-optimize': () => this.writingOptimize(el),
      'writing-copy': () => this.copy(this.temp.writing.output),
      'writing-export': () => this.writingExport(),
      'image-describe': () => this.imageDescribe(el),
      'image-ocr': () => this.imageOcr(el),
      'image-compress': () => this.imageCompress(el),
      'image-bg': () => this.imageRemoveBg(el),
      'image-download': () => this.imageDownload(),
      'file-favorite': () => this.fileFavorite(el.dataset.id),
      'file-open': () => this.fileOpen(el.dataset.id),
      'file-download': () => this.fileDownload(el.dataset.id),
      'file-delete': () => this.fileDelete(el.dataset.id),
      'file-rename': () => this.fileRename(el.dataset.id),
      'task-open': () => { this.temp.taskSelectedId = el.dataset.id; this.rerender(); },
      'task-open-result': () => { this.temp.taskSelectedId = el.dataset.id; this.navigate(el.dataset.route || 'taskcenter'); },
      'task-refresh': () => this.refreshTaskCenter(),
      'logs-refresh': () => this.refreshBusinessState(),
      'task-cancel': () => this.cancelTaskRecord(el.dataset.id),
      'task-retry': () => this.retryTaskRecord(el.dataset.id),
      'toolcenter-refresh': () => this.refreshAgentRuntime(true),
      'toolcenter-select': () => { this.temp.toolSelectedName = el.dataset.id; this.rerender(); },
      'toolcenter-run': () => this.toolCenterRun(el),
      'approval-refresh': () => this.refreshAgentRuntime(true),
      'approval-select': () => { this.temp.approvalSelectedId = el.dataset.id; this.rerender(); },
      'approval-approve': () => this.runtimeApproval(el.dataset.id, true),
      'approval-reject': () => this.runtimeApproval(el.dataset.id, false),
      'download-open': () => { this.temp.downloadSelectedId = el.dataset.id; this.rerender(); },
      'download-run': () => this.downloadCenterDownload(el.dataset.id),
      'download-refresh': () => this.rerender(),
      'kb-add': () => this.kbAdd(),
      'kb-ask': () => this.kbAsk(el),
      'kb-delete': () => this.kbDelete(el.dataset.id),
      'agent-plan': () => this.agentPlan(),
      'agent-run': () => this.agentRun(el),
      'agent-stop': () => this.agentStop(),
      'workflow-run': () => this.enterpriseWorkflow(el),
      'workspace-run': () => this.workspaceRun(el.dataset.module, el),
      'workspace-save': () => this.workspaceSave(el.dataset.module),
      'workspace-copy': () => this.workspaceCopy(el.dataset.module),
      'workspace-clear': () => this.workspaceClear(el.dataset.module),
      'workspace-export': () => this.workspaceExport(el.dataset.module),
      'reusable-session-select': () => this.selectReusableSession(el.dataset.module, el.dataset.id),
      'reusable-session-new': () => this.newReusableSession(el.dataset.module),
      'reusable-session-copy': () => this.copyReusableSession(el.dataset.module, el.dataset.id),
      'cost-import-rfq': () => this.costImportCurrentRfq(),
      'quotation-sample': () => this.quotationLoadSample(el.dataset.sample || 'complete'),
      'quotation-generate': () => this.quotationGenerateDraft(),
      'quotation-save': () => this.quotationSaveDraft(),
      'quotation-copy': () => this.quotationCopyDraft(),
      'quotation-print': () => this.quotationPrintDraft(),
      'quotation-submit-approval': () => this.quotationStartApproval(),
      'quotation-decision': () => this.quotationDecision(el.dataset.status),
      'quotation-final-send': () => this.quotationFinalSend(),
      'quotation-risk-add': () => this.quotationAddRisk(),
      'quotation-risk-action': () => this.quotationUpdateRisk(el.dataset.status || 'save'),
      'quotation-risk-select': () => this.quotationSelectRisk(el.dataset.id),
      'quotation-risk-history': () => this.quotationOpenRiskHistory(el.dataset.id),
      'quotation-draft-open': () => this.quotationOpenSavedDraft(el.dataset.id),
      'quotation-draft-delete': () => this.quotationDeleteSavedDraft(el.dataset.id),
      'quotation-refresh': () => this.refreshBusinessState(),
      'inquiry-new': () => this.inquiryNew(),
      'inquiry-save': () => this.inquirySave(),
      'inquiry-edit': () => this.inquiryEdit(el.dataset.id),
      'inquiry-delete': () => this.inquiryDelete(el.dataset.id),
      'inquiry-search': () => this.inquirySearch(),
      'inquiry-refresh': () => this.loadManufacturingData(),
      'manufacturing-refresh': () => this.loadManufacturingData(),
      'manufacturing-customer-new': () => this.manufacturingCustomerNew(),
      'manufacturing-customer-select': () => this.manufacturingSelectCustomer(el.dataset.id),
      'manufacturing-customer-save': () => this.manufacturingSaveCustomer(),
      'manufacturing-customer-delete': () => this.manufacturingDeleteCustomer(el.dataset.id),
      'manufacturing-contact-add': () => this.manufacturingAddContact(),
      'manufacturing-contact-select': () => this.manufacturingSelectContact(el.dataset.id),
      'manufacturing-contact-save': () => this.manufacturingAddContact(),
      'manufacturing-project-from-customer': () => this.manufacturingProjectFromCustomer(),
      'manufacturing-project-new': () => this.manufacturingProjectNew(),
      'manufacturing-project-select': () => this.manufacturingSelectProject(el.dataset.id),
      'manufacturing-project-save': () => this.manufacturingSaveProject(),
      'manufacturing-project-delete': () => this.manufacturingDeleteProject(el.dataset.id),
      'manufacturing-rfq-new': () => this.manufacturingRfqNew(),
      'manufacturing-rfq-from-project': () => this.manufacturingRfqFromProject(),
      'manufacturing-rfq-import-ocr': () => this.manufacturingImportApprovedOcr(),
      'manufacturing-rfq-select': () => this.manufacturingSelectRfq(el.dataset.id),
      'manufacturing-rfq-save': () => this.manufacturingSaveRfq(),
      'manufacturing-rfq-delete': () => this.manufacturingDeleteRfq(el.dataset.id),
      'manufacturing-rfq-search': () => this.manufacturingSearchRfqs(),
      'manufacturing-requirement-save': () => this.manufacturingSaveRequirement(el.dataset.id),
      'manufacturing-risk-add': () => this.manufacturingAddRisk(),
      'manufacturing-risk-save': () => this.manufacturingSaveRisk(el.dataset.id),
      'manufacturing-followup-add': () => this.manufacturingAddFollowup(),
      'manufacturing-review-submit': () => this.manufacturingSubmitReview(),
      'manufacturing-transition': () => this.manufacturingTransition(),
      'manufacturing-convert-quotation': () => this.manufacturingConvertQuotation(),
      'manufacturing-import-legacy': () => this.manufacturingImportLegacy(),
      'validate-run': () => this.validateRun(el.dataset.mode, el),
      'quality-check': () => this.qualityCheck(el),
      'quality-fix': () => this.qualityFix(el),
      'quality-export': () => this.qualityExport(el),
      'apqp-open': () => this.apqpOpen(),
      'apqp-back': () => this.apqpBack(),
      'apqp-refresh': () => this.apqpRefresh(),
      'apqp-select': () => this.apqpSelect(el.dataset.id),
      'apqp-create': () => this.apqpCreate(),
      'apqp-update-project': () => this.apqpUpdateProject(),
      'apqp-deliverable-update': () => this.apqpUpdateDeliverable(el.dataset.id),
      'apqp-evidence-add': () => this.apqpAddEvidence(),
      'apqp-evidence-delete': () => this.apqpDeleteEvidence(el.dataset.id),
      'apqp-risk-add': () => this.apqpAddRisk(),
      'apqp-risk-update': () => this.apqpUpdateRisk(el.dataset.id),
      'apqp-task-add': () => this.apqpAddTask(),
      'apqp-task-update': () => this.apqpUpdateTask(el.dataset.id),
      'apqp-stage-submit': () => this.apqpStageAction(el.dataset.stageId, 'submit'),
      'apqp-stage-approve': () => this.apqpStageAction(el.dataset.stageId, 'approve'),
      'apqp-stage-reject': () => this.apqpStageAction(el.dataset.stageId, 'reject'),
      'apqp-close-project': () => this.apqpCloseProject(),
      'skill-enterprise-intro': () => this.skillEnterpriseIntro(),
      'skills-filter': () => this.skillsSetFilter(el.dataset.category),
      'skills-select': () => this.skillsSelect(el.dataset.id),
      'skills-copy': () => this.skillsCopy(el.dataset.id),
      'skills-use': () => this.skillsUse(el.dataset.id),
      'skills-reset': () => this.skillsReset(),
      'bug-confirm': () => this.confirmBugAlert(el.dataset.id),
      'bug-ignore': () => this.ignoreBugAlert(el.dataset.id),
      'bug-restore': () => this.restoreBugAlert(el.dataset.id),
      'bug-detail': () => this.openBugDetail(el.dataset.id),
      'error-center-self-test': () => this.runErrorCenterSelfTest(),
      'mail-generate': () => this.mailGenerate(el),
      'mail-polish': () => this.mailPolish(el),
      'mail-translate': () => this.mailTranslate(el),
      'mail-summary': () => this.mailSummary(el),
      'mail-save-draft': () => this.mailSaveDraft(),
      'mail-copy-content': () => this.mailCopyContent(),
      'mail-send': () => this.mailSend(),
      'mail-precheck': () => this.mailPrecheck(),
      'mail-remove-attachment': () => this.mailRemoveAttachment(el.dataset.id),
      'mail-compress-attachment': () => this.mailCompressAttachment(el.dataset.id),
      'mail-preview-attachment': () => this.mailPreviewAttachment(el.dataset.id),
      'mail-open-record': () => this.mailOpenRecord(el.dataset.id),
      'mail-retry': () => this.mailRetry(el.dataset.id),
      'mail-confirm-send': () => this.mailConfirmSend(),
      'mail-approve': () => this.mailApprove(),
      'bidding-mail': () => this.biddingMail(),
      'cost-calc': () => this.costCalc(el),
      'cost-sample': () => this.costFillSample(),
      'cost-clear': () => this.costClear(),
      'cost-print': () => this.costPrint(),
      'exception-add': () => this.exceptionAdd(),
      'exception-report': () => this.exceptionReport(),
      'inspection-add': () => this.inspectionAdd(),
      'inspection-report': () => this.inspectionReport(),
      'user-add': () => this.userAdd(),
      'role-add': () => this.roleAdd(),
      'version-save': () => this.versionSave(),
      'version-restore': () => this.versionRestore(el.dataset.id),
      'version-compare': () => this.versionCompare(),
      'bidding-analyze': () => this.biddingAnalyze(el),
      'demo-bid': () => this.demoBid(),
      'demo-load': () => this.loadDemoData(),
      'demo-flow': () => this.startDemoFlow(),
      'demo-reset': () => this.resetDemoEnvironment(),
      'ai-retry': () => this.retryLastAiAction(),
      'ai-switch-model': () => this.switchAiModel(),
      'settings-dev-toggle': () => this.settingsDevToggle(),
      'datamask-run': () => this.dataMaskRun(el),
      'datamask-copy': () => this.copy(this.getWorkspace('datamask').result || ''),
      'datamask-export': () => this.dataMaskExport(),
      'datamask-clear': () => this.dataMaskClear(),
      'geo-import-ocr': () => this.geoImportOcr(),
      'geo-generate': () => this.geoGenerate(el),
      'geo-copy': () => this.geoCopy(el),
      'geo-preview': () => this.geoPreview(),
      'geo-export': () => this.geoExportPackage(el),
      'integration-save': () => this.integrationSave(el),
      'integration-delete': () => this.integrationDelete(el.dataset.id),
      'integration-test': () => this.integrationTest(el.dataset.id, el),
      'integration-refresh': () => this.integrationRefresh(),
      'integration-toggle': () => this.integrationToggle(el.dataset.id),
      'integration-log': () => this.integrationShowLog(el.dataset.id),
      'integration-map-add': () => this.integrationMapAdd(el.dataset.id),
      'aihistory-refresh': () => this.rerender(),
      'aihistory-export': () => this.aiHistoryExport(),
      'aihistory-clear': () => this.aiHistoryClear(),
      'refresh-ai-status': () => this.refreshAiStatus(),
      'monitor-refresh': () => this.refreshAgentRuntime(true),
      'systemcheck-run': () => this.runSystemCheck(),
      'settings-tab': () => { this.temp.settingsTab = el.dataset.tab; this.rerender(); },
      'settings-api-toggle': () => {
        Store.state.settings.apiEnabled = !Store.state.settings.apiEnabled;
        if (!Store.state.settings.apiEnabled) Store.state.settings.accessMode = 'local';
        Store.save();
        this.updateApiState();
        this.rerender();
      },
      'settings-save-ai': () => this.settingsSaveAI(),
      'settings-test-ai': () => this.settingsTestAI(el),
      'settings-mail-toggle': () => this.settingsMailToggle(),
      'settings-save-mail': () => this.settingsSaveMail(),
      'settings-test-mail': () => this.settingsTestMail(el),
      'integration-select': () => { this.temp.integrationSelectedId = el.dataset.id; this.rerender(); },
      'auth-login': () => this.authLogin(),
      'auth-register': () => this.authRegister(),
      'auth-logout': () => this.authLogout(),
      'auth-change-password': () => this.authChangePassword(),
      'auth-save-enterprise': () => this.authSaveEnterprise(),
      'orders-refresh': () => this.refreshOrders(true),
      'order-save': () => this.saveOrder(),
      'order-delete': () => this.deleteOrder(el.dataset.id),
      'inventory-refresh': () => this.refreshInventory(true),
      'inventory-save': () => this.saveInventory(),
      'inventory-delete': () => this.deleteInventory(el.dataset.id),
      'plan-sample': () => this.planSample(el),
      'plan-csv-template': () => this.downloadPlanCsvTemplate(el),
      'plan-analyze': () => this.planAnalyze(el),
      'plan-report': () => this.planReport(el),
      'plan-copy': () => this.planCopy(el),
      'plan-export': () => this.planExport(el),
      'plan-generate': () => this.planGenerate(),
      'equipment-save': () => this.equipmentSave(el),
      'equipment-reset': () => this.equipmentReset(el),
      'risk-refresh': () => this.riskRefresh(),
      'assistant-run': () => this.assistantRun(),
      'search-run': () => this.searchRun(),
      'rl-run': () => this.rlRun(el),
      'rl-regenerate': () => this.rlRun(el, true),
      'rl-rate-good': () => this.rlQuickRate('有用'),
      'rl-rate-bad': () => this.rlQuickRate('无用'),
      'rl-save': () => this.rlSave(),
      'rl-refresh': () => this.rlRefresh(),
      'settings-backup': () => this.settingsBackup(),
      'settings-clear': () => this.settingsClear()
      ,
      'self-check': () => this.oneClickSelfCheck()
    };
    try {
      if (handlers[action]) await handlers[action]();
    } catch (error) {
      if (!String(action || '').startsWith('ocr-')) console.error(error);
      if (String(action || '').startsWith('manufacturing-')) {
        this.temp.manufacturing.error = `保存失败，可重试：${Utils.friendlyErrorMessage(error.message || '请求未完成')}`;
        this.toast(this.temp.manufacturing.error, 'error');
        return;
      }
      const message = this.recordAiError(error, action);
      this.toast(message || '操作失败', 'error');
    }
  },

  async skillEnterpriseIntro() {
    const ws = Store.state.workspaces.skillDemo || (Store.state.workspaces.skillDemo = {
      enterpriseName: '',
      products: '',
      equipment: '',
      industry: '',
      strengths: '',
      contact: '',
      result: '',
      updatedAt: Date.now()
    });
    ws.enterpriseName = document.getElementById('skillEnterpriseName')?.value.trim() || ws.enterpriseName || '';
    ws.products = document.getElementById('skillProducts')?.value.trim() || ws.products || '';
    ws.equipment = document.getElementById('skillEquipment')?.value.trim() || ws.equipment || '';
    ws.industry = document.getElementById('skillIndustry')?.value.trim() || ws.industry || '';
    ws.strengths = document.getElementById('skillStrengths')?.value.trim() || ws.strengths || '';
    ws.contact = document.getElementById('skillContact')?.value.trim() || ws.contact || '';
    await this.busy(null, async () => {
      const skillInput = {
        enterpriseName: ws.enterpriseName,
        products: ws.products,
        equipment: ws.equipment,
        industry: ws.industry,
        strengths: ws.strengths,
        contact: ws.contact
      };
      const resultText = this.skillMockOutput('enterprise-intro', skillInput);
      ws.result = resultText;
      ws.updatedAt = Date.now();
      Store.save();
      Store.logAiHistory({
        module: 'skill-enterprise-intro',
        skillId: 'enterprise-intro',
        skillName: '企业介绍生成',
        provider: 'mock',
        model: 'skill-template',
        success: true,
        mock: true,
        duration: 0,
        error: '',
        rawError: '',
        input: JSON.stringify(skillInput),
        output: resultText
      });
      Store.addActivity('Skill：企业介绍生成', 'ai');
      this.rerender();
    });
  },

  getSkillHubState() {
    this.temp.skillHub = this.temp.skillHub || {};
    const defaults = { category: '全部', query: '', selectedId: '', recent: [], copied: [], preview: '' };
    this.temp.skillHub = { ...defaults, ...this.temp.skillHub };
    return this.temp.skillHub;
  },

  getChatDemoMode() {
    return {
      label: '本地演示模式 / Mock AI',
      note: '当前 v1.4 RFQ Demo 使用本地规则 / Mock 回复，用于演示系统工作流；真实模型接入属于后续服务器部署能力。'
    };
  },

  chatSuggestModules(text = '') {
    const content = String(text || '').toLowerCase();
    const cards = [];
    const push = (route, title, description, nextStep) => {
      if (!cards.some(card => card.route === route)) cards.push({ route, title, description, nextStep });
    };
    if (/(识别|发货单|单据|ocr|采购单|标签|图片)/i.test(content)) {
      push('ocr', 'OCR 单据识别', '上传发货单、采购单或图片，自动识别文字并整理字段。', '打开 OCR 页面：#/ocr');
    }
    if (/(报价|成本|利润|单价|算价|核算)/i.test(content)) {
      push('cost', '成本核算助手', '输入材料、加工、人工和利润率，快速生成建议报价。', '打开成本核算助手：#/cost');
    }
    if (/(模板|话术|招聘|日报|维修|质量|返工|客户跟进|回访)/i.test(content)) {
      push('skills', 'Skill 模板', '使用制造业固定模板生成报价、日报、维修、招聘和回访内容。', '打开 Skill 模板：#/skills');
    }
    if (/(错误|报错|监控|bug|异常|健康|日志)/i.test(content)) {
      push('monitoring', 'Error Center', '查看错误聚合、状态、最近修复和健康统计。', '打开错误中心：#/monitoring');
    }
    if (/(生产|日报|计划|排产|工单|设备|维修|工艺|质量)/i.test(content)) {
      push('productionplan', '生产计划助手', '拆解订单、查看设备负载、提醒交期风险。', '打开生产计划助手：#/productionplan');
      push('worklog', '工作日志', '记录今天的生产、质量和问题处理情况。', '打开工作日志：#/worklog');
    }
    if (!cards.length) {
      push('assistant', '企业 AI 助手中心', '输入自然语言，系统会推荐对应模块和下一步操作。', '打开企业 AI 助手中心：#/assistant');
      push('skills', 'Skill 模板', '用固定模板把常见工厂场景先走通。', '打开 Skill 模板：#/skills');
    }
    return cards.slice(0, 4);
  },

  chatBuildDemoReply(text = '', chat = null) {
    const raw = String(text || '').trim();
    const cards = this.chatSuggestModules(raw);
    const first = cards[0] || { title: '企业 AI 助手中心', nextStep: '打开企业 AI 助手中心：#/assistant' };
    const lower = raw.toLowerCase();
    const lines = [];
    if (/(识别|发货单|单据|ocr|采购单|标签|图片)/i.test(lower)) {
      lines.push('我建议你先用【OCR 单据识别】处理图片或单据，再把识别结果转到后续模块。');
      lines.push('如果图片里有发货单、采购单或标签，我会优先帮你识别单号、客户、产品、数量、日期和电话。');
    } else if (/(报价|成本|利润|单价|算价|核算)/i.test(lower)) {
      lines.push('我建议你使用【成本核算助手】。');
      lines.push('你可以输入产品名称、材料单价、加工时间、人工成本、损耗率和目标利润率，系统会自动计算材料成本、加工成本、人工成本、总成本、建议报价和单件报价。');
    } else if (/(模板|话术|招聘|日报|维修|质量|返工|客户跟进|回访)/i.test(lower)) {
      lines.push('我建议你使用【Skill 模板】。');
      lines.push('这里有报价、生产计划、质量异常、设备维修、客户跟进和招聘等固定模板，适合直接复制或快速预览。');
    } else if (/(错误|报错|监控|bug|异常|健康|日志)/i.test(lower)) {
      lines.push('我建议你查看【Error Center / Bug Monitor】。');
      lines.push('你可以看到错误聚合、忽略、确认修复和最近修复记录，方便快速定位问题。');
    } else if (/(生产|日报|计划|排产|工单|设备|维修|工艺|质量)/i.test(lower)) {
      lines.push('我建议你先打开【生产计划助手】或【工作日志】。');
      lines.push('这些模块更适合处理订单拆解、设备负载、交期风险和当日生产问题。');
    } else {
      lines.push('我建议你从【企业 AI 助手中心】或【Skill 模板】开始。');
      lines.push('这样可以先把问题落到具体模块，再一步步完成识别、分析和输出。');
    }
    const fileHint = chat?.files?.length
      ? `当前会话已挂载 ${chat.files.length} 个文件，你也可以继续追问这些文件中的内容。`
      : '如果你有文件，可以先挂载文件再继续问我。';
    const response = [
      `已收到你的问题：${raw || '（空）'}`,
      '',
      ...lines,
      '',
      '推荐模块：',
      ...cards.map(card => `- ${card.title}：${card.nextStep}`),
      '',
      '下一步：',
      first.nextStep,
      '',
      fileHint,
      '',
      '当前为 v1.4 RFQ Demo，本地规则 / Mock AI。'
    ].join('\n');
    return { text: response, cards, summaryLines: lines, mode: 'mock', intent: cards[0]?.title || '通用制造业助手' };
  },

  chatFillDemoConversation() {
    const chat = Store.state.chats.find(c => c.id === Store.state.activeChatId) || this.createChat(false);
    const questions = ['你能做什么', '继续', '帮我生成一份生产日报'];
    const messages = [];
    questions.forEach((question, index) => {
      const demo = this.chatBuildDemoReply(question, chat);
      messages.push({ role: 'user', content: question, time: Date.now() + index * 1200 });
      messages.push({
        id: uid(),
        role: 'assistant',
        content: demo.text,
        time: Date.now() + index * 1200 + 1,
        mode: 'mock',
        recommendations: demo.cards,
        requestId: `demo-chat-${index + 1}`
      });
    });
    chat.title = 'AI Chat 演示对话';
    chat.messages = messages;
    chat.files = chat.files || [];
    chat.updatedAt = Date.now();
    Store.save();
    this.renderNav();
    this.rerender();
    this.toast('已填充 AI Chat 演示对话');
    this.scrollChatToBottom('auto');
  },

  saveSkillHubState() {
    localStorage.setItem('personal-ai-os-skill-hub', JSON.stringify(this.getSkillHubState()));
  },

  skillsSetFilter(category = '全部') {
    const hub = this.getSkillHubState();
    hub.category = category || '全部';
    this.saveSkillHubState();
    this.rerender();
  },

  skillsSelect(id = '') {
    const hub = this.getSkillHubState();
    hub.selectedId = id || hub.selectedId;
    if (id && !hub.recent.includes(id)) hub.recent = [id, ...hub.recent].slice(0, 8);
    this.saveSkillHubState();
    this.rerender();
  },

  async skillsCopy(id = '') {
    const skill = (globalThis.AISkills?.get?.(id) || globalThis.AISkills?.list?.().find(item => item.id === id));
    if (!skill) {
      this.toast('未找到模板', 'error');
      return;
    }
    const text = [
      `模板名称：${skill.name}`,
      `使用场景：${skill.scenario || '待补充'}`,
      `适合岗位：${skill.role || '待补充'}`,
      `输入字段：${(skill.inputFields || []).join('、') || '待补充'}`,
      `输出格式：${(skill.outputFormat || []).join(' + ') || '待补充'}`,
      `示例内容：${skill.example || '待补充'}`,
      `使用建议：${skill.suggestion || '待补充'}`
    ].join('\n');
    await this.copy(text);
    const hub = this.getSkillHubState();
    hub.copied = [id, ...hub.copied.filter(item => item !== id)].slice(0, 8);
    this.saveSkillHubState();
    this.toast('模板内容已复制');
  },

  skillsUse(id = '') {
    const skill = globalThis.AISkills?.get?.(id);
    if (!skill) {
      this.toast('未找到模板', 'error');
      return;
    }
    const hub = this.getSkillHubState();
    hub.selectedId = id;
    const mock = skill.mockOutput ? skill.mockOutput({}) : '待接入 AI 后可自动生成结果';
    hub.preview = `待接入 AI 后可自动生成结果\n\n${mock}`;
    if (!hub.copied.includes(id)) hub.copied = hub.copied.filter(item => item !== id);
    if (!hub.recent.includes(id)) hub.recent = [id, ...hub.recent].slice(0, 8);
    this.saveSkillHubState();
    this.rerender();
    this.toast('已加载模板预览');
  },

  skillsReset() {
    this.temp.skillHub = {
      category: '全部',
      query: '',
      selectedId: '',
      recent: [],
      copied: [],
      preview: ''
    };
    this.saveSkillHubState();
    this.rerender();
    this.toast('已重置模板筛选');
  },

  skillMockOutput(skillId, input = {}) {
    const builtIn = globalThis.AISkills?.mockOutput?.(skillId, input);
    if (builtIn) return builtIn;
    const pick = value => String(value || '').trim() || '待补充';
    const clamp = (text, max = 200) => {
      const value = String(text || '').trim();
      return value ? (value.length > max ? `${value.slice(0, max - 1)}…` : value) : '';
    };
    if (skillId === 'enterprise-intro') {
      return [
        `企业简介：${clamp(`${pick(input.enterpriseName)}，专注${pick(input.products)}，面向${pick(input.industry)}等场景，提供稳定加工与配套支持。`, 70)}`,
        `核心能力：${clamp(`设备能力：${pick(input.equipment)}；优势：${pick(input.strengths)}。`, 70)}`,
        `适合客户：${clamp(`适合需要${pick(input.products)}的采购客户、项目方和长期合作客户。`, 60)}`,
        `联系建议：${clamp(`如需对接，请联系${pick(input.contact)}，先确认图纸、数量和交期。`, 60)}`
      ].join('\n');
    }
    if (skillId === 'product-intro') {
      return [
        `产品简介：${clamp(`${pick(input.productName)}，采用${pick(input.material)}并通过${pick(input.process)}加工，主要用于${pick(input.usage)}。`, 70)}`,
        `加工能力：${clamp(`支持${pick(input.process)}等工艺，可按图纸和样件确认。`, 60)}`,
        `适合客户：${clamp(`适合${pick(input.industry)}相关采购客户及项目配套客户。`, 60)}`,
        `采购建议：${clamp(`如需采购，请先确认规格、数量、交期与包装要求；优势：${pick(input.strengths)}。`, 70)}`
      ].join('\n');
    }
    if (skillId === 'quote-summary') {
      return [
        `报价摘要：${clamp(`${pick(input.productName)} 的报价需要结合材料、工艺和数量确认。`, 70)}`,
        `影响价格因素：${clamp(`材料：${pick(input.material)}；数量：${pick(input.quantity)}；工艺：${pick(input.process)}。`, 80)}`,
        `交期说明：${clamp(`交期为${pick(input.delivery)}，若有加急或特殊要求需提前确认。`, 60)}`,
        `需要补充的信息：${clamp(`${pick(input.requirements)}；如有图纸、样件或包装要求请一并提供。`, 80)}`,
        `下一步建议：${clamp('先确认规格、数量、图纸和交期，再安排正式报价。', 60)}`
      ].join('\n');
    }
    if (skillId === 'inquiry-reply') {
      return [
        `回复内容：您好，关于${pick(input.product)}的需求我们已收到，可按您的数量和交期进一步确认。`,
        `需要确认的问题：${clamp(`请确认${pick(input.material)}、数量${pick(input.quantity)}、交期${pick(input.delivery)}及图纸要求。`, 80)}`,
        `建议发送方式：微信或邮件回复更方便，必要时可附上联系方式 ${pick(input.contact)}。`
      ].join('\n');
    }
    if (skillId === 'ocr-summary') {
      return [
        `内容摘要：${clamp(`文件类型为${pick(input.fileType)}，OCR 结果已整理。`, 60)}`,
        `关键信息：${clamp(`${pick(input.userGoal)}；OCR 原文已接收，关键字段请继续确认。`, 80)}`,
        `可能问题：${clamp('部分字符可能存在疑似识别偏差，建议人工核对。', 60)}`,
        `下一步建议：${clamp('若用于发货、报价或归档，请先核对数量、日期和单号。', 60)}`
      ].join('\n');
    }
    if (skillId === 'error-summary') {
      return [
        `问题摘要：${clamp(`${pick(input.moduleName)} 出现 ${pick(input.count)} 次异常记录。`, 60)}`,
        `可能原因：${clamp('可能与配置、数据输入或前端交互有关。', 60)}`,
        `影响范围：${clamp('仅影响当前模块或相关页面，不代表系统整体故障。', 60)}`,
        `处理建议：${clamp(`请查看 ${pick(input.recentTime)} 附近的日志并逐项核对。`, 60)}`
      ].join('\n');
    }
    return '';
  },

  async handleFileInput(type, files) {
    if (!files.length) return;
    try {
      const empty = files.find(file => file.size === 0);
      if (empty) throw new Error(`文件“${empty.name}”为空，请选择包含内容的文件。`);
      const oversized = files.find(file => file.size > 20 * 1024 * 1024);
      if (oversized) throw new Error(`文件“${oversized.name}”超过 20MB，请压缩或拆分后上传。`);
      if (type === 'excel-file') await this.loadExcel(files[0]);
      if (type === 'plan-csv') await this.loadPlanCsv(files[0]);
      if (type === 'word-file') await this.loadWord(files[0]);
      if (type === 'pdf-files') await this.loadPdfs(files);
      if (type === 'ocr-file' || type === 'ocr-camera') this.loadOcr(files[0]);
      if (type === 'image-file') this.loadImage(files[0]);
      if (type === 'file-center') await this.addFiles(files);
      if (type === 'kb-files') await this.addKnowledgeFiles(files);
      if (type === 'restore-backup') await this.restoreBackup(files[0]);
      if (type === 'chat-files') await this.attachChatFiles(files);
      if (type === 'mail-attachments') await this.mailAddAttachments(files);
      if (type.startsWith('workspace-file:')) await this.addWorkspaceFiles(type.split(':')[1], files);
    } catch (error) {
      this.toast(Utils.friendlyErrorMessage(error.message || '文件读取失败'), 'error');
    }
  },

  getWorkspace(route = this.route) {
    if (!Store.state.workspaces[route]) {
      Store.state.workspaces[route] = {
        title: '',
        prompt: '',
        result: '',
        selected: route === 'templates' ? (typeof TEMPLATE_OPTIONS !== 'undefined' ? TEMPLATE_OPTIONS[0] : '') : '',
        files: [],
        records: [],
        updatedAt: Date.now()
      };
      if (route === 'mail') {
        Object.assign(Store.state.workspaces[route], {
          type: '标书提交邮件',
          recipient: '',
          subject: '',
          body: '',
          attachments: [],
          approvalStatus: '草稿',
          finalVersionChecked: false,
          precheck: []
        });
      }
      Store.save();
    }
    return Store.state.workspaces[route];
  },

  getQuotationWorkspace() {
    const ws = this.getWorkspace('quotation');
    return typeof RFQStore !== 'undefined' && RFQStore && typeof RFQStore.ensureQuotationWorkspace === 'function'
      ? RFQStore.ensureQuotationWorkspace(ws)
      : ws;
  },

  saveQuotationAudit(action, detail = {}) {
    const ws = this.getQuotationWorkspace();
    const entry = {
      id: uid(),
      time: Date.now(),
      action: String(action || '记录'),
      module: 'quotation',
      status: detail.status || ws.rfqApproval?.status || 'draft',
      riskId: detail.riskId || '',
      riskName: detail.riskName || '',
      approvalStatus: detail.approvalStatus || ws.rfqApproval?.status || 'draft',
      count: detail.count ?? (Array.isArray(ws.rfqRisks) ? ws.rfqRisks.length : 0),
      blockers: detail.blockers ?? (Array.isArray(ws.rfqBlockers) ? ws.rfqBlockers.length : 0),
      reason: detail.reason || '',
      suggestion: detail.suggestion || '',
      message: detail.message || '',
      signature: detail.signature || ''
    };
    ws.rfqAuditTrail = Array.isArray(ws.rfqAuditTrail) ? ws.rfqAuditTrail : [];
    ws.rfqAuditTrail.unshift(entry);
    ws.rfqAuditTrail = ws.rfqAuditTrail.slice(0, 50);
    Store.state.operationLogs.unshift({
      id: uid(),
      title: `RFQ ${entry.action}`,
      type: 'quotation',
      time: entry.time
    });
    Store.state.operationLogs = Store.state.operationLogs.slice(0, 200);
    Store.save();
    return entry;
  },

  quotationOrderFields(ws = {}) {
    return {
      customerName: String(ws.customerName || '').trim(),
      productName: String(ws.productName || '').trim(),
      productCode: String(ws.productCode || '').trim(),
      materialName: String(ws.materialName || '').trim(),
      quantity: String(ws.quantity || '').trim(),
      unit: String(ws.unit || '').trim() || '件',
      processType: String(ws.processType || '').trim(),
      deliveryDate: String(ws.deliveryDate || '').trim(),
      contactName: String(ws.contactName || '').trim(),
      phone: String(ws.phone || '').trim(),
      email: String(ws.email || '').trim(),
      quoteDate: String(ws.quoteDate || '').trim(),
      requirements: String(ws.requirements || '').trim()
    };
  },

  quotationNormalizeRisks(risks = []) {
    if (typeof RFQRisk !== 'undefined' && RFQRisk && typeof RFQRisk.normalizeRiskList === 'function') {
      return RFQRisk.normalizeRiskList(risks);
    }
    return Array.isArray(risks) ? risks : [];
  },

  quotationGetBlockers(ws = this.getQuotationWorkspace()) {
    const order = this.quotationOrderFields(ws);
    const risks = this.quotationNormalizeRisks(ws.rfqRisks || []);
    return typeof RFQValidation !== 'undefined' && RFQValidation && typeof RFQValidation.getQuotationBlockers === 'function'
      ? RFQValidation.getQuotationBlockers(order, risks)
      : [];
  },

  quotationHandledRiskNotes(ws = this.getQuotationWorkspace()) {
    const risks = this.quotationNormalizeRisks(ws.rfqRisks || []);
    return typeof RFQValidation !== 'undefined' && RFQValidation && typeof RFQValidation.handledRiskNotes === 'function'
      ? RFQValidation.handledRiskNotes(risks)
      : [];
  },

  quotationSyncDerived(ws = this.getQuotationWorkspace()) {
    const risks = this.quotationNormalizeRisks(ws.rfqRisks || []);
    ws.rfqRisks = risks;
    ws.rfqBlockers = this.quotationGetBlockers(ws);
    ws.rfqSelectedRiskId = ws.rfqSelectedRiskId || risks[0]?.id || '';
    const selected = risks.find(item => item.id === ws.rfqSelectedRiskId) || risks[0] || null;
    if (selected) {
      ws.selectedRiskName = selected.name || '';
      ws.selectedRiskType = selected.type || '';
      ws.selectedRiskSeverity = selected.severity || 'medium';
      ws.selectedRiskStatus = selected.status || 'pending';
      ws.selectedRiskOwner = selected.owner || '';
      ws.selectedRiskMitigation = selected.mitigation || '';
      ws.selectedRiskAcceptReason = selected.acceptReason || '';
      ws.rfqSelectedRiskId = selected.id;
    }
    ws.rfqBlockerSummary = ws.rfqBlockers.length
      ? ws.rfqBlockers.map(item => `${item.title}：${item.reason}；${item.suggestion}`).join('\n')
      : '当前无阻断项，可继续进入报价审批。';
    ws.rfqApproval = ws.rfqApproval && typeof ws.rfqApproval === 'object'
      ? ws.rfqApproval
      : { status: 'draft', reason: '', history: [], updatedAt: Date.now() };
    if (!Array.isArray(ws.rfqApproval.history)) ws.rfqApproval.history = [];
    if (!ws.rfqApproval.status) ws.rfqApproval.status = 'draft';
    return ws;
  },

  quotationFillSelectedRiskFromWorkspace(ws = this.getQuotationWorkspace()) {
    const risks = this.quotationNormalizeRisks(ws.rfqRisks || []);
    const selected = risks.find(item => item.id === ws.rfqSelectedRiskId);
    if (selected) {
      ws.selectedRiskName = selected.name || '';
      ws.selectedRiskType = selected.type || '';
      ws.selectedRiskSeverity = selected.severity || 'medium';
      ws.selectedRiskStatus = selected.status || 'pending';
      ws.selectedRiskOwner = selected.owner || '';
      ws.selectedRiskMitigation = selected.mitigation || '';
      ws.selectedRiskAcceptReason = selected.acceptReason || '';
    }
    return selected || null;
  },

  syncWorkspaceFromDom(route = this.route) {
    const ws = this.getWorkspace(route);
    document.querySelectorAll(`[data-ws-field][data-module="${route}"]`).forEach(field => {
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        ws[field.dataset.wsField] = field.value;
      }
    });
    ws.updatedAt = Date.now();
    return ws;
  },

  reusableSessionSnapshot(module) {
    if (module === 'excel') {
      const x = this.temp.excel;
      return { rows: x.rows || [], sheetName: x.sheetName || '', result: x.result || '', records: x.records || [], summary: x.summary || null, meta: x.meta || {}, schema: x.schema || {}, sourceFile: x.file ? { name: x.file.name, size: x.file.size || 0, type: x.file.type || '' } : null };
    }
    if (module === 'word') return { ...this.getWord(), sourceFile: this.temp.word.sourceFile || null };
    if (module === 'pdf') {
      const p = this.temp.pdf;
      return { result: p.result || '', extracted: p.extracted || '', qaQuestion: p.qaQuestion || '', qaAnswer: p.qaAnswer || '', analysis: p.analysis || '', tableText: p.tableText || '', scanMode: p.scanMode || '', fileInfos: p.fileInfos || [] };
    }
    if (module === 'cost') return structuredClone(this.getWorkspace('cost'));
    throw new Error('不支持的复用会话类型');
  },

  restoreReusableSessions() {
    for (const module of ['excel', 'word', 'pdf', 'cost']) {
      const id = Store.state.activeReusableSessionIds?.[module];
      const session = (Store.state.reusableSessions?.[module] || []).find(item => item.id === id);
      if (!session?.snapshot) continue;
      const snapshot = structuredClone(session.snapshot);
      if (module === 'excel') this.temp.excel = { ...this.temp.excel, ...snapshot, file: snapshot.sourceFile, workbook: null };
      if (module === 'word') this.temp.word = snapshot;
      if (module === 'pdf') this.temp.pdf = { ...this.temp.pdf, ...snapshot, files: [] };
      if (module === 'cost') Store.state.workspaces.cost = snapshot;
    }
  },

  saveReusableSession(module, action = 'saved') {
    const sessions = Store.state.reusableSessions[module] || (Store.state.reusableSessions[module] = []);
    const activeId = Store.state.activeReusableSessionIds[module];
    const snapshot = this.reusableSessionSnapshot(module);
    const now = Date.now();
    let session = sessions.find(item => item.id === activeId);
    if (!session) {
      session = { id: uid(), module, createdAt: now, history: [] };
      sessions.unshift(session);
      Store.state.activeReusableSessionIds[module] = session.id;
    }
    session.title = module === 'word' ? (snapshot.title || '未命名文档')
      : module === 'cost' ? (snapshot.productName || snapshot.productCode || '未命名核算')
        : snapshot.sourceFile?.name || snapshot.fileInfos?.[0]?.name || `${module.toUpperCase()} 会话`;
    session.snapshot = snapshot;
    session.updatedAt = now;
    session.history = [...(session.history || []), { action, at: now }].slice(-50);
    Store.state.reusableSessions[module] = sessions.slice(0, 20);
    Store.save();
    return session;
  },

  selectReusableSession(module, id) {
    const session = (Store.state.reusableSessions[module] || []).find(item => item.id === id);
    if (!session) throw new Error('会话不存在或已被清理');
    const snapshot = structuredClone(session.snapshot || {});
    if (module === 'excel') this.temp.excel = { ...this.temp.excel, ...snapshot, file: snapshot.sourceFile, workbook: null };
    if (module === 'word') {
      this.temp.word = snapshot;
      localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(snapshot));
    }
    if (module === 'pdf') this.temp.pdf = { ...this.temp.pdf, ...snapshot, files: [] };
    if (module === 'cost') Store.state.workspaces.cost = snapshot;
    Store.state.activeReusableSessionIds[module] = id;
    session.history = [...(session.history || []), { action: 'reopened', at: Date.now() }].slice(-50);
    Store.save();
    this.rerender();
  },

  newReusableSession(module) {
    Store.state.activeReusableSessionIds[module] = '';
    if (module === 'excel') this.temp.excel = { file: null, workbook: null, rows: [], sheetName: '', result: '', records: [], summary: null, meta: {}, schema: {}, loadedFromFileId: null };
    if (module === 'word') this.temp.word = { title: '', content: '', sourceFile: null };
    if (module === 'pdf') this.temp.pdf = { files: [], result: '', extracted: '', qaQuestion: '', qaAnswer: '', analysis: '', tableText: '', scanMode: '', fileInfos: [], loadedFromFileId: null };
    if (module === 'cost') Store.state.workspaces.cost = {};
    Store.save();
    this.rerender();
  },

  copyReusableSession(module, id) {
    const source = (Store.state.reusableSessions[module] || []).find(item => item.id === id);
    if (!source) throw new Error('找不到要复制的会话');
    const copy = structuredClone(source);
    copy.id = uid();
    copy.title = `${source.title || module}（副本）`;
    copy.createdAt = copy.updatedAt = Date.now();
    copy.history = [{ action: 'copied', sourceSessionId: id, at: Date.now() }];
    Store.state.reusableSessions[module].unshift(copy);
    Store.state.activeReusableSessionIds[module] = copy.id;
    Store.save();
    this.selectReusableSession(module, copy.id);
  },

  workspaceSave(route = this.route) {
    this.syncWorkspaceFromDom(route);
    if (route === 'cost') this.saveReusableSession('cost', 'manual_saved');
    Store.save();
    Store.addActivity(`保存工作区：${moduleById(route).name}`, 'file');
    this.toast('工作区草稿已保存');
  },

  async workspaceCopy(route = this.route) {
    const ws = this.syncWorkspaceFromDom(route);
    if (!ws.result) throw new Error('暂无可复制结果');
    await this.copy(ws.result);
  },

  workspaceClear(route = this.route) {
    const ws = this.getWorkspace(route);
    ws.title = '';
    ws.prompt = '';
    ws.result = '';
    ws.files = [];
    ws.records = [];
    if (route === 'quotation') {
      ws.customerName = '';
      ws.productName = '';
      ws.productCode = '';
      ws.materialName = '';
      ws.quantity = '';
      ws.unit = '件';
      ws.processType = '';
      ws.deliveryDate = '';
      ws.contactName = '';
      ws.phone = '';
      ws.email = '';
      ws.quoteDate = '';
      ws.requirements = '';
      ws.rfqRisks = [];
      ws.rfqBlockers = [];
      ws.rfqDraft = '';
      ws.rfqAuditTrail = [];
      ws.rfqSavedDrafts = [];
      ws.rfqApproval = { status: 'draft', reason: '', history: [], updatedAt: Date.now() };
      ws.approvalReason = '';
      ws.selectedRiskName = '';
      ws.selectedRiskType = '';
      ws.selectedRiskSeverity = 'medium';
      ws.selectedRiskStatus = 'pending';
      ws.selectedRiskOwner = '';
      ws.selectedRiskMitigation = '';
      ws.selectedRiskAcceptReason = '';
      ws.newRiskName = '';
      ws.newRiskType = '';
      ws.newRiskSeverity = 'medium';
      ws.newRiskOwner = '';
      ws.newRiskMitigation = '';
      ws.rfqSelectedRiskId = '';
      ws.rfqBlockerSummary = '当前无阻断项。';
    }
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  async workspaceExport(route = this.route) {
    const ws = this.syncWorkspaceFromDom(route);
    const title = ws.title || moduleById(route).name;
    const content = ws.result || ws.prompt;
    if (!content) throw new Error('暂无可导出内容');
    if (['templates', 'word', 'writing', 'mail', 'bidding', 'contract'].includes(route)) {
      await Utils.exportDocx(title, content, title);
      return;
    }
    if (['versioning', 'knowledge', 'aisearch', 'datavalidation', 'cost', 'prodexception', 'inspection'].includes(route)) {
      Utils.textDownload(content, `${safeName(title)}.txt`);
      return;
    }
    if (route === 'excel' && this.temp.excel.rows.length) {
      this.excelExport();
      return;
    }
    Utils.textDownload(content, `${safeName(title)}.txt`);
  },

  quotationLoadSample(sampleKey = 'complete') {
    const ws = this.getQuotationWorkspace();
    const sample = typeof RFQStore !== 'undefined' && RFQStore && typeof RFQStore.cloneSample === 'function'
      ? RFQStore.cloneSample(sampleKey)
      : null;
    if (!sample) throw new Error('未找到 RFQ 示例数据');
    Object.assign(ws, sample.order || {});
    ws.rfqSampleKey = sample.key || sampleKey;
    ws.rfqRisks = this.quotationNormalizeRisks(sample.risks || []);
    ws.rfqApproval = {
      status: 'draft',
      reason: '',
      history: [],
      updatedAt: Date.now()
    };
    ws.rfqApprovalReason = '';
    ws.rfqDraft = '';
    ws.result = '';
    ws.rfqBlockers = [];
    ws.rfqAuditTrail = Array.isArray(ws.rfqAuditTrail) ? ws.rfqAuditTrail : [];
    ws.rfqSavedDrafts = Array.isArray(ws.rfqSavedDrafts) ? ws.rfqSavedDrafts : [];
    ws.rfqSelectedRiskId = ws.rfqRisks[0]?.id || '';
    this.quotationFillSelectedRiskFromWorkspace(ws);
    ws.rfqLastComputedAt = Date.now();
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('加载示例数据', {
      message: sample.label,
      signature: `RFQ_SAMPLE_${String(ws.rfqSampleKey || sampleKey).toUpperCase()}`
    });
    Store.save();
    this.rerender();
    this.toast(`已加载示例：${sample.label}`);
  },

  async persistBusinessState(successMessage = '数据已保存') {
    Store.save();
    const result = await Store.flushSync();
    if (result.ok && result.mode === 'server') {
      this.toast(`${successMessage}，已同步到后端 SQLite。`);
    } else if (result.ok) {
      this.toast(`${successMessage}，当前为 localStorage 演示降级。`, 'warning');
    } else {
      this.toast(result.message || '已保存到本地，后端同步失败。', 'warning');
    }
    return result;
  },

  async refreshBusinessState() {
    this.temp.inquiryLoading = true;
    this.rerender();
    await Store.hydrateFromServer();
    this.temp.inquiryLoading = false;
    this.rerender();
    this.toast(Store.syncStatus.message, Store.syncStatus.mode === 'server' ? 'success' : 'warning');
  },

  async quotationSaveDraft() {
    const ws = this.syncWorkspaceFromDom('quotation');
    ws.rfqDraft = ws.rfqDraft || ws.result || '';
    ws.result = ws.rfqDraft || ws.result || '';
    ws.rfqSavedDrafts = Array.isArray(ws.rfqSavedDrafts) ? ws.rfqSavedDrafts : [];
    ws.rfqSavedDrafts.unshift({
      id: uid(),
      time: Date.now(),
      status: ws.rfqApproval?.status || 'draft',
      draft: ws.rfqDraft,
      blockers: structuredClone(ws.rfqBlockers || [])
    });
    ws.rfqSavedDrafts = ws.rfqSavedDrafts.slice(0, 10);
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('保存报价草稿', {
      status: ws.rfqApproval?.status || 'draft',
      message: '报价草稿已保存，登录后同步到企业 SQLite',
      count: ws.rfqSavedDrafts.length
    });
    await this.persistBusinessState('报价草稿已保存');
    this.rerender();
  },

  quotationOpenSavedDraft(id) {
    const ws = this.getQuotationWorkspace();
    const saved = (ws.rfqSavedDrafts || []).find(item => item.id === id);
    if (!saved) throw new Error('报价草稿不存在或已删除');
    ws.rfqDraft = saved.draft || '';
    ws.result = saved.draft || '';
    ws.rfqBlockers = structuredClone(saved.blockers || []);
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('打开历史报价草稿', { status: saved.status || 'draft', message: `draftId: ${id}` });
    Store.save();
    this.rerender();
  },

  async quotationDeleteSavedDraft(id) {
    const ws = this.getQuotationWorkspace();
    const saved = (ws.rfqSavedDrafts || []).find(item => item.id === id);
    if (!saved) throw new Error('报价草稿不存在或已删除');
    if (!confirm('确认删除该报价草稿？删除后将同步到企业数据库。')) return;
    ws.rfqSavedDrafts = ws.rfqSavedDrafts.filter(item => item.id !== id);
    this.saveQuotationAudit('删除报价草稿', { status: saved.status || 'draft', message: `draftId: ${id}` });
    await this.persistBusinessState('报价草稿已删除');
    this.rerender();
  },

  async loadManufacturingData(options = {}) {
    const state = this.temp.manufacturing;
    const silent = Boolean(options.silent);
    state.loading = true;
    state.error = '';
    if (!silent && ['home', 'crm', 'project', 'inquiries'].includes(this.route)) this.rerender();
    try {
      const query = encodeURIComponent(state.query || '');
      const [customerResponse, projectResponse, rfqResponse] = await Promise.all([
        APIClient.request(`${ManufacturingWorkspace.API_ROOT}/customers?pageSize=100&q=${query}`),
        APIClient.request(`${ManufacturingWorkspace.API_ROOT}/projects?pageSize=100&q=${query}`),
        APIClient.request(`${ManufacturingWorkspace.API_ROOT}/rfqs?pageSize=100&q=${query}`)
      ]);
      state.customers = ManufacturingWorkspace.normalizeCollection(customerResponse).items;
      state.projects = ManufacturingWorkspace.normalizeCollection(projectResponse).items;
      state.rfqs = ManufacturingWorkspace.normalizeCollection(rfqResponse).items;
      state.mode = 'server';
      const details = [];
      if (state.selectedCustomerId && state.customers.some(item => item.id === state.selectedCustomerId)) {
        details.push(APIClient.request(`${ManufacturingWorkspace.API_ROOT}/customers/${state.selectedCustomerId}`)
          .then(response => { state.customer = response.data?.customer || null; }));
      } else {
        state.selectedCustomerId = '';
        state.customer = null;
      }
      if (state.selectedProjectId && state.projects.some(item => item.id === state.selectedProjectId)) {
        details.push(APIClient.request(`${ManufacturingWorkspace.API_ROOT}/projects/${state.selectedProjectId}`)
          .then(response => { state.project = response.data?.project || null; }));
      } else {
        state.selectedProjectId = '';
        state.project = null;
      }
      if (state.selectedRfqId && state.rfqs.some(item => item.id === state.selectedRfqId)) {
        details.push(APIClient.request(`${ManufacturingWorkspace.API_ROOT}/rfqs/${state.selectedRfqId}`)
          .then(response => { state.rfq = response.data?.rfq || null; }));
      } else {
        state.selectedRfqId = '';
        state.rfq = null;
      }
      await Promise.all(details);
      Store.syncStatus = { mode: 'server', state: 'synced', message: '客户与 RFQ 已从 SQLite 读取', updatedAt: Date.now() };
      if (!silent) this.toast('客户、项目与 RFQ 已刷新');
    } catch (error) {
      state.mode = 'fallback';
      state.error = Utils.friendlyErrorMessage(error.message || '后端不可用');
      state.customers = [];
      state.projects = [];
      state.rfqs = [];
      state.customer = null;
      state.project = null;
      state.rfq = null;
      Store.syncStatus = { mode: 'local', state: 'offline', message: `后端不可用：${state.error}`, updatedAt: Date.now() };
      if (!silent) this.toast(ManufacturingWorkspace.OFFLINE_NOTICE, 'warning');
    } finally {
      state.loaded = true;
      state.loading = false;
      if (['home', 'crm', 'project', 'inquiries'].includes(this.route)) this.rerender();
    }
  },

  async manufacturingRequest(path, options = {}) {
    const state = this.temp.manufacturing;
    ManufacturingWorkspace.assertServerWritable(state.mode);
    state.error = '';
    try {
      return await APIClient.request(`${ManufacturingWorkspace.API_ROOT}${path}`, options);
    } catch (error) {
      state.error = Utils.friendlyErrorMessage(error.message || '业务操作失败');
      throw error;
    }
  },

  manufacturingCustomerNew() {
    const state = this.temp.manufacturing;
    state.selectedCustomerId = '';
    state.customer = null;
    state.error = '';
    state.workflow = null;
    state.createKeys = { ...(state.createKeys || {}), customer: '' };
    this.rerender();
  },

  async manufacturingSelectCustomer(id) {
    const state = this.temp.manufacturing;
    state.selectedCustomerId = id;
    const response = await this.manufacturingRequest(`/customers/${id}`);
    state.customer = response.data?.customer || null;
    this.rerender();
  },

  async manufacturingSaveCustomer() {
    const state = this.temp.manufacturing;
    ManufacturingWorkspace.assertServerWritable(state.mode);
    const input = {
      name: document.getElementById('manufacturingCustomerName')?.value.trim() || '',
      source: document.getElementById('manufacturingCustomerSource')?.value.trim() || '',
      level: document.getElementById('manufacturingCustomerLevel')?.value || 'normal',
      owner: document.getElementById('manufacturingCustomerOwner')?.value.trim() || '',
      status: document.getElementById('manufacturingCustomerStatus')?.value || 'active',
      notes: document.getElementById('manufacturingCustomerNotes')?.value.trim() || ''
    };
    const errors = ManufacturingWorkspace.validateCustomer(input);
    if (errors.length) throw new Error(errors.join('；'));
    const selected = state.customer?.id ? state.customer : null;
    if (!selected) input.idempotency_key = this.manufacturingCreateKey('customer');
    const response = await this.manufacturingRequest(selected ? `/customers/${selected.id}` : '/customers', {
      method: selected ? 'PATCH' : 'POST',
      body: JSON.stringify(selected ? { ...input, version: selected.version } : input)
    });
    state.selectedCustomerId = response.data?.customer?.id || state.selectedCustomerId;
    await this.loadManufacturingData({ silent: true });
    if (!selected) state.workflow = { done: '客户已创建', next: '为该客户创建项目', action: 'manufacturing-project-from-customer' };
    this.toast(selected ? '客户档案已更新' : '客户已创建');
  },

  async manufacturingDeleteCustomer(id) {
    ManufacturingWorkspace.assertServerWritable(this.temp.manufacturing.mode);
    const reason = prompt('请填写删除客户的原因（必填）：', '');
    if (reason === null) return;
    if (!reason.trim()) throw new Error('删除客户必须填写原因');
    if (!confirm('确认删除该客户档案？存在关联项目或 RFQ 时后端会阻止。')) return;
    await this.manufacturingRequest(`/customers/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    this.temp.manufacturing.selectedCustomerId = '';
    this.temp.manufacturing.customer = null;
    await this.loadManufacturingData({ silent: true });
    this.toast('客户档案已删除');
  },

  async manufacturingAddContact() {
    const state = this.temp.manufacturing;
    if (!state.customer?.id) throw new Error('请先保存并选择客户');
    const input = {
      name: document.getElementById('manufacturingContactName')?.value.trim() || '',
      title: document.getElementById('manufacturingContactTitle')?.value.trim() || '',
      phone: document.getElementById('manufacturingContactPhone')?.value.trim() || '',
      email: document.getElementById('manufacturingContactEmail')?.value.trim() || '',
      notes: document.getElementById('manufacturingContactNotes')?.value.trim() || '',
      isPrimary: Boolean(document.getElementById('manufacturingContactPrimary')?.checked)
    };
    const errors = ManufacturingWorkspace.validateContact(input);
    if (errors.length) throw new Error(errors.join('；'));
    const selected = state.contactDraft;
    await this.manufacturingRequest(selected ? `/customers/${state.customer.id}/contacts/${selected.id}` : `/customers/${state.customer.id}/contacts`, { method: selected ? 'PATCH' : 'POST', body: JSON.stringify(input) });
    state.contactDraft = null;
    await this.manufacturingSelectCustomer(state.customer.id);
    this.toast(selected ? '客户联系人已更新' : '客户联系人已新增');
  },

  manufacturingSelectContact(id) {
    const contact = this.temp.manufacturing.customer?.contacts?.find(item => item.id === id);
    if (!contact) throw new Error('联系人不存在或已删除');
    this.temp.manufacturing.contactDraft = { ...contact };
    this.rerender();
  },

  manufacturingProjectFromCustomer() {
    const state = this.temp.manufacturing;
    if (!state.customer?.id) throw new Error('请先选择客户');
    state.project = { customer_id: state.customer.id, customer_name: state.customer.name, owner: state.customer.owner || '', status: 'draft' };
    state.selectedProjectId = '';
    state.createKeys = { ...(state.createKeys || {}), project: '' };
    state.workflow = null;
    this.navigate('project');
  },

  manufacturingProjectNew() {
    const state = this.temp.manufacturing;
    state.selectedProjectId = '';
    state.project = state.customer?.id ? { customer_id: state.customer.id, customer_name: state.customer.name, owner: state.customer.owner || '', status: 'draft' } : null;
    state.error = '';
    state.createKeys = { ...(state.createKeys || {}), project: '' };
    this.rerender();
  },

  async manufacturingSelectProject(id) {
    const state = this.temp.manufacturing;
    state.selectedProjectId = id;
    const response = await this.manufacturingRequest(`/projects/${id}`);
    state.project = response.data?.project || null;
    this.rerender();
  },

  async manufacturingSaveProject() {
    const state = this.temp.manufacturing;
    ManufacturingWorkspace.assertServerWritable(state.mode);
    const input = {
      customer_id: document.getElementById('manufacturingProjectCustomer')?.value || '',
      name: document.getElementById('manufacturingProjectName')?.value.trim() || '',
      description: document.getElementById('manufacturingProjectDescription')?.value.trim() || '',
      owner: document.getElementById('manufacturingProjectOwner')?.value.trim() || '',
      planned_start_date: document.getElementById('manufacturingProjectStart')?.value || '',
      planned_end_date: document.getElementById('manufacturingProjectEnd')?.value || '',
      status: document.getElementById('manufacturingProjectStatus')?.value || 'draft'
    };
    const errors = ManufacturingWorkspace.validateProject(input);
    if (errors.length) throw new Error(errors.join('；'));
    const selected = state.project?.id ? state.project : null;
    if (!selected) input.idempotency_key = this.manufacturingCreateKey('project');
    const response = await this.manufacturingRequest(selected ? `/projects/${selected.id}` : '/projects', {
      method: selected ? 'PATCH' : 'POST',
      body: JSON.stringify(selected ? { ...input, version: selected.version } : input)
    });
    state.selectedProjectId = response.data?.project?.id || state.selectedProjectId;
    await this.loadManufacturingData({ silent: true });
    if (!selected) state.workflow = { done: '项目已创建', next: '创建第一个 RFQ', action: 'manufacturing-rfq-from-project' };
    this.toast(selected ? '项目档案已更新' : '项目已创建');
  },

  async manufacturingDeleteProject(id) {
    const reason = prompt('请填写删除项目的原因（必填）：', '');
    if (reason === null) return;
    if (!reason.trim()) throw new Error('删除项目必须填写原因');
    if (!confirm('确认删除该项目档案？关联 RFQ 存在时后端会阻止。')) return;
    await this.manufacturingRequest(`/projects/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    this.temp.manufacturing.selectedProjectId = '';
    this.temp.manufacturing.project = null;
    await this.loadManufacturingData({ silent: true });
    this.toast('项目档案已删除');
  },

  manufacturingRfqNew() {
    const state = this.temp.manufacturing;
    state.selectedRfqId = '';
    state.rfq = state.project?.id ? { customer_id: state.project.customer_id, project_id: state.project.id, owner: state.project.owner || '' } : null;
    state.error = '';
    state.createKeys = { ...(state.createKeys || {}), rfq: '' };
    this.temp.inquirySelectedId = '';
    this.rerender();
  },

  async manufacturingSelectRfq(id) {
    const state = this.temp.manufacturing;
    state.selectedRfqId = id;
    const response = await this.manufacturingRequest(`/rfqs/${id}`);
    state.rfq = response.data?.rfq || null;
    this.rerender();
  },

  manufacturingSearchRfqs() {
    this.temp.manufacturing.query = document.getElementById('manufacturingSearch')?.value.trim() || '';
    this.loadManufacturingData();
  },

  manufacturingRfqInput() {
    return {
      customer_id: document.getElementById('manufacturingRfqCustomer')?.value || '',
      project_id: document.getElementById('manufacturingRfqProject')?.value || '',
      product_name: document.getElementById('manufacturingRfqProduct')?.value.trim() || '',
      product_code: document.getElementById('manufacturingRfqProductCode')?.value.trim() || '',
      material: document.getElementById('manufacturingRfqMaterial')?.value.trim() || '',
      quantity: document.getElementById('manufacturingRfqQuantity')?.value || '',
      unit: document.getElementById('manufacturingRfqUnit')?.value.trim() || '件',
      process_requirements: document.getElementById('manufacturingRfqProcess')?.value.trim() || '',
      tolerance_requirements: document.getElementById('manufacturingRfqTolerance')?.value.trim() || '',
      surface_treatment: document.getElementById('manufacturingRfqSurface')?.value.trim() || '',
      packaging_requirements: document.getElementById('manufacturingRfqPackaging')?.value.trim() || '',
      quality_requirements: document.getElementById('manufacturingRfqQuality')?.value.trim() || '',
      customer_special_requirements: document.getElementById('manufacturingRfqSpecial')?.value.trim() || '',
      requested_delivery_date: document.getElementById('manufacturingRfqDelivery')?.value || '',
      owner: document.getElementById('manufacturingRfqOwner')?.value.trim() || '',
      contact_name: document.getElementById('manufacturingRfqContact')?.value.trim() || '',
      contact_details: document.getElementById('manufacturingRfqContactDetails')?.value.trim() || '',
      notes: document.getElementById('manufacturingRfqNotes')?.value.trim() || ''
    };
  },

  async manufacturingSaveRfq() {
    const state = this.temp.manufacturing;
    ManufacturingWorkspace.assertServerWritable(state.mode);
    const input = this.manufacturingRfqInput();
    const errors = ManufacturingWorkspace.validateRfq(input);
    if (errors.length) throw new Error(errors.join('；'));
    const selected = state.rfq?.id ? state.rfq : null;
    if (!selected) input.idempotency_key = this.manufacturingCreateKey('rfq');
    if (!selected && state.rfq?.ocrImport) Object.assign(input, state.rfq.ocrImport);
    const response = await this.manufacturingRequest(selected ? `/rfqs/${selected.id}` : '/rfqs', {
      method: selected ? 'PATCH' : 'POST',
      body: JSON.stringify(selected ? { ...input, version: selected.version } : input)
    });
    state.selectedRfqId = response.data?.rfq?.id || state.selectedRfqId;
    await this.loadManufacturingData({ silent: true });
    if (!selected) state.workflow = { done: 'RFQ 已创建', next: '查看缺失项与风险', action: 'manufacturing-rfq-select', id: state.selectedRfqId };
    this.toast(selected ? 'RFQ 已更新' : 'RFQ 已创建');
  },

  manufacturingRfqFromProject() {
    const project = this.temp.manufacturing.project;
    if (!project?.id) throw new Error('请先选择项目');
    this.temp.manufacturing.rfq = { customer_id: project.customer_id, project_id: project.id, owner: project.owner || '' };
    this.temp.manufacturing.selectedRfqId = '';
    this.temp.manufacturing.createKeys = { ...(this.temp.manufacturing.createKeys || {}), rfq: '' };
    this.temp.manufacturing.workflow = null;
    this.navigate('inquiries');
  },

  manufacturingCreateKey(type) {
    const state = this.temp.manufacturing;
    state.createKeys = state.createKeys || {};
    if (!state.createKeys[type]) state.createKeys[type] = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return state.createKeys[type];
  },

  manufacturingImportApprovedOcr() {
    const payload = OCRArchitecture.confirmedPayload(this.temp.ocr?.review, this.temp.ocr?.providerResult);
    if (payload.reviewStatus !== 'approved') throw new Error('OCR 结果尚未人工批准，不能正式导入 RFQ');
    const state = this.temp.manufacturing;
    const current = state.rfq || {};
    const fields = payload.fields || {};
    const mapping = { product_name: 'product_name', material: 'material', quantity: 'quantity', delivery_date: 'requested_delivery_date', specification: 'process_requirements', notes: 'notes' };
    const next = { ...current };
    for (const [ocrKey, target] of Object.entries(mapping)) {
      const incoming = String(fields[ocrKey] || '').trim();
      const existing = String(current[target] || '').trim();
      if (!incoming) continue;
      if (existing && existing !== incoming && !confirm(`OCR 导入字段冲突：${target}\n当前值：${existing}\nOCR 值：${incoming}\n\n确定采用 OCR 值？取消则保留当前值。`)) continue;
      next[target] = incoming;
    }
    next.ocrImport = { source: 'ocr', source_reference: payload.requestId, ocr_source: payload };
    state.rfq = next;
    state.selectedRfqId = '';
    state.createKeys = { ...(state.createKeys || {}), rfq: `ocr-${payload.requestId}` };
    this.toast('已导入人工批准且有值的 OCR 字段；冲突字段均已等待你的明确选择。');
    this.rerender();
  },

  async manufacturingDeleteRfq(id) {
    const reason = prompt('请填写删除 RFQ 的原因（必填）：', '');
    if (reason === null) return;
    if (!reason.trim()) throw new Error('删除 RFQ 必须填写原因');
    if (!confirm('确认删除该 RFQ？已进入报价或成交状态时后端会阻止。')) return;
    await this.manufacturingRequest(`/rfqs/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    this.temp.manufacturing.selectedRfqId = '';
    this.temp.manufacturing.rfq = null;
    await this.loadManufacturingData({ silent: true });
    this.toast('RFQ 已删除');
  },

  async manufacturingSaveRequirement(id) {
    const rfq = this.temp.manufacturing.rfq;
    if (!rfq?.id) throw new Error('请先选择 RFQ');
    const value = document.getElementById(`manufacturingRequirement-${id}`)?.value.trim() || '';
    const confirmed = Boolean(document.getElementById(`manufacturingRequirementConfirmed-${id}`)?.checked);
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/requirements/${id}`, {
      method: 'PATCH', body: JSON.stringify({ value, confirmed })
    });
    this.temp.manufacturing.rfq = response.data?.rfq || rfq;
    await this.loadManufacturingData({ silent: true });
    this.toast('RFQ 需求项已更新');
  },

  async manufacturingAddRisk() {
    const rfq = this.temp.manufacturing.rfq;
    if (!rfq?.id) throw new Error('请先选择 RFQ');
    const input = {
      title: document.getElementById('manufacturingRiskTitle')?.value.trim() || '',
      category: document.getElementById('manufacturingRiskCategory')?.value || 'delivery',
      severity: document.getElementById('manufacturingRiskSeverity')?.value || 'medium',
      probability: document.getElementById('manufacturingRiskProbability')?.value || 1,
      impact: document.getElementById('manufacturingRiskImpact')?.value || 1,
      owner: document.getElementById('manufacturingRiskOwner')?.value.trim() || '',
      mitigation: document.getElementById('manufacturingRiskMitigation')?.value.trim() || ''
    };
    if (!input.title) throw new Error('风险标题不能为空');
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/risks`, { method: 'POST', body: JSON.stringify(input) });
    this.temp.manufacturing.rfq = response.data?.rfq || rfq;
    await this.loadManufacturingData({ silent: true });
    this.toast('RFQ 风险已新增');
  },

  async manufacturingSaveRisk(id) {
    const rfq = this.temp.manufacturing.rfq;
    const risk = rfq?.risks?.find(item => item.id === id);
    if (!risk) throw new Error('风险不存在或已删除');
    const status = document.getElementById(`manufacturingRiskStatus-${id}`)?.value || risk.status;
    let acceptanceReason = risk.acceptance_reason || '';
    let closureEvidence = risk.closure_evidence || '';
    if (status === 'accepted') {
      if (!confirm('接受风险是高风险操作，确认继续？')) return;
      acceptanceReason = prompt('请填写风险接受理由：', acceptanceReason) || '';
    }
    if (status === 'closed') {
      if (!confirm('关闭风险需要人工确认，确认继续？')) return;
      closureEvidence = prompt('请填写关闭说明或证据引用：', closureEvidence) || '';
    }
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/risks/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status, acceptance_reason: acceptanceReason, closure_evidence: closureEvidence, version: risk.version })
    });
    this.temp.manufacturing.rfq = response.data?.rfq || rfq;
    await this.loadManufacturingData({ silent: true });
    this.toast('RFQ 风险已更新');
  },

  async manufacturingAddFollowup() {
    const rfq = this.temp.manufacturing.rfq;
    if (!rfq?.id) throw new Error('请先选择 RFQ');
    const input = {
      method: document.getElementById('manufacturingFollowupMethod')?.value || 'note',
      content: document.getElementById('manufacturingFollowupContent')?.value.trim() || '',
      next_followup_at: document.getElementById('manufacturingFollowupNext')?.value || '',
      owner: document.getElementById('manufacturingFollowupOwner')?.value.trim() || ''
    };
    if (!input.content) throw new Error('跟进内容不能为空');
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/followups`, { method: 'POST', body: JSON.stringify(input) });
    this.temp.manufacturing.rfq = response.data?.rfq || rfq;
    this.rerender();
    this.toast('RFQ 跟进记录已保存');
  },

  async manufacturingSubmitReview() {
    const rfq = this.temp.manufacturing.rfq;
    if (!rfq?.id) throw new Error('请先选择 RFQ');
    if (!confirm('确认提交 RFQ 评审？缺失项会被后端确定性阻断。')) return;
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/submit-review`, { method: 'POST', body: JSON.stringify({}) });
    this.temp.manufacturing.rfq = response.data?.rfq || rfq;
    await this.loadManufacturingData({ silent: true });
    this.toast(this.temp.manufacturing.rfq?.status === 'information_required' ? '缺失项已标记，请补充资料' : 'RFQ 已提交人工评审', this.temp.manufacturing.rfq?.status === 'information_required' ? 'warning' : 'success');
  },

  async manufacturingTransition() {
    const rfq = this.temp.manufacturing.rfq;
    if (!rfq?.id) throw new Error('请先选择 RFQ');
    const target = document.getElementById('manufacturingTransitionTarget')?.value || '';
    if (!target) throw new Error('请选择目标状态');
    if (!confirm(`确认将 RFQ 流转到“${ManufacturingWorkspace.RFQ_STATUS_LABELS[target] || target}”？`)) return;
    const reason = prompt('请填写流转说明（补充资料、成交、失效时必填）：', '') ?? '';
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/transition`, {
      method: 'POST', body: JSON.stringify({ target_status: target, reason })
    });
    this.temp.manufacturing.rfq = response.data?.rfq || rfq;
    await this.loadManufacturingData({ silent: true });
    this.toast(`RFQ 已进入${ManufacturingWorkspace.RFQ_STATUS_LABELS[target] || target}`);
  },

  async manufacturingConvertQuotation() {
    const state = this.temp.manufacturing;
    const rfq = state.rfq;
    if (!rfq?.id) throw new Error('请先选择 RFQ');
    if (!confirm('确认将已评审的 RFQ 转入现有报价模块？')) return;
    const response = await this.manufacturingRequest(`/rfqs/${rfq.id}/convert-to-quotation`, { method: 'POST', body: JSON.stringify({}) });
    const draft = response.data?.quotationDraft || {};
    const ws = this.getQuotationWorkspace();
    for (const [key, value] of Object.entries(draft)) if (value !== '' && value != null) ws[key] = value;
    ws.rfqSource = { rfqId: draft.sourceRfqId, rfqNo: draft.sourceRfqNo, approvedByHuman: true };
    ws.updatedAt = Date.now();
    Store.save();
    state.rfq = response.data?.rfq || rfq;
    this.toast('RFQ 已转入现有报价模块');
    this.navigate('quotation');
  },

  async manufacturingImportLegacy() {
    if (!confirm('将旧询盘显式导入为新 RFQ 草稿？原数据不会被删除，也不会自动批准。')) return;
    const response = await this.manufacturingRequest('/rfqs/import-legacy', { method: 'POST', body: JSON.stringify({}) });
    await this.loadManufacturingData({ silent: true });
    this.toast(`旧询盘导入完成：新增 ${response.data?.imported || 0}，跳过 ${response.data?.skipped || 0}`);
  },

  inquiryNew() {
    this.temp.inquirySelectedId = '';
    this.rerender();
  },

  inquiryEdit(id) {
    const record = (Store.state.ocrInquiries || []).find(item => item.id === id);
    if (!record) throw new Error('询盘记录不存在或已删除');
    this.temp.inquirySelectedId = id;
    this.rerender();
  },

  inquirySearch() {
    this.temp.inquirySearch = document.getElementById('inquirySearch')?.value.trim() || '';
    this.rerender();
  },

  async inquirySave() {
    const selected = (Store.state.ocrInquiries || []).find(item => item.id === this.temp.inquirySelectedId);
    const customerName = document.getElementById('inquiryCustomer')?.value.trim() || '';
    const productName = document.getElementById('inquiryProduct')?.value.trim() || '';
    const quantity = document.getElementById('inquiryQuantity')?.value.trim() || '';
    const specification = document.getElementById('inquirySpecification')?.value.trim() || '';
    const contact = document.getElementById('inquiryContact')?.value.trim() || '';
    const notes = document.getElementById('inquiryNotes')?.value.trim() || '';
    const status = document.getElementById('inquiryStatus')?.value || 'draft';
    if (!customerName) throw new Error('请填写客户或来源');
    if (!productName) throw new Error('请填写产品名称');
    const now = Date.now();
    const record = {
      ...(selected || {}),
      id: selected?.id || uid(),
      customerName,
      productName,
      quantity,
      specification,
      contact,
      notes,
      status,
      source: selected?.source || 'manual',
      createdAt: selected?.createdAt || now,
      updatedAt: now
    };
    Store.state.ocrInquiries = Array.isArray(Store.state.ocrInquiries) ? Store.state.ocrInquiries : [];
    Store.state.ocrInquiries = [record, ...Store.state.ocrInquiries.filter(item => item.id !== record.id)].slice(0, 200);
    Store.state.operationLogs.unshift({ id: uid(), title: selected ? '编辑询盘草稿' : '新建询盘草稿', type: 'inquiry', time: now, recordId: record.id });
    this.temp.inquirySelectedId = record.id;
    await this.persistBusinessState(selected ? '询盘草稿已更新' : '询盘草稿已新建');
    this.rerender();
  },

  async inquiryDelete(id) {
    const record = (Store.state.ocrInquiries || []).find(item => item.id === id);
    if (!record) throw new Error('询盘记录不存在或已删除');
    if (!confirm(`确认删除询盘草稿“${record.customerName || record.fields?.customer_name || '未命名'}”？`)) return;
    Store.state.ocrInquiries = Store.state.ocrInquiries.filter(item => item.id !== id);
    Store.state.operationLogs.unshift({ id: uid(), title: '删除询盘草稿', type: 'inquiry', time: Date.now(), recordId: id });
    if (this.temp.inquirySelectedId === id) this.temp.inquirySelectedId = '';
    await this.persistBusinessState('询盘草稿已删除');
    this.rerender();
  },

  async quotationCopyDraft() {
    const ws = this.syncWorkspaceFromDom('quotation');
    const draft = ws.rfqDraft || ws.result || '';
    if (!draft) throw new Error('暂无可复制的报价草稿');
    await this.copy(draft);
    this.saveQuotationAudit('复制报价草稿', {
      status: ws.rfqApproval?.status || 'draft',
      message: '报价草稿已复制到剪贴板'
    });
  },

  quotationPrintDraft() {
    const ws = this.syncWorkspaceFromDom('quotation');
    const draft = ws.rfqDraft || ws.result || '';
    if (!draft) throw new Error('暂无可打印的报价草稿');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${Utils.escape(ws.productName || 'RFQ 报价草稿')}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:28px;color:#111827}
      h1,h2,h3,p{margin:0 0 10px}
      .card{border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:16px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .muted{color:#6b7280}
      .warn{color:#b45309}
      .ok{color:#047857}
      .line{white-space:pre-wrap;line-height:1.75}
    </style></head><body>
      <h1>RFQ 报价草稿</h1>
      <p class="muted">本草稿由 Industrial AI OS 本地规则生成，最终发送前需人工确认。</p>
      <div class="card"><div class="grid">
        <div><h3>客户需求</h3><p>客户：${Utils.escape(ws.customerName || '待补充')}</p><p>产品：${Utils.escape(ws.productName || '待补充')}</p><p>材料：${Utils.escape(ws.materialName || '待补充')}</p><p>数量：${Utils.escape(String(ws.quantity || '待补充'))} ${Utils.escape(ws.unit || '件')}</p></div>
        <div><h3>交付信息</h3><p>工艺：${Utils.escape(ws.processType || '待补充')}</p><p>交期：${Utils.escape(ws.deliveryDate || '待补充')}</p><p>联系人：${Utils.escape(ws.contactName || '待补充')}</p><p>联系方式：${Utils.escape(ws.phone || '待补充')}</p></div>
      </div></div>
      <div class="card"><h3>报价草稿</h3><div class="line">${Utils.escape(draft)}</div></div>
      <div class="card"><h3>风险说明</h3><p class="${(ws.rfqBlockers || []).length ? 'warn' : 'ok'}">${Utils.escape((ws.rfqBlockers || []).length ? (ws.rfqBlockers || []).map(item => item.reason).join('；') : '当前无阻断项，可进入审批。')}</p></div>
    </body></html>`;
    const win = window.open('', '_blank', 'width=1100,height=900');
    if (!win) {
      this.toast('浏览器阻止了打印窗口，请允许弹窗后重试', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
    this.saveQuotationAudit('打印报价草稿', {
      status: ws.rfqApproval?.status || 'draft',
      message: '已打开报价草稿打印窗口'
    });
    this.toast('已打开报价草稿打印窗口');
  },

  quotationOpenRiskHistory(riskId) {
    const ws = this.getQuotationWorkspace();
    const risk = (ws.rfqRisks || []).find(item => item.id === riskId);
    if (!risk) {
      this.toast('未找到风险详情', 'error');
      return;
    }
    const history = Array.isArray(risk.history) ? risk.history : [];
    const body = history.length
      ? history.map(item => `${Utils.formatDate(item.time || Date.now(), true)}\n动作：${item.action || '更新'}\n状态：${item.status || 'pending'}\n说明：${item.note || '无'}`).join('\n\n---\n\n')
      : '暂无历史记录';
    this.openModal(`<div class="modal-head"><h3>风险历史</h3><button class="icon-btn" data-action="modal-close">${icon('x')}</button></div><div class="modal-body"><div class="result-box large">${Utils.textToHtml(`风险名称：${risk.name || '未命名风险'}\n类型：${risk.type || '风险'}\n严重程度：${risk.severity || '中'}\n状态：${risk.status || 'pending'}\n负责人：${risk.owner || '待分配'}\n处理措施：${risk.mitigation || '待补充'}\n更新时间：${Utils.formatDate(risk.updatedAt || Date.now(), true)}\n\n历史：\n${body}`)}</div></div>`);
  },

  quotationSelectRisk(riskId) {
    const ws = this.getQuotationWorkspace();
    ws.rfqSelectedRiskId = riskId;
    this.quotationFillSelectedRiskFromWorkspace(ws);
    this.quotationSyncDerived(ws);
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  quotationAddRisk() {
    const ws = this.syncWorkspaceFromDom('quotation');
    const name = String(ws.newRiskName || '').trim();
    if (!name) throw new Error('请填写风险名称');
    const risk = {
      id: uid(),
      name,
      type: String(ws.newRiskType || '交付风险').trim() || '交付风险',
      severity: String(ws.newRiskSeverity || 'medium').trim() || 'medium',
      status: 'pending',
      owner: String(ws.newRiskOwner || '待分配').trim() || '待分配',
      mitigation: String(ws.newRiskMitigation || '待补充').trim() || '待补充',
      acceptReason: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      history: [
        {
          id: uid(),
          action: '新建风险',
          note: String(ws.newRiskMitigation || '待补充').trim() || '待补充',
          status: 'pending',
          time: Date.now()
        }
      ],
      source: 'rfq'
    };
    ws.rfqRisks = this.quotationNormalizeRisks([risk, ...(ws.rfqRisks || [])]);
    ws.rfqSelectedRiskId = risk.id;
    ws.newRiskName = '';
    ws.newRiskType = '';
    ws.newRiskSeverity = 'medium';
    ws.newRiskOwner = '';
    ws.newRiskMitigation = '';
    this.quotationFillSelectedRiskFromWorkspace(ws);
    this.quotationSyncDerived(ws);
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('新增风险', {
      riskId: risk.id,
      riskName: risk.name,
      status: risk.status,
      message: `${risk.name} 已加入风险评审`,
      signature: `RFQ_RISK_${risk.id}`
    });
    Store.save();
    this.rerender();
    this.toast('风险已添加');
  },

  quotationUpdateRisk(action) {
    const ws = this.syncWorkspaceFromDom('quotation');
    const riskId = ws.rfqSelectedRiskId;
    const list = this.quotationNormalizeRisks(ws.rfqRisks || []);
    const risk = list.find(item => item.id === riskId);
    if (!risk) {
      this.toast('请先选择一个风险', 'error');
      return;
    }
    const now = Date.now();
    const reason = String(ws.selectedRiskAcceptReason || '').trim();
    const owner = String(ws.selectedRiskOwner || risk.owner || '').trim() || '待分配';
    const mitigation = String(ws.selectedRiskMitigation || risk.mitigation || '').trim() || '待补充';
    const name = String(ws.selectedRiskName || risk.name || '').trim() || risk.name;
    const type = String(ws.selectedRiskType || risk.type || '').trim() || risk.type;
    const severity = typeof RFQRisk !== 'undefined' && RFQRisk ? RFQRisk.normalizeSeverity(ws.selectedRiskSeverity || risk.severity) : String(ws.selectedRiskSeverity || risk.severity || 'medium');
    let status = typeof RFQRisk !== 'undefined' && RFQRisk ? RFQRisk.normalizeStatus(action === 'save' ? ws.selectedRiskStatus : action) : String(action || risk.status || 'pending');
    if (action === 'save') status = typeof RFQRisk !== 'undefined' && RFQRisk ? RFQRisk.normalizeStatus(ws.selectedRiskStatus || risk.status) : String(ws.selectedRiskStatus || risk.status || 'pending');
    if (action === 'accept' && typeof RFQRisk !== 'undefined' && RFQRisk && RFQRisk.isSevereRisk(risk) && !reason) {
      this.toast('严重或阻断风险接受时必须填写接受原因', 'error');
      return;
    }
    if (action === 'accept' && typeof RFQRisk !== 'undefined' && RFQRisk && RFQRisk.needsAcceptanceReason({ ...risk, status: 'accepted', acceptReason: reason })) {
      this.toast('请先补充接受原因', 'error');
      return;
    }
    const nextStatus = action === 'handle' ? 'handling'
      : action === 'mitigate' ? 'mitigated'
      : action === 'accept' ? 'accepted'
      : action === 'close' ? 'closed'
      : status;
    const updated = {
      ...risk,
      name,
      type,
      severity,
      status: nextStatus,
      owner,
      mitigation,
      acceptReason: action === 'accept' ? reason : (risk.acceptReason || ''),
      updatedAt: now,
      history: Array.isArray(risk.history) ? [...risk.history] : []
    };
    updated.history.unshift({
      id: uid(),
      action: action === 'handle' ? '处理风险'
        : action === 'mitigate' ? '缓解风险'
        : action === 'accept' ? '接受风险'
        : action === 'close' ? '关闭风险'
        : '更新风险',
      note: action === 'accept' ? reason || '已填写接受原因' : mitigation,
      status: nextStatus,
      time: now
    });
    list[list.findIndex(item => item.id === risk.id)] = updated;
    ws.rfqRisks = list;
    ws.rfqSelectedRiskId = updated.id;
    this.quotationFillSelectedRiskFromWorkspace(ws);
    this.quotationSyncDerived(ws);
    ws.updatedAt = now;
    const actionLabel = action === 'handle' ? '处理风险'
      : action === 'mitigate' ? '标记已缓解'
      : action === 'accept' ? '接受风险'
      : action === 'close' ? '关闭风险'
      : '保存风险';
    this.saveQuotationAudit(actionLabel, {
      riskId: updated.id,
      riskName: updated.name,
      status: updated.status,
      reason: updated.acceptReason || mitigation,
      message: `${updated.name} 状态更新为 ${updated.status}`
    });
    Store.save();
    this.rerender();
    this.toast(`风险已${actionLabel}`);
  },

  quotationGenerateDraft() {
    const ws = this.syncWorkspaceFromDom('quotation');
    this.quotationFillSelectedRiskFromWorkspace(ws);
    this.quotationSyncDerived(ws);
    const blockers = this.quotationGetBlockers(ws);
    ws.rfqBlockers = blockers;
    if (blockers.length) {
      ws.rfqDraft = '';
      ws.result = blockers.map(item => `${item.title}：${item.reason}\n建议：${item.suggestion}`).join('\n\n');
      ws.rfqApproval.status = 'draft';
      ws.rfqLastComputedAt = Date.now();
      ws.updatedAt = Date.now();
      this.saveQuotationAudit('报价阻断', {
        status: 'blocked',
        message: '存在阻断项，报价草稿未生成',
        blockers: blockers.length,
        reason: blockers.map(item => item.reason).join('；'),
        suggestion: blockers.map(item => item.suggestion).join('；')
      });
      Store.save();
      this.rerender();
      this.toast('存在阻断项，请先处理后再生成报价草稿', 'warning');
      return { blocked: true, blockers };
    }
    const handledNotes = this.quotationHandledRiskNotes(ws);
    const approval = ws.rfqApproval || { status: 'draft', reason: '', history: [] };
    const draftText = typeof RFQValidation !== 'undefined' && RFQValidation && typeof RFQValidation.buildQuotationDraft === 'function'
      ? RFQValidation.buildQuotationDraft(this.quotationOrderFields(ws), ws.rfqRisks || [], approval)
      : '';
    const summary = [
      '报价草稿（RFQ）',
      `客户：${ws.customerName || '待补充'}`,
      `产品：${ws.productName || '待补充'}`,
      `材料：${ws.materialName || '待补充'}`,
      `数量：${ws.quantity || '待补充'} ${ws.unit || '件'}`,
      `工艺：${ws.processType || '待补充'}`,
      `交期：${ws.deliveryDate || '待补充'}`,
      `联系人：${ws.contactName || '待补充'}`,
      `联系方式：${ws.phone || '待补充'}`,
      '',
      '已处理风险：',
      handledNotes.length ? handledNotes.map(item => `- ${item}`).join('\n') : '- 无',
      '',
      '报价说明：',
      `当前报价草稿已自动带入客户、产品、材料、数量、工艺、交期与联系方式。`,
      `审批状态：${approval.status || 'draft'}`,
      `最终发送前必须由人工确认。`
    ].join('\n');
    ws.rfqDraft = draftText ? `${summary}\n\n${draftText}` : summary;
    ws.result = ws.rfqDraft;
    ws.rfqLastComputedAt = Date.now();
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('生成报价草稿', {
      status: 'draft',
      message: '报价草稿已生成',
      blockers: 0,
      count: ws.rfqRisks.length
    });
    Store.save();
    this.rerender();
    this.toast('报价草稿已生成');
    return ws.rfqDraft;
  },

  quotationStartApproval() {
    const ws = this.syncWorkspaceFromDom('quotation');
    this.quotationFillSelectedRiskFromWorkspace(ws);
    const blockers = this.quotationGetBlockers(ws);
    if (blockers.length) {
      ws.rfqBlockers = blockers;
      ws.result = blockers.map(item => `${item.title}：${item.reason}\n建议：${item.suggestion}`).join('\n\n');
      ws.rfqApproval.status = 'draft';
      ws.updatedAt = Date.now();
      this.saveQuotationAudit('发起审批失败', {
        status: 'blocked',
        message: '存在阻断项，无法发起审批',
        blockers: blockers.length,
        reason: blockers.map(item => item.reason).join('；')
      });
      Store.save();
      this.rerender();
      this.toast('存在阻断项，请先处理后再发起审批', 'error');
      return false;
    }
    ws.rfqApproval.status = 'pending';
    ws.rfqApproval.reason = String(ws.approvalReason || '').trim();
    ws.rfqApproval.updatedAt = Date.now();
    ws.rfqApproval.history.unshift({
      id: uid(),
      action: '发起审批',
      status: 'pending',
      reason: ws.rfqApproval.reason || '无',
      time: Date.now()
    });
    ws.rfqLastSubmittedAt = Date.now();
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('发起审批', {
      status: 'pending',
      message: '报价审批已进入 pending',
      reason: ws.rfqApproval.reason || ''
    });
    Store.save();
    this.rerender();
    this.toast('报价审批已发起');
    return true;
  },

  quotationDecision(status) {
    const ws = this.syncWorkspaceFromDom('quotation');
    const approval = ws.rfqApproval || { status: 'draft', reason: '', history: [] };
    const reason = String(ws.approvalReason || approval.reason || '').trim();
    const blockers = this.quotationGetBlockers(ws);
    if (status === 'approved') {
      if (blockers.length) {
        ws.rfqBlockers = blockers;
        ws.result = blockers.map(item => `${item.title}：${item.reason}\n建议：${item.suggestion}`).join('\n\n');
        this.toast('存在阻断项，无法批准报价', 'error');
        this.saveQuotationAudit('审批批准失败', {
          status: 'blocked',
          message: '阻断项未解决',
          blockers: blockers.length,
          reason: blockers.map(item => item.reason).join('；')
        });
        Store.save();
        this.rerender();
        return false;
      }
      approval.status = 'approved';
      approval.reason = reason || approval.reason || '已批准';
      approval.updatedAt = Date.now();
      approval.history.unshift({
        id: uid(),
        action: '批准',
        status: 'approved',
        reason: approval.reason,
        time: Date.now()
      });
      ws.rfqApproval = approval;
      ws.approvalReason = approval.reason;
      ws.rfqApprovedAt = Date.now();
      const draft = this.quotationGenerateDraft();
      this.saveQuotationAudit('审批通过', {
        status: 'approved',
        message: '审批通过并生成报价草稿',
        reason: approval.reason
      });
      Store.save();
      this.toast('审批通过，已生成报价草稿');
      return draft;
    }
    if (status === 'rejected' || status === 'returned') {
      if (!reason) {
        this.toast('驳回或退回补充必须填写原因', 'error');
        return false;
      }
      approval.status = status;
      approval.reason = reason;
      approval.updatedAt = Date.now();
      approval.history.unshift({
        id: uid(),
        action: status === 'rejected' ? '驳回' : '退回补充',
        status,
        reason,
        time: Date.now()
      });
      ws.rfqApproval = approval;
      ws.approvalReason = reason;
      ws.rfqDraft = ws.rfqDraft || '';
      ws.result = ws.result || ws.rfqDraft || '';
      ws.updatedAt = Date.now();
      this.saveQuotationAudit(status === 'rejected' ? '审批驳回' : '审批退回', {
        status,
        message: status === 'rejected' ? '报价审批被驳回' : '报价审批退回补充',
        reason
      });
      Store.save();
      this.rerender();
      this.toast(status === 'rejected' ? '报价已驳回' : '报价已退回补充');
      return true;
    }
    return false;
  },

  quotationFinalSend() {
    const ws = this.syncWorkspaceFromDom('quotation');
    if (!ws.rfqDraft && !ws.result) throw new Error('请先生成报价草稿');
    if ((ws.rfqApproval?.status || 'draft') !== 'approved') {
      throw new Error('请先通过审批后再进行最终发送');
    }
    const blockers = this.quotationGetBlockers(ws);
    if (blockers.length) throw new Error('存在阻断项，请先处理风险');
    const confirmText = `客户：${ws.customerName || '待补充'}\n产品：${ws.productName || '待补充'}\n审批状态：${ws.rfqApproval?.status || 'draft'}\n\n确认后将记录为最终发送动作，但不会自动调用收费 API。`;
    if (!confirm(confirmText)) return false;
    ws.rfqFinalSentAt = Date.now();
    ws.updatedAt = Date.now();
    this.saveQuotationAudit('最终发送确认', {
      status: 'approved',
      message: '已完成人工确认的最终发送动作'
    });
    Store.save();
    this.rerender();
    this.toast('已记录最终发送确认');
    return true;
  },

  parseKeyValueText(text = '') {
    const map = {};
    String(text).split('\n').forEach(line => {
      const match = line.match(/^\s*([^=：:；;]+?)\s*(?:=|：|:)\s*(.+?)\s*$/);
      if (match) map[match[1].trim()] = match[2].trim();
    });
    return map;
  },

  setupOcrProviders() {
    if (this.ocrRegistry || typeof OCRArchitecture === 'undefined') return this.ocrRegistry;
    const registry = new OCRArchitecture.ProviderRegistry({
      onLog: entry => this.recordOcrProviderLog(entry),
      onError: entry => this.recordOcrProviderError(entry)
    });
    const health = OCRService.health();
    const current = OCRArchitecture.createCurrentProvider({
      recognize: (file, onProgress) => OCRService.recognize(file, onProgress),
      healthCheck: () => ({ available: Boolean(OCRService.health().hasTesseract), status: OCRService.health().engineState, message: OCRService.health().engineError || '' }),
      structure: text => OCRService.structure(text)
    });
    current.available = Boolean(health.hasTesseract);
    current.availabilityReason = health.hasTesseract ? '' : '当前 OCR 引擎未加载，自动模式将明确降级到演示 Provider';
    registry.register(current);
    registry.register(OCRArchitecture.createPlaceholderProvider('local', '本地 OCR', 'local', { supportsLocal: true, supportsTable: true, supportsChinese: true }));
    registry.register(OCRArchitecture.createPlaceholderProvider('cloud', '云端 OCR', 'cloud', { supportsCloud: true, supportsTable: true, supportsChinese: true }));
    registry.register(OCRArchitecture.createPlaceholderProvider('vision', '视觉模型', 'vision', { supportsCloud: true, supportsTable: true, supportsHandwriting: true, supportsChinese: true }));
    registry.register(OCRArchitecture.createMockProvider());
    this.ocrRegistry = registry;
    const data = Store.state.ocrData;
    this.temp.ocr.providerId = data.providerConfig.selectedProviderId || 'auto';
    for (const provider of registry.list()) data.providerHealth[provider.providerId] = {
      available: provider.available, status: provider.available ? (provider.providerType === 'mock' ? 'demo' : 'ready') : 'unconfigured',
      message: provider.availabilityReason || '', updatedAt: Date.now()
    };
    Store.save();
    return registry;
  },

  restoreOcrSession() {
    if (typeof OCRArchitecture === 'undefined') return null;
    const data = Store.state.ocrData || {};
    const sessions = Array.isArray(data.documentSessions) ? data.documentSessions : [];
    const selected = sessions.find(item => item.document_session_id === data.activeDocumentSessionId) || sessions[0] || null;
    const result = selected?.result || (Array.isArray(data.results) ? data.results[0] : null);
    if (!result?.requestId) return null;
    let review = selected?.review || (data.reviews || []).find(item => item.requestId === result.requestId);
    if (!review) {
      review = OCRArchitecture.createReview(result);
      data.reviews = [review, ...(data.reviews || [])].slice(0, 50);
      Store.save();
    }
    const o = this.temp.ocr;
    o.providerResult = result;
    o.documentSessionId = selected?.document_session_id || '';
    o.review = review;
    o.result = result.rawText || '';
    o.original = result.rawText || '';
    o.providerId = data.providerConfig?.selectedProviderId || result.providerId || 'auto';
    o.sourceFile = { ...(selected?.sourceFile || result.sourceFile || review.source?.sourceFile || {}) };
    o.mock = result.providerId === 'mock' || Boolean(result.fallbackUsed);
    o.mockReason = result.fallbackUsed ? result.warnings?.[0] || '真实识别不可用，已使用演示降级' : '';
    o.status = o.mock ? (result.fallbackUsed ? '已使用降级模式（演示数据，非真实识别）' : '演示数据（非真实识别）')
      : result.status === 'partial_success' ? '部分成功：疑似乱码或模型兼容异常'
        : result.success ? '真实 OCR 成功' : 'OCR 失败';
    o.progress = result.success ? 1 : 0;
    o.diagnostics = data.errors?.[0] || null;
    return { result, review, session: selected };
  },

  ocrSelectDocumentSession(sessionId) {
    const data = Store.state.ocrData || {};
    const session = (data.documentSessions || []).find(item => item.document_session_id === sessionId);
    if (!session) throw new Error('OCR 文档会话不存在或已被清理');
    data.activeDocumentSessionId = sessionId;
    Store.save();
    this.temp.ocr = { ...this.temp.ocr, file: null, url: '', documentSessionId: sessionId, providerResult: session.result || null,
      review: session.review || null, result: session.rawText || '', original: session.rawText || '',
      confirmedFields: session.confirmedFields || null, sourceFile: { ...(session.sourceFile || {}) }, status: '已打开已保存文档会话' };
    this.restoreOcrSession();
    this.rerender();
    this.toast('已打开已保存 OCR 文档；原图未保存到浏览器存储，请重新选择原图后再核对。');
  },

  ocrNewDocumentSession() {
    this.temp.ocr = { ...this.temp.ocr, file: null, url: '', documentSessionId: '', providerResult: null, review: null,
      result: '', original: '', confirmedFields: null, fieldDrafts: [], status: '等待上传新图片', progress: 0 };
    Store.state.ocrData.activeDocumentSessionId = '';
    Store.save();
    this.rerender();
    this.toast('已新建 OCR 任务；选择图片后会创建独立文档会话。');
  },

  ocrResolveRecognitionConflict(decision) {
    const sessionId = this.temp.ocr.documentSessionId;
    const session = (Store.state.ocrData?.documentSessions || []).find(item => item.document_session_id === sessionId);
    if (!session?.recognitionConflict) throw new Error('当前文档没有待处理的重新识别冲突');
    if (decision === 'adopt_new_ocr') {
      const review = session.recognitionConflict.candidateReview || OCRArchitecture.createReview(session.result || {});
      session.review = review;
      this.temp.ocr.review = review;
      this.temp.ocr.confirmedFields = null;
    }
    this.touchOcrDocumentSession(sessionId, {
      review: session.review,
      recognitionConflict: { ...session.recognitionConflict, status: decision, resolved_at: new Date().toISOString() }
    }, decision);
    Store.save();
    this.rerender();
    this.toast(decision === 'adopt_new_ocr' ? '已采用新 OCR 字段，需重新人工复核后才能进入正式业务。' : '已保留人工确认字段；新 OCR 结果仍保存在本 Session 历史中。');
  },

  upsertOcrDocumentTemplate(result) {
    const type = String(result?.documentType || this.temp.ocr?.template || '通用').trim() || '通用';
    const templateId = `template-${type}`;
    const templates = Store.state.ocrData.documentTemplates || (Store.state.ocrData.documentTemplates = []);
    const fields = (result?.fields || []).map(field => ({ key: field.key, label: field.label, required: Boolean(field.required) }));
    const index = templates.findIndex(item => item.template_id === templateId);
    const current = index >= 0 ? templates[index] : { template_id: templateId, template_name: type, template_type: type, created_at: new Date().toISOString() };
    const next = { ...current, field_definitions: fields, last_used_at: new Date().toISOString() };
    if (index >= 0) templates[index] = next; else templates.unshift(next);
    Store.state.ocrData.documentTemplates = templates.slice(0, 30);
    return templateId;
  },

  touchOcrDocumentSession(sessionId, patch = {}, action = '') {
    const data = Store.state.ocrData;
    const sessions = Array.isArray(data.documentSessions) ? data.documentSessions : (data.documentSessions = []);
    const index = sessions.findIndex(item => item.document_session_id === sessionId);
    const current = index >= 0 ? sessions[index] : { document_session_id: sessionId, history: [], created_at: new Date().toISOString() };
    const next = { ...current, ...patch, updated_at: new Date().toISOString() };
    if (action) next.history = [{ action, at: Date.now() }, ...(current.history || [])].slice(0, 100);
    if (index >= 0) sessions[index] = next; else sessions.unshift(next);
    data.documentSessions = sessions.slice(0, 50);
    data.activeDocumentSessionId = sessionId;
    return next;
  },

  ocrEnvironment() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    return {
      browser: nav.userAgent || '', platform: nav.platform || '', operatingSystem: nav.userAgentData?.platform || '',
      architecture: nav.userAgentData?.architecture || '', deviceMemoryGb: Number(nav.deviceMemory) || null,
      hardwareConcurrency: Number(nav.hardwareConcurrency) || null, nodeVersion: typeof process !== 'undefined' ? process.version : '',
      online: typeof nav.onLine === 'boolean' ? nav.onLine : null
    };
  },

  recordOcrProviderLog(entry = {}) {
    const data = Store.state.ocrData;
    data.tasks.unshift({ schemaVersion: 2, time: Date.now(), module: 'ocr', ...entry });
    data.tasks = data.tasks.slice(0, 200);
    Store.save();
  },

  recordOcrProviderError({ requestId, provider = {}, error, file, startedAt, fallbackUsed }) {
    const durationMs = Math.max(0, Date.now() - Date.parse(startedAt || new Date().toISOString()));
    const errorType = error?.code || 'invalid_response';
    const diagnostic = OCRArchitecture.sanitizeDiagnostics({
      errorType, requestId, providerId: provider.providerId || '', providerVersion: provider.version || '',
      fileType: file?.type || '', imageSize: this.temp.ocr?.sourceFile?.dimensions || {}, durationMs,
      rawError: String(error?.message || error || ''), retried: Number(this.temp.ocr?.retryCount || 0) > 0,
      fallbackUsed: Boolean(fallbackUsed), environment: this.ocrEnvironment()
    });
    Store.state.ocrData.errors.unshift({ ...diagnostic, time: Date.now() });
    Store.state.ocrData.errors = Store.state.ocrData.errors.slice(0, 100);
    this.temp.ocr.diagnostics = diagnostic;
    this.reportBug({
      module: 'OCR', feature: 'Provider 识别', type: errorType, message: `OCR 诊断：${error?.message || '识别异常'}`,
      description: JSON.stringify(diagnostic), suggestion: '请重新识别、检查图片质量，或更换可用 Provider。',
      requestId, source: 'ocr-provider', signature: ['OCR', errorType, provider.providerId || 'unknown', error?.message || 'error'].join('|'), rawError: String(error?.message || error || '')
    });
    Store.save();
  },

  updateOcrDailyStats(result) {
    const stats = Store.state.ocrData.stats;
    const today = new Date().toISOString().slice(0, 10);
    if (stats.date !== today) Object.assign(stats, { date: today, todayCount: 0, todayFailureCount: 0, todayFallbackCount: 0 });
    stats.todayCount += 1;
    if (!result?.success) stats.todayFailureCount += 1;
    if (result?.fallbackUsed) stats.todayFallbackCount += 1;
  },

  persistOcrResult(result) {
    const data = Store.state.ocrData;
    data.results = data.results.filter(item => item.requestId !== result.requestId);
    data.results.unshift(result);
    data.results = data.results.slice(0, 50);
    const sessionId = this.temp.ocr.documentSessionId || `doc-${result.requestId}`;
    const existingSession = (data.documentSessions || []).find(item => item.document_session_id === sessionId);
    const protectedReview = existingSession?.review?.status === 'approved' ? existingSession.review : null;
    const existingReview = data.reviews.find(item => item.requestId === result.requestId);
    const candidateReview = OCRArchitecture.createReview(result, existingReview || {});
    const review = protectedReview || candidateReview;
    data.reviews = data.reviews.filter(item => item.requestId !== result.requestId);
    data.reviews.unshift(candidateReview);
    data.reviews = data.reviews.slice(0, 50);
    this.temp.ocr.providerResult = result;
    this.temp.ocr.review = review;
    this.temp.ocr.documentSessionId = sessionId;
    const recognitionConflict = protectedReview ? {
      status: 'requires_user_choice', previousRequestId: protectedReview.requestId, newRequestId: result.requestId,
      candidateReview,
      message: '新 OCR 结果不会自动覆盖已人工批准字段；请人工比较后选择保留或采用新值。', created_at: new Date().toISOString()
    } : null;
    const templateId = this.upsertOcrDocumentTemplate(result);
    const recognitionHistory = [
      { requestId: result.requestId, result, created_at: new Date().toISOString() },
      ...(existingSession?.recognitionHistory || [])
    ].slice(0, 20);
    this.touchOcrDocumentSession(sessionId, {
      requestId: result.requestId,
      sourceFile: { ...(result.sourceFile || this.temp.ocr.sourceFile || {}) },
      storage_status: 'metadata_only', rawText: result.rawText || '', result, review,
      template_id: templateId, recognitionConflict, recognitionHistory
    }, protectedReview ? 'recognition_conflict_created' : 'ocr_result_saved');
    this.updateOcrDailyStats(result);
    Store.save();
    return review;
  },

  saveOcrReview(review) {
    const data = Store.state.ocrData;
    data.reviews = data.reviews.filter(item => item.requestId !== review.requestId);
    data.reviews.unshift(review);
    data.reviews = data.reviews.slice(0, 50);
    this.temp.ocr.review = review;
    const sessionId = this.temp.ocr.documentSessionId || `doc-${review.requestId}`;
    this.temp.ocr.documentSessionId = sessionId;
    this.touchOcrDocumentSession(sessionId, { requestId: review.requestId, review }, 'review_saved');
    Store.save();
  },

  syncOcrReviewFromDom() {
    let review = this.temp.ocr.review;
    if (!review) throw Object.assign(new Error('暂无可复核的 OCR 结果'), { code: 'review_not_found' });
    document.querySelectorAll('[data-ocr-review-field]').forEach(input => {
      const field = review.fields.find(item => item.key === input.dataset.ocrReviewField);
      if (field && String(field.value ?? '') !== String(input.value ?? '')) {
        review = OCRArchitecture.updateReviewField(review, field.key, input.value);
      }
    });
    this.saveOcrReview(review);
    return review;
  },

  ocrReviewerName() {
    const user = AuthClient.session?.user || {};
    return user.name || user.email || '当前用户';
  },

  async ocrSaveReviewDraft() {
    const review = this.syncOcrReviewFromDom();
    this.recordTask({
      type: 'OCR人工复核', fileName: this.temp.ocr.file?.name || '图片', module: 'ocr', status: 'waiting_human',
      summary: `复核草稿已保存 · ${review.modifications.length} 处修改`, requestId: review.requestId
    });
    await this.persistBusinessState('OCR 复核草稿已保存');
    this.rerender();
  },

  async ocrApproveReview() {
    const review = this.syncOcrReviewFromDom();
    const summary = OCRArchitecture.reviewSummary(review);
    if (!confirm(`确认批准本次 OCR 人工复核？\n\n低置信度字段：${summary.lowConfidenceCount}\n缺失字段：${summary.missingCount}\n人工修改：${summary.manuallyEditedCount}\n\n批准后才能转入报价或询价，仍需对原图负责核对。`)) return;
    const approved = OCRArchitecture.approveReview(review, this.ocrReviewerName());
    this.saveOcrReview(approved);
    const fields = Object.fromEntries(approved.fields.map(field => [field.label, field.value || '待补充']));
    const confirmed = { confirmed: true, confirmedAt: Date.now(), reviewedAt: approved.reviewedAt, reviewer: approved.reviewer, fields, source: 'ocr-review-v2' };
    this.temp.ocr.confirmedFields = confirmed;
    this.touchOcrDocumentSession(this.temp.ocr.documentSessionId || `doc-${approved.requestId}`, { confirmedFields: confirmed }, 'review_approved');
    localStorage.setItem('personal-ai-os-ocr-confirmed-fields', JSON.stringify(confirmed));
    this.recordTask({ type: 'OCR人工复核', fileName: this.temp.ocr.file?.name || '图片', module: 'ocr', status: 'success',
      summary: '人工复核已批准', requestId: approved.requestId, result: JSON.stringify(fields) });
    Store.addActivity('OCR 人工复核已批准', 'check');
    await Store.flushSync();
    this.rerender();
    this.toast('复核已批准，现可转入正式业务。');
  },

  async ocrRejectReview() {
    if (!this.temp.ocr.review) throw new Error('暂无可驳回的 OCR 结果');
    const reason = prompt('请填写驳回原因（必填）：', this.temp.ocr.review.rejectionReason || '');
    if (reason === null) return;
    const rejected = OCRArchitecture.rejectReview(this.syncOcrReviewFromDom(), reason, this.ocrReviewerName());
    this.saveOcrReview(rejected);
    this.recordOcrProviderError({ requestId: rejected.requestId, provider: this.ocrRegistry?.get(this.temp.ocr.providerResult?.providerId) || {},
      error: Object.assign(new Error(reason), { code: 'user_rejected' }), file: this.temp.ocr.file, startedAt: this.temp.ocr.providerResult?.startedAt, fallbackUsed: this.temp.ocr.providerResult?.fallbackUsed });
    this.recordTask({ type: 'OCR人工复核', fileName: this.temp.ocr.file?.name || '图片', module: 'ocr', status: 'failed',
      summary: `已驳回：${reason}`, requestId: rejected.requestId });
    await Store.flushSync();
    this.rerender();
    this.toast('OCR 复核已驳回，未进入正式业务。', 'warning');
  },

  async ocrRefreshProviders() {
    const registry = this.setupOcrProviders();
    const current = registry.get('current');
    if (current) {
      const engine = OCRService.health();
      current.available = Boolean(engine.hasTesseract);
      current.availabilityReason = current.available ? '' : '当前 OCR 引擎未加载';
    }
    for (const provider of registry.list()) {
      const health = await registry.healthCheck(provider.providerId);
      Store.state.ocrData.providerHealth[provider.providerId] = { ...health, updatedAt: Date.now() };
    }
    Store.save();
    this.rerender();
    this.toast('OCR Provider 状态已刷新');
  },

  async ocrCopyDiagnostics() {
    const result = this.temp.ocr.providerResult || {};
    const diagnostics = OCRArchitecture.sanitizeDiagnostics(this.temp.ocr.diagnostics || {
      requestId: result.requestId || '', providerId: result.providerId || '', providerVersion: result.providerVersion || '',
      status: result.status || 'waiting', fileType: this.temp.ocr.sourceFile?.type || '', imageSize: this.temp.ocr.sourceFile?.dimensions || {},
      durationMs: result.durationMs || 0, warnings: result.warnings || [], errors: result.errors || [],
      fallbackUsed: Boolean(result.fallbackUsed), environment: this.ocrEnvironment()
    });
    await this.copy(JSON.stringify(diagnostics, null, 2));
    this.toast('已复制脱敏 OCR 诊断信息');
  },

  async ocrTransferQuotation() {
    const payload = OCRArchitecture.confirmedPayload(this.temp.ocr.review, this.temp.ocr.providerResult);
    if (!confirm('确认将已人工批准的 OCR 字段转入报价工作台？\n空字段保持为空，不会自动编造。')) return;
    const fields = payload.fields;
    const ws = this.getQuotationWorkspace();
    const patch = {};
    if (fields.customer_name) patch.customerName = fields.customer_name;
    if (fields.product_name) patch.productName = fields.product_name;
    if (fields.material) patch.materialName = fields.material;
    if (fields.quantity) patch.quantity = fields.quantity;
    if (fields.delivery_date || fields.date) patch.deliveryDate = fields.delivery_date || fields.date;
    const requirements = [fields.specification && `规格：${fields.specification}`, fields.notes,
      fields.unit_price && `OCR单价：${fields.unit_price}`, fields.total_amount && `OCR总金额：${fields.total_amount}`].filter(Boolean).join('\n');
    if (requirements) patch.requirements = requirements;
    Object.assign(ws, patch, { ocrSource: payload, updatedAt: Date.now() });
    this.saveQuotationAudit('OCR人工确认结果转入', { status: 'draft', message: `requestId: ${payload.requestId}` });
    await this.persistBusinessState('OCR 结果已转入报价草稿');
    this.navigate('quotation');
  },

  async ocrTransferInquiry() {
    const payload = OCRArchitecture.confirmedPayload(this.temp.ocr.review, this.temp.ocr.providerResult);
    if (!confirm('确认将已人工批准的 OCR 字段保存为询价记录？')) return;
    Store.state.ocrInquiries = Array.isArray(Store.state.ocrInquiries) ? Store.state.ocrInquiries : [];
    Store.state.ocrInquiries.unshift({
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      source: 'ocr',
      customerName: payload.fields?.customer_name || '',
      productName: payload.fields?.product_name || '',
      quantity: payload.fields?.quantity || '',
      specification: payload.fields?.specification || '',
      contact: payload.fields?.phone || '',
      notes: payload.fields?.notes || '',
      ...payload
    });
    Store.state.ocrInquiries = Store.state.ocrInquiries.slice(0, 100);
    Store.state.operationLogs.unshift({ id: uid(), title: 'OCR结果转入询价草稿', type: 'ocr', time: Date.now(), requestId: payload.requestId });
    await this.persistBusinessState('询盘草稿已保存，未自动发送');
    this.navigate('inquiries');
  },

  ocrExportReview() {
    const review = this.temp.ocr.review;
    const result = this.temp.ocr.providerResult;
    if (!review || !result) throw new Error('暂无可导出的复核结果');
    const content = [
      'OCR 人工复核结果', `requestId：${review.requestId}`, `Provider：${result.providerName} (${result.providerId})`,
      `识别状态：${result.status}`, `识别开始：${result.startedAt || '未记录'}`, `识别完成：${result.finishedAt || '未记录'}`, `耗时：${result.durationMs || 0} ms`,
      `复核状态：${review.status}`, `复核人：${review.reviewer || '未批准'}`, `复核时间：${review.reviewedAt || '未批准'}`, '',
      '结构化字段', ...review.fields.map(field => `${field.label}：${field.value || '待补充'} | 置信度 ${Math.round(field.confidence * 100)}% | ${field.status}`), '',
      '人工修改', ...(review.modifications.length ? review.modifications.map(item => `${item.time} ${item.label}：${item.originalValue} -> ${item.newValue}`) : ['无']), '',
      '警告', ...(result.warnings.length ? result.warnings : ['无']), '', '错误', ...(result.errors.length ? result.errors.map(error => error.message || error.type || String(error)) : ['无']), '', '原始识别文本', result.rawText
    ].join('\n');
    Utils.textDownload(content, `OCR复核_${review.requestId}.txt`);
    this.toast('OCR 复核结果已导出');
  },

  ocrZoom(delta) {
    this.temp.ocr.reviewZoom = Math.max(0.5, Math.min(2, Number(this.temp.ocr.reviewZoom || 1) + delta));
    this.rerender();
  },

  getOcrFieldOrder() {
    return ['单据类型', '企业名称', '单据编号', '客户名称', '产品名称', '产品编码', '材料', '规格型号', '数量', '单位', '交货日期', '电话', '地址', '网址', '备注', '可信度', '缺失字段'];
  },

  isLikelyOcrNoise(value = '') {
    const text = String(value || '').trim();
    if (!text) return true;
    if (['待补充', '未识别', 'undefined', 'null', 'NaN', 'Infinity'].includes(text)) return true;
    if (text.length > 80) return true;
    if (/^[A-Z]{6,}$/.test(text)) return true;
    if (/(.)\1{5,}/.test(text)) return true;
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    const digits = (text.match(/\d/g) || []).length;
    const junk = (text.match(/[^ \u4e00-\u9fa5A-Za-z0-9。，、；：:,.%（）()\-_/&·]/g) || []).length;
    const ratio = chinese / Math.max(1, text.length);
    return ratio < 0.08 && letters > digits * 2 || junk / Math.max(1, text.length) > 0.18;
  },

  normalizeOcrField(field, value, source = '', quality = {}) {
    let text = String(value || '').trim();
    if (!text || this.isLikelyOcrNoise(text)) return '待补充';
    if (field === '单据类型') {
      if (/发货|送货/.test(text)) return '发货单';
      if (/采购/.test(text)) return '采购单';
      if (/生产|日报/.test(text)) return '生产日报';
      if (/合同/.test(text)) return '合同';
      if (/报价/.test(text)) return '报价单';
      if (/订单/.test(text)) return '订单';
      return quality.level === 'poor' ? '待补充' : text;
    }
    if (field === '企业名称') {
      return /(公司|厂|有限|集团|店|部)/.test(text) ? text : '待补充';
    }
    if (field === '单据编号') {
      return /^[A-Za-z0-9][A-Za-z0-9\-_/]{2,}$/.test(text) ? text : '待补充';
    }
    if (field === '客户名称') {
      return /(公司|厂|集团|学校|医院|店|部|有限公司|有限责任公司)/.test(text) || quality.level !== 'poor' ? text : '待补充';
    }
    if (field === '产品名称') {
      return text.length <= 40 && /[\u4e00-\u9fa5A-Za-z0-9]/.test(text) ? text : '待补充';
    }
    if (field === '产品编码') {
      return /^[A-Za-z0-9][A-Za-z0-9\-_/]{2,}$/.test(text) ? text : '待补充';
    }
    if (field === '材料') {
      return /(不锈钢|铝|钢|铜|塑料|板材|型材|304|316|45#|碳钢)/.test(text) ? text : '待补充';
    }
    if (field === '规格型号') {
      return text.length <= 50 ? text : '待补充';
    }
    if (field === '数量') {
      return /^-?\d+(?:\.\d+)?$/.test(text) ? String(Number(text)) : '待补充';
    }
    if (field === '单位') {
      return /^(件|个|箱|套|台|批|米|kg|公斤|吨|只|张|pcs|PCs|条|支|包|卷)$/.test(text) ? text : (text.length <= 6 ? text : '待补充');
    }
    if (field === '交货日期') {
      return /(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?)/.test(text) ? text : '待补充';
    }
    if (field === '电话') {
      return /(?:\d{3,4}-\d{7,8}|\d{11}|\d{2,4}\s?\d{6,8})/.test(text) ? text : '待补充';
    }
    if (field === '地址') {
      return text.length >= 4 ? text : '待补充';
    }
    if (field === '网址') {
      return /(?:https?:\/\/|www\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/\S*)?/i.test(text) ? text : '待补充';
    }
    if (field === '备注') {
      return text.length <= 120 ? text : '待补充';
    }
    if (field === '可信度') {
      return ['低', '中', '高'].includes(text) ? text : (quality.level === 'good' ? '高' : quality.level === 'medium' ? '中' : '低');
    }
    return text || '待补充';
  },

  buildOcrFieldDrafts(source = '', quality = {}, preferred = {}) {
    const base = OCRService.structure(source || '');
    const sourceText = String(source || '');
    const pick = (field) => {
      const prefer = preferred[field];
      const raw = prefer != null && String(prefer).trim() ? prefer : base.fields?.[field];
      return this.normalizeOcrField(field, raw, sourceText, quality);
    };
    const fields = this.getOcrFieldOrder().reduce((acc, field) => {
      acc[field] = pick(field);
      return acc;
    }, {});
    const missing = Object.entries(fields)
      .filter(([field, value]) => field !== '可信度' && field !== '缺失字段' && String(value || '').trim() === '待补充')
      .map(([field]) => field);
    fields['缺失字段'] = missing.length ? missing.join('、') : '无';
    return {
      fields,
      rows: this.getOcrFieldOrder().map(field => ({
        field,
        value: fields[field],
        status: field === '可信度'
          ? fields[field]
          : (fields[field] && fields[field] !== '待补充' ? '已识别' : '未识别')
      })),
      quality,
      confirmed: false,
      confirmedAt: 0,
      source: 'ocr'
    };
  },

  buildOcrDemoFields() {
    const fields = {
      '单据类型': '发货单',
      '企业名称': '溧阳五四不锈钢有限公司',
      '单据编号': 'FH-20240627-001',
      '客户名称': '新能源设备客户',
      '产品名称': '304不锈钢连接件',
      '产品编码': 'WUSI-CNC-001',
      '材料': '304不锈钢',
      '规格型号': 'CNC加工件',
      '数量': '500',
      '单位': '件',
      '交货日期': '2026-06-27',
      '电话': '0519-87654321',
      '地址': '江苏省溧阳市',
      '网址': 'www.wusi-stainless.com',
      '备注': '示例数据，仅用于系统演示',
      '可信度': '中',
      '缺失字段': '无'
    };
    const rawText = [
      '发货单',
      '单据编号：FH-20240627-001',
      '企业名称：溧阳五四不锈钢有限公司',
      '客户名称：新能源设备客户',
      '产品名称：304不锈钢连接件',
      '产品编码：WUSI-CNC-001',
      '材料：304不锈钢',
      '规格型号：CNC加工件',
      '数量：500',
      '单位：件',
      '交货日期：2026-06-27',
      '电话：0519-87654321',
      '地址：江苏省溧阳市',
      '网址：www.wusi-stainless.com',
      '备注：示例数据，仅用于系统演示'
    ].join('\n');
    return {
      fields,
      rawText,
      rows: this.getOcrFieldOrder().map(field => ({
        field,
        value: fields[field] || '待补充',
        status: field === '可信度' ? fields[field] : (fields[field] && fields[field] !== '待补充' ? '已识别' : '未识别')
      })),
      quality: {
        level: 'medium',
        score: 68,
        reasons: ['这是演示样例字段，不代表真实 OCR 百分百识别成功']
      },
      confirmed: false,
      confirmedAt: 0,
      source: 'demo'
    };
  },

  getOcrSourceText() {
    const o = this.temp.ocr || {};
    return String(window.GlobalSystemState?.ocrResult?.text || o.result || o.aiFix || o.demoFields?.rawText || '').trim();
  },

  syncOcrSourceState(sourceText) {
    const text = String(sourceText || '').trim();
    if (!text) return null;
    const current = window.GlobalSystemState?.ocrResult && typeof window.GlobalSystemState.ocrResult === 'object'
      ? window.GlobalSystemState.ocrResult
      : {};
    if (String(current.text || '').trim() === text) return current;
    const synced = {
      ...current,
      text,
      status: current.status && current.status !== 'idle' ? current.status : 'success'
    };
    window.GlobalSystemState.ocrResult = synced;
    if (typeof emit === 'function') emit('ocr:completed', synced);
    syncGlobalSystemState({ ocrResult: synced });
    return synced;
  },

  shouldUseOcrMockAi() {
    const settings = Store.state.settings || {};
    return Utils.isDisplayMode()
      || settings.accessMode === 'local'
      || !settings.apiEnabled
      || !settings.apiUrl;
  },

  renderOcrFieldTable(mode = 'current') {
    const o = this.temp.ocr || {};
    const source = this.getOcrSourceText();
    const quality = o.quality || OCRService.assessQuality(source);
    let draft = mode === 'confirmed' ? o.confirmedFields : (o.fieldDrafts && o.fieldDrafts.fields ? o.fieldDrafts : null);
    if (!draft) {
      draft = this.buildOcrFieldDrafts(source, quality, o.demoFields?.fields || o.confirmedFields?.fields || {});
      o.fieldDrafts = draft;
    }
    const rows = this.getOcrFieldOrder().map(field => {
      const value = String(draft.fields?.[field] || '待补充').trim() || '待补充';
      return `<tr data-ocr-field-row="${Utils.escape(field)}"><td>${Utils.escape(field)}</td><td><input class="input" data-ocr-field="${Utils.escape(field)}" value="${Utils.escape(value)}" placeholder="待补充"></td><td><span class="status-pill ${value === '待补充' ? 'warning' : 'success'}">${value === '待补充' ? '未识别' : '已识别'}</span></td></tr>`;
    }).join('');
    const qualityLabel = quality.level === 'poor' ? '当前 OCR 原文质量较差，可能由图片模糊、表格线干扰、文字过小、图片压缩或生成图片导致。请以结构化字段表和人工确认结果为准。'
      : quality.level === 'medium' ? 'OCR 已识别部分内容，但仍需人工核对关键字段。'
        : 'OCR 识别质量较好，但仍建议人工核对后使用。';
    const reasons = (quality.reasons || []).length ? `<div class="privacy-note warning">${icon('scan')}<span>${Utils.escape(quality.reasons.join('；'))}</span></div>` : '';
    const demoNote = o.demoFields ? `<div class="privacy-note">${icon('info')}<span>这是演示样例字段，不代表真实 OCR 已百分百识别成功。</span></div>` : '';
    const confirmedNote = o.confirmedFields?.confirmed ? `<div class="privacy-note success">${icon('check')}<span>字段已保存，请在后续报价、模板或导出前再次核对。</span></div>` : '';
    return `<section class="panel"><div class="panel-head"><div><h3>识别字段表</h3></div><span class="badge">${quality.level.toUpperCase()} · ${Math.round(quality.score || 0)}分</span></div><div class="panel-body">${reasons}<div class="privacy-note">${icon('shield')}<span>${Utils.escape(qualityLabel)}</span></div>${demoNote}${confirmedNote}<div class="table-wrap"><table class="data-table"><thead><tr><th>字段</th><th>结果</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></div><div class="button-row"><button class="primary-btn" data-action="ocr-confirm-fields">${icon('check')}人工确认后保存</button><button class="secondary-btn" data-action="ocr-load-demo-fields">${icon('image')}加载演示字段</button></div></div></section><section class="panel"><div class="panel-head"><h3>原始 OCR 拆行结果</h3><span class="badge">${(source || '').length}</span></div><div class="panel-body">${UI.result(source, 'OCR 原文仅供参考，请以字段表和人工确认结果为准。', true)}</div></section>`;
  },

  async addWorkspaceFiles(route, files) {
    const ws = this.getWorkspace(route);
    for (const file of files) {
      const content = await Utils.extractFileText(file);
      ws.files = ws.files || [];
      ws.files.unshift({
        id: uid(),
        name: file.name,
        category: Utils.fileCategory(file),
        content: Utils.sliceText(content, 5000),
        time: Date.now()
      });
    }
    ws.updatedAt = Date.now();
    Store.save();
    Store.addActivity(`上传 ${files.length} 个资料到 ${moduleById(route).name}`, 'file');
    this.rerender();
  },

  createChat(save = true) {
    const chat = { id: uid(), title: '新对话', messages: [], createdAt: Date.now(), updatedAt: Date.now(), files: [] };
    Store.state.chats.unshift(chat);
    Store.state.activeChatId = chat.id;
    if (save) Store.save();
    return chat;
  },

  filteredChats() {
    const q = this.temp.chatSearch.trim().toLowerCase();
    if (!q) return Store.state.chats;
    return Store.state.chats.filter(chat => `${chat.title}\n${chat.messages.map(m => m.content).join('\n')}`.toLowerCase().includes(q));
  },

  loadDemoData() {
    const now = Date.now();
    Store.state.orders = [
      { id: uid(), order_no: 'SO-2026-015', customer: '常州新能源科技有限公司', product: '304不锈钢连接件', quantity: 760, delivery_date: '2026-07-05', status: '待发货', priority: '高', created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() },
      { id: uid(), order_no: 'SO-2026-016', customer: '上海智造工厂', product: 'CNC加工件', quantity: 180, delivery_date: '2026-07-02', status: '生产中', priority: '高', created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }
    ];
    Store.state.inventory = [
      { id: uid(), product_code: 'P-1001', product_name: '304不锈钢连接件', stock_quantity: 240, safety_stock: 300, location: 'A-01', updated_at: new Date(now).toISOString() },
      { id: uid(), product_code: 'P-2002', product_name: 'CNC壳体', stock_quantity: 120, safety_stock: 80, location: 'B-03', updated_at: new Date(now).toISOString() }
    ];
    Store.state.workspaces = Store.state.workspaces || {};
    Store.state.workspaces.workflow = {
      prompt: '上传发货单 -> Excel识别 -> AI分析 -> 生成待办 -> 生成工作日志 -> 生成自动报表 -> Agentic RL执行 -> 导出Word/PDF/Excel',
      result: '业务流程：\n1. 上传发货单\n2. Excel识别\n3. AI分析\n4. 生成待办\n5. 生成工作日志\n6. 生成自动报表\n7. Agentic RL执行\n8. 导出Word/PDF/Excel'
    };
    Store.state.workspaces.autoreport = {
      prompt: '客户：常州新能源科技有限公司\n数量：760\n金额：9710\n运输方式：汽运\n付款方式：月结30天\n风险：交期紧张',
      result: '企业报表：\n客户：常州新能源科技有限公司\n金额：9710\n数量：760\n运输方式：汽运\n付款方式：月结30天\n风险：交期紧张\n建议：优先排产并确认收款节点。'
    };
    Store.state.workspaces.todo = {
      prompt: '今日待办：1. 确认发货单 2. 跟进订单 3. 检查库存 4. 回复客户邮件',
      result: '今日待办：\n1. 确认发货单 / 负责人：企业管理员 / 截止时间：今日18:00 / 优先级：高 / 状态：待处理\n2. 跟进订单 / 负责人：销售 / 截止时间：今日17:30 / 优先级：中 / 状态：待处理\n3. 检查库存 / 负责人：仓库 / 截止时间：今日16:30 / 优先级：高 / 状态：待处理\n4. 回复客户邮件 / 负责人：企业管理员 / 截止时间：今日15:00 / 优先级：高 / 状态：待处理'
    };
    Store.state.workspaces.worklog = {
      prompt: '汇总今日 Excel、Word、SQL、Agent、AI聊天与RL执行情况',
      result: '日报：\n- Excel：已完成发货单统计\n- Word：已完成总结和导出\n- SQL：已生成业务查询\n- Agent：已执行任务拆解\n- AI聊天：已处理客户问题\n- RL：已记录反馈\n建议：明日优先处理延期订单和低库存物料。'
    };
    Store.state.workspaces.chip = {
      prompt: '生成一个 Verilog 计数器和 Testbench，并解释时序逻辑',
      result: 'module counter(input clk, input rst_n, output reg [3:0] q);\n  always @(posedge clk or negedge rst_n) begin\n    if (!rst_n) q <= 4\'d0;\n    else q <= q + 1\'d1;\n  end\nendmodule'
    };
    Store.state.rlFeedback = Store.state.rlFeedback || [];
    Store.state.rlFeedback.unshift({
      id: uid(),
      task: '根据订单和库存生成生产计划',
      module: 'agentic-rl',
      prompt: '请拆解并执行',
      reply: '已完成',
      rating: '★★★★☆',
      reason: '步骤清晰',
      modifiedContent: '优先库存充足订单',
      success: true,
      createdAt: now,
      time: now
    });
    Store.state.dashboard = {
      todayOrders: Store.state.orders.length,
      inventoryAlerts: Store.state.inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0)).length,
      delayedOrders: 0,
      todayPlan: 2,
      productionPlanOrders: 0,
      productionPlanRisk: 0,
      connectorUnconfigured: (Store.state.connectors || []).filter(item => item.status === '未配置' || !item.enabled).length,
      connectorConnected: (Store.state.connectors || []).filter(item => item.status === '已连接').length,
      connectorFailed: (Store.state.connectors || []).filter(item => item.status === '连接失败').length,
      aiSuggestions: ['已加载演示数据，可完整演示业务闭环。', '请从首页开始演示路线。'],
      agentExecutions: 1,
      aiLearningTimes: Store.state.rlFeedback.length,
      systemStatus: '演示模式'
    };
    Store.save();
    this.toast('演示数据已加载');
    this.rerender();
  },

  async startDemoFlow() {
    this.loadDemoData();
    this.navigate('excel');
    this.toast('已进入演示流程：先从 Excel 发货单开始');
  },

  resetDemoEnvironment() {
    if (!confirm('确定清空测试数据并重新加载标准演示环境吗？')) return;
    Store.state.chats = [];
    Store.state.activeChatId = null;
    Store.state.operationLogs = [];
    Store.state.rlFeedback = [];
    Store.state.workspaces = Store.state.workspaces || {};
    ['word', 'excel', 'pdf', 'ocr', 'sql', 'writing', 'image', 'assistant', 'workflow', 'todo', 'worklog', 'autoreport', 'systemcheck', 'rlcenter', 'searchcenter', 'geo'].forEach(key => {
      Store.state.workspaces[key] = {};
    });
    this.temp.word = { title: '', content: '', sourceFile: null };
    this.temp.excel = { file: null, workbook: null, rows: [], records: [], summary: null, meta: {}, schema: {}, result: '', sheetName: '发货单' };
    this.temp.pdf = { files: [], result: '', extracted: '', tableText: '', qaAnswer: '', qaQuestion: '', analysis: '', scanMode: '' };
    this.temp.ocr = { file: null, image: '', text: '', corrected: '', result: '', meta: {}, qaQuestion: '', qaAnswer: '', analysis: '' };
    this.temp.sql = { dialect: 'MySQL', prompt: '', output: '', explanation: '' };
    this.temp.writing = { type: '日报', prompt: '', output: '' };
    this.temp.agent = { goal: '', plan: [], result: '', runs: [], currentRun: null };
    localStorage.removeItem('personal-ai-os-word-draft');
    localStorage.removeItem('personal-ai-os-excel-draft');
    localStorage.removeItem('personal-ai-os-pdf-draft');
    localStorage.removeItem('personal-ai-os-ocr-draft');
    localStorage.removeItem('personal-ai-os-sql-draft');
    localStorage.removeItem('personal-ai-os-writing-draft');
    this.loadDemoData();
    this.navigate('home');
    this.toast('测试数据已清空并重新加载演示环境');
  },

  sanitizeText(text = '') {
    let output = String(text || '');
    output = output.replace(/\b1[3-9]\d{9}\b/g, value => `${value.slice(0, 3)}****${value.slice(-4)}`);
    output = output.replace(/([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[\w.-]+\.\w+)/g, (_, first, mid, tail) => `${first}***${tail}`);
    output = output.replace(/\b(\d{17}[0-9Xx]|\d{15})\b/g, value => `${value.slice(0, 3)}***********${value.slice(-4)}`);
    output = output.replace(/(常州新能源科技有限公司|溧阳五四不锈钢有限公司|[A-Za-z0-9\u4e00-\u9fa5]{4,}公司)/g, '某客户公司');
    output = output.replace(/(江苏省[^，。\n]+|广东省[^，。\n]+|浙江省[^，。\n]+|上海市[^，。\n]+)/g, '某地区地址');
    output = output.replace(/\b\d{4,}(?:\.\d+)?\b/g, '***金额***');
    return output;
  },

  stripMarkdownForDocument(text = '') {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, block => block.replace(/```/g, '').trim())
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
      .replace(/^[ \t]*>\s?/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^[ \t]*[-*][ \t]+/gm, '- ')
      .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
      .replace(/[ \t]{2,}\n/g, '\n')
      .replace(/[“”]/g, '"')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  extractSqlPayload(text = '') {
    const source = String(text || '').trim();
    const sqlMatch = source.match(/```sql\s*([\s\S]*?)```/i) || source.match(/```\s*([\s\S]*?)```/);
    const sql = this.stripMarkdownForDocument(sqlMatch?.[1] || source)
      .replace(/^\s*sql\s*/i, '')
      .trim();
    const explanation = sqlMatch
      ? this.stripMarkdownForDocument(source.replace(sqlMatch[0], '').trim())
      : '';
    return { sql, explanation };
  },

  dataMaskRun() {
    const ws = this.getWorkspace('datamask');
    if (!ws.prompt || !ws.prompt.trim()) throw new Error('请先粘贴需要脱敏的文本');
    ws.result = this.sanitizeText(ws.prompt);
    ws.updatedAt = Date.now();
    Store.save();
    this.toast('已完成本地脱敏');
    this.rerender();
  },

  dataMaskExport() {
    const ws = this.getWorkspace('datamask');
    if (!ws.result) throw new Error('暂无可导出的脱敏结果');
    Utils.textDownload(ws.result, `数据脱敏_${new Date().toISOString().slice(0, 10)}.txt`);
    this.toast('脱敏结果已导出');
  },

  dataMaskClear() {
    const ws = this.getWorkspace('datamask');
    ws.title = '';
    ws.prompt = '';
    ws.result = '';
    ws.files = [];
    ws.records = [];
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  geoNormalizeSource(text = '') {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/([A-Za-z])\s+([A-Za-z])/g, '$1 $2')
      .replace(/[，。；;：:]+/g, match => match)
      .trim();
  },

  geoBuildContent(ws, source = '') {
    const cleaned = this.geoNormalizeSource(source);
    const enterprise = (ws.enterpriseName || '某制造企业').trim();
    const industry = (ws.industry || '制造业').trim();
    const lines = cleaned.split('\n').map(line => line.trim()).filter(Boolean);
    const keywords = Array.from(new Set([
      enterprise,
      industry,
      ...lines.flatMap(line => line.split(/[\s,，、;；]+/).map(item => item.trim()).filter(Boolean))
    ])).filter(Boolean).slice(0, 18);
    const faq = [
      { q: `${enterprise} 主要做什么？`, a: `我们专注于 ${industry} 相关的产品、资料整理与交付支持。` },
      { q: `支持哪些产品或资料？`, a: '支持产品标签、采购单、发货单、设备信息、企业资料、服务介绍与知识内容整理。' },
      { q: '如何提升 AI 搜索理解？', a: '通过结构化标题、FAQ、关键词、JSON-LD、llms.txt、robots.txt 和 sitemap.xml 提升可读性。' },
      { q: '内容是否保证被收录？', a: '不保证；AI GEO 只能提升被 AI 理解和引用的概率。' }
    ];
    const enterpriseIntro = `${enterprise}是一家${industry}企业，围绕产品交付、资料整理、生产协同与客户服务提供可持续的内容支持。`;
    const productIntro = `产品/资料覆盖：${lines.slice(0, 4).join('；') || '发货单、采购单、产品标签、设备信息等'}`;
    const serviceIntro = '服务能力包括资料纠错、结构化整理、知识归档、AI 可读内容生成、搜索摘要与引用友好内容包装。';
    const summary = `${enterprise} 的 GEO 内容围绕企业简介、产品介绍、服务能力、FAQ、关键词和结构化数据构建，便于 AI 搜索引擎理解、引用与检索。`;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: enterprise,
      description: enterpriseIntro,
      keywords: keywords.join(', '),
      url: Store.state.settings.githubPagesUrl || window.location.origin || '',
      areaServed: industry,
      sameAs: [],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `${enterprise} 服务与产品`,
        itemListElement: lines.slice(0, 8).map((line, index) => ({
          '@type': 'Offer',
          position: index + 1,
          itemOffered: {
            '@type': 'Service',
            name: line.slice(0, 60) || `服务 ${index + 1}`,
            description: line.slice(0, 140) || enterpriseIntro
          }
        }))
      }
    };
    const llms = [
      `# ${enterprise}`,
      '',
      `> ${summary}`,
      '',
      '## 企业简介',
      enterpriseIntro,
      '',
      '## 产品介绍',
      productIntro,
      '',
      '## 服务能力',
      serviceIntro,
      '',
      '## FAQ',
      ...faq.flatMap(item => [`### ${item.q}`, item.a, '']),
      '## 关键词',
      keywords.join('、')
    ].join('\n');
    const robots = `User-agent: *\nAllow: /\nSitemap: ${Store.state.settings.githubPagesUrl || window.location.origin || ''}/sitemap.xml`;
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${Utils.escapeXml(Store.state.settings.githubPagesUrl || window.location.origin || '')}/geo-knowledge.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`;
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${Utils.escapeXml(enterprise)} GEO 知识库</title><meta name="description" content="${Utils.escapeXml(summary)}"><script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script></head><body><main style="max-width:900px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;line-height:1.7"><h1>${Utils.escapeXml(enterprise)} AI 可读知识库</h1><p>${Utils.escapeXml(summary)}</p><h2>企业简介</h2><p>${Utils.escapeXml(enterpriseIntro)}</p><h2>产品介绍</h2><p>${Utils.escapeXml(productIntro)}</p><h2>服务能力</h2><p>${Utils.escapeXml(serviceIntro)}</p><h2>FAQ</h2>${faq.map(item => `<section><h3>${Utils.escapeXml(item.q)}</h3><p>${Utils.escapeXml(item.a)}</p></section>`).join('')}<h2>关键词</h2><p>${Utils.escapeXml(keywords.join('、'))}</p></main></body></html>`;
    const score = {
      complete: Math.min(100, 55 + Math.min(lines.length * 5, 20) + (faq.length * 3)),
      clear: Math.min(100, 60 + (cleaned.length > 120 ? 15 : 0) + (cleaned.includes('：') || cleaned.includes(':') ? 10 : 0)),
      structured: Math.min(100, 58 + (lines.length > 3 ? 12 : 0) + 10),
      trust: Math.min(100, 62 + (cleaned.includes('公司') || cleaned.includes('企业') ? 10 : 0) + (cleaned.includes('地址') ? 8 : 0)),
      keywords: Math.min(100, 54 + Math.min(keywords.length * 2, 20)),
      faq: Math.min(100, 50 + faq.length * 10)
    };
    score.total = Math.round((score.complete + score.clear + score.structured + score.trust + score.keywords + score.faq) / 6);
    score.details = { summary: `已生成 ${faq.length} 条 FAQ、${keywords.length} 个关键词，并输出 JSON-LD / llms.txt / robots.txt / sitemap.xml。` };
    return {
      cleaned: [
        `企业名称：${enterprise}`,
        `行业领域：${industry}`,
        '',
        '整理后的核心内容：',
        cleaned || '暂无可整理内容'
      ].join('\n'),
      result: [
        `AI GEO 企业曝光系统`,
        `企业简介：${enterpriseIntro}`,
        `产品介绍：${productIntro}`,
        `服务能力：${serviceIntro}`,
        `AI 搜索摘要：${summary}`,
        `关键词标签：${keywords.join('、')}`,
        '',
        'FAQ 问答库：',
        ...faq.flatMap(item => [`Q：${item.q}`, `A：${item.a}`, '']),
        '结构化数据 JSON-LD：',
        JSON.stringify(schema, null, 2),
        '',
        'llms.txt：',
        llms,
        '',
        'robots.txt：',
        robots,
        '',
        'sitemap.xml：',
        sitemap
      ].join('\n'),
      preview: html,
      schema,
      llms,
      robots,
      sitemap,
      html,
      keywords,
      faq,
      score
    };
  },

  geoImportOcr() {
    const ws = this.getWorkspace('geo');
    const ocr = this.temp.ocr || {};
    const source = String(ocr.aiFix || ocr.result || '').trim();
    if (!source) {
      ws.result = '未检测到 OCR 结果，请先完成 OCR 识别后再导入。';
      ws.updatedAt = Date.now();
      Store.save();
      this.toast('没有可导入的 OCR 结果', 'error');
      this.rerender();
      return;
    }
    ws.source = source;
    ws.cleaned = this.geoBuildContent(ws, source).cleaned;
    ws.sourceFrom = 'ocr';
    ws.updatedAt = Date.now();
    Store.save();
    this.toast('已从 OCR 结果导入 GEO 内容');
    this.rerender();
  },

  async geoGenerate(btn) {
    const ws = this.getWorkspace('geo');
    const source = String(ws.cleaned || ws.source || '').trim();
    if (!source) throw new Error('请先导入 OCR 结果或输入企业资料');
    await this.busy(btn, async () => {
      const generated = this.geoBuildContent(ws, source);
      ws.cleaned = generated.cleaned;
      ws.result = generated.result;
      ws.preview = generated.preview;
      ws.schema = generated.schema;
      ws.llms = generated.llms;
      ws.robots = generated.robots;
      ws.sitemap = generated.sitemap;
      ws.html = generated.html;
      ws.score = generated.score;
      ws.files = [
        { name: 'geo-knowledge.html', type: 'HTML', content: generated.html },
        { name: 'llms.txt', type: 'TXT', content: generated.llms },
        { name: 'robots.txt', type: 'TXT', content: generated.robots },
        { name: 'sitemap.xml', type: 'XML', content: generated.sitemap },
        { name: 'schema.json', type: 'JSON', content: JSON.stringify(generated.schema, null, 2) }
      ];
      ws.sourceFrom = ws.sourceFrom || 'manual';
      ws.updatedAt = Date.now();
      Store.save();
      Store.addActivity(`生成 GEO 文件包：${ws.enterpriseName || '企业'}`, 'ai');
      this.toast('GEO 文件包已生成');
      this.rerender();
    });
  },

  async geoCopy(btn) {
    const ws = this.getWorkspace('geo');
    const text = ws.result || ws.cleaned || '';
    if (!text) throw new Error('暂无可复制的 GEO 方案');
    await this.busy(btn, async () => this.copy(text));
  },

  geoPreview() {
    const ws = this.getWorkspace('geo');
    if (!ws.preview) throw new Error('请先生成 GEO 文件包');
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) throw new Error('浏览器阻止了预览窗口');
    win.document.open();
    win.document.write(ws.preview);
    win.document.close();
    this.toast('已打开 AI 可读知识库预览');
  },

  async geoExportPackage(btn) {
    const ws = this.getWorkspace('geo');
    if (!ws.files?.length) throw new Error('请先生成 GEO 文件包');
    await this.busy(btn, async () => {
      if (!window.JSZip) throw new Error('JSZip 未加载，无法导出 GEO 文件包');
      const zip = new JSZip();
      ws.files.forEach(file => zip.file(file.name, file.content || ''));
      const blob = await zip.generateAsync({ type: 'blob' });
      Utils.download(blob, `${safeName(ws.enterpriseName || 'geo-knowledge')}_GEO文件包.zip`);
      this.toast('GEO 文件包已导出');
    });
  },

  getConnector(id) {
    return (Store.state.connectors || []).find(item => item.id === id);
  },

  connectorRequiredFields(type) {
    const map = {
      ERP: ['endpoint', 'systemName'],
      MES: ['endpoint', 'systemName'],
      WMS: ['endpoint', 'systemName'],
      SCADA: ['endpoint', 'systemName'],
      PLC: ['endpoint', 'protocol'],
      SAP: ['endpoint', 'systemName'],
      'SQL Server': ['host', 'port', 'database', 'username'],
      Oracle: ['host', 'port', 'database', 'username'],
      OA: ['endpoint', 'systemName'],
      CRM: ['endpoint', 'systemName'],
      'REST API': ['endpoint'],
      Webhook: ['endpoint'],
      MQTT: ['broker', 'port', 'topic'],
      'OPC UA': ['endpoint'],
      'Excel/CSV': ['filePath'],
      Robot: ['endpoint', 'robotName'],
      'Digital Twin': ['endpoint', 'platformName']
    };
    return map[type] || ['endpoint'];
  },

  connectorStatus(connector) {
    if (!connector) return '未配置';
    if (!connector.enabled) return '未配置';
    const required = this.connectorRequiredFields(connector.type);
    const config = connector.config || {};
    const hasAny = Object.values(config).some(value => String(value ?? '').trim());
    if (!hasAny) return '未配置';
    const missing = required.filter(key => !String(config[key] ?? '').trim());
    if (missing.length) return '配置不完整';
    return connector.status || '连接失败';
  },

  connectorSummary(connector) {
    const config = connector?.config || {};
    const required = this.connectorRequiredFields(connector?.type);
    const missing = required.filter(key => !String(config[key] ?? '').trim());
    if (!connector?.enabled) return '默认关闭，手动启用后再配置';
    if (!Object.values(config).some(value => String(value ?? '').trim())) return '未配置连接信息';
    if (missing.length) return `配置不完整：缺少 ${missing.join('、')}`;
    return '已保存配置，等待真实连接测试';
  },

  connectorLog(connector, message, level = 'info') {
    if (!connector) return;
    connector.logs = connector.logs || [];
    connector.logs.unshift({
      id: uid(),
      time: Date.now(),
      level,
      message
    });
    connector.logs = connector.logs.slice(0, 50);
    connector.updatedAt = Date.now();
    Store.save();
  },

  readConnectorForm(id) {
    const form = document.querySelector(`[data-connector-form="${id}"]`);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('[data-field]').forEach(input => {
      data[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value.trim();
    });
    return data;
  },

  integrationSave(btn) {
    const id = btn.dataset.id || this.temp.integrationSelectedId || document.querySelector('[data-connector-current]')?.dataset.connectorCurrent;
    const connector = this.getConnector(id);
    if (!connector) throw new Error('未找到连接器');
    const data = this.readConnectorForm(id);
    connector.config = {
      ...(connector.config || {}),
      ...data
    };
    connector.enabled = document.querySelector(`[data-connector-enabled="${id}"]`)?.checked ?? connector.enabled;
    connector.status = this.connectorStatus(connector);
    connector.updatedAt = Date.now();
    this.connectorLog(connector, `已保存 ${connector.type} 连接器配置`);
    Store.save();
    this.toast(`${connector.name} 配置已保存`);
    this.rerender();
  },

  integrationDelete(id) {
    const connector = this.getConnector(id);
    if (!connector) throw new Error('未找到连接器');
    connector.enabled = false;
    connector.config = {};
    connector.status = '未配置';
    connector.logs = [];
    connector.mappings = [];
    connector.updatedAt = Date.now();
    this.connectorLog(connector, '已删除配置并重置为未配置状态');
    Store.save();
    this.toast(`${connector.name} 已重置`);
    this.rerender();
  },

  integrationToggle(id) {
    const connector = this.getConnector(id);
    if (!connector) throw new Error('未找到连接器');
    connector.enabled = !connector.enabled;
    connector.status = this.connectorStatus(connector);
    this.connectorLog(connector, connector.enabled ? '已手动启用' : '已手动关闭');
    Store.save();
    this.rerender();
  },

  integrationRefresh() {
    Store.state.connectors = (Store.state.connectors || []).map(item => ({
      ...item,
      status: this.connectorStatus(item)
    }));
    Store.save();
    this.toast('连接器状态已刷新');
    this.rerender();
  },

  integrationShowLog(id) {
    const connector = this.getConnector(id);
    if (!connector) throw new Error('未找到连接器');
    const lines = (connector.logs || []).slice(0, 10).map(item => `[${Utils.formatDate(item.time, true)}] ${item.level.toUpperCase()} ${item.message}`);
    const content = lines.length ? lines.join('\n') : '暂无日志';
    this.modal({
      title: `${connector.name} 日志`,
      body: `<pre class="log-box">${Utils.escape(content)}</pre>`,
      actions: `<button class="primary-btn" data-action="modal-close">关闭</button>`
    });
  },

  integrationMapAdd(id) {
    const connector = this.getConnector(id);
    if (!connector) throw new Error('未找到连接器');
    connector.mappings = connector.mappings || [];
    connector.mappings.unshift({
      id: uid(),
      source: 'source_field',
      target: 'target_field',
      note: '字段映射占位，等待企业接口确认'
    });
    connector.mappings = connector.mappings.slice(0, 20);
    connector.updatedAt = Date.now();
    this.connectorLog(connector, '已新增字段映射占位');
    Store.save();
    this.rerender();
  },

  async integrationTest(id, btn) {
    const connector = this.getConnector(id);
    if (!connector) throw new Error('未找到连接器');
    const status = this.connectorStatus(connector);
    connector.updatedAt = Date.now();
    if (!connector.enabled) {
      connector.status = '未配置';
      this.connectorLog(connector, '测试连接：未启用');
      Store.save();
      this.toast('未配置');
      this.rerender();
      return;
    }
    const required = this.connectorRequiredFields(connector.type);
    const config = connector.config || {};
    const missing = required.filter(key => !String(config[key] ?? '').trim());
    if (!Object.values(config).some(value => String(value ?? '').trim())) {
      connector.status = '未配置';
      this.connectorLog(connector, '测试连接：未配置');
      Store.save();
      this.toast('未配置');
      this.rerender();
      return;
    }
    if (missing.length) {
      connector.status = '配置不完整';
      this.connectorLog(connector, `测试连接：配置不完整，缺少 ${missing.join('、')}`, 'warn');
      Store.save();
      this.toast('配置不完整');
      this.rerender();
      return;
    }
    const browserReachable = ['REST API', 'Webhook'].includes(connector.type) && /^https?:\/\//i.test(config.endpoint || '');
    if (browserReachable) {
      try {
        await this.busy(btn, async () => {
          const res = await fetch(config.endpoint, { method: 'GET', mode: 'cors' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          connector.status = '已连接';
          this.connectorLog(connector, '测试连接成功，接口可访问');
          Store.save();
          this.toast('已连接');
        });
      } catch (error) {
        connector.status = '连接失败';
        this.connectorLog(connector, `测试连接失败：${error.message}`, 'error');
        Store.save();
        this.toast('连接失败', 'error');
      } finally {
        this.rerender();
      }
      return;
    }
    connector.status = '连接失败';
    this.connectorLog(connector, `${connector.type} 连接器当前仅预留接口，尚未接入真实企业系统`, 'warn');
    Store.save();
    this.toast('连接失败', 'error');
    this.rerender();
  },

  aiHistoryExport() {
    const items = Store.state.aiHistory || [];
    if (!items.length) throw new Error('暂无 AI 调用历史');
    const text = items.slice(0, 20).map(item => [
      `时间：${Utils.formatDate(item.time, true)}`,
      `模块：${item.module || '-'}`,
      `Provider：${item.provider || '-'}`,
      `Model：${item.model || '-'}`,
      `是否成功：${item.success ? '是' : '否'}`,
      `是否 Mock：${item.mock ? '是' : '否'}`,
      `请求耗时：${item.duration || 0} ms`,
      `Prompt Tokens：${item.promptTokens ?? item.inputTokens ?? '未返回'}`,
      `Completion Tokens：${item.completionTokens ?? item.outputTokens ?? '未返回'}`,
      `错误原因：${item.error || '无'}`,
      `Raw Error：${item.rawError || '无'}`,
      `Token 用量：${item.totalTokens ?? '未返回'}`,
      '---'
    ].join('\n')).join('\n');
    Utils.textDownload(text, `AI调用历史_${new Date().toISOString().slice(0, 10)}.txt`);
    this.toast('AI 调用历史已导出');
  },

  aiHistoryClear() {
    if (!confirm('确定清空 AI 调用历史？')) return;
    Store.state.aiHistory = [];
    Store.save();
    this.rerender();
  },

  recordAiError(error, context = '') {
    if (/^ocr-(summary|translate|qa|ai-fix|ai-table|table-restore)$/i.test(context || '') && this.shouldUseOcrMockAi()) {
      return AIService.friendlyMessage(error) || Utils.friendlyErrorMessage(error?.message || error);
    }
    const message = AIService.friendlyMessage(error) || Utils.friendlyErrorMessage(error?.message || error);
    Store.state.aiErrors = Store.state.aiErrors || [];
    const signature = this.bugAlertSignature({ module: context || 'AI', feature: 'AI 调用', type: 'AI错误', message });
    Store.state.aiErrors.unshift({
      id: uid(),
      message,
      detail: String(error?.message || error || ''),
      context,
      requestId: error?.requestId || '',
      rawError: String(error?.rawError || error?.message || error || ''),
      signature,
      time: Date.now()
    });
    Store.state.aiErrors = Store.state.aiErrors.slice(0, 50);
    Store.state.errorLog = Array.isArray(Store.state.errorLog) ? Store.state.errorLog : [];
    Store.state.errorLog.unshift({
      id: uid(),
      time: Date.now(),
      module: context || 'AI',
      feature: context,
      message,
      requestId: error?.requestId || '',
      suggestion: this.suggestFix(error),
      rawError: String(error?.rawError || error?.message || error || ''),
      signature
    });
    Store.state.errorLog = Store.state.errorLog.slice(0, 100);
    syncGlobalSystemState({ errorLog: Store.state.errorLog });
    emit('error:created', {
      module: context || 'AI',
      feature: 'AI 调用',
      type: 'AI错误',
      message,
      description: String(error?.message || error || ''),
      suggestion: this.suggestFix(error),
      requestId: error?.requestId || '',
      source: 'ai-error',
      time: Date.now()
    });
    this.reportBug({
      module: context || 'AI',
      feature: 'AI 调用',
      type: 'AI错误',
      message,
      description: String(error?.message || error || ''),
      suggestion: this.suggestFix(error),
      requestId: error?.requestId || '',
      source: 'ai-error'
    });
    Store.addActivity(`AI错误：${context || '未知任务'}`, 'error');
    Store.save();
    return message;
  },

  recordTask(entry = {}) {
    if (!entry.type && !entry.fileName && !entry.summary) return;
    Store.addTaskRecord(entry);
    this.updateStabilityHealthSnapshot('task-recorded');
    Store.addActivity(`任务：${entry.type || entry.fileName || '处理任务'}`, 'file');
  },

  upsertStabilityTask(entry = {}) {
    const normalized = Stability.normalizeTask(entry);
    Store.state.taskRecords = Store.state.taskRecords || [];
    const index = Store.state.taskRecords.findIndex(item => item.id === normalized.id);
    if (index >= 0) Store.state.taskRecords[index] = { ...Store.state.taskRecords[index], ...normalized };
    else Store.state.taskRecords.unshift(normalized);
    Store.state.taskRecords = Store.state.taskRecords.slice(0, 200);
    this.updateStabilityHealthSnapshot(entry.source || 'stability-task');
    Store.save();
    return normalized;
  },

  async runWithStability(kind, task, work) {
    if (!Stability.canStart(kind)) {
      const error = new Error(`${kind} concurrency limit reached`);
      error.code = 'CONCURRENCY_LIMIT';
      throw error;
    }
    const startedAt = Date.now();
    const taskId = task.id || uid();
    const retryCount = Number(task.retryCount || 0);
    Stability.start(kind);
    this.upsertStabilityTask({
      ...task,
      id: taskId,
      status: retryCount ? 'retrying' : 'running',
      startedAt,
      updatedAt: startedAt,
      retryCount,
      cancellable: true,
      retryable: false,
      source: `${kind}-started`
    });
    const timeout = Stability.timeoutPromise(kind);
    try {
      const result = await Promise.race([Promise.resolve(work({ taskId, startedAt, timeoutMs: timeout.timeoutMs })), timeout.promise]);
      const finishedAt = Date.now();
      this.upsertStabilityTask({
        ...task,
        id: taskId,
        status: 'success',
        startedAt,
        updatedAt: finishedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        retryCount,
        summary: task.summary || `${kind} completed`,
        result: task.result || '',
        cancellable: false,
        retryable: false,
        source: `${kind}-success`
      });
      return result;
    } catch (error) {
      const finishedAt = Date.now();
      const status = error?.status === 'timeout' || error?.code === 'TIMEOUT'
        ? 'timeout'
        : error?.code === 'CANCELLED'
          ? 'cancelled'
          : error?.code === 'INTERRUPTED'
            ? 'interrupted'
            : 'failed';
      this.upsertStabilityTask({
        ...task,
        id: taskId,
        status,
        startedAt,
        updatedAt: finishedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        retryCount,
        errorMessage: Utils.friendlyErrorMessage(error?.message || error),
        failureType: Stability.classifyFailure(error?.message || error),
        cancellable: false,
        retryable: true,
        source: `${kind}-${status}`
      });
      throw error;
    } finally {
      timeout.clear();
      Stability.finish(kind);
    }
  },

  updateStabilityHealthSnapshot(source = 'frontend') {
    const tasks = (Store.state.taskRecords || []).map(item => Stability.normalizeTask(item));
    const errors = this.getVisibleBugAlerts ? this.getVisibleBugAlerts() : (Store.state.bugAlerts || []).map(item => Stability.normalizeError(item));
    const activeTasks = tasks.filter(item => ['pending', 'running', 'waiting_human'].includes(item.status));
    const failedTasks = tasks.filter(item => ['failed', 'timeout', 'interrupted'].includes(item.status));
    const activeErrors = errors.filter(item => item.lifecycle === 'active');
    const checks = [
      {
        name: 'Task Center',
        category: 'stability',
        state: failedTasks.length ? 'failed' : activeTasks.length ? 'running' : 'success',
        status: failedTasks.length ? '🟡 存在失败任务' : activeTasks.length ? '🟡 有任务处理中' : '🟢 正常',
        reason: `任务 ${tasks.length} 个，处理中 ${activeTasks.length} 个，失败/超时/中断 ${failedTasks.length} 个。`,
        suggestion: failedTasks.length ? '打开 Task Center 查看失败原因，必要时重试或取消。' : '任务状态结构正常。'
      },
      {
        name: 'Error Center',
        category: 'stability',
        state: activeErrors.length ? 'failed' : 'success',
        status: activeErrors.length ? '🟡 待处理' : '🟢 正常',
        reason: `错误 ${errors.length} 条，待处理 ${activeErrors.length} 条。`,
        suggestion: activeErrors.length ? '查看 Error Center，确认修复或忽略非阻塞问题。' : '暂无待处理错误。'
      },
      {
        name: 'Stability Center',
        category: 'stability',
        state: 'success',
        status: '🟢 已统一',
        reason: '任务、错误、健康状态已使用统一 schemaVersion=1。',
        suggestion: '后续阶段再接入 AI/OCR/Workflow/Agent/Tool 外围状态。'
      }
    ];
    Store.state.taskRecords = tasks;
    Store.state.bugAlerts = errors;
    Store.state.errorLog = (Store.state.errorLog || []).map(item => Stability.normalizeError(item));
    Store.state.systemHealth = Stability.buildHealthSnapshot({
      checks,
      tasks,
      errors,
      source,
      gateway: Store.state.aiGatewayStatus
    });
    Store.state.runtimeMonitor = Store.state.runtimeMonitor || {};
    Store.state.runtimeMonitor.healthChecks = Store.state.systemHealth.checks;
    Store.state.runtimeMonitor.lastSelfCheckAt = Store.state.systemHealth.updatedAt;
    Store.state.runtimeMonitor.lastSelfCheckSource = source;
    Store.state.runtimeMonitor.lastSelfCheckSummary = Store.state.systemHealth.summary;
    syncGlobalSystemState({
      systemHealth: Store.state.systemHealth,
      errorLog: Store.state.errorLog,
      aiGateway: Store.state.aiGatewayStatus
    });
  },

  recordDownload(entry = {}) {
    if (!entry.filename) return;
    const recordId = entry.id || uid();
    if (entry.blob) {
      this.temp.downloadCache = this.temp.downloadCache || {};
      this.temp.downloadCache[recordId] = entry.blob;
    }
    Store.addDownloadRecord({ ...entry, id: recordId });
    Store.addActivity(`下载：${entry.filename}`, 'file');
  },

  recordSystemError(error, context = '', module = 'system') {
    const message = Utils.friendlyErrorMessage(error?.message || error);
    const signature = this.bugAlertSignature({ module, feature: context, type: '系统错误', message });
    Store.state.aiErrors = Store.state.aiErrors || [];
    Store.state.aiErrors.unshift({
      id: uid(),
      message,
      detail: String(error?.message || error || ''),
      context,
      requestId: error?.requestId || '',
      rawError: String(error?.rawError || error?.message || error || ''),
      module,
      severity: /PDF|OCR|fetch|AI/i.test(String(error?.message || error)) ? '中' : '高',
      fixed: false,
      signature,
      suggestion: this.suggestFix(error),
      time: Date.now()
    });
    Store.state.aiErrors = Store.state.aiErrors.slice(0, 50);
    Store.state.errorLog = Array.isArray(Store.state.errorLog) ? Store.state.errorLog : [];
    Store.state.errorLog.unshift({
      id: uid(),
      time: Date.now(),
      module: module || 'system',
      feature: context,
      message,
      requestId: error?.requestId || '',
      suggestion: this.suggestFix(error),
      rawError: String(error?.rawError || error?.message || error || ''),
      signature
    });
    Store.state.errorLog = Store.state.errorLog.slice(0, 100);
    syncGlobalSystemState({ errorLog: Store.state.errorLog });
    emit('error:created', {
      module: module || 'system',
      feature: context,
      type: '系统错误',
      message,
      description: String(error?.message || error || ''),
      suggestion: this.suggestFix(error),
      requestId: error?.requestId || '',
      source: 'system-error',
      time: Date.now()
    });
    this.reportBug({
      module,
      feature: context,
      type: '系统错误',
      message,
      description: String(error?.message || error || ''),
      suggestion: this.suggestFix(error),
      requestId: error?.requestId || '',
      source: 'system-error'
    });
    Store.addActivity(`系统错误：${context || module}`, 'error');
    Store.save();
    return message;
  },

  suggestFix(error) {
    const text = String(error?.message || error || '');
    if (/PDF/i.test(text)) return '请尝试 OCR 或更清晰的 PDF 文件。';
    if (/OCR/i.test(text)) return '请上传清晰图片，或改用 PDF/Excel 原文件。';
    if (/fetch|Network|连接/i.test(text)) return '请检查网络、本地服务或 AI Gateway 配置。';
    if (/Response|读取/i.test(text)) return '刷新页面后重试，并避免重复读取同一响应。';
    return '请查看日志并重试，如仍失败请切换 Mock 模式。';
  },

  async oneClickSelfCheck() {
    await this.runSystemCheck();
    this.toast('自检已完成');
    this.navigate('systemcheck');
  },

  async refreshAiStatus() {
    try {
      const health = await APIClient.health();
      if (!health?.deepseekConfigured) {
        Store.state.aiServerStatus = { provider: health?.provider || 'deepseek', model: health?.model || 'deepseek-v4-flash', mode: 'disabled', enabled: false, healthy: false, backendOnline: true, message: 'AI 服务暂未配置' };
        Store.state.aiServerUsage = null;
        Store.save();
        this.rerender();
        return;
      }
      const [config, usage] = await Promise.all([
        APIClient.request('/api/ai/config-safe'),
        APIClient.request('/api/ai/usage')
      ]);
      Store.state.aiServerStatus = config.data || {};
      Store.state.aiServerUsage = usage.data || {};
      Store.save();
      this.rerender();
    } catch (error) {
      Store.state.aiServerStatus = { provider: 'deepseek', mode: 'degraded', enabled: false, healthy: false, backendOnline: false, message: Utils.friendlyErrorMessage(error?.message || error) };
      Store.save();
      this.rerender();
    }
  },

  retryLastAiAction() {
    if (this.route === 'chat') return this.sendChat();
    if (this.route === 'assistant') return this.assistantRun();
    if (this.route === 'rlcenter') return this.rlRun();
    if (this.route === 'systemcheck') return this.runSystemCheck();
    if (this.route === 'aistatus') return this.rerender();
    this.toast('请在对应模块中重新执行最近一次 AI 操作');
  },

  switchAiModel() {
    const models = ['deepseek-v4-flash', 'deepseek-v4-pro', 'qwen-plus', 'gpt-4o-mini'];
    const current = Store.state.settings.model || models[0];
    const next = models[(models.indexOf(current) + 1) % models.length];
    Store.state.settings.model = next;
    Store.save();
    this.toast(`已切换模型：${next}`);
    this.rerender();
  },

  async runSystemCheck() {
    const ws = this.getWorkspace('systemcheck');
    const apiUrl = Store.state.settings.apiUrl;
    const displayMode = Utils.isGitHubPagesHost() && !(apiUrl && Store.state.settings.apiEnabled);
    const now = Date.now();
    const report = [];
    const push = (name, status, reason, suggestion) => {
      report.push({ name, status, reason: reason || '', suggestion: suggestion || '', time: now });
    };
    const normalizedBugAlerts = this.getVisibleBugAlerts();
    const unresolvedErrors = normalizedBugAlerts.filter(item => (item.lifecycle || this.bugAlertLifecycle(item)) === 'active');
    const latestFix = (Store.state.repairRecords || []).length
      ? Store.state.repairRecords[0]
      : normalizedBugAlerts.filter(item => (item.lifecycle || this.bugAlertLifecycle(item)) === 'resolved').sort((a, b) => (b.confirmedAt || b.fixedAt || b.lastAt || b.time || 0) - (a.confirmedAt || a.fixedAt || a.lastAt || a.time || 0))[0] || null;
    const hasRecentChatFetchError = unresolvedErrors.some(item => /ai-chat|chat/i.test(`${item.feature || ''} ${item.module || ''}`) && /Failed to fetch|Network Error|AI 后端连接失败|Timeout/i.test(`${item.message || ''} ${item.description || ''}`));
    const hasRecentPdfError = unresolvedErrors.some(item => /PDF Worker|pdf/i.test(`${item.feature || ''} ${item.module || ''}`) && /Failed to fetch|worker|路径|加载失败|PDF/i.test(`${item.message || ''} ${item.description || ''}`));
    const localStorageOk = (() => {
      try {
        const key = `__eaos_health_${now}`;
        localStorage.setItem(key, '1');
        const ok = localStorage.getItem(key) === '1';
        localStorage.removeItem(key);
        return ok;
      } catch {
        return false;
      }
    })();
    const pdfWorkerReady = Boolean(globalThis.PDFLib?.GlobalWorkerOptions?.workerSrc);
    const ocrHealth = typeof OCRService?.health === 'function' ? OCRService.health() : {};
    const excelProbe = (() => {
      try {
        const sample = [
          ['序号', '产品编码', '产品名称', '规格型号', '单位', '发货数量', '单价', '金额'],
          ['1', 'A001', '测试件', 'M1', '件', '2', '10', '20']
        ];
        const extracted = ExcelBusiness.extract(sample);
        return extracted.detailRows.length === 1 && ExcelBusiness.toObjects(extracted).length === 1;
      } catch {
        return false;
      }
    })();
    let backendOk = false;
    let apiHealth = null;
    let serverSelfTest = null;
    let gatewayStatus = '⚪ 未配置';
    let gatewayReason = '未配置后端地址或未启用远程 AI。';
    let gatewaySuggestion = '请在 AI 设置中心配置 API Base URL 并开启远程 AI。';
    let deepseekStatus = '⚪ 未配置';
    let deepseekReason = gatewayReason;
    let deepseekSuggestion = gatewaySuggestion;
    let backendStatus = displayMode ? '🟡 展示模式 / 后端不可用' : '⚪ 未配置';
    let backendReason = displayMode ? '当前运行在 GitHub Pages 展示模式，后端不可用。' : '未配置后端地址。';
    let backendSuggestion = displayMode ? '部署真实后端后再切换到生产模式。' : '请先配置后端地址。';

    if (displayMode) {
      gatewayStatus = '⚪ disabled';
      gatewayReason = 'GitHub Pages 静态安全模式不直接调用 DeepSeek。';
      gatewaySuggestion = '如需真实 AI，请部署后端。';
      deepseekStatus = '🟡 未连接';
      deepseekReason = 'GitHub Pages 展示模式不连接 DeepSeek。';
      deepseekSuggestion = '部署后端并配置 DeepSeek Key。';
    } else if (apiUrl && Store.state.settings.apiEnabled) {
      try {
        [apiHealth, serverSelfTest] = await Promise.all([
          APIClient.health(apiUrl),
          APIClient.systemStatus(apiUrl)
        ]);
        backendOk = Boolean(apiHealth?.ok);
        backendStatus = backendOk ? '🟢 正常' : '🔴 异常';
        backendReason = backendOk ? 'GET /api/health 返回正常。' : 'GET /api/health 返回异常。';
        backendSuggestion = backendOk ? '后端可达。' : '请检查后端服务与健康检查接口。';
      } catch (error) {
        backendStatus = '🔴 异常';
        backendReason = Utils.friendlyErrorMessage(error?.message || error);
        backendSuggestion = '请检查网络、后端地址或服务状态。';
      }
      if (backendOk) {
        if (apiHealth?.deepseekConfigured) {
          try {
            const configSafe = await APIClient.request('/api/ai/config-safe', {}, { baseUrl: apiUrl, timeout: 8000 });
            const gateway = configSafe?.data || configSafe || {};
            const healthy = gateway.enabled && gateway.healthy && gateway.circuit?.state !== 'open';
            gatewayStatus = healthy ? '🟢 已配置 / 待调用验证' : '🟡 降级或受限';
            gatewayReason = healthy ? '已通过安全状态接口验证网关配置；未发送测试提示词，不产生模型调用费用。' : (gateway.reason || 'AI Gateway 当前不可用或受限。');
            gatewaySuggestion = healthy ? '真实调用将在用户提交任务时按预算与权限执行。' : '请检查模型配置、预算或熔断状态。';
            deepseekStatus = healthy ? '🟢 已配置' : '🟡 未就绪';
            deepseekReason = healthy ? 'DeepSeek Key 仅保存在服务端；本检查未执行真实模型请求。' : gatewayReason;
            deepseekSuggestion = gatewaySuggestion;
          } catch (error) {
            const friendly = AIService.friendlyMessage(error);
            gatewayStatus = '🔴 真实错误';
            gatewayReason = friendly;
            gatewaySuggestion = '请检查 DeepSeek Key、模型名称、Base URL 或网络。';
            deepseekStatus = '🔴 未连接';
            deepseekReason = friendly;
            deepseekSuggestion = gatewaySuggestion;
          }
        } else {
          gatewayStatus = '⚪ 未配置';
          gatewayReason = 'AI 服务暂未配置。';
          gatewaySuggestion = '请在后端环境变量中配置 DEEPSEEK_API_KEY。';
          deepseekStatus = '⚪ 未配置';
          deepseekReason = gatewayReason;
          deepseekSuggestion = gatewaySuggestion;
        }
      }
    }

    if (displayMode) {
      backendReason = '当前运行在 GitHub Pages 展示模式，后端不可用。';
      gatewayStatus = '⚪ disabled';
      gatewayReason = 'GitHub Pages 未配置独立服务端网关，真实 AI 已禁用。';
      deepseekStatus = '🟡 未连接';
      deepseekReason = '展示模式不连接 DeepSeek。';
    }

    if (hasRecentChatFetchError) {
      if (displayMode) {
        gatewayStatus = '🟡 展示模式历史提示';
        gatewayReason = '检测到 ai-chat Failed to fetch 历史记录，但当前为 GitHub Pages 展示模式，不作为 STEP 5 阻塞。';
        gatewaySuggestion = '如需真实 AI，请部署后端后再进行在线验证。';
      } else {
        gatewayStatus = '🟡 近期存在网络错误';
        gatewayReason = '存在未确认的 ai-chat Failed to fetch / 网络错误记录，需先排查后端连通性。';
        gatewaySuggestion = '请先查看 Error Center 并确认最近网络错误已修复。';
      }
    }
    if (hasRecentPdfError) {
      if (displayMode) {
        backendStatus = '🟡 展示模式历史提示';
        backendReason = '检测到 PDF Worker 历史失败记录，但当前为 GitHub Pages 展示模式，不作为 STEP 5 阻塞。';
        backendSuggestion = '如需真实 PDF Worker，请在后端版本继续排查。';
      } else {
        backendStatus = '🟡 降级可用';
        backendReason = '存在未确认的 PDF Worker 失败记录，文件处理不能视为绿色。';
        backendSuggestion = '请先排查 PDF Worker / 路径问题并确认最近错误已修复。';
      }
    }

    const pushState = [
      ['登录', AuthClient.isLoggedIn() ? '🟢 正常' : '🔴 异常', AuthClient.isLoggedIn() ? '已登录。' : '请先登录。', AuthClient.isLoggedIn() ? '保持当前登录状态。' : '请使用演示账号或正式账号登录。'],
      ['GitHub Pages / Server Mode', displayMode ? '🟡 展示模式' : '🟢 正常', displayMode ? '当前运行在 GitHub Pages 展示模式。' : '当前处于本地/服务器模式。', displayMode ? '展示模式下不请求后端。' : '可继续进行真实 AI 调用。'],
      ['后端状态', backendStatus, backendReason, backendSuggestion],
      ['服务端数据库', serverSelfTest ? (serverSelfTest.databaseOk ? '🟢 正常' : '🔴 异常') : '🟡 未连接', serverSelfTest ? (serverSelfTest.databaseOk ? '服务端 SQLite 自检通过。' : '服务端数据库自检失败。') : '未获取服务端自检结果。', serverSelfTest?.databaseOk ? '持久化服务可用。' : '请检查私有网关连接与服务端状态。'],
      ['服务端工具与 Agent', serverSelfTest ? (serverSelfTest.toolRegistryOk && serverSelfTest.agentRuntimeOk ? '🟢 正常' : '🔴 异常') : '🟡 未连接', serverSelfTest ? `Tool Registry ${serverSelfTest.toolRegistryOk ? '正常' : '异常'}；Agent Runtime ${serverSelfTest.agentRuntimeOk ? '正常' : '异常'}。` : '未获取服务端自检结果。', serverSelfTest?.toolRegistryOk && serverSelfTest?.agentRuntimeOk ? '服务端基础能力可用。' : '请检查服务端自检。'],
      ['AI Gateway', gatewayStatus, gatewayReason, gatewaySuggestion],
      ['DeepSeek', deepseekStatus, deepseekReason, deepseekSuggestion],
      ['PDF Worker', displayMode ? '🟡 仅前端能力可用' : (pdfWorkerReady ? '🟢 正常' : '🔴 异常'), displayMode ? 'GitHub Pages 仅提供前端能力。' : (pdfWorkerReady ? 'PDF Worker 已就绪。' : 'PDF Worker 未加载或路径错误。'), displayMode ? '部署后端版本后可启用更完整能力。' : '请检查 vendor/pdfjs/pdf.worker.mjs 路径。'],
      ['OCR', displayMode ? '🟡 仅前端能力可用' : (ocrHealth.hasTesseract ? '🟢 正常' : '🔴 异常'), displayMode ? 'GitHub Pages 仅提供前端能力。' : (ocrHealth.hasTesseract ? `引擎状态：${ocrHealth.engineState || 'unknown'}` : 'OCR 引擎未加载。'), displayMode ? '如需真实后端可在部署版中扩展。' : '请检查 Tesseract 依赖是否可用。'],
      ['Excel', displayMode ? '🟡 仅前端能力可用' : (excelProbe ? '🟢 正常' : '🔴 异常'), displayMode ? 'GitHub Pages 仅提供前端能力。' : (excelProbe ? 'Excel 解析规则通过样例验证。' : 'Excel 解析样例未通过。'), displayMode ? '部署本地/服务器版后继续使用真实文件。' : '请检查 Excel 解析逻辑。'],
      ['localStorage', localStorageOk ? '🟢 正常' : '🔴 异常', localStorageOk ? '读写正常。' : '本地存储读写失败。', localStorageOk ? '可继续保存本地数据。' : '请检查浏览器隐私设置。'],
      ['Connector 状态', Array.isArray(Store.state.connectors) ? (Store.state.connectors.some(item => item.status === '已连接') ? '🟢 已连接' : Store.state.connectors.every(item => item.status === '未配置' || !item.enabled) ? '⚪ 未配置' : Store.state.connectors.some(item => item.status === '连接失败') ? '🔴 连接失败' : '🟡 待验证') : '🔴 异常', Array.isArray(Store.state.connectors) ? `未配置 ${Store.state.connectors.filter(item => item.status === '未配置' || !item.enabled).length} 个；已连接 ${Store.state.connectors.filter(item => item.status === '已连接').length} 个；连接失败 ${Store.state.connectors.filter(item => item.status === '连接失败').length} 个。` : '连接器数据缺失。', '请在 Integration Center 中按真实配置逐个启用。'],
      ['Bug Monitor', unresolvedErrors.length ? '🟡 待确认' : '🟢 正常', `${normalizedBugAlerts.length} 条聚合错误，${normalizedBugAlerts.filter(item => (item.lifecycle || this.bugAlertLifecycle(item)) === 'ignored').length} 条已忽略，${normalizedBugAlerts.filter(item => (item.lifecycle || this.bugAlertLifecycle(item)) === 'resolved').length} 条已修复。`, '重复错误会自动合并，忽略项不再影响健康状态。'],
      ['Error Center', unresolvedErrors.length ? '🟡 待处理' : '🟢 正常', `${unresolvedErrors.length} 条待处理错误，${Store.state.repairRecords?.length || 0} 条最近修复。`, '保留历史错误并持续追踪。'],
      ['最近错误', unresolvedErrors.length ? `${unresolvedErrors[0].message || '错误'}` : '暂无', unresolvedErrors.length ? `来源：${unresolvedErrors[0].context || unresolvedErrors[0].module || 'system'}` : '暂无最近错误记录。', unresolvedErrors.length ? '查看 Error Center 并确认修复。' : '暂无需要处理的问题。'],
      ['最近修复', latestFix ? `${latestFix.module || 'system'} · ${latestFix.feature || latestFix.type || '已确认修复'}` : '暂无已确认修复记录', latestFix ? `${latestFix.message || latestFix.description || ''}` : '暂无用户点击“确认修复”的记录。', latestFix ? '可在 Bug Monitor 查看确认修复记录。' : '点击 Bug Monitor 的“确认修复”后会出现在这里。'],
      ['Agent 任务总数', String((Store.state.runtimeMonitor?.totalTasks || 0)), `成功 ${(Store.state.runtimeMonitor?.successTasks || 0)} / 失败 ${(Store.state.runtimeMonitor?.failedTasks || 0)} / 超时 ${(Store.state.runtimeMonitor?.timeoutTasks || 0)}`, '继续执行 Agent Runtime 任务会自动更新。'],
      ['成功任务数', String((Store.state.runtimeMonitor?.successTasks || 0)), '来自任务队列统计。', '继续执行任务后会自动刷新。'],
      ['失败任务数', String((Store.state.runtimeMonitor?.failedTasks || 0)), '来自任务队列统计。', '失败任务会写入日志与 Error Center。'],
      ['超时任务数', String((Store.state.runtimeMonitor?.timeoutTasks || 0)), '来自任务队列统计。', '可根据超时原因调整任务或工具。'],
      ['等待审批任务数', String((Store.state.runtimeMonitor?.waitingHumanTasks || 0)), '来自 Human Approval 统计。', '审批后状态会继续流转。'],
      ['工具调用总数', String((Store.state.runtimeMonitor?.toolCallCount || 0)), '来自 Tool Center 统计。', '继续调用工具会自动增加。']
    ];
    Store.state.runtimeMonitor = Store.state.runtimeMonitor || {};
    const healthChecks = pushState.map(([name, status, reason, suggestion]) => ({ name, status, reason, suggestion, time: now }));
    Store.state.runtimeMonitor.healthChecks = healthChecks;
    Store.state.systemHealth = {
      checks: healthChecks,
      summary: healthChecks.map(item => `${item.name}：${item.status}`).join(' | '),
      updatedAt: now,
      source: displayMode ? 'GitHub Pages' : (apiUrl ? '本地/服务器' : '未配置'),
      gateway: Store.state.aiGatewayStatus,
      errors: normalizedBugAlerts.slice(0, 20)
    };
    Store.state.runtimeMonitor.lastSelfCheckAt = now;
    Store.state.runtimeMonitor.lastSelfCheckSource = displayMode ? 'GitHub Pages' : (apiUrl ? '本地/服务器' : '未配置');
    Store.state.runtimeMonitor.lastSelfCheckSummary = healthChecks.map(item => `${item.name}：${item.status}`).join(' | ');
    Store.state.aiGatewayStatus = {
      state: gatewayStatus.includes('🟢') ? 'online' : gatewayStatus.includes('🟡') ? 'mock' : gatewayStatus.includes('🔴') ? 'error' : 'unknown',
      message: gatewayReason,
      provider: displayMode ? 'mock' : (Store.state.settings.provider || 'OpenAI-compatible'),
      model: Store.state.settings.model || 'deepseek-v4-flash',
      updatedAt: now
    };
    Store.state.aiGateway = Store.state.aiGatewayStatus;
    if (typeof globalThis !== 'undefined') {
      syncGlobalSystemState({
        aiGateway: Store.state.aiGatewayStatus,
        systemHealth: Store.state.systemHealth,
        errorLog: Store.state.errorLog,
        ocrResult: Store.state.ocrResult,
        aiResult: Store.state.aiResult,
        runtime: window.runtime
      });
    }
    ws.result = Store.state.runtimeMonitor.healthChecks.map(item => `${item.name}｜${item.status}｜${item.reason || '无'}｜${item.suggestion || '无'}｜${Utils.formatDate(item.time, true)}`).join('\n');
    ws.checkedAt = now;
    Store.save();
    this.rerender();
  },

  async sendChat() {
    if (this.temp.chatSending) {
      this.toast('AI 正在生成回复，请勿重复发送。', 'warning');
      return;
    }
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    if (!text) {
      this.toast('请输入问题后再发送。', 'warning');
      return;
    }
    this.temp.chatSending = true;
    this.chatAutoScrollUntil = Date.now() + 3000;
    let chat = Store.state.chats.find(c => c.id === Store.state.activeChatId) || this.createChat(false);
    const fileContext = (chat.files || []).map(item => `文件：${item.name}\n${item.content.slice(0, 2000)}`).join('\n\n');
    const history = chat.messages.slice(-8).map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n');
    const commandHint = text.startsWith('/') ? `快捷命令：${text}\n` : '';
    chat.messages.push({ role: 'user', content: text, time: Date.now() });
    const loadingId = uid();
    const stabilityTaskId = uid();
    const startedAt = Date.now();
    const retryCount = Number(this.temp.chatRetryCount || 0);
    this.upsertStabilityTask({
      id: stabilityTaskId,
      type: 'AI Chat',
      module: 'chat',
      status: retryCount ? 'retrying' : 'running',
      summary: text.slice(0, 120),
      startedAt,
      retryCount,
      cancellable: true,
      retryable: false,
      source: 'ai-chat'
    });
    chat.messages.push({ id: loadingId, role: 'assistant', content: '正在处理...', time: Date.now(), mode: 'loading' });
    if (chat.title === '新对话') chat.title = text.slice(0, 24);
    chat.updatedAt = Date.now();
    Store.save();
    this.rerender();
    try {
      const demo = this.chatBuildDemoReply(`${text}${fileContext ? `\n${fileContext.slice(0, 800)}` : ''}`, chat);
      const prompt = `${commandHint}${fileContext ? `相关文件：\n${fileContext}\n\n` : ''}${history ? `历史上下文：\n${history}\n\n` : ''}当前问题：${text}`;
      const loadingMessage = chat.messages.find(item => item.id === loadingId);
      if (loadingMessage) {
        loadingMessage.content = '正在生成中...';
        loadingMessage.mode = 'streaming';
        loadingMessage.streaming = true;
      }
      Store.logAiHistory({
        module: 'ai-chat',
        skillId: 'chat-demo',
        skillName: 'AI Chat 本地演示',
        provider: 'mock',
        model: 'local-rule',
        success: true,
        mock: true,
        duration: 0,
        input: prompt,
        output: demo.text,
        error: '',
        rawError: '',
        requestId: `chat-${Date.now()}`
      });
      chat = Store.state.chats.find(c => c.id === chat.id);
      const msg = chat.messages.find(item => item.id === loadingId);
      if (msg) {
        msg.content = demo.text;
        msg.mode = demo.mode;
        msg.streaming = false;
        msg.recommendations = demo.cards;
        msg.intent = demo.intent;
      }
      chat = Store.state.chats.find(c => c.id === chat.id);
      chat.messages = chat.messages.filter(item => item.id !== loadingId);
      chat.messages.push({
        role: 'assistant',
        content: demo.text,
        time: Date.now(),
        mode: demo.mode,
        requestId: `chat-${Date.now()}`,
        recommendations: demo.cards,
        intent: demo.intent
      });
      chat.updatedAt = Date.now();
      Store.addActivity(`AI聊天：${chat.title}`, 'ai');
      this.temp.chatRetryCount = 0;
      this.upsertStabilityTask({
        id: stabilityTaskId,
        type: 'AI Chat',
        module: 'chat',
        status: 'success',
        summary: demo.mode === 'mock' || demo.mode === 'demo' ? 'Mock/Fallback reply generated' : 'AI reply generated',
        result: demo.text,
        startedAt,
        updatedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        retryCount,
        mockFallbackCount: (Store.state.aiHistory || []).filter(item => item.mock).length,
        cancellable: false,
        retryable: false,
        source: 'ai-chat'
      });
      if (input) input.value = '';
      this.renderNav();
      this.rerender();
      this.scrollChatToBottom('auto');
    } catch (error) {
      chat = Store.state.chats.find(c => c.id === chat.id);
      chat.messages = chat.messages.filter(item => item.id !== loadingId);
      const message = this.recordAiError(error, 'ai-chat');
      this.temp.chatRetryCount = retryCount + 1;
      this.upsertStabilityTask({
        id: stabilityTaskId,
        type: 'AI Chat',
        module: 'chat',
        status: error?.status === 'timeout' || error?.code === 'TIMEOUT' ? 'timeout' : error?.code === 'CANCELLED' ? 'cancelled' : error?.code === 'INTERRUPTED' ? 'interrupted' : 'failed',
        summary: text.slice(0, 120),
        errorMessage: message,
        failureType: Stability.classifyFailure(error?.message || error),
        startedAt,
        updatedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        retryCount,
        cancellable: false,
        retryable: true,
        source: 'ai-chat'
      });
      chat.messages.push({ role: 'assistant', content: message, time: Date.now(), mode: 'error' });
      chat.updatedAt = Date.now();
      Store.save();
      this.toast(message, 'error');
      this.rerender();
      this.scrollChatToBottom('auto');
    } finally {
      this.temp.chatSending = false;
      this.chatAutoScrollUntil = Date.now() + 1200;
      chat = Store.state.chats.find(c => c.id === chat.id);
      if (chat) {
        const loading = chat.messages.find(item => item.id === loadingId);
        if (loading?.streaming) {
          loading.streaming = false;
          loading.mode = 'interrupted';
          this.upsertStabilityTask({
            id: stabilityTaskId,
            type: 'AI Chat',
            module: 'chat',
            status: 'interrupted',
            summary: text.slice(0, 120),
            errorMessage: 'AI Chat loading was interrupted before completion',
            failureType: 'interrupted',
            startedAt,
            updatedAt: Date.now(),
            finishedAt: Date.now(),
            durationMs: Date.now() - startedAt,
            retryCount,
            cancellable: false,
            retryable: true,
            source: 'ai-chat'
          });
          Store.save();
        }
      }
      if (this.route === 'chat') this.rerender();
    }
  },

  clearChat() {
    const chat = Store.state.chats.find(c => c.id === Store.state.activeChatId);
    if (!chat) return;
    if (confirm('确定清空当前聊天记录？')) {
      chat.messages = [];
      chat.updatedAt = Date.now();
      Store.save();
      this.rerender();
    }
  },

  openChatFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.md';
    input.dataset.input = 'chat-files';
    input.addEventListener('change', () => this.handleFileInput('chat-files', [...input.files]));
    input.click();
  },

  async attachChatFiles(files) {
    const chat = Store.state.chats.find(c => c.id === Store.state.activeChatId) || this.createChat(false);
    chat.files = chat.files || [];
    for (const file of files) {
      const content = await Utils.extractFileText(file);
      chat.files.push({ name: file.name, content });
    }
    chat.updatedAt = Date.now();
    Store.save();
    this.toast(`已挂载 ${files.length} 个文件到当前会话`);
    this.rerender();
  },

  async loadExcel(file) {
    const book = XLSX.read(await file.arrayBuffer(), { cellDates: true, raw: false });
    const sheetName = book.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: '', raw: false });
    this.temp.excel = {
      ...this.temp.excel,
      file,
      workbook: book,
      rows,
      sheetName,
      result: `已读取 ${sheetName}：${rows.length} 行。`,
      records: [],
      summary: null,
      meta: {},
      schema: {}
    };
    this.recordTask({
      type: 'Excel解析',
      fileName: file.name,
      module: 'excel',
      status: '完成',
      summary: `已读取 ${sheetName}，共 ${rows.length} 行`,
      result: `已读取 ${sheetName}：${rows.length} 行。`
    });
    this.saveReusableSession('excel', 'file_loaded');
    Store.addActivity(`读取表格：${file.name}`, 'file');
    this.rerender();
  },

  excelSample() {
    const rows = [
      ['发货单', '', '', '', '', '', '', ''],
      ['客户', 'NOVA GmbH', '联系电话', '13800138000', '日期', '2026-06-27', '付款方式', '月结30天'],
      ['运输方式', '汽运', '订单号', 'SO-2026-015', '状态', '待发货', '', ''],
      ['序号', '产品编码', '产品名称', '规格型号', '单位', '发货数量', '单价', '金额'],
      [1, 'P-1001', '轴承A', '6204', 'PCS', 120, 8, 960],
      [2, 'P-1002', '齿轮B', 'M2-40T', 'PCS', 180, 6, 1080],
      [3, 'P-1003', '传动轴C', 'C-12', 'PCS', 200, 10, 2000],
      [4, 'P-1004', '支架D', 'BR-9', 'PCS', 140, 12, 1680],
      [5, 'P-1005', '联轴器E', 'LJQ-3', 'PCS', 120, 33.25, 3990],
      ['备注', '以上数量仅统计产品明细', '', '', '', '', '', '']
    ];
    this.temp.excel = {
      ...this.temp.excel,
      file: { name: '发货单示例.xlsx', size: 2048, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      workbook: null,
      rows,
      sheetName: '发货单',
      result: '已加载企业发货单示例，可直接验证统计、查重和 AI 分析。',
      records: [],
      summary: null,
      meta: {},
      schema: {}
    };
    this.recordTask({
      type: 'Excel示例',
      fileName: '发货单示例.xlsx',
      module: 'excel',
      status: '完成',
      summary: '已加载企业发货单示例'
    });
    this.saveReusableSession('excel', 'sample_loaded');
    Store.addActivity('加载 Excel 示例');
    this.rerender();
  },

  requireExcel() {
    if (!this.temp.excel.rows.length) throw new Error('请先上传 Excel 文件');
  },

  getExcelAnalysis() {
    this.requireExcel();
    const extracted = ExcelBusiness.extract(this.temp.excel.rows);
    const records = ExcelBusiness.toObjects(extracted);
    const summary = ExcelBusiness.stats(records, extracted.meta);
    this.temp.excel.records = records;
    this.temp.excel.summary = summary;
    this.temp.excel.meta = extracted.meta;
    this.temp.excel.schema = extracted.schema;
    return { extracted, records, summary };
  },

  excelClassify() {
    const { records, summary } = this.getExcelAnalysis();
    const classified = ExcelBusiness.classifyRows(records);
    this.temp.excel.records = classified;
    this.temp.excel.result = [
      '自动分类完成：',
      ...classified.map(item => `${item.code || item.index || '-'} ${item.name || '-'} -> ${item.businessCategory}`),
      '',
      `客户：${summary.customer}`,
      `产品种类：${summary.productKinds}`
    ].join('\n');
    this.recordTask({
      type: 'Excel分类',
      fileName: this.temp.excel.file?.name || 'Excel文件',
      module: 'excel',
      status: '完成',
      summary: `客户 ${summary.customer}；产品种类 ${summary.productKinds}`,
      result: this.temp.excel.result
    });
    Store.addActivity('Excel 自动分类');
    this.saveReusableSession('excel', 'classified');
    this.rerender();
  },

  excelDedupe() {
    const { records } = this.getExcelAnalysis();
    const { kept, removed } = ExcelBusiness.dedupe(records);
    this.temp.excel.records = kept;
    this.temp.excel.summary = ExcelBusiness.stats(kept, this.temp.excel.meta);
    this.temp.excel.result = [
      `查重完成：仅按 序号 / 产品编码 / 产品名称 / 规格型号 检查。`,
      `保留 ${kept.length} 行，移除 ${removed.length} 行。`,
      removed.length ? `重复项：${removed.map(item => `${item.code || '-'} ${item.name || '-'}`).join('；')}` : '未发现重复项。'
    ].join('\n');
    this.recordTask({
      type: 'Excel查重',
      fileName: this.temp.excel.file?.name || 'Excel文件',
      module: 'excel',
      status: '完成',
      summary: `保留 ${kept.length} 行，移除 ${removed.length} 行`,
      result: this.temp.excel.result
    });
    Store.addActivity('Excel 自动查重');
    this.saveReusableSession('excel', 'deduplicated');
    this.rerender();
  },

  excelStats() {
    const { records } = this.getExcelAnalysis();
    const stats = ExcelBusiness.stats(records, this.temp.excel.meta);
    this.temp.excel.result = [
      `产品明细 ${stats.lineCount} 行`,
      `总数量 ${stats.totalQuantity}`,
      `总金额 ${stats.totalAmount.toFixed(2)}`,
      `平均单价 ${stats.avgPrice.toFixed(2)}`,
      `产品种类 ${stats.productKinds}`,
      `客户 ${stats.customer}`,
      `发货日期 ${stats.deliveryDate}`,
      `状态 ${stats.status}`,
      '',
      '说明：已自动忽略标题、客户信息、备注、联系电话、日期、订单号等非产品明细内容。'
    ].join('\n');
    this.recordTask({
      type: 'Excel统计',
      fileName: this.temp.excel.file?.name || 'Excel文件',
      module: 'excel',
      status: '完成',
      summary: `总数量 ${stats.totalQuantity}，总金额 ${stats.totalAmount.toFixed(2)}`,
      result: this.temp.excel.result
    });
    Store.addActivity('Excel 自动统计');
    this.saveReusableSession('excel', 'statistics_calculated');
    this.rerender();
  },

  async excelAnalyze(btn) {
    await this.busy(btn, async () => {
      const { records, summary } = this.getExcelAnalysis();
      const localReport = ExcelBusiness.report(records, this.temp.excel.meta);
      if (Store.state.settings.accessMode === 'local') {
        this.temp.excel.result = localReport;
      } else {
        const ai = await AIService.complete(
          `你是制造企业 Excel 业务分析助手。请基于以下发货/表格数据输出真实业务分析结果，必须包含：客户、数量、金额、付款方式、运输方式、异常、建议。不得输出空泛摘要。\n\n统计概览：\n${localReport}\n\n产品明细：\n${records.map(item => `${item.index}. ${item.code} | ${item.name} | ${item.spec} | 数量 ${item.quantity} | 单价 ${item.price} | 金额 ${item.amount}`).join('\n')}\n\n已识别字段：客户 ${summary.customer}；发货日期 ${summary.deliveryDate}；状态 ${summary.status}；付款方式 ${summary.payment}；运输方式 ${summary.transport}`,
          { mode: 'excel-analyze', module: 'excel', mockFallback: () => localReport }
        );
        this.temp.excel.result = ai.text;
      }
      this.recordTask({
        type: 'Excel业务分析',
        fileName: this.temp.excel.file?.name || 'Excel文件',
        module: 'excel',
        status: '完成',
        summary: (this.temp.excel.result || '').slice(0, 160),
        result: this.temp.excel.result
      });
      Store.addActivity('AI 分析 Excel', 'ai');
      this.saveReusableSession('excel', 'analysis_generated');
      this.rerender();
    });
  },

  excelExport() {
    this.requireExcel();
    const records = this.temp.excel.records.length ? this.temp.excel.records : this.getExcelAnalysis().records;
    const rows = [['序号', '产品编码', '产品名称', '规格型号', '单位', '发货数量', '单价', '金额', '客户', '交期', '状态']];
    records.forEach(item => {
      rows.push([item.index, item.code, item.name, item.spec, item.unit, item.quantity, item.price, item.amount, item.customer, item.date, item.status]);
    });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), this.temp.excel.sheetName || '处理结果');
    const filename = `处理结果_${this.temp.excel.file?.name || '数据.xlsx'}`;
    XLSX.writeFile(book, filename);
    this.recordDownload({
      filename,
      sourceModule: 'excel',
      sourceName: this.temp.excel.file?.name || 'Excel文件',
      fileType: 'xlsx',
      status: '已生成',
      summary: `来自 ${this.temp.excel.sheetName || '处理结果'} 的导出文件`
    });
    Store.addActivity('导出 Excel', 'file');
    this.saveReusableSession('excel', 'exported');
    this.toast('Excel 已导出');
  },

  async loadWord(file) {
    const ext = Utils.fileExt(file);
    if (ext === 'doc') throw new Error('Pages 和系统流程不保证支持 .doc，请先转换为 .docx 再上传');
    if (['txt', 'md', 'rtf'].includes(ext)) {
      this.temp.word = {
        title: file.name.replace(/\.[^.]+$/, ''),
        content: await file.text(),
        sourceFile: file.name
      };
      localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
      this.saveReusableSession('word', 'file_loaded');
      Store.addActivity(`读取文本文档：${file.name}`, 'file');
      this.navigate('word');
      return;
    }
    if (ext !== 'docx') throw new Error('请上传 docx 文件');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    this.temp.word = {
      title: file.name.replace(/\.docx$/i, ''),
      content: result.value.trim(),
      sourceFile: file.name
    };
    localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
    this.saveReusableSession('word', 'file_loaded');
    Store.addActivity(`读取 Word：${file.name}`, 'file');
    this.navigate('word');
  },

  wordNew() {
    if (!confirm('新建文档会清空当前草稿，是否继续？')) return;
    this.temp.word = { title: '', content: '', sourceFile: null };
    Store.state.activeReusableSessionIds.word = '';
    localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
    this.rerender();
  },

  getWord() {
    this.temp.word = {
      ...this.temp.word,
      title: document.getElementById('wordTitle')?.value || this.temp.word.title,
      content: document.getElementById('wordContent')?.value || this.temp.word.content
    };
    return this.temp.word;
  },

  async wordAI(mode, btn) {
    const w = this.getWord();
    if (!w.content.trim()) throw new Error('请先输入正文或上传 docx');
    await this.busy(btn, async () => {
      const map = {
        polish: 'polish',
        summary: 'summary',
        continue: 'continue',
        rewrite: 'rewrite',
        proofread: 'proofread',
        format: 'format'
      };
      let output = '';
      try {
        const r = await AIService.complete(w.content, { mode: map[mode] || 'polish' });
        output = this.stripMarkdownForDocument(r.text);
      } catch (error) {
        const message = this.recordAiError(error, `word-${mode}`);
        const lines = w.content.split('\n').map(line => line.trim()).filter(Boolean);
        if (mode === 'summary') output = `当前为演示模式，已使用内置演示数据生成结果。\n如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。\n\n文档重点：${lines.slice(0, 6).join('；')}`;
        else if (mode === 'proofread') output = `${w.content}\n\n【纠错提示】\n${message}`;
        else if (mode === 'format') output = lines.join('\n');
        else if (mode === 'rewrite') output = `改写版本：\n${lines.join(' ')}`;
        else output = `润色结果：\n${lines.join(' ')}`;
      }
      if (mode === 'summary') w.content += `\n\n【AI总结】\n${output}`;
      else w.content = output;
      localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(w));
      this.saveReusableSession('word', `ai_${mode}`);
      Store.addActivity(`Word AI ${mode}`, 'ai');
      this.rerender();
    });
  },

  async wordExport() {
    const w = this.getWord();
    if (!w.content) throw new Error('正文为空');
    await Utils.exportDocx(w.title, w.content, w.title || 'Word文档');
    this.saveReusableSession('word', 'exported_docx');
    Store.addActivity(`导出 Word：${w.title}`, 'file');
  },

  async wordPdf(btn) {
    const w = this.getWord();
    if (!w.content) throw new Error('正文为空');
    await this.busy(btn, async () => {
      const res = await Utils.exportPdf(w.title, w.content);
      if (res?.mode === 'txt') this.toast(res.message || 'PDF 导出失败，已降级为 TXT 导出', 'error');
      else this.toast('PDF 已导出');
      return res;
    });
    Store.addActivity(`导出 PDF：${w.title}`, 'file');
    this.saveReusableSession('word', 'exported_pdf');
  },

  async loadPdfs(files) {
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error(`${file.name} 不是 PDF 文件`);
      }
    }
    const info = [];
    const fileInfos = [];
    const extractedTexts = [];
    this.toast('正在读取 PDF 文件...');
    let detectedMode = 'text';
    for (const file of files) {
      const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      let status = '读取成功';
      let text = '';
      try {
        const parsed = await Utils.extractPdfTextSmart(file);
        text = parsed.text || '';
        detectedMode = parsed.mode || detectedMode;
        status = parsed.reason || (parsed.mode === 'ocr' ? '扫描件已自动 OCR' : '读取成功');
      } catch (error) {
        status = Utils.friendlyErrorMessage(error.message);
      }
      fileInfos.push({ name: file.name, size: file.size, pages: doc.getPageCount(), status });
      info.push(`${file.name}｜${Utils.formatBytes(file.size)}｜${doc.getPageCount()} 页｜${status}`);
      if (text) extractedTexts.push(`【${file.name}】\n${text}`);
    }
    if (!extractedTexts.length) info.push('该 PDF 可能是复杂矢量图、扫描质量较低或加密文件，请尝试上传截图、转换为图片，或手动粘贴文本。');
    this.temp.pdf = {
      ...this.temp.pdf,
      files,
      result: info.join('\n'),
      extracted: extractedTexts.join('\n\n'),
      tableText: '',
      qaAnswer: '',
      analysis: '',
      qaQuestion: '',
      scanMode: extractedTexts.length ? detectedMode : 'scan',
      fileInfos
    };
    files.forEach((file, index) => {
      this.recordTask({
        type: 'PDF解析',
        fileName: file.name,
        module: 'pdf',
        status: extractedTexts[index] ? '完成' : '失败',
        summary: extractedTexts[index] ? `${file.name} 已解析${detectedMode === 'ocr' ? '（OCR）' : '（文字层）'}` : '未读取到可分析内容',
        result: extractedTexts[index] || info[index] || ''
      });
    });
    Store.addActivity(`读取 ${files.length} 个 PDF`, 'file');
    this.saveReusableSession('pdf', 'file_loaded');
    this.rerender();
    this.toast(extractedTexts.length ? (detectedMode === 'ocr' ? 'PDF 已上传并自动 OCR' : 'PDF 上传并读取成功') : 'PDF 已上传，但未读取到可分析内容', extractedTexts.length ? 'success' : 'error');
  },

  requirePdf() {
    if (!this.temp.pdf.files.length && !this.temp.pdf.extracted) throw new Error('请先上传 PDF 文件，或打开包含已提取文字的历史会话');
  },

  async ensurePdfExtracted() {
    this.requirePdf();
    if (this.temp.pdf.extracted) return this.temp.pdf.extracted;
    const file = this.temp.pdf.files[0];
    if (!file) throw new Error('原 PDF 二进制未保存在浏览器中；当前可查看历史结果，如需重新解析请再次选择原文件');
    const parsed = await Utils.extractPdfTextSmart(file);
    const text = parsed.text || '';
    if (!text.trim()) throw new Error(parsed.reason || 'PDF 无法提取文字，请尝试 OCR');
    this.temp.pdf.scanMode = parsed.mode || 'text';
    this.temp.pdf.extracted = text;
    return this.temp.pdf.extracted;
  },

  async pdfSample(btn) {
    await this.busy(btn, async () => {
      const pdf = await PDFLib.PDFDocument.create();
      const page = pdf.addPage([720, 460]);
      page.drawText('Delivery Note SO-2026-015', { x: 48, y: 390, size: 24 });
      page.drawText('Customer: Changzhou New Energy Technology Co., Ltd.', { x: 48, y: 350, size: 16 });
      page.drawText('Product: 304 stainless steel connectors', { x: 48, y: 320, size: 16 });
      page.drawText('Quantity: 760', { x: 48, y: 290, size: 16 });
      page.drawText('Total Amount: 9710.00', { x: 48, y: 260, size: 16 });
      page.drawText('Payment Terms: Net 30', { x: 48, y: 230, size: 16 });
      page.drawText('Shipping: Logistics Delivery', { x: 48, y: 200, size: 16 });
      page.drawText('Status: Pending Receipt', { x: 48, y: 170, size: 16 });
      const bytes = await pdf.save();
      const file = new File([bytes], 'PDF示例发货单.pdf', { type: 'application/pdf' });
      await this.loadPdfs([file]);
      this.toast('PDF 示例文件已加载');
    });
  },

  async pdfExtract(btn) {
    await this.busy(btn, async () => {
      this.requirePdf();
      const texts = [];
      for (const file of this.temp.pdf.files) {
        const parsed = await Utils.extractPdfTextRaw(file);
        if (!Utils.isMostlyText(parsed.text)) throw new Error('该 PDF 可能是扫描件，请使用 OCR 图片识别');
        texts.push(`【${file.name}】\n模式：文字层\n${parsed.text}`);
      }
      this.temp.pdf.extracted = texts.join('\n\n');
      this.temp.pdf.result = this.temp.pdf.extracted;
      this.recordTask({
        type: 'PDF提取文字',
        fileName: this.temp.pdf.files[0]?.name || 'PDF文件',
        module: 'pdf',
        status: '完成',
        summary: '已提取 PDF 文字层内容',
        result: this.temp.pdf.result
      });
      Store.addActivity('提取 PDF 文字');
      this.saveReusableSession('pdf', 'text_extracted');
      this.rerender();
    });
  },

  async pdfSummary(btn) {
    await this.busy(btn, async () => {
      const extracted = await this.ensurePdfExtracted();
      const file = this.temp.pdf.files[0];
      const modeText = this.temp.pdf.scanMode === 'ocr' ? '扫描版 PDF 已自动 OCR。' : '已读取文字层 PDF。';
      let summary = '';
      let modeNotice = '';
      const gatewayResult = await AIService.complete(
            `请总结以下 PDF 内容，提取重点、风险、关键数据和建议。\n文件：${file.name}\n模式：${modeText}\n内容：\n${extracted.slice(0, 12000)}`,
            { mode: 'pdf', module: 'ai-pdf', mockFallback: reason => `Mock 兜底：AI Gateway 暂不可用。\n原因：${reason}\n\n${KnowledgeEngine.summary(extracted)}` }
          );
      summary = gatewayResult.text;
      if (gatewayResult.mode === 'mock') modeNotice = '当前为 Mock 兜底结果，可在 AI 设置中心检查 Provider、Base URL、API Key 和 Model。';
      this.temp.pdf.summaryCompleted = true;
      this.temp.pdf.summaryMode = gatewayResult.mode === 'mock' ? 'mock' : 'gateway';
      this.temp.pdf.analysis = summary;
      this.temp.pdf.result = `PDF总结\n\n文件：${file.name}\n${modeText}\n${modeNotice ? `\n${modeNotice}\n` : ''}\n${summary}\n\n建议：继续使用 PDF 问答、翻译或转 Word 处理。`;
      this.recordTask({
        type: 'PDF总结',
        fileName: file.name,
        module: 'pdf',
        status: '完成',
        summary: summary.slice(0, 160),
        result: this.temp.pdf.result
      });
      Store.addActivity('AI 总结 PDF', 'ai');
      this.rerender();
    });
  },

  async pdfToOcr(btn) {
    await this.busy(btn, async () => {
      if (!this.temp.pdf.files.length) throw new Error('请先上传 PDF 文件');
      const file = this.temp.pdf.files[0];
      const parsed = await Utils.extractPdfTextSmart(file);
      this.temp.pdf.scanMode = parsed.mode || 'text';
      this.temp.pdf.extracted = parsed.text || '';
      this.temp.pdf.analysis = parsed.text || '';
      this.temp.pdf.result = parsed.mode === 'ocr'
        ? `已转入 OCR 识别。\n\n${parsed.reason || '检测为扫描版 PDF，已自动 OCR'}\n\n${parsed.text || ''}`
        : `该 PDF 已有文字层，可直接总结、翻译或问答。\n\n${parsed.text || ''}`;
      this.temp.pdf.summaryCompleted = false;
      this.recordTask({
        type: 'PDF转OCR',
        fileName: file.name,
        module: 'pdf',
        status: '完成',
        summary: parsed.mode === 'ocr' ? '扫描版已转入 OCR' : '文字层 PDF 无需 OCR',
        result: this.temp.pdf.result
      });
      Store.addActivity(`PDF 转 OCR：${file.name}`, 'file');
      this.rerender();
      this.toast(parsed.mode === 'ocr' ? 'PDF 已转入 OCR 识别' : '该 PDF 已有文字层，无需转入 OCR');
    });
  },

  async pdfTranslate(btn) {
    await this.busy(btn, async () => {
      const extracted = await this.ensurePdfExtracted();
      const file = this.temp.pdf.files[0];
      const res = await AIService.complete(
        `请将以下 PDF 内容翻译成正式英文商务表达，保留客户、产品、数量、金额、付款方式、运输方式、状态等关键字段。\n文件：${file.name}\n内容：\n${extracted.slice(0, 12000)}`,
        { mode: 'translate', module: 'ai-pdf', mockFallback: reason => `Mock 兜底：${reason}\n\n${KnowledgeEngine.summary(extracted)}` }
      );
      this.temp.pdf.result = `PDF翻译\n\n${res.text}`;
      this.temp.pdf.analysis = res.text;
      this.recordTask({
        type: 'PDF翻译',
        fileName: file.name,
        module: 'pdf',
        status: '完成',
        summary: res.text.slice(0, 160),
        result: this.temp.pdf.result
      });
      Store.addActivity('AI 翻译 PDF', 'ai');
      this.rerender();
    });
  },

  async pdfAsk(btn) {
    const q = document.getElementById('pdfQuestion')?.value.trim() || this.temp.pdf.qaQuestion;
    if (!q) throw new Error('请输入 PDF 问题');
    await this.busy(btn, async () => {
      const extracted = await this.ensurePdfExtracted();
      this.temp.pdf.qaQuestion = q;
      let answerText = '';
      if (Store.state.settings.accessMode !== 'local') {
        const ai = await AIService.complete(
          `你是 PDF 问答助手。请仅根据以下 PDF 内容回答问题，不确定时明确说明无法确认。\n\n问题：${q}\n\nPDF内容：\n${extracted.slice(0, 12000)}`,
          { mode: 'pdf-qa', module: 'ai-pdf', mockFallback: () => KnowledgeEngine.answer(q, [KnowledgeEngine.buildEntry({ title: this.temp.pdf.files[0].name, content: extracted, sourceType: 'pdf' })]).text }
        );
        answerText = ai.text;
      } else {
        const answer = KnowledgeEngine.answer(q, [KnowledgeEngine.buildEntry({ title: this.temp.pdf.files[0].name, content: extracted, sourceType: 'pdf' })]);
        answerText = answer.text;
      }
      this.temp.pdf.qaAnswer = answerText;
      this.temp.pdf.result = `PDF问答\n问题：${q}\n回答：${answerText}`;
      this.recordTask({
        type: 'PDF问答',
        fileName: this.temp.pdf.files[0]?.name || 'PDF文件',
        module: 'pdf',
        status: '完成',
        summary: q,
        result: answerText
      });
      Store.addActivity(`PDF问答：${q.slice(0, 20)}`, 'ai');
      this.rerender();
    });
  },

  async pdfTableExtract(btn) {
    await this.busy(btn, async () => {
      const extracted = await this.ensurePdfExtracted();
      const lines = extracted.split('\n').map(line => line.trim()).filter(Boolean);
      const tableLines = lines.filter(line => /\d/.test(line) && /[A-Za-z\u4e00-\u9fa5]/.test(line));
      this.temp.pdf.tableText = tableLines.join('\n');
      this.temp.pdf.result = `表格提取结果\n\n${this.temp.pdf.tableText || '未提取到明显表格行，建议先 OCR 后核对版式。'}`;
      this.recordTask({
        type: 'PDF表格提取',
        fileName: this.temp.pdf.files[0]?.name || 'PDF文件',
        module: 'pdf',
        status: '完成',
        summary: '已提取表格或列表文本',
        result: this.temp.pdf.result
      });
      Store.addActivity('PDF 表格提取', 'ai');
      this.rerender();
    });
  },

  async pdfSplit(btn) {
    await this.busy(btn, async () => {
      this.requirePdf();
      const file = this.temp.pdf.files[0];
      const src = await PDFLib.PDFDocument.load(await file.arrayBuffer());
      for (let i = 0; i < src.getPageCount(); i += 1) {
        const out = await PDFLib.PDFDocument.create();
        const [page] = await out.copyPages(src, [i]);
        out.addPage(page);
        Utils.download(new Blob([await out.save()], { type: 'application/pdf' }), `${safeName(file.name.replace(/\.pdf$/i, ''))}_第${i + 1}页.pdf`);
        await wait(60);
      }
      this.temp.pdf.result = `已将 ${file.name} 拆分为 ${src.getPageCount()} 个 PDF 文件。`;
      this.recordTask({
        type: 'PDF拆分',
        fileName: file.name,
        module: 'pdf',
        status: '完成',
        summary: `拆分为 ${src.getPageCount()} 个文件`,
        result: this.temp.pdf.result
      });
      Store.addActivity('拆分 PDF', 'file');
      this.rerender();
    });
  },

  async pdfMerge(btn) {
    if (this.temp.pdf.files.length < 2) throw new Error('合并 PDF 至少需要两个文件');
    await this.busy(btn, async () => {
      const out = await PDFLib.PDFDocument.create();
      for (const file of this.temp.pdf.files) {
        const src = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(page => out.addPage(page));
      }
      Utils.download(new Blob([await out.save()], { type: 'application/pdf' }), '合并文档.pdf');
      this.temp.pdf.result = `已合并 ${this.temp.pdf.files.length} 个文件，共 ${out.getPageCount()} 页。`;
      this.recordTask({
        type: 'PDF合并',
        fileName: this.temp.pdf.files.map(item => item.name).join('、'),
        module: 'pdf',
        status: '完成',
        summary: `合并 ${this.temp.pdf.files.length} 个 PDF 文件`,
        result: this.temp.pdf.result
      });
      Store.addActivity('合并 PDF', 'file');
      this.rerender();
    });
  },

  async pdfWord(btn) {
    await this.busy(btn, async () => {
      this.requirePdf();
      try {
        const extracted = await this.ensurePdfExtracted();
        if (!extracted.trim()) throw new Error('未提取到可转换文字');
        await Utils.exportDocx(this.temp.pdf.files[0].name.replace(/\.pdf$/i, ''), extracted, this.temp.pdf.files[0].name.replace(/\.pdf$/i, ''));
        this.temp.pdf.result = `已生成标准 DOCX，可使用 Pages、Word 或 WPS 打开。`;
        this.recordTask({
          type: 'PDF转Word',
          fileName: this.temp.pdf.files[0]?.name || 'PDF文件',
          module: 'pdf',
          status: '完成',
          summary: '已生成标准 DOCX',
          result: this.temp.pdf.result
        });
        this.recordDownload({
          filename: `${this.temp.pdf.files[0].name.replace(/\.pdf$/i, '')}.docx`,
          sourceModule: 'pdf',
          sourceName: this.temp.pdf.files[0].name,
          fileType: 'docx',
          status: '已生成',
          summary: 'PDF 转 Word 输出文件'
        });
        Store.addActivity('PDF 转 Word', 'file');
        this.rerender();
      } catch (error) {
        this.temp.pdf.result = `PDF 转 Word 失败：${Utils.friendlyErrorMessage(error.message)}`;
        this.rerender();
        throw error;
      }
    });
  },

  async pdfExport(btn) {
    await this.busy(btn, async () => {
      const content = this.temp.pdf.result || this.temp.pdf.qaAnswer || this.temp.pdf.analysis || this.temp.pdf.extracted;
      if (!content) throw new Error('暂无可导出的 PDF 结果');
      const blob = await Utils.exportDocx('PDF处理结果', content, 'PDF处理结果');
      this.recordDownload({
        filename: 'PDF处理结果.docx',
        sourceModule: 'pdf',
        sourceName: this.temp.pdf.files[0]?.name || 'PDF文件',
        fileType: 'docx',
        status: '已生成',
        summary: 'PDF 处理结果导出文件',
        blob
      });
      Store.addActivity('导出 PDF 处理结果', 'file');
      this.toast('PDF 处理结果 Word 已导出');
    });
  },

  loadOcr(file) {
    if (!/^image\/(?:png|jpe?g|webp)$/i.test(file.type) && !/\.(?:png|jpe?g|webp)$/i.test(file.name)) {
      const error = new Error('仅支持 PNG、JPG、JPEG、WEBP 图片');
      error.code = 'unsupported_file';
      this.reportBug({ module: 'OCR', feature: '文件输入', type: 'unsupported_file', message: error.message,
        description: `不支持的文件类型：${file.type || '未知'}`, suggestion: '请转换为 PNG、JPG、JPEG 或 WEBP 后重试。',
        source: 'ocr-provider', signature: `OCR|unsupported_file|${file.type || 'unknown'}` });
      throw error;
    }
    if (this.temp.ocr.url) URL.revokeObjectURL(this.temp.ocr.url);
    const engine = typeof OCRService.health === 'function' ? OCRService.health() : {};
    const demoFields = /OCR示例发货单/i.test(file.name) || /示例/i.test(file.name) ? this.buildOcrDemoFields() : null;
    const providerId = Store.state.ocrData?.providerConfig?.selectedProviderId || this.temp.ocr.providerId || 'auto';
    const uploadedAt = new Date().toISOString();
    const documentSessionId = uid();
    this.temp.ocr = {
      file,
      url: URL.createObjectURL(file),
      result: '',
      progress: 0,
      status: '未开始',
      engineStatus: engine,
      structured: '',
      template: '通用',
      analysis: '',
      qaQuestion: '',
      qaAnswer: '',
      mock: false,
      mockReason: '',
      providerId,
      providerResult: null,
      documentSessionId,
      review: null,
      diagnostics: null,
      reviewZoom: 1,
      sourceFile: { name: file.name, size: file.size, type: file.type, uploadedAt, dimensions: {} },
      fieldDrafts: [],
      confirmedFields: JSON.parse(localStorage.getItem('personal-ai-os-ocr-confirmed-fields') || 'null'),
      demoFields
    };
    this.touchOcrDocumentSession(documentSessionId, {
      requestId: '', sourceFile: { name: file.name, size: file.size, type: file.type, uploadedAt },
      storage_status: 'metadata_only', rawText: '', result: null, review: null, template_id: '',
      file_reselect_required_after_reload: true
    }, 'document_loaded');
    Store.save();
    const image = new Image();
    image.onload = () => {
      if (this.temp.ocr.file === file) {
        this.temp.ocr.sourceFile.dimensions = { width: image.naturalWidth, height: image.naturalHeight };
        this.rerender();
      }
    };
    image.src = this.temp.ocr.url;
    this.recordTask({
      type: 'OCR载入',
      fileName: file.name,
      module: 'ocr',
      status: '完成',
      summary: '已载入图片等待识别'
    });
    this.rerender();
    this.toast(`图片已加载：${file.name}，请点击“开始识别”`);
  },

  formatOcrStructuredView(structured = {}, sourceText = '') {
    const rows = Array.isArray(structured.fieldRows) ? structured.fieldRows : [];
    const fieldTable = [
      '识别字段表',
      '字段 | 结果 | 状态',
      '---|---|---',
      ...rows.map(row => `${row.field || '待补充'} | ${String(row.value || '待补充').trim() || '待补充'} | ${row.status || '未识别'}`)
    ];
    const rawLines = Array.isArray(structured.lines) && structured.lines.length
      ? structured.lines
      : String(sourceText || '').split('\n').map(line => line.trim()).filter(Boolean);
    return [
      ...fieldTable,
      '',
      '原始 OCR 拆行结果',
      ...rawLines
    ].join('\n').trim();
  },

  async ocrSample(btn) {
    await this.busy(btn, async () => {
      const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 430;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('发货单 SO-2026-015', 48, 86);
    ctx.font = '44px sans-serif';
    ctx.fillText('客户 NOVA GmbH', 48, 164);
    ctx.fillText('发货数量 760', 48, 242);
    ctx.fillText('总金额 9710', 48, 320);
    ctx.fillText('付款方式 月结30天  运输方式 汽运', 48, 398);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      this.loadOcr(new File([blob], 'OCR示例发货单.png', { type: 'image/png' }));
      this.toast('OCR 示例图片已加载，请点击开始识别');
    });
  },

  async ocrCopy(btn) {
    if (!this.temp.ocr.result) throw new Error('暂无识别文字');
    await this.busy(btn, async () => this.copy(this.temp.ocr.result));
  },

  async ocrRun(btn, forceRetry = false) {
    const o = this.temp.ocr;
    if (!o.file) throw new Error('请先上传或拍摄图片');
    const registry = this.setupOcrProviders();
    const providerId = o.providerId || Store.state.ocrData.providerConfig.selectedProviderId || 'auto';
    const stabilityTaskId = uid();
    const startedAt = Date.now();
    const retryCount = Number(o.retryCount || 0) + (forceRetry ? 1 : 0);
    await this.busy(btn, async () => {
      this.upsertStabilityTask({
        id: stabilityTaskId,
        type: 'OCR识别',
        fileName: o.file.name,
        module: 'ocr',
        status: retryCount ? 'retrying' : 'running',
        startedAt,
        retryCount,
        cancellable: true,
        retryable: false,
        source: 'ocr'
      });
      const chosen = providerId === 'auto' ? registry.get('current') : registry.get(providerId);
      o.status = `处理中（${chosen?.providerName || '自动选择'}）`;
      o.progress = 0.06;
      o.mock = false;
      o.providerResult = null;
      o.review = null;
      Store.state.ocrResult = { text: '', table: null, imageMeta: o.sourceFile, status: 'processing', providerId };
      if (typeof emit === 'function') emit('ocr:completed', Store.state.ocrResult);
      syncGlobalSystemState({ ocrResult: Store.state.ocrResult });
      this.rerender();
      await wait(80);
      const requestId = stabilityTaskId;
      const environment = this.ocrEnvironment();
      const result = await registry.run({
        providerId,
        file: o.file,
        allowFallback: providerId === 'auto',
        timeoutMs: Stability.limitFor('ocr').timeoutMs,
        context: { requestId, environment, sourceFile: o.sourceFile, mode: providerId,
          lowConfidenceThreshold: Store.state.ocrData.providerConfig.lowConfidenceThreshold,
          highRiskThreshold: Store.state.ocrData.providerConfig.highRiskThreshold },
        onProgress: (progress, status) => {
          o.progress = progress;
          o.status = status ? `处理中：${status}` : '处理中';
          const bar = document.getElementById('ocrBar');
          if (bar) bar.style.width = `${progress * 100}%`;
          const pct = document.getElementById('ocrPercent');
          if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
          const stat = document.getElementById('ocrStatus');
          if (stat) stat.textContent = o.status;
        }
      });
      o.result = result.rawText;
      o.mock = result.providerId === 'mock' || result.fallbackUsed;
      o.mockReason = result.fallbackUsed ? result.warnings[0] || '真实识别不可用，已使用演示降级' : '';
      o.status = result.providerId === 'mock' ? (result.fallbackUsed ? '已使用降级模式（演示数据，非真实识别）' : '演示数据（非真实识别）')
        : result.status === 'fallback' ? '已使用降级模式（演示数据）'
        : result.status === 'partial_success' ? '部分成功：疑似乱码或模型兼容异常'
          : result.status === 'success' ? '真实 OCR 成功' : 'OCR 失败';
      o.progress = 1;
      o.original = o.result;
      const quality = OCRService.assessQuality(o.result);
      o.quality = quality;
      const structured = OCRService.structure(o.result);
      o.template = structured.template;
      const demoFieldValues = result.providerId === 'mock' ? (o.demoFields?.fields || o.confirmedFields?.fields || {}) : {};
      o.fieldDrafts = this.buildOcrFieldDrafts(o.result, quality, demoFieldValues);
      o.structured = this.renderOcrFieldTable('current');
      o.aiFix = '';
      o.aiMode = 'mock';
      o.aiError = '';
      o.edited = false;
      o.analysis = '';
      o.qaQuestion = '';
      o.qaAnswer = '';
      result.fields = OCRArchitecture.normalizeFields(result.fields, structured.fields || {}, result.confidence);
      result.documentType = structured.template || result.documentType;
      result.sourceFile = { ...o.sourceFile };
      this.persistOcrResult(result);
      const garbage = OCRArchitecture.detectGarbled(result.rawText);
      if (garbage.garbled) this.recordOcrProviderError({ requestId, provider: registry.get(result.providerId) || {},
        error: Object.assign(new Error('疑似乱码或模型兼容异常'), { code: 'garbled_text' }), file: o.file,
        startedAt: result.startedAt, fallbackUsed: result.fallbackUsed });
      const ocrState = { ...result, text: result.rawText, table: structured.pairs.length ? structured.pairs : null,
        imageMeta: o.sourceFile, status: result.status, quality };
      Store.state.ocrResult = ocrState;
      if (typeof emit === 'function') emit('ocr:completed', ocrState);
      syncGlobalSystemState({ ocrResult: ocrState });
      this.recordTask({
        type: 'OCR识别',
        fileName: o.file.name,
        module: 'ocr',
        status: result.status === 'fallback' ? '完成' : result.status,
        summary: `${result.providerName} · ${result.status} · 待人工复核`, result: o.result,
        requestId: result.requestId, durationMs: result.durationMs, retryCount,
        fallbackUsed: result.fallbackUsed, providerId: result.providerId
      });
      o.retryCount = retryCount;
      this.upsertStabilityTask({
        id: stabilityTaskId,
        type: 'OCR识别',
        fileName: o.file.name,
        module: 'ocr',
        status: result.success ? 'success' : result.status,
        startedAt,
        updatedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        retryCount,
        requestId: result.requestId,
        mockFallbackCount: result.fallbackUsed ? 1 : 0,
        summary: `${result.providerName} · ${result.status} · ${result.fallbackUsed ? '演示降级' : '未降级'}`,
        result: o.result,
        cancellable: false,
        retryable: false,
        source: 'ocr'
      });
      Store.addActivity(`OCR 识别：${o.file.name}`, 'ai');
      this.rerender();
      this.toast(result.fallbackUsed ? '真实识别不可用，已使用明确标注的演示降级结果。' : result.status === 'partial_success' ? '识别结果疑似异常，请人工复核或更换 Provider。' : 'OCR 识别完成，请人工复核。', result.status === 'partial_success' ? 'warning' : 'success');
    }).catch(error => {
      o.retryCount = retryCount + 1;
      o.status = error?.code === 'request_timeout' || error?.code === 'TIMEOUT' ? 'OCR 超时' : `OCR 失败：${Utils.friendlyErrorMessage(error?.message || error)}`;
      this.updateOcrDailyStats({ success: false, fallbackUsed: false });
      this.upsertStabilityTask({
        id: stabilityTaskId,
        type: 'OCR识别',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: error?.code === 'request_timeout' || error?.code === 'TIMEOUT' ? 'timeout' : error?.code === 'CANCELLED' ? 'cancelled' : 'failed',
        startedAt,
        updatedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        retryCount,
        errorMessage: Utils.friendlyErrorMessage(error?.message || error),
        failureType: Stability.classifyFailure(error?.message || error),
        cancellable: false,
        retryable: true,
        source: 'ocr'
      });
      Store.save();
      this.rerender();
      throw error;
    }).finally(() => {
      o.loading = false;
      o.cancelRequested = false;
    });
  },

  async ocrSummary(btn) {
    const o = this.temp.ocr;
    await this.busy(btn, async () => {
      const source = this.getOcrSourceText();
      this.syncOcrSourceState(source);
      if (!source) {
        o.aiMode = 'mock';
        o.aiError = '';
        o.analysis = '【Mock OCR 总结】\n当前未检测到可总结的 OCR 原文，请先上传图片或确认字段表。\n请以结构化字段表为准。';
      } else if (this.shouldUseOcrMockAi()) {
        o.aiMode = 'mock';
        o.aiError = '';
        o.analysis = [
          '【Mock OCR 总结】',
          '当前为本地演示版 / Mock AI，真实 AI 后端未连接。',
          `文件类型：${o.template || '通用'}`,
          `内容摘要：${KnowledgeEngine.summary(source)}`,
          '请重点核对单据类型、企业名称、单据编号、产品名称、数量、电话和地址等字段。'
        ].join('\n');
      } else {
        const ai = await AIService.complete(
          `请总结以下 OCR 识别内容，提取文件类型、关键字段、风险和建议。\n模板：${o.template || '通用'}\nOCR内容：\n${source.slice(0, 12000)}`,
          { mode: 'ocr-summary', module: 'ocr', mockFallback: reason => `Mock 兜底：${reason}\n\n${KnowledgeEngine.summary(source)}` }
        );
        o.analysis = ai.text;
      }
      this.recordTask({
        type: 'OCR总结',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: '完成',
        summary: String(o.analysis || '').slice(0, 160),
        result: o.analysis
      });
      Store.addActivity(`OCR AI总结：${o.file?.name || '图片'}`, 'ai');
      this.rerender();
    });
  },

  async ocrTranslate(btn) {
    const o = this.temp.ocr;
    await this.busy(btn, async () => {
      const source = this.getOcrSourceText();
      this.syncOcrSourceState(source);
      if (!source) {
        o.aiMode = 'mock';
        o.aiError = '';
        o.analysis = '【Mock AI 翻译】\n当前未检测到可翻译的 OCR 原文，请先上传图片或确认字段表。';
      } else if (this.shouldUseOcrMockAi()) {
        o.aiMode = 'mock';
        o.aiError = '';
        o.analysis = [
          '【Mock AI 翻译】',
          '当前未连接真实 AI，翻译功能为演示状态。',
          `英文演示摘要：${KnowledgeEngine.summary(source)}`
        ].join('\n');
      } else {
        const ai = await AIService.complete(
          `请将以下 OCR 识别内容翻译成正式英文，保留单号、客户、产品、数量、金额、交期等关键字段。\n模板：${o.template || '通用'}\nOCR内容：\n${source.slice(0, 12000)}`,
          { mode: 'ocr-translate', module: 'ocr', mockFallback: reason => `Mock 兜底：${reason}\n\n${KnowledgeEngine.summary(source)}` }
        );
        o.analysis = ai.text;
      }
      this.recordTask({
        type: 'OCR翻译',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: '完成',
        summary: String(o.analysis || '').slice(0, 160),
        result: o.analysis
      });
      Store.addActivity(`OCR AI翻译：${o.file?.name || '图片'}`, 'ai');
      this.rerender();
    });
  },

  async ocrAsk(btn) {
    const o = this.temp.ocr;
    const question = document.getElementById('ocrQuestion')?.value.trim() || o.qaQuestion || '';
    if (!question) throw new Error('请输入 OCR 问题');
    await this.busy(btn, async () => {
      o.qaQuestion = question;
      const source = this.getOcrSourceText();
      this.syncOcrSourceState(source);
      let answerText = '';
      if (this.shouldUseOcrMockAi() || !source) {
        o.aiMode = 'mock';
        o.aiError = '';
        answerText = [
          '【Mock OCR 问答】',
          '当前未连接真实 AI，无法进行真实语义问答。',
          '你可以先查看结构化字段表，或人工确认关键字段后再用于报价、导出或后续处理。'
        ].join('\n');
      } else {
        const ai = await AIService.complete(
          `你是 OCR 问答助手。请仅根据以下 OCR 内容回答问题，不确定时输出“无法确认”。\n\n问题：${question}\n\nOCR内容：\n${source.slice(0, 12000)}`,
          { mode: 'ocr-qa', module: 'ocr', mockFallback: () => KnowledgeEngine.answer(question, [KnowledgeEngine.buildEntry({ title: o.file?.name || 'OCR文件', content: source, sourceType: 'ocr' })]).text }
        );
        answerText = ai.text;
      }
      o.qaAnswer = answerText;
      o.analysis = `OCR问答\n问题：${question}\n回答：${answerText}`;
      this.recordTask({
        type: 'OCR问答',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: '完成',
        summary: question,
        result: answerText
      });
      Store.addActivity(`OCR问答：${question.slice(0, 20)}`, 'ai');
      this.rerender();
    });
  },

  async ocrAIFix(btn) {
    const o = this.temp.ocr;
    const stateOcr = window.GlobalSystemState?.ocrResult || {};
    const source = this.getOcrSourceText();
    if (!source) {
      o.aiMode = 'disabled';
      o.aiError = '未检测到 OCR 原文，无法生成 AI 纠错建议。';
      this.toast(o.aiError, 'error');
      return;
    }
    if (String(stateOcr.text || '').trim() !== source) {
      const structured = OCRService.structure(source);
      const synced = {
        ...stateOcr,
        text: source,
        table: stateOcr.table ?? (structured.pairs.length ? structured.pairs : null),
        imageMeta: stateOcr.imageMeta || (o.file ? { name: o.file.name, size: o.file.size, type: o.file.type } : {}),
        status: stateOcr.status === 'failed' ? 'success' : (stateOcr.status || 'success')
      };
      window.GlobalSystemState.ocrResult = synced;
      if (typeof emit === 'function') emit('ocr:completed', synced);
    }
    const quality = o.quality || OCRService.assessQuality(source);
    const buildMock = reason => {
      const structured = OCRService.structure(source);
      const structuredLines = structured.pairs.length
        ? structured.pairs.map(([key, value]) => `${key}：${String(value || '').trim() || '待确认'}`)
        : structured.lines;
      const repairedLines = structuredLines.length
        ? structuredLines
        : source.split('\n').map(line => line.trim()).filter(Boolean);
      return [
        'AI 修复内容仅供参考，请人工核对后使用。',
        'OCR 原文：',
        source,
        '',
        'AI 修复结果：',
        repairedLines.join('\n') || '待确认',
        '',
        `Mock 说明：${reason || '已基于原文生成保守纠错结果，缺失信息标记为待确认。'}`
      ].join('\n').trim();
    };
    const confirmText = '当前 OCR 内容将发送至第三方 AI 进行纠错，请确认不包含企业机密或已完成脱敏。';
    const remoteReady = Store.state.settings.accessMode !== 'local' && Store.state.settings.apiEnabled && Store.state.settings.apiUrl;
    if (Utils.isGitHubPagesHost()) {
      o.aiMode = 'disabled';
      o.aiError = '当前为 GitHub Pages 静态安全模式，OCR AI 纠错需连接独立服务端网关。';
      this.reportBug({ module: 'OCR', feature: 'AI 纠错建议', type: 'deepseek-not-configured', message: o.aiError, signature: 'deepseek-not-configured' });
      this.rerender();
      this.toast(o.aiError, 'warning');
      return;
    }
    if (!remoteReady || this.shouldUseOcrMockAi()) {
      await this.busy(btn, async () => {
        o.aiMode = 'mock';
        o.aiError = '';
        o.aiFix = buildMock('当前未连接真实 AI，已使用 Mock 纠错结果。');
        o.status = '已使用 Mock 纠错';
        o.edited = false;
        o.fieldDrafts = this.buildOcrFieldDrafts(o.aiFix || source, quality, o.confirmedFields?.fields || o.demoFields?.fields || {});
        o.structured = this.renderOcrFieldTable('current');
        this.recordTask({
          type: 'OCR纠错',
          fileName: o.file?.name || '图片',
          module: 'ocr',
          status: '完成',
          summary: 'ocr_ai_fix_mock',
          result: o.aiFix
        });
        Store.addActivity(`OCR AI 纠错：${o.file?.name || '图片'}`, 'ai');
        this.rerender();
        this.toast('当前为本地演示版 / Mock AI，已使用 Mock 纠错结果。');
      });
      return;
    }
    if (remoteReady) {
      if (!confirm(confirmText)) {
        o.aiMode = 'cancelled';
        o.aiError = '用户未授权发送脱敏 OCR 文字，未调用 DeepSeek。';
        this.rerender();
        this.toast(o.aiError, 'warning');
        return;
      }
    }
    const prompt = `你是 OCR 纠错助手。请只基于原文进行修复，不要编造缺失内容。若无法确认，请输出“无法确认”。\n\n要求：\n1. 输出两栏：OCR 原文、AI 修复结果。\n2. AI 修复结果必须包含提示：AI 修复内容仅供参考，请人工核对后使用。\n3. 优先修复字段：发货单号、客户名称、发货日期、联系人、电话、产品编码、产品名称、规格型号、数量、单价、金额。\n4. 如果字段缺失或不确定，必须标注“无法确认”。\n5. 如果原文是表格，尽量按行列还原，但不要乱编。\n\nOCR 原文：\n${source}\n\n质量提示：${quality?.summary || '正常'}`;
    await this.busy(btn, async () => {
      try {
        const ai = await AIService.complete(prompt, {
          mode: 'ocr-correct',
          module: 'ocr-ai-fix',
          temperature: 0.1,
          allowMockFallback: false,
          sensitiveMode: 'mask',
          sensitiveConfirmed: true,
          promptVersion: 'ocr-correct-v1'
        });
        const repaired = String(ai.text || '').trim();
        if (!repaired) throw new Error('DeepSeek 未返回有效 OCR 纠错建议。');
        o.aiFix = repaired;
        o.aiMode = ai.mode || 'api';
        o.aiError = '';
        o.aiSuggestionMeta = {
          provider: 'deepseek', model: ai.model || '', createdAt: new Date().toISOString(),
          inputTokens: ai.usage?.prompt_tokens || 0, outputTokens: ai.usage?.completion_tokens || 0,
          totalTokens: ai.usage?.total_tokens || 0, estimatedCost: ai.estimatedCost || 0, cost: ai.cost || null,
          cached: Boolean(ai.cached), confirmed: false
        };
      } catch (error) {
        o.aiMode = 'failed';
        o.aiError = Utils.friendlyErrorMessage(AIService.friendlyMessage?.(error) || error.message);
        o.status = 'AI 纠错建议生成失败';
        this.reportBug({ module: 'OCR', feature: 'AI 纠错建议', type: 'deepseek-ocr-suggestion-failed', message: o.aiError, signature: 'deepseek-ocr-suggestion-failed' });
        this.rerender();
        this.toast(o.aiError, 'error');
        return;
      }
      o.status = 'AI 纠错建议已生成，等待人工采用';
      this.recordTask({
        type: 'OCR纠错',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: '完成',
        summary: o.aiMode === 'api' ? 'ocr_ai_fix_deepseek' : 'ocr_ai_fix_mock',
        result: o.aiFix
      });
      Store.addActivity(`OCR AI 纠错：${o.file?.name || '图片'}`, 'ai');
      this.rerender();
      this.toast(o.aiMode === 'api' ? 'AI 纠错完成' : 'AI Mock 纠错完成');
    });
  },

  async ocrAITable(btn) {
    const o = this.temp.ocr;
    const source = this.getOcrSourceText();
    await this.busy(btn, async () => {
      if (!source || this.shouldUseOcrMockAi()) {
        o.aiMode = 'mock';
        o.aiError = '';
        const structured = OCRService.structure(source || o.demoFields?.rawText || '');
        const lines = structured.pairs.length ? structured.pairs.map(([key, value]) => `${key}：${String(value || '').trim() || '待确认'}`) : structured.lines;
        o.aiFix = ['【Mock AI 表格还原】', '当前未连接真实 AI，表格还原仅为演示模式。建议优先使用人工确认字段表。', ...lines].join('\n');
      } else {
        const structured = OCRService.structure(source);
        const lines = structured.pairs.length ? structured.pairs.map(([key, value]) => `${key}：${value}`) : structured.lines;
        o.aiFix = ['AI 修复内容仅供参考，请人工核对后使用。', ...lines].join('\n');
      }
      o.edited = true;
      o.status = '表格还原完成';
      o.fieldDrafts = this.buildOcrFieldDrafts(o.aiFix || source, o.quality || OCRService.assessQuality(source), o.confirmedFields?.fields || o.demoFields?.fields || {});
      o.structured = this.renderOcrFieldTable('current');
      this.recordTask({
        type: 'OCR表格还原',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: '完成',
        summary: 'ocr_table_restore',
        result: o.aiFix
      });
      this.rerender();
      this.toast('AI 表格还原完成');
    });
  },

  async ocrAISave(btn) {
    const o = this.temp.ocr;
    const text = String(o.aiFix || '').trim();
    if (!text) throw new Error('暂无可保存的 AI 修复结果');
    await this.busy(btn, async () => {
      const sourceText = String(window.GlobalSystemState?.ocrResult?.text || o.result || o.demoFields?.rawText || '').trim();
      const quality = o.quality || OCRService.assessQuality(sourceText || text);
      const saved = o.fieldDrafts && o.fieldDrafts.fields ? o.fieldDrafts.fields : this.buildOcrFieldDrafts(text || sourceText, quality, o.demoFields?.fields || {}).fields;
      const confirmed = {
        confirmed: true,
        confirmedAt: Date.now(),
        fields: saved,
        quality,
        source: 'ocr'
      };
      o.confirmedFields = confirmed;
      this.touchOcrDocumentSession(o.documentSessionId || `doc-${o.providerResult?.requestId || uid()}`, { confirmedFields: confirmed }, 'fields_confirmed');
      localStorage.setItem('personal-ai-os-ocr-confirmed-fields', JSON.stringify(confirmed));
      o.result = sourceText || text;
      Store.state.ocrResult = {
        text: sourceText || text,
        table: Store.state.ocrResult?.table ?? null,
        imageMeta: Store.state.ocrResult?.imageMeta || {},
        status: 'success',
        quality
      };
      if (typeof emit === 'function') emit('ocr:completed', Store.state.ocrResult);
      if (typeof globalThis !== 'undefined') {
        syncGlobalSystemState({ ocrResult: Store.state.ocrResult });
      }
      o.edited = true;
      Store.save();
      this.recordTask({
        type: 'OCR人工保存',
        fileName: o.file?.name || '图片',
        module: 'ocr',
        status: '完成',
        summary: '人工确认后保存 OCR 结果',
        result: text
      });
      this.rerender();
      this.toast('字段已保存，请在后续报价、模板或导出前再次核对。');
    });
  },

  async ocrConfirmFields(btn) {
    const o = this.temp.ocr;
    const sourceText = String(window.GlobalSystemState?.ocrResult?.text || o.result || o.aiFix || o.demoFields?.rawText || '').trim();
    if (!sourceText) throw new Error('暂无可确认字段');
    await this.busy(btn, async () => {
      const quality = o.quality || OCRService.assessQuality(sourceText);
      const fields = this.getOcrFieldOrder().reduce((acc, field) => {
        if (field === '缺失字段' || field === '可信度') return acc;
        const input = document.querySelector(`[data-ocr-field="${CSS.escape(field)}"]`);
        acc[field] = this.normalizeOcrField(field, input?.value ?? o.fieldDrafts?.fields?.[field] ?? '', sourceText, quality);
        return acc;
      }, {});
      const missing = this.getOcrFieldOrder()
        .filter(field => field !== '可信度' && field !== '缺失字段')
        .filter(field => String(fields[field] || '待补充').trim() === '待补充');
      fields['可信度'] = quality.level === 'good' ? '高' : quality.level === 'medium' ? '中' : '低';
      fields['缺失字段'] = missing.length ? missing.join('、') : '无';
      const confirmed = {
        confirmed: true,
        confirmedAt: Date.now(),
        fields,
        quality,
        source: 'ocr'
      };
      o.confirmedFields = confirmed;
      o.fieldDrafts = { fields, rows: this.getOcrFieldOrder().map(field => ({
        field,
        value: fields[field] || '待补充',
        status: field === '可信度' ? fields[field] : (fields[field] && fields[field] !== '待补充' ? '已识别' : '未识别')
      })), quality, confirmed: true, confirmedAt: confirmed.confirmedAt, source: 'ocr' };
      localStorage.setItem('personal-ai-os-ocr-confirmed-fields', JSON.stringify(confirmed));
      this.toast('字段已保存，请在后续报价、模板或导出前再次核对。');
      this.rerender();
    });
  },

  async ocrLoadDemoFields(btn) {
    await this.busy(btn, async () => {
      const demo = this.buildOcrDemoFields();
      this.temp.ocr.demoFields = demo;
      this.temp.ocr.fieldDrafts = demo;
      this.temp.ocr.structured = this.renderOcrFieldTable('current');
      this.temp.ocr.quality = demo.quality;
      this.temp.ocr.status = '演示样例字段已加载';
      this.toast('已加载演示样例字段，不代表真实 OCR 已百分百识别成功。');
      this.rerender();
    });
  },

  async ocrTxt(btn) {
    const text = this.temp.ocr.result;
    if (!text) throw new Error('暂无识别文字');
    await this.busy(btn, async () => {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      Utils.download(blob, 'OCR识别结果.txt');
      this.recordDownload({
        filename: 'OCR识别结果.txt',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'txt',
        status: '已生成',
        summary: 'OCR 原始文本导出',
        blob
      });
      this.toast('OCR TXT 已导出');
    });
  },

  async ocrAiTxt(btn) {
    const text = this.temp.ocr.aiFix || '';
    if (!text) throw new Error('暂无 AI 修复结果');
    await this.busy(btn, async () => {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      Utils.download(blob, 'OCR AI修复结果.txt');
      this.recordDownload({
        filename: 'OCR AI修复结果.txt',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'txt',
        status: '已生成',
        summary: 'OCR AI 修复文本导出',
        blob
      });
      this.toast('AI 修复 TXT 已导出');
    });
  },

  async ocrExcel(btn) {
    const text = this.temp.ocr.result;
    if (!text) throw new Error('暂无识别文字');
    await this.busy(btn, async () => {
      const structured = OCRService.structure(text);
      const rows = structured.pairs.length ? [['字段', '值'], ...structured.pairs] : [['序号', '识别文字'], ...structured.lines.map((line, index) => [index + 1, line])];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'OCR结果');
      XLSX.writeFile(book, 'OCR识别结果.xlsx');
      this.recordDownload({
        filename: 'OCR识别结果.xlsx',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'xlsx',
        status: '已生成',
        summary: 'OCR 原始结果导出'
      });
      this.toast('OCR Excel 已导出');
    });
  },

  async ocrAiExcel(btn) {
    const text = this.temp.ocr.aiFix || '';
    if (!text) throw new Error('暂无 AI 修复结果');
    await this.busy(btn, async () => {
      const structured = OCRService.structure(text);
      const rows = structured.pairs.length ? [['字段', '值'], ...structured.pairs] : [['序号', '识别文字'], ...structured.lines.map((line, index) => [index + 1, line])];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'AI修复结果');
      XLSX.writeFile(book, 'OCR AI修复结果.xlsx');
      this.recordDownload({
        filename: 'OCR AI修复结果.xlsx',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'xlsx',
        status: '已生成',
        summary: 'OCR AI 修复结果导出'
      });
      this.toast('AI 修复 Excel 已导出');
    });
  },

  async ocrWord(btn) {
    const text = this.temp.ocr.result;
    if (!text) throw new Error('暂无识别文字');
    await this.busy(btn, async () => {
      const blob = await Utils.exportDocx('OCR识别结果', text, 'OCR识别结果');
      this.recordDownload({
        filename: 'OCR识别结果.docx',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'docx',
        status: '已生成',
        summary: 'OCR 原始 Word 导出',
        blob
      });
      this.toast('OCR Word 已导出');
    });
  },

  async ocrAiWord(btn) {
    const text = this.temp.ocr.aiFix || '';
    if (!text) throw new Error('暂无 AI 修复结果');
    await this.busy(btn, async () => {
      const blob = await Utils.exportDocx('OCR AI修复结果', text, 'OCR AI修复结果');
      this.recordDownload({
        filename: 'OCR AI修复结果.docx',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'docx',
        status: '已生成',
        summary: 'OCR AI 修复 Word 导出',
        blob
      });
      this.toast('AI 修复 Word 已导出');
    });
  },

  getOcrConfirmedFieldMap() {
    const session = (Store.state.ocrData?.documentSessions || []).find(item => item.document_session_id === this.temp.ocr?.documentSessionId);
    const saved = this.temp.ocr?.confirmedFields || session?.confirmedFields || JSON.parse(localStorage.getItem('personal-ai-os-ocr-confirmed-fields') || 'null');
    return saved && typeof saved === 'object' ? saved : null;
  },

  async ocrConfirmedTxt(btn) {
    const confirmed = this.getOcrConfirmedFieldMap();
    if (!confirmed?.fields) throw new Error('暂无人工确认字段');
    await this.busy(btn, async () => {
      const content = this.getOcrFieldOrder().map(field => `${field}：${confirmed.fields[field] || '待补充'}`).join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      Utils.download(blob, 'OCR人工确认字段.txt');
      this.recordDownload({
        filename: 'OCR人工确认字段.txt',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'txt',
        status: '已生成',
        summary: 'OCR 人工确认字段 TXT 导出',
        blob
      });
      this.toast('人工确认字段 TXT 已导出');
    });
  },

  async ocrConfirmedWord(btn) {
    const confirmed = this.getOcrConfirmedFieldMap();
    if (!confirmed?.fields) throw new Error('暂无人工确认字段');
    await this.busy(btn, async () => {
      const content = this.getOcrFieldOrder().map(field => `${field}：${confirmed.fields[field] || '待补充'}`).join('\n');
      const blob = await Utils.exportDocx('OCR人工确认字段', content, 'OCR人工确认字段');
      this.recordDownload({
        filename: 'OCR人工确认字段.docx',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'docx',
        status: '已生成',
        summary: 'OCR 人工确认字段 Word 导出',
        blob
      });
      this.toast('人工确认字段 Word 已导出');
    });
  },

  async ocrConfirmedExcel(btn) {
    const confirmed = this.getOcrConfirmedFieldMap();
    if (!confirmed?.fields) throw new Error('暂无人工确认字段');
    await this.busy(btn, async () => {
      const rows = [['字段', '值', '状态'], ...this.getOcrFieldOrder().map(field => [
        field,
        confirmed.fields[field] || '待补充',
        confirmed.fields[field] && confirmed.fields[field] !== '待补充' ? '已识别' : '未识别'
      ])];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '人工确认字段');
      XLSX.writeFile(book, 'OCR人工确认字段.xlsx');
      this.recordDownload({
        filename: 'OCR人工确认字段.xlsx',
        sourceModule: 'ocr',
        sourceName: this.temp.ocr.file?.name || 'OCR文件',
        fileType: 'xlsx',
        status: '已生成',
        summary: 'OCR 人工确认字段 Excel 导出'
      });
      this.toast('人工确认字段 Excel 已导出');
    });
  },

  async pptGenerate(btn) {
    const ws = this.getWorkspace('ppt');
    const topic = String(ws.topic || '').trim();
    const industry = String(ws.industry || '').trim();
    const pages = Math.max(3, Math.min(30, Number(ws.pages) || 8));
    const purpose = ws.purpose || '工作汇报';
    if (!topic) throw new Error('请输入 PPT 主题');
    if (!industry) throw new Error('请输入所属行业');
    await this.busy(btn, async () => {
      const prompt = `你是企业 PPT 策划助手。请生成一份可直接制作的 PPT 逐页大纲。\n主题：${topic}\n行业：${industry}\n页数：${pages}\n用途：${purpose}\n补充要求：${ws.prompt || '无'}\n\n严格输出 ${pages} 页，每页必须包含“第N页｜标题”“页面内容”“建议图表/视觉”，内容要符合行业和用途，不能只给通用摘要。`;
      const buildMock = reason => {
        const pagePlans = [
          ['封面', `${topic}；${industry} ${purpose}`], ['项目背景', '行业现状、业务痛点、建设必要性'],
          ['目标与范围', '项目目标、适用场景、实施边界'], ['总体方案', '业务架构、数据架构、AI Gateway能力'],
          ['核心功能', '生产计划、文件处理、智能分析、风险预警'], ['实施路径', '准备、试点、推广、持续优化'],
          ['价值指标', '效率、质量、交期、成本和可追溯性'], ['总结与下一步', '关键结论、行动计划、责任分工']
        ];
        while (pagePlans.length < pages) pagePlans.splice(pagePlans.length - 1, 0, [`业务专题${pagePlans.length - 5}`, '结合实际数据说明流程、风险与改进建议']);
        return [`Mock PPT 大纲｜${topic}`, `行业：${industry}｜用途：${purpose}｜页数：${pages}`, `AI Gateway 已自动降级 Mock。原因：${reason}`, '', ...pagePlans.slice(0, pages).map((item, index) => `第${index + 1}页｜${item[0]}\n页面内容：${item[1]}\n建议图表/视觉：${index < 2 ? '行业场景图与关键数字卡片' : '流程图、对比图或数据图表'}`)].join('\n\n');
      };
      try {
        const response = await AIService.complete(prompt, { mode: 'ppt-outline', module: 'ai-ppt', temperature: 0.3, mockFallback: buildMock });
        if (!response.text?.trim()) throw new Error('AI Gateway 返回内容为空');
        ws.result = response.text;
        ws.pptMode = response.mode === 'mock' ? 'mock' : 'gateway';
        ws.pptError = response.error || '';
      } catch (error) {
        ws.result = buildMock(AIService.friendlyMessage?.(error) || error.message);
        ws.pptMode = 'mock';
        ws.pptError = Utils.friendlyErrorMessage(AIService.friendlyMessage?.(error) || error.message);
      }
      ws.updatedAt = Date.now();
      Store.save();
      Store.addActivity(`生成 PPT 大纲：${topic}`, 'ai');
      this.rerender();
      this.toast(ws.pptMode === 'gateway' ? 'PPT 大纲生成成功' : 'PPT Mock 大纲生成成功');
    });
  },

  async sqlGenerate(btn) {
    const dialect = document.getElementById('sqlDialect')?.value || this.temp.sql.dialect;
    const prompt = document.getElementById('sqlPrompt')?.value.trim() || '';
    if (!prompt) throw new Error('请输入自然语言需求');
    await this.busy(btn, async () => {
      if (Store.state.settings.accessMode === 'local') {
        const result = SQLBuilder.build(dialect, prompt);
        this.temp.sql = { dialect, prompt, output: result.sql, explanation: result.explanation };
      } else {
        const res = await AIService.complete(
          `请根据以下业务需求生成 ${dialect} SQL，并附带简短说明。要求尽量使用真实业务字段，例如 customer_name、delivery_quantity、amount、delivery_date、status。需求：${prompt}`,
          { mode: 'sql', module: 'ai-sql' }
        );
        const parsed = this.extractSqlPayload(res.text);
        this.temp.sql = {
          dialect,
          prompt,
          output: parsed.sql,
          explanation: parsed.explanation || '已生成 SQL，可继续执行“解释SQL”或“优化SQL”查看说明。'
        };
      }
      Store.addActivity('生成 SQL', 'ai');
      this.rerender();
    });
  },

  async sqlOptimize(btn) {
    const sql = document.getElementById('sqlOutput')?.value.trim() || this.temp.sql.output;
    if (!sql) throw new Error('请先生成或输入 SQL');
    await this.busy(btn, async () => {
      if (Store.state.settings.accessMode === 'local') {
        this.temp.sql.output = formatSQL(sql);
        this.temp.sql.explanation = [
          '优化建议：避免 SELECT *，为 WHERE / GROUP BY / JOIN 涉及字段建立索引。',
          '索引建议：客户统计场景建议为 customer_name、delivery_date、status 建立组合或单列索引。',
          '执行计划提示：在 MySQL 用 EXPLAIN，在 SQL Server 查看 Actual Execution Plan，在 Oracle 查看 PLAN_TABLE。'
        ].join('\n');
      } else {
        const res = await AIService.complete(
          `请优化以下 ${this.temp.sql.dialect} SQL，并给出索引建议与执行计划提示：\n${sql}`,
          { mode: 'sql-optimize', module: 'ai-sql' }
        );
        this.temp.sql.explanation = res.text;
      }
      Store.addActivity('优化 SQL', 'ai');
      this.rerender();
    });
  },

  async sqlExplain(btn) {
    const sql = document.getElementById('sqlOutput')?.value.trim() || this.temp.sql.output;
    if (!sql) throw new Error('请先生成或输入 SQL');
    await this.busy(btn, async () => {
      if (Store.state.settings.accessMode === 'local') {
        const actions = [];
        if (/select/i.test(sql)) actions.push('读取查询结果');
        if (/group by/i.test(sql)) actions.push('按业务字段进行分组汇总');
        if (/sum\(/i.test(sql)) actions.push('聚合计算数量或金额');
        if (/where/i.test(sql)) actions.push('按条件过滤业务数据');
        if (/order by/i.test(sql)) actions.push('按关键指标排序');
        this.temp.sql.explanation = `SQL 解释：\n${actions.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\n字段检查：请确认 customer_name、delivery_quantity、amount、delivery_date 等字段与真实库结构一致。`;
      } else {
        const res = await AIService.complete(
          `请逐步解释以下 ${this.temp.sql.dialect} SQL 的作用，并指出潜在字段、索引与性能风险：\n${sql}`,
          { mode: 'sql-explain', module: 'ai-sql' }
        );
        this.temp.sql.explanation = res.text;
      }
      this.rerender();
    });
  },

  saveWritingDraft() {
    localStorage.setItem('personal-ai-os-writing-draft', JSON.stringify(this.temp.writing));
  },

  async writingGenerate(btn) {
    const type = document.querySelector('[name="writingType"]:checked')?.value || this.temp.writing.type;
    const prompt = document.getElementById('writingPrompt')?.value.trim() || '';
    if (!prompt) throw new Error('请输入写作要求');
    await this.busy(btn, async () => {
      let output = '';
      try {
        output = Store.state.settings.accessMode === 'local'
          ? WritingTemplates.generate(type, prompt)
          : (await AIService.complete(
              `文档类型：${type}\n要求：${prompt}\n请严格保留数量、客户、产品、交期、付款方式等关键数据，并使用对应正式模板输出。`,
              { mode: 'writing', module: 'ai-office-writing' }
            )).text;
      } catch (error) {
        this.recordAiError(error, 'writing-generate');
        output = `当前为演示模式，已使用内置演示数据生成结果。\n如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。\n\n${WritingTemplates.generate(type, prompt)}`;
      }
      this.temp.writing = { type, prompt, output };
      this.saveWritingDraft();
      Store.addActivity(`AI写作：${type}`, 'ai');
      this.rerender();
    });
  },

  async writingOptimize(btn) {
    const output = document.getElementById('writingOutput')?.value.trim() || this.temp.writing.output;
    if (!output) throw new Error('请先生成内容');
    await this.busy(btn, async () => {
      try {
        const r = await AIService.complete(output, { mode: 'polish' });
        this.temp.writing.output = r.text;
      } catch (error) {
        this.recordAiError(error, 'writing-optimize');
        this.temp.writing.output = `当前为演示模式，已使用内置演示数据生成结果。\n如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。\n\n${output}`;
      }
      this.saveWritingDraft();
      Store.addActivity('继续优化写作', 'ai');
      this.rerender();
    });
  },

  async writingExport() {
    if (!this.temp.writing.output) throw new Error('暂无内容');
    await Utils.exportDocx(this.temp.writing.type, this.temp.writing.output, this.temp.writing.type);
  },

  loadImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
    if (this.temp.image.url) URL.revokeObjectURL(this.temp.image.url);
    this.temp.image = {
      file,
      url: URL.createObjectURL(file),
      result: '',
      outputBlob: file,
      imageType: ImageAssistant.classify(file),
      ocrText: ''
    };
    this.rerender();
  },

  requireImage() {
    if (!this.temp.image.file) throw new Error('请先上传图片');
  },

  async imageDescribe(btn) {
    this.requireImage();
    await this.busy(btn, async () => {
      const dims = await imageDimensions(this.temp.image.url);
      const type = this.temp.image.imageType || ImageAssistant.classify(this.temp.image.file);
      let ocrText = this.temp.image.ocrText;
      if (type === '单据' && !ocrText) {
        ocrText = await OCRService.recognize(this.temp.image.file);
        this.temp.image.ocrText = ocrText;
      }
      this.temp.image.result = ImageAssistant.analyzeByType(type, ocrText, dims);
      Store.addActivity('图片智能分析', 'ai');
      this.rerender();
    });
  },

  async imageOcr(btn) {
    this.requireImage();
    await this.busy(btn, async () => {
      const text = await OCRService.recognize(this.temp.image.file);
      this.temp.image.ocrText = text;
      const meta = await imageDimensions(this.temp.image.url);
      const parsedTable = OCRService.structure(text);
      Store.state.ocrResult = {
        text,
        table: parsedTable.pairs.length ? parsedTable.pairs : parsedTable.lines,
        imageMeta: meta || {},
        status: text ? 'success' : 'failed'
      };
      if (typeof emit === 'function') emit('ocr:completed', Store.state.ocrResult);
      if (typeof globalThis !== 'undefined') {
        syncGlobalSystemState({ ocrResult: Store.state.ocrResult });
      }
      this.temp.image.result = `OCR识别结果\n\n${text}`;
      Store.addActivity('图片 OCR', 'ai');
      this.rerender();
    });
  },

  async imageCompress(btn) {
    this.requireImage();
    await this.busy(btn, async () => {
      const blob = await processImage(this.temp.image.url, () => {}, 0.72);
      this.temp.image.outputBlob = blob;
      this.temp.image.url = URL.createObjectURL(blob);
      this.temp.image.result = `压缩完成：${Utils.formatBytes(this.temp.image.file.size)} → ${Utils.formatBytes(blob.size)}`;
      Store.addActivity('压缩图片', 'file');
      this.rerender();
    });
  },

  async imageRemoveBg(btn) {
    this.requireImage();
    const type = this.temp.image.imageType || ImageAssistant.classify(this.temp.image.file);
    if (type === '单据' || type === '截图' || type === '证件') {
      throw new Error(`当前图片类型为“${type}”，不建议默认去背景，请优先使用 OCR 或分析功能`);
    }
    await this.busy(btn, async () => {
      const blob = await processImage(this.temp.image.url, (ctx, width, height) => {
        const img = ctx.getImageData(0, 0, width, height);
        const data = img.data;
        for (let i = 0; i < data.length; i += 4) {
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          if (min > 235) data[i + 3] = Math.max(0, 255 - (min - 235) * 13);
        }
        ctx.putImageData(img, 0, 0);
      }, 1, 'image/png');
      this.temp.image.outputBlob = blob;
      this.temp.image.url = URL.createObjectURL(blob);
      this.temp.image.result = '已完成产品图浅底去背景。复杂场景建议后续接入专业图像模型。';
      Store.addActivity('图片去背景', 'file');
      this.rerender();
    });
  },

  imageDownload() {
    this.requireImage();
    Utils.download(this.temp.image.outputBlob || this.temp.image.file, `处理后_${this.temp.image.file.name.replace(/\.[^.]+$/, '.png')}`);
  },

  async addFiles(files) {
    for (const file of files) {
      const id = uid();
      const now = Date.now();
      const meta = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        category: Utils.fileCategory(file),
        favorite: false,
        updatedAt: now,
        uploadedAt: now,
        openCount: 0
      };
      await FileDB.put({ id, blob: file, meta });
      Store.state.files.unshift(meta);
    }
    Store.save();
    Store.addActivity(`上传 ${files.length} 个文件`, 'file');
    this.toast(`已保存 ${files.length} 个文件`);
    this.rerender();
  },

  fileFavorite(id) {
    const file = Store.state.files.find(item => item.id === id);
    if (file) {
      file.favorite = !file.favorite;
      file.updatedAt = Date.now();
      Store.save();
      this.rerender();
    }
  },

  async fileOpen(id) {
    const rec = await FileDB.get(id);
    if (!rec) throw new Error('文件内容不存在');
    const meta = Store.state.files.find(item => item.id === id);
    if (!meta) throw new Error('文件记录不存在');
    meta.openCount = (meta.openCount || 0) + 1;
    meta.updatedAt = Date.now();
    Store.touchRecentFile(id);
    const category = meta.category;
    if (category === '表格') {
      const file = new File([rec.blob], meta.name, { type: rec.blob.type || meta.type });
      await this.loadExcel(file);
      this.temp.excel.loadedFromFileId = id;
      this.navigate('excel');
      return;
    }
    if (category === '文档') {
      const ext = Utils.fileExt({ name: meta.name });
      if (ext === 'doc') throw new Error('当前文件是 .doc，请先转为 .docx 后再在 Word 助手中处理');
      const file = new File([rec.blob], meta.name, { type: rec.blob.type || meta.type });
      await this.loadWord(file);
      return;
    }
    if (category === 'PDF') {
      const file = new File([rec.blob], meta.name, { type: rec.blob.type || meta.type });
      await this.loadPdfs([file]);
      this.temp.pdf.loadedFromFileId = id;
      this.navigate('pdf');
      return;
    }
    if (category === '图片') {
      const file = new File([rec.blob], meta.name, { type: rec.blob.type || meta.type });
      this.loadImage(file);
      this.navigate('image');
      return;
    }
    const url = URL.createObjectURL(rec.blob);
    const win = window.open('about:blank', '_blank');
    if (win) win.location = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    Store.addActivity(`打开文件：${meta.name}`, 'file');
  },

  async fileDownload(id) {
    const rec = await FileDB.get(id);
    if (!rec) throw new Error('文件内容不存在');
    Utils.download(rec.blob, rec.meta.name);
    Store.addActivity(`下载文件：${rec.meta.name}`, 'file');
  },

  async fileDelete(id) {
    const file = Store.state.files.find(item => item.id === id);
    if (!file) return;
    if (!confirm(`确定删除“${file.name}”？`)) return;
    await FileDB.delete(id);
    Store.state.files = Store.state.files.filter(item => item.id !== id);
    Store.state.recentOpenIds = Store.state.recentOpenIds.filter(item => item !== id);
    Store.save();
    Store.addActivity(`删除文件：${file.name}`, 'file');
    this.rerender();
  },

  async downloadCenterDownload(id) {
    const record = (Store.state.downloadRecords || []).find(item => item.id === id);
    if (!record) throw new Error('下载记录不存在');
    const cache = this.temp.downloadCache || {};
    if (cache[id]) {
      Utils.download(cache[id], record.filename);
      this.toast(`已下载 ${record.filename}`);
      return;
    }
    const file = Store.state.files.find(item => item.name === record.filename || item.name === record.sourceName);
    if (file) {
      await this.fileDownload(file.id);
      return;
    }
    throw new Error('当前下载记录无法重新下载，请重新导出');
  },

  async fileRename(id) {
    const file = Store.state.files.find(item => item.id === id);
    if (!file) return;
    const next = prompt('输入新的文件名', file.name);
    if (!next || next === file.name) return;
    file.name = next.trim();
    file.updatedAt = Date.now();
    const rec = await FileDB.get(id);
    if (rec) {
      rec.meta.name = file.name;
      await FileDB.put(rec);
    }
    Store.save();
    this.rerender();
  },

  kbAdd() {
    const title = document.getElementById('kbTitle')?.value.trim();
    const content = document.getElementById('kbContent')?.value.trim();
    if (!title || !content) throw new Error('请填写知识标题和内容');
    Store.state.knowledge.unshift(KnowledgeEngine.buildEntry({ title, content, sourceType: 'manual' }));
    Store.save();
    Store.addActivity(`添加知识：${title}`);
    this.rerender();
  },

  async addKnowledgeFiles(files) {
    for (const file of files) {
      this.toast(`正在提取：${file.name}`);
      const content = await Utils.extractFileText(file);
      Store.state.knowledge.unshift(KnowledgeEngine.buildEntry({ title: file.name, content, sourceType: 'file', fileName: file.name }));
    }
    Store.save();
    Store.addActivity(`导入 ${files.length} 个知识文件`, 'file');
    this.toast('知识文件已导入');
    this.rerender();
  },

  async kbAsk(btn) {
    const q = document.getElementById('kbQuestion')?.value.trim() || this.temp.kbQuestion;
    if (!q) throw new Error('请输入知识库问题');
    if (!Store.state.knowledge.length) throw new Error('请先添加知识内容');
    this.temp.kbQuestion = q;
    await this.busy(btn, async () => {
      const answer = KnowledgeEngine.answer(q, Store.state.knowledge);
      this.temp.kbAnswer = `${answer.text}${answer.refs?.length ? `\n\n参考资料：${answer.refs.join('、')}` : ''}`;
      Store.addActivity(`知识库问答：${q.slice(0, 25)}`, 'ai');
      this.rerender();
    });
  },

  kbDelete(id) {
    const item = Store.state.knowledge.find(entry => entry.id === id);
    if (item && confirm(`删除知识“${item.title}”？`)) {
      Store.state.knowledge = Store.state.knowledge.filter(entry => entry.id !== id);
      Store.save();
      this.rerender();
    }
  },

  normalizeRuntimeTask(task = {}) {
    const output = task.output_payload || {};
    const logs = Array.isArray(task.logs) ? task.logs : [];
    const startedAt = new Date(task.created_at || Date.now()).getTime();
    const updatedAt = new Date(task.updated_at || task.created_at || Date.now()).getTime();
    const lastFailure = logs.slice().reverse().find(log => ['failed', 'timeout', 'cancelled'].includes(log.status) || log.error_message);
    return {
      id: task.id,
      runtime: true,
      time: updatedAt,
      createdAt: startedAt,
      updatedAt,
      startedAt,
      finishedAt: ['success', 'failed', 'timeout', 'cancelled'].includes(task.status) ? updatedAt : 0,
      type: task.title || 'Agent 任务',
      fileName: task.input_payload?.filename || '',
      module: 'agent-runtime',
      status: task.status || 'pending',
      failureType: task.failureType || Stability.classifyFailure(task.error_message || lastFailure?.error_message || task.error_code || ''),
      errorMessage: task.error_message || lastFailure?.error_message || '',
      summary: output.summary || task.error_message || '',
      result: output.result || task.error_message || '',
      sourceId: task.id,
      route: 'agent',
      retryCount: Number(task.retry_count || 0),
      durationMs: Number(task.durationMs || task.duration_ms || (updatedAt && startedAt ? Math.max(0, updatedAt - startedAt) : 0)),
      circuitState: task.circuitState || task.circuit_state || 'unknown',
      requestId: lastFailure?.request_id || logs[0]?.request_id || '',
      cancellable: ['pending', 'running', 'waiting_human'].includes(task.status),
      retryable: ['failed', 'timeout', 'cancelled'].includes(task.status)
    };
  },

  async refreshAgentRuntime(silent = false) {
    if (!AuthClient.isLoggedIn() || AuthClient.isDemo()) return;
    const [tasksRes, toolsRes, monitorRes, memoryRes] = await Promise.all([
      APIClient.request('/api/agents/tasks'),
      APIClient.request('/api/agents/tools'),
      APIClient.request('/api/agents/monitor'),
      APIClient.request('/api/agents/memory')
    ]);
    const tasks = tasksRes.data?.items || [];
    const approvals = tasks.filter(item => item.approval).map(item => ({
      id: item.approval.id,
      taskId: item.id,
      toolName: item.approval.tool_name,
      actionLabel: item.approval.action_label,
      status: item.approval.status,
      reason: item.approval.reason,
      createdAt: new Date(item.approval.created_at).getTime()
    }));
    const runtimeRecords = tasks.map(task => this.normalizeRuntimeTask(task));
    const nonRuntime = (Store.state.taskRecords || []).filter(item => !item.runtime);
    Store.state.taskRecords = [...runtimeRecords, ...nonRuntime].sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 200);
    Store.state.agentRuns = tasks.slice(0, 20).map(task => ({
      id: task.id,
      goal: task.goal,
      result: task.output_payload?.summary || task.output_payload?.result || task.error_message || '',
      status: task.status,
      time: new Date(task.updated_at || task.created_at || Date.now()).getTime()
    }));
    Store.state.agentApprovals = approvals;
    Store.state.toolCatalog = toolsRes.data?.items || [];
    if (!this.temp.toolSelectedName && Store.state.toolCatalog[0]) this.temp.toolSelectedName = Store.state.toolCatalog[0].toolName;
    Store.state.runtimeMonitor = monitorRes.data?.monitor || Store.state.runtimeMonitor;
    Store.state.memoryEntries = memoryRes.data?.items || [];
    Store.state.dashboard = {
      ...Store.state.dashboard,
      agentExecutions: tasks.length,
      systemStatus: approvals.length ? '等待审批' : (tasks.some(item => item.status === 'failed') ? '存在失败任务' : Store.state.dashboard.systemStatus)
    };
    const latest = tasks[0];
    if (latest) {
      this.temp.agent.currentRunId = latest.id;
      this.temp.agent.status = latest.status || this.temp.agent.status;
      this.temp.agent.steps = (latest.input_payload?.plan || []).map((step, index) => ({
        key: step.key || step.toolName || `step_${index + 1}`,
        text: step.label || step.actionLabel || step.toolName || `步骤 ${index + 1}`,
        status: index < Number(latest.current_step || 0)
          ? '已完成'
          : latest.status === 'waiting_human' && index === Number(latest.current_step || 0)
            ? '等待审批'
            : latest.status === 'running' && index === Number(latest.current_step || 0)
              ? '执行中'
              : latest.status === 'failed' && index === Number(latest.current_step || 0)
                ? '失败'
                : latest.status === 'timeout' && index === Number(latest.current_step || 0)
                  ? '超时'
                  : latest.status === 'cancelled' && index === Number(latest.current_step || 0)
                    ? '已取消'
                    : '等待中',
        duration: 0,
        error: index === Number(latest.current_step || 0) ? (latest.error_message || '') : ''
      }));
      this.temp.agent.logs = (latest.logs || []).map(log => ({
        id: log.id,
        time: new Date(log.created_at).toLocaleTimeString('zh-CN'),
        text: `${log.tool_name || log.agent_name || 'agent'} · ${log.status}${log.error_message ? ` · ${log.error_message}` : ''}`,
        status: log.status,
        stepKey: log.tool_name || ''
      }));
      this.temp.agent.result = latest.output_payload?.result || latest.error_message || this.temp.agent.result;
    }
    this.updateStabilityHealthSnapshot('agent-runtime-refresh');
    Store.save();
    if (!silent) this.rerender();
  },

  async refreshTaskCenter() {
    await Store.hydrateFromServer();
    await this.refreshAgentRuntime(true);
    this.rerender();
    this.toast(Store.syncStatus.mode === 'server' ? '任务和业务日志已从后端刷新' : Store.syncStatus.message, Store.syncStatus.mode === 'server' ? 'success' : 'warning');
  },

  agentPlan() {
    const goal = document.getElementById('agentGoal')?.value.trim() || this.temp.agent.goal;
    if (!goal) throw new Error('请输入任务目标');
    const steps = this.buildAgentSteps(goal);
    this.temp.agent = {
      ...this.temp.agent,
      goal,
      steps: steps.map(step => ({ ...step, status: '等待中', duration: 0, error: '' })),
      logs: [],
      result: '',
      running: false,
      status: '等待中',
      cancelRequested: false
    };
    this.rerender();
  },

  buildAgentSteps(goal) {
    if (/标书.*发送邮件|生成标书并发送邮件|投标.*发送/i.test(goal)) {
      return [
        { key: 'bidding_prepare', text: '调用招投标助手生成标书内容' },
        { key: 'export_pdf', text: '导出 PDF' },
        { key: 'mail_generate', text: '调用邮件助手生成提交邮件' },
        { key: 'mail_attach', text: '附加投标文件' },
        { key: 'mail_send', text: '使用 Agent Mail 发送或演示发送' },
        { key: 'mail_record', text: '保存发送记录与执行日志' }
      ];
    }
    if (/excel.*日报|日报.*excel|一键企业办公流程/i.test(goal)) {
      return [
        { key: 'excel_stats', text: '调用 Excel 助手统计产品明细' },
        { key: 'write_report', text: '调用 Word 助手生成日报' },
        { key: 'export_pdf', text: '导出 PDF' },
        { key: 'save_file', text: '保存到文件中心' },
        { key: 'save_knowledge', text: '建立知识条目' }
      ];
    }
    if (/知识库|问答/.test(goal)) return [
      { key: 'knowledge_prepare', text: '检查知识库资料' },
      { key: 'knowledge_answer', text: '生成问答结果' }
    ];
    if (/文件/.test(goal)) return [
      { key: 'file_prepare', text: '读取文件中心记录' },
      { key: 'file_sort', text: '按类型与时间整理文件' }
    ];
    if (/表格|excel/i.test(goal)) return [
      { key: 'excel_stats', text: '读取表格并统计关键指标' },
      { key: 'excel_analyze', text: '输出业务分析' }
    ];
    return [
      { key: 'goal_check', text: '理解任务目标与可调用工具' },
      { key: 'run_best_effort', text: '尝试调用已有模块处理任务' }
    ];
  },

  agentLog(text, status = 'info', stepKey = '') {
    this.temp.agent.logs.push({
      id: uid(),
      time: new Date().toLocaleTimeString('zh-CN'),
      text,
      status,
      stepKey
    });
  },

  async agentRun(btn) {
    if (!AuthClient.isLoggedIn() || AuthClient.isDemo()) return this.agentRunLocal(btn);
    const goal = document.getElementById('agentGoal')?.value.trim() || this.temp.agent.goal;
    if (!goal) throw new Error('请输入任务目标');
    this.temp.agent.goal = goal;
    await this.busy(btn, async () => {
      const input = {
        goal,
        prompt: goal,
        text: [
          this.temp.excel.result,
          this.temp.pdf.extracted,
          this.temp.ocr.result,
          this.getWorkspace('productionplan').planResult
        ].filter(Boolean).join('\n\n'),
        rows: this.temp.excel.rows || [],
        filename: this.temp.excel.file?.name || this.temp.pdf.files?.[0]?.name || this.temp.ocr.file?.name || '',
        sql: this.temp.sql.prompt || '',
        outputName: safeName(this.temp.word.title || 'agent-report.txt'),
        outputText: this.temp.word.content || this.getWorkspace('writing').result || ''
      };
      const res = await APIClient.request('/api/agents/tasks', {
        method: 'POST',
        body: JSON.stringify({ goal, input })
      });
      const task = res.data?.task;
      this.temp.agent.currentRunId = task?.id || '';
      this.temp.agent.status = task?.status || 'pending';
      if (task?.id) {
        const runtimeTask = this.normalizeRuntimeTask(task);
        Store.state.taskRecords = [runtimeTask, ...(Store.state.taskRecords || []).filter(item => item.id !== task.id)].slice(0, 200);
        Store.state.agentRuns = [{
          id: task.id,
          goal: task.goal,
          result: task.output_payload?.summary || task.output_payload?.result || task.error_message || '',
          status: task.status || 'pending',
          time: new Date(task.updated_at || task.created_at || Date.now()).getTime()
        }, ...(Store.state.agentRuns || []).filter(item => item.id !== task.id)].slice(0, 20);
        Store.save();
      }
      try {
        await this.refreshAgentRuntime(true);
      } catch (error) {
        this.agentLog(`刷新 Agent 状态失败：${Utils.friendlyErrorMessage(error.message)}`, 'warning');
      }
      this.rerender();
      this.pollRuntimeTask(task?.id);
    });
  },

  async agentRunLocal(btn) {
    if (this.temp.agent.running) return;
    if (!this.temp.agent.steps.length) this.agentPlan();
    const agent = this.temp.agent;
    agent.running = true;
    agent.status = '执行中';
    agent.cancelRequested = false;
    agent.logs = [];
    this.agentLog('任务开始，已进入执行状态。');
    this.rerender();
    clearTimeout(this.agentTimer);
    this.agentTimer = setTimeout(() => {
      if (agent.running) {
        agent.status = '失败';
        agent.running = false;
        agent.result = '任务超时：单次 Agent 执行超过 30 秒，已自动停止。';
        this.agentLog('任务超时，已停止执行。', 'error');
        this.rerender();
      }
    }, 30000);
    try {
      for (const step of agent.steps) {
        if (agent.cancelRequested) throw new Error('任务已取消');
        const start = performance.now();
        step.status = '执行中';
        this.agentLog(`开始：${step.text}`, 'info', step.key);
        this.rerender();
        await this.runAgentStep(step);
        step.duration = Math.round(performance.now() - start);
        step.status = '已完成';
        this.agentLog(`完成：${step.text}（${step.duration} ms）`, 'success', step.key);
        this.rerender();
      }
      agent.result = this.agentFinalResult();
      agent.status = '已完成';
      agent.running = false;
      Store.state.agentRuns.unshift({
        id: uid(),
        goal: agent.goal,
        steps: structuredClone(agent.steps),
        logs: structuredClone(agent.logs),
        result: agent.result,
        status: agent.status,
        time: Date.now()
      });
      Store.save();
      Store.addActivity(`Agent 完成：${agent.goal.slice(0, 28)}`, 'ai');
      this.rerender();
    } catch (error) {
      clearTimeout(this.agentTimer);
      agent.running = false;
      agent.status = error.message === '任务已取消' ? '取消' : '失败';
      agent.result = Utils.friendlyErrorMessage(error.message);
      const current = agent.steps.find(step => step.status === '执行中');
      if (current) {
        current.status = agent.status;
        current.error = Utils.friendlyErrorMessage(error.message);
      }
      this.agentLog(`失败：${Utils.friendlyErrorMessage(error.message)}`, 'error');
      this.rerender();
      throw error;
    } finally {
      clearTimeout(this.agentTimer);
    }
  },

  agentStop() {
    if (AuthClient.isLoggedIn() && !AuthClient.isDemo() && this.temp.agent.currentRunId) {
      return this.runtimeTaskCancel(this.temp.agent.currentRunId);
    }
    if (!this.temp.agent.running) return;
    this.temp.agent.cancelRequested = true;
    this.temp.agent.status = '取消';
    this.agentLog('收到停止指令，正在取消任务。', 'warning');
    this.rerender();
  },

  async pollRuntimeTask(taskId) {
    if (!taskId || !AuthClient.isLoggedIn() || AuthClient.isDemo()) return;
    clearTimeout(this.runtimePoller);
    const tick = async () => {
      const res = await APIClient.request(`/api/agents/tasks/${taskId}`);
      const task = res.data?.task;
      if (!task) return;
      const normalized = this.normalizeRuntimeTask(task);
      Store.state.taskRecords = [normalized, ...(Store.state.taskRecords || []).filter(item => item.id !== task.id)].slice(0, 200);
      this.temp.agent.currentRunId = task.id;
      this.temp.agent.status = task.status || 'running';
      this.temp.agent.steps = (task.input_payload?.plan || []).map((step, index) => ({
        key: step.key || step.toolName || `step_${index + 1}`,
        text: step.label || step.actionLabel || step.toolName || `步骤 ${index + 1}`,
        status: index < Number(task.current_step || 0)
          ? '已完成'
          : task.status === 'waiting_human' && index === Number(task.current_step || 0)
            ? '等待审批'
            : task.status === 'running' && index === Number(task.current_step || 0)
              ? '执行中'
              : task.status === 'failed' && index === Number(task.current_step || 0)
                ? '失败'
                : task.status === 'timeout' && index === Number(task.current_step || 0)
                  ? '超时'
                  : task.status === 'cancelled' && index === Number(task.current_step || 0)
                    ? '已取消'
                    : '等待中',
        duration: 0,
        error: index === Number(task.current_step || 0) ? (task.error_message || '') : ''
      }));
      this.temp.agent.result = task.output_payload?.result || task.error_message || '';
      this.temp.agent.logs = (task.logs || []).map(log => ({
        id: log.id,
        time: new Date(log.created_at).toLocaleTimeString('zh-CN'),
        text: `${log.tool_name || log.agent_name || 'agent'} · ${log.status}${log.error_message ? ` · ${log.error_message}` : ''}`,
        status: log.status,
        stepKey: log.tool_name || ''
      }));
      if (task.approval) {
        Store.state.agentApprovals = [{
          id: task.approval.id,
          taskId: task.id,
          toolName: task.approval.tool_name,
          actionLabel: task.approval.action_label,
          status: task.approval.status,
          reason: task.approval.reason,
          createdAt: new Date(task.approval.created_at).getTime()
        }, ...(Store.state.agentApprovals || []).filter(item => item.id !== task.approval.id)];
      }
      Store.save();
      this.rerender();
      if (!['pending', 'running', 'waiting_human'].includes(task.status)) return;
      this.runtimePoller = setTimeout(() => tick().catch(error => this.toast(Utils.friendlyErrorMessage(error.message), 'error')), 1500);
    };
    await tick();
  },

  async runtimeTaskCancel(taskId) {
    await APIClient.request(`/api/agents/tasks/${taskId}/cancel`, { method: 'POST', body: JSON.stringify({}) });
    await this.refreshAgentRuntime();
    this.toast('任务已取消');
  },

  async runtimeTaskRetry(taskId) {
    await APIClient.request(`/api/agents/tasks/${taskId}/retry`, { method: 'POST', body: JSON.stringify({}) });
    await this.refreshAgentRuntime();
    this.pollRuntimeTask(taskId);
    this.toast('任务已重新执行');
  },

  async cancelTaskRecord(taskId) {
    const task = (Store.state.taskRecords || []).find(item => item.id === taskId);
    if (!task) return this.toast('未找到任务', 'error');
    if (task.runtime) return this.runtimeTaskCancel(taskId);
    const now = Date.now();
    Object.assign(task, Stability.normalizeTask({
      ...task,
      status: 'cancelled',
      updatedAt: now,
      finishedAt: now,
      errorMessage: task.errorMessage || '用户在 Task Center 取消任务',
      summary: task.summary || '任务已取消'
    }));
    this.updateStabilityHealthSnapshot('task-cancelled');
    Store.save();
    this.toast('任务已标记为取消');
    this.rerender();
  },

  async retryTaskRecord(taskId) {
    const task = (Store.state.taskRecords || []).find(item => item.id === taskId);
    if (!task) return this.toast('未找到任务', 'error');
    if (task.runtime) return this.runtimeTaskRetry(taskId);
    const retry = Stability.normalizeTask({
      ...task,
      id: uid(),
      sourceId: task.id,
      status: 'pending',
      time: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      finishedAt: 0,
      retryCount: Number(task.retryCount || 0) + 1,
      summary: `重试任务：${task.summary || task.type || task.fileName || '本地任务'}`,
      result: '',
      errorMessage: ''
    });
    Store.state.taskRecords.unshift(retry);
    Store.state.taskRecords = Store.state.taskRecords.slice(0, 200);
    this.temp.taskSelectedId = retry.id;
    this.updateStabilityHealthSnapshot('task-retry-created');
    Store.save();
    this.toast('已创建本地重试记录');
    this.rerender();
  },

  async runtimeApproval(taskId, approved) {
    await APIClient.request(`/api/agents/tasks/${taskId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason: approved ? '人工审批通过' : '人工审批拒绝' })
    });
    await this.refreshAgentRuntime();
    if (approved) this.pollRuntimeTask(taskId);
    this.toast(approved ? '审批已通过，任务继续执行' : '审批已拒绝，任务已终止');
  },

  async toolCenterRun(btn) {
    if (!AuthClient.isLoggedIn() || AuthClient.isDemo()) throw new Error('请使用后端登录后再执行 Tool Center');
    const selected = Store.state.toolCatalog.find(item => item.toolName === this.temp.toolSelectedName) || Store.state.toolCatalog[0];
    if (!selected) throw new Error('当前没有可执行工具');
    const ws = this.getWorkspace('toolcenter');
    await this.busy(btn, async () => {
      const startedAt = Date.now();
      const raw = document.getElementById('toolcenterInput')?.value.trim() || ws.prompt || '{}';
      ws.prompt = raw;
      let input;
      try {
        input = JSON.parse(raw || '{}');
      } catch {
        throw new Error('参数格式错误：请输入合法 JSON');
      }
      const res = await APIClient.request(`/api/agents/tools/${selected.toolName}/execute`, {
        method: 'POST',
        body: JSON.stringify({ input })
      });
      const result = res.data?.result || {};
      ws.result = JSON.stringify(result || {}, null, 2);
      this.upsertStabilityTask({
        id: uid(),
        type: `Tool ${selected.toolName}`,
        module: 'toolcenter',
        status: result.status || (result.ok ? 'success' : 'failed'),
        startedAt,
        updatedAt: Date.now(),
        finishedAt: Date.now(),
        durationMs: Number(result.durationMs || (Date.now() - startedAt)),
        retryCount: Number(result.retryCount || 0),
        failureType: result.failureType || Stability.classifyFailure(result.error || ''),
        errorMessage: result.error || '',
        summary: `${selected.toolName} · circuit ${result.circuitState || selected.circuitState || 'closed'}`,
        result: ws.result,
        requestId: result.requestId || '',
        circuitState: result.circuitState || selected.circuitState || 'closed',
        retryable: !result.ok,
        cancellable: false,
        source: 'toolcenter'
      });
      Store.save();
      this.rerender();
    });
  },

  async runAgentStep(step) {
    switch (step.key) {
      case 'excel_stats':
        if (!this.temp.excel.rows.length) throw new Error('Excel 助手未加载数据，无法执行统计');
        this.excelStats();
        return;
      case 'bidding_prepare':
        if (!this.getWorkspace('bidding').prompt && !this.getWorkspace('bidding').result) this.demoBid();
        await this.biddingAnalyze();
        return;
      case 'excel_analyze':
        if (!this.temp.excel.rows.length) throw new Error('Excel 助手未加载数据，无法分析');
        this.temp.excel.result = ExcelBusiness.report(this.getExcelAnalysis().records, this.temp.excel.meta);
        return;
      case 'write_report': {
        const stats = this.temp.excel.summary || this.getExcelAnalysis().summary;
        this.temp.word.title = `日报_${stats.customer}_${stats.deliveryDate}`;
        this.temp.word.content = WritingTemplates.generate('日报', `客户：${stats.customer}\n产品：${this.temp.excel.records[0]?.name || ''}\n数量：${stats.totalQuantity}\n交期：${stats.deliveryDate}\n付款方式：${stats.payment}\n运输方式：${stats.transport}`);
        localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
        return;
      }
      case 'export_pdf':
        if (this.temp.word.content) await Utils.exportPdf(this.temp.word.title, this.temp.word.content);
        else if (this.getWorkspace('bidding').result) await Utils.exportPdf('投标文件摘要', this.getWorkspace('bidding').result);
        else throw new Error('暂无可导出的文档内容');
        return;
      case 'mail_generate':
        this.biddingMail();
        await this.mailGenerate();
        return;
      case 'mail_attach': {
        const mail = this.getMailWorkspace();
        if (!(mail.attachments || []).length) this.biddingMail();
        mail.finalVersionChecked = true;
        Store.save();
        return;
      }
      case 'mail_send': {
        const mail = this.getMailWorkspace();
        mail.approvalStatus = '已确认';
        if (!mail.recipient) mail.recipient = 'demo-tender@company.com';
        await this.mailConfirmSend();
        return;
      }
      case 'mail_record':
        if (!Store.state.mailRecords.length) throw new Error('未生成发送记录');
        return;
      case 'save_file': {
        if (!this.temp.word.content) throw new Error('无可保存文档');
        const blob = await new Blob([this.temp.word.content], { type: 'text/plain;charset=utf-8' });
        const file = new File([blob], `${safeName(this.temp.word.title || '日报')}.txt`, { type: 'text/plain' });
        await this.addFiles([file]);
        return;
      }
      case 'save_knowledge':
        if (!this.temp.word.content) throw new Error('无日报内容，无法写入知识库');
        Store.state.knowledge.unshift(KnowledgeEngine.buildEntry({
          title: this.temp.word.title,
          content: this.temp.word.content,
          sourceType: 'agent'
        }));
        Store.save();
        return;
      case 'knowledge_prepare':
        if (!Store.state.knowledge.length) throw new Error('知识库为空，无法执行问答');
        return;
      case 'knowledge_answer':
        this.temp.agent.result = KnowledgeEngine.answer(this.temp.agent.goal, Store.state.knowledge).text;
        return;
      case 'file_prepare':
        if (!Store.state.files.length) throw new Error('文件中心暂无文件');
        return;
      case 'file_sort':
        Store.state.files.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        Store.save();
        return;
      case 'goal_check':
        if (Store.state.settings.accessMode === 'cloud' && !Store.state.settings.apiUrl) {
          throw new Error('云端模式未配置服务端 AI Gateway 地址');
        }
        return;
      case 'run_best_effort':
        if (/pdf/i.test(this.temp.agent.goal) && !this.temp.pdf.files.length) throw new Error('PDF助手未加载文件');
        return;
      default:
        throw new Error(`未知步骤：${step.key}`);
    }
  },

  agentFinalResult() {
    const stats = this.temp.excel.summary;
    if (stats) {
      return [
        `任务完成`,
        `客户：${stats.customer}`,
        `产品明细：${stats.lineCount} 行`,
        `总数量：${stats.totalQuantity}`,
        `总金额：${stats.totalAmount.toFixed(2)}`,
        `付款方式：${stats.payment}`,
        `运输方式：${stats.transport}`
      ].join('\n');
    }
    return this.temp.agent.result || '任务已完成。';
  },

  async enterpriseWorkflow(btn) {
    if (!this.temp.excel.rows.length) throw new Error('请先在 Excel 助手加载发货单或统计表');
    const ws = this.getWorkspace('workflow');
    const stabilityTaskId = uid();
    const startedAt = Date.now();
    const retryCount = Number(ws.retryCount || 0);
    const workflowSteps = [
      { key: 'excel_stats', label: '统计 Excel 数据' },
      { key: 'word_report', label: '生成企业日报' },
      { key: 'export_pdf', label: '导出 PDF' },
      { key: 'save_file', label: '保存到文件中心' },
      { key: 'save_knowledge', label: '写入知识库' }
    ];
    ws.steps = workflowSteps.map(step => ({ ...step, status: retryCount ? 'retrying' : 'pending', durationMs: 0, errorMessage: '' }));
    await this.busy(btn, async () => {
      this.upsertStabilityTask({
        id: stabilityTaskId,
        type: 'Workflow',
        module: 'workflow',
        status: retryCount ? 'retrying' : 'running',
        startedAt,
        retryCount,
        cancellable: true,
        retryable: false,
        source: 'workflow'
      });
      const runStep = async (key, fn) => {
        const step = ws.steps.find(item => item.key === key);
        const stepStartedAt = Date.now();
        if (step) step.status = 'running';
        try {
          const result = await fn();
          if (step) {
            step.status = 'success';
            step.durationMs = Date.now() - stepStartedAt;
          }
          return result;
        } catch (error) {
          if (step) {
            step.status = 'failed';
            step.durationMs = Date.now() - stepStartedAt;
            step.errorMessage = Utils.friendlyErrorMessage(error?.message || error);
            step.failureType = Stability.classifyFailure(error?.message || error);
          }
          throw error;
        } finally {
          Store.save();
        }
      };
      try {
        await runStep('excel_stats', async () => this.excelStats());
        const stats = this.temp.excel.summary || this.getExcelAnalysis().summary;
        await runStep('word_report', async () => {
          this.temp.word.title = `企业日报_${stats.customer}_${stats.deliveryDate}`;
          this.temp.word.content = WritingTemplates.generate('日报', `客户：${stats.customer}\n产品：${this.temp.excel.records.map(item => item.name).filter(Boolean).join('、')}\n数量：${stats.totalQuantity}\n交期：${stats.deliveryDate}\n付款方式：${stats.payment}\n运输方式：${stats.transport}`);
          localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
        });
        await runStep('export_pdf', async () => Utils.exportPdf(this.temp.word.title, this.temp.word.content));
        await runStep('save_file', async () => {
          const textFile = new File([new Blob([this.temp.word.content], { type: 'text/plain;charset=utf-8' })], `${safeName(this.temp.word.title)}.txt`, { type: 'text/plain' });
          await this.addFiles([textFile]);
        });
        await runStep('save_knowledge', async () => {
          Store.state.knowledge.unshift(KnowledgeEngine.buildEntry({ title: this.temp.word.title, content: this.temp.word.content, sourceType: 'workflow' }));
        });
        ws.retryCount = 0;
        this.upsertStabilityTask({
          id: stabilityTaskId,
          type: 'Workflow',
          module: 'workflow',
          status: 'success',
          startedAt,
          updatedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          retryCount,
          summary: '一键企业办公流程完成',
          result: this.temp.word.content,
          cancellable: false,
          retryable: false,
          source: 'workflow'
        });
        Store.save();
        Store.addActivity('一键企业办公流程完成', 'ai');
        this.toast('一键企业办公流程已完成');
        this.rerender();
      } catch (error) {
        ws.retryCount = retryCount + 1;
        this.upsertStabilityTask({
          id: stabilityTaskId,
          type: 'Workflow',
          module: 'workflow',
          status: error?.code === 'CANCELLED' ? 'cancelled' : error?.code === 'INTERRUPTED' ? 'interrupted' : 'failed',
          startedAt,
          updatedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          retryCount,
          errorMessage: Utils.friendlyErrorMessage(error?.message || error),
          failureType: Stability.classifyFailure(error?.message || error),
          summary: 'Workflow step failed',
          cancellable: false,
          retryable: true,
          source: 'workflow'
        });
        this.rerender();
        throw error;
      }
    });
  },

  async workspaceRun(route = this.route, btn) {
    const ws = this.syncWorkspaceFromDom(route);
    await this.busy(btn, async () => {
      switch (route) {
        case 'templates': {
          const type = ws.selected || '模板';
          ws.result = `${type}\n\n${WritingTemplates.generate(type.includes('合同') ? '合同' : type.includes('日报') ? '日报' : type.includes('报价') ? '产品介绍' : '邮件', ws.prompt || '')}\n\n导出建议：如需正式交付，请继续在 Word 助手中润色后导出 Word/PDF。`;
          break;
        }
        case 'mail':
          ws.result = this.buildMailContent(ws.selected || '商务邮件', ws.prompt || '');
          break;
        case 'cost':
          ws.costPlan = this.buildCostPlan(ws);
          ws.result = ws.costPlan.summary;
          this.detectCostCalculationBug({ ...ws, costPlan: ws.costPlan, result: ws.result });
          break;
        case 'prodexception':
          await this.exceptionReport();
          return;
        case 'inspection':
          this.inspectionReport();
          return;
        case 'bidding':
          await this.biddingAnalyze(btn);
          return;
        case 'quotation':
          this.quotationGenerateDraft();
          return;
        case 'datavalidation':
          this.validateRun('all');
          return;
        default: {
          const source = [ws.prompt, ...(ws.files || []).map(item => `【${item.name}】\n${item.content}`)].filter(Boolean).join('\n\n');
          const label = moduleById(route).name;
          const localResult = () => {
            const preview = source.split('\n').filter(Boolean).slice(0, 8).join('\n');
            if (route === 'bom') {
              return `${label}\n\nBOM结构：\n1. 主料 / 规格 / 用量 / 单位\n2. 辅料 / 规格 / 用量 / 单位\n3. 外协件 / 供应商 / 交期 / 备注\n\n建议：请补充层级、版本号和替代料信息。`;
            }
            if (route === 'erp') {
              return `${label}\n\nERP业务分析：\n- 主数据：客户、物料、仓库、单位\n- 业务单据：订单、采购、入库、出库、发货\n- 风险：字段缺失、重复单号、库存不足\n- 建议：先统一编码，再导入数据库。`;
            }
            if (route === 'mes') {
              return `${label}\n\n生产执行分析：\n- 工单状态：待开工 / 进行中 / 已完工\n- 关键检查：工序、设备、产量、异常、交期\n- 风险：缺料、延期、设备超负荷\n- 建议：优先排产临期订单并跟踪异常。`;
            }
            if (route === 'aisearch') {
              return `${label}\n\n搜索结果：\n${preview ? preview : '未找到匹配内容'}\n\n建议：增加客户、产品、订单号等关键词继续搜索。`;
            }
            if (route === 'analytics') {
              return `${label}\n\n数据结论：\n- 订单、库存、邮件、日志可形成闭环\n- 需优先关注低库存与临期订单\n- 报表应围绕客户、数量、金额、交期展开\n\n建议：继续补充原始数据后生成图表。`;
            }
            if (route === 'workflow') {
              return `${label}\n\n流程步骤：\n1. 上传资料\n2. 自动识别关键字段\n3. 校验订单与库存\n4. 生成计划与报表\n5. 人工确认后归档\n\n负责人：按业务模块分配`;
            }
            if (route === 'todo') {
              return `${label}\n\n待办事项：\n1. 确认发货单 / 负责人：仓库 / 截止时间：今日 16:00 / 优先级：高\n2. 跟进订单 / 负责人：销售 / 截止时间：今日 17:00 / 优先级：高\n3. 复核库存 / 负责人：计划员 / 截止时间：今日 15:30 / 优先级：中`;
            }
            if (route === 'worklog') {
              return `${label}\n\n工作日志：\n- Excel：已完成发货单统计\n- Word：已生成业务文稿\n- SQL：已完成查询准备\n- Agent：已执行流程拆解\n\n建议：下班前补齐交期与异常记录。`;
            }
            if (route === 'autoreport') {
              return `${label}\n\n企业报表：\n客户：常州新能源科技有限公司\n数量：760\n金额：9710.00\n运输方式：物流配送\n付款方式：月结30天\n风险：交期紧张\n建议：优先确认发货与回款。`;
            }
            if (route === 'modeladmin') {
              return `${label}\n\n模型状态：\n- 当前模型：${Store.state.settings.model || '未配置'}\n- 接口状态：${Store.state.settings.apiEnabled ? '已启用' : '未启用'}\n- 后端地址：${Store.state.settings.apiUrl || '未配置'}\n- 建议：确认 Vercel 环境变量后再上线。`;
            }
            if (route === 'apiadmin') {
              return `${label}\n\nAPI状态：\n- AI API：${Store.state.settings.apiUrl ? '已配置' : '未配置'}\n- Mail API：${Store.state.settings.agentMail?.apiUrl ? '已配置' : '未配置'}\n- 认证方式：JWT\n- 建议：统一检查 HTTPS 地址与密钥权限。`;
            }
            return `${label}处理结果\n\n${preview ? `关键内容：\n${preview}\n\n` : ''}输入资料：${(ws.files || []).length} 个文件\n保存时间：${new Date().toLocaleString('zh-CN')}\n\n建议：继续补充具体业务字段后导出或归档。`;
          };
          if (Store.state.settings.accessMode !== 'local' && source) {
            ws.result = (await AIService.complete(
              `模块：${moduleById(route).name}\n请根据以下资料生成可执行结果，尽量保留数量、客户、产品、交期、付款方式等关键字段。\n\n${source}`,
              {
                mode: route,
                module: route === 'chip' ? 'chip-assistant' : route
              }
            )).text;
          } else {
            ws.result = localResult();
          }
        }
      }
      ws.updatedAt = Date.now();
      Store.save();
      Store.addActivity(`${moduleById(route).name} 执行完成`, 'ai');
      this.rerender();
    });
  },

  buildMailContent(type, prompt) {
    const fields = WritingTemplates.parseFields(prompt || '');
    const body = {
      '商务邮件': `主题：关于${fields.product || '项目合作'}的商务沟通\n\n尊敬的${fields.customer || '客户'}：\n\n您好！现将${fields.product || '相关事项'}同步如下：\n- 数量：${fields.quantity || '待确认'}\n- 交期：${fields.delivery || '待确认'}\n- 付款方式：${fields.payment || '待确认'}\n- 运输方式：${fields.transport || '待确认'}\n\n请您确认以上信息，我们将据此推进后续工作。\n\n备注：\n${prompt || '无'}`,
      '发货通知': `主题：${fields.product || '货物'}发货通知\n\n尊敬的${fields.customer || '客户'}：\n\n您好！您司订购的${fields.product || '产品'}已安排发货。\n- 发货数量：${fields.quantity || '待确认'}\n- 交期/发货日期：${fields.delivery || '待确认'}\n- 运输方式：${fields.transport || '待确认'}\n- 付款方式：${fields.payment || '待确认'}\n\n如需收货联系人或签收要求，请及时回复。\n\n补充说明：\n${prompt || '无'}`,
      '报价邮件': `主题：${fields.product || '产品'}报价单发送\n\n尊敬的${fields.customer || '客户'}：\n\n附件/正文为本次报价信息，请查收。\n- 产品：${fields.product || '待确认'}\n- 数量：${fields.quantity || '待确认'}\n- 交期：${fields.delivery || '待确认'}\n- 付款方式：${fields.payment || '待确认'}\n\n如需调整规格、数量或条款，请直接回复本邮件。\n\n备注：\n${prompt || '无'}`,
      '投标文件提交邮件': `主题：${fields.product || '项目'}投标文件提交\n\n尊敬的招标单位：\n\n您好！现提交 ${fields.product || '本项目'} 的投标资料，请查收。\n- 项目/产品：${fields.product || '待确认'}\n- 截止/交付节点：${fields.delivery || '待确认'}\n- 商务条款：${fields.payment || '待确认'}\n\n随邮件附上投标目录、商务标、技术标及报价表，请审阅。\n\n补充说明：\n${prompt || '无'}`
    };
    return body[type] || body['商务邮件'];
  },

  validateRun(mode = 'all') {
    const ws = this.getWorkspace('datavalidation');
    const issues = [];
    if (this.temp.excel.rows.length) {
      const { records, summary } = this.getExcelAnalysis();
      issues.push(`Excel产品明细：${records.length} 行`);
      issues.push(`总数量：${summary.totalQuantity}`);
      issues.push(`总金额：${summary.totalAmount.toFixed(2)}`);
      if (/13800138000|1[3-9]\d{9}/.test(JSON.stringify(this.temp.excel.rows)) && String(summary.totalAmount).includes('13800138000')) {
        issues.push('错误：电话号码被计入金额');
      } else {
        issues.push('校验通过：电话号码未计入数量或金额统计');
      }
      const duplicate = ExcelBusiness.dedupe(records).removed;
      issues.push(`重复检查：${duplicate.length ? `发现 ${duplicate.length} 行重复` : '未发现重复行'}`);
    }
    const text = ws.prompt || '';
    if (text) {
      const lines = text.split('\n').map(item => item.trim()).filter(Boolean);
      const empties = lines.filter(line => /[:：=]\s*$/.test(line)).length;
      const phones = [...text.matchAll(/1[3-9]\d{9}/g)].map(match => match[0]);
      const amounts = [...text.matchAll(/(?:金额|合计|单价)[:：=]?\s*([\d.]+)/g)].map(match => Number(match[1]));
      if (mode !== 'excel') {
        issues.push(`空值检查：${empties} 项`);
        issues.push(`格式检查：识别到电话 ${phones.length} 个，金额字段 ${amounts.length} 个`);
        if (phones.some(phone => amounts.includes(Number(phone)))) issues.push('警告：电话号码疑似被误识别为金额');
      }
    }
    if (!issues.length) issues.push('请先上传 Excel 或粘贴待校验数据。');
    ws.result = [`数据校验结果（模式：${mode}）`, ...issues].join('\n');
    ws.updatedAt = Date.now();
    Store.save();
    Store.addActivity(`执行数据校验：${mode}`, 'ai');
    this.rerender();
  },

  apqpState() {
    this.temp.apqp ||= { open: false, loading: false, projects: [], selectedId: '', project: null, error: '' };
    return this.temp.apqp;
  },

  apqpIsStatic() {
    return Utils.isGitHubPagesHost();
  },

  apqpEnsureWritable() {
    const state = this.apqpState();
    try {
      APQPWorkspace.assertWritable(this.apqpIsStatic());
      return true;
    } catch (error) {
      state.error = error.message;
      this.rerender();
      this.toast(error.message, 'warning');
      return false;
    }
  },

  apqpConfirm(action, message) {
    if (!APQPWorkspace.requiresConfirmation(action)) return true;
    return window.confirm(message);
  },

  apqpSetError(error) {
    const state = this.apqpState();
    state.error = Utils.friendlyErrorMessage(error?.message || error || 'APQP 操作失败');
    this.rerender();
    this.toast(state.error, 'error');
  },

  async apqpOpen() {
    const state = this.apqpState();
    state.open = true;
    state.error = '';
    if (this.apqpIsStatic()) {
      const demo = APQPWorkspace.demoProject();
      state.projects = [demo];
      state.selectedId = demo.id;
      state.project = demo;
      this.rerender();
      return;
    }
    this.rerender();
    await this.apqpLoadProjects();
  },

  apqpBack() {
    const state = this.apqpState();
    state.open = false;
    state.error = '';
    this.rerender();
  },

  async apqpLoadProjects() {
    const state = this.apqpState();
    state.loading = true;
    try {
      const response = await APIClient.request('/api/apqp/projects');
      state.projects = response.data?.items || [];
      state.error = '';
      if (state.selectedId && state.projects.some(item => item.id === state.selectedId)) await this.apqpLoadDetail(state.selectedId, false);
      else state.project = null;
      this.rerender();
    } catch (error) {
      this.apqpSetError(error);
    } finally {
      state.loading = false;
    }
  },

  async apqpLoadDetail(projectId, render = true) {
    const state = this.apqpState();
    try {
      const [detailResponse, deliverablesResponse, evidenceResponse, risksResponse, tasksResponse, historyResponse] = await Promise.all([
        APIClient.request(`/api/apqp/projects/${projectId}`),
        APIClient.request(`/api/apqp/projects/${projectId}/deliverables`),
        APIClient.request(`/api/apqp/projects/${projectId}/evidence`),
        APIClient.request(`/api/apqp/projects/${projectId}/risks`),
        APIClient.request(`/api/apqp/projects/${projectId}/tasks`),
        APIClient.request(`/api/apqp/projects/${projectId}/history`)
      ]);
      const item = detailResponse.data?.project;
      state.selectedId = projectId;
      state.project = {
        ...item,
        assessment: detailResponse.data?.project?.assessment || deliverablesResponse.data?.assessment || {},
        deliverables: deliverablesResponse.data?.items || [],
        evidence: evidenceResponse.data?.items || [],
        risks: risksResponse.data?.items || [],
        tasks: tasksResponse.data?.items || [],
        history: historyResponse.data?.items || []
      };
      state.error = '';
      if (render) this.rerender();
    } catch (error) {
      this.apqpSetError(error);
    }
  },

  async apqpRefresh() {
    if (this.apqpIsStatic()) {
      const demo = APQPWorkspace.demoProject();
      Object.assign(this.apqpState(), { projects: [demo], selectedId: demo.id, project: demo, error: '' });
      this.rerender();
      return;
    }
    await this.apqpLoadProjects();
  },

  async apqpSelect(projectId) {
    if (this.apqpIsStatic()) {
      const state = this.apqpState();
      state.selectedId = projectId;
      state.project = state.projects.find(item => item.id === projectId) || null;
      this.rerender();
      return;
    }
    await this.apqpLoadDetail(projectId);
  },

  async apqpAfterWrite(projectId, message) {
    await this.apqpLoadProjects();
    if (projectId) await this.apqpLoadDetail(projectId);
    this.toast(message);
  },

  async apqpCreate() {
    if (!this.apqpEnsureWritable()) return;
    const input = {
      project_no: document.getElementById('apqpCreateNo')?.value.trim(),
      project_name: document.getElementById('apqpCreateName')?.value.trim(),
      customer_or_source: document.getElementById('apqpCreateCustomer')?.value.trim(),
      project_owner: document.getElementById('apqpCreateOwner')?.value.trim(),
      planned_start_date: document.getElementById('apqpCreateStart')?.value,
      planned_end_date: document.getElementById('apqpCreateEnd')?.value
    };
    const errors = APQPWorkspace.validateProject(input);
    if (errors.length) return this.apqpSetError(new Error(errors.join('；')));
    try {
      const response = await APIClient.request('/api/apqp/projects', { method: 'POST', body: JSON.stringify(input) });
      const projectId = response.data?.project?.id;
      await this.apqpAfterWrite(projectId, 'APQP 项目已创建');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpUpdateProject() {
    const state = this.apqpState();
    if (!state.project || !this.apqpEnsureWritable()) return;
    const input = {
      project_name: document.getElementById('apqpEditName')?.value.trim(),
      customer_or_source: document.getElementById('apqpEditCustomer')?.value.trim(),
      project_owner: document.getElementById('apqpEditOwner')?.value.trim(),
      planned_end_date: document.getElementById('apqpEditEnd')?.value,
      importance_level: document.getElementById('apqpEditImportance')?.value
    };
    const errors = APQPWorkspace.validateProject(input);
    if (errors.length) return this.apqpSetError(new Error(errors.join('；')));
    const sensitiveChanged = input.project_owner !== state.project.project_owner
      || input.planned_end_date !== state.project.planned_end_date
      || input.importance_level !== state.project.importance_level;
    if (sensitiveChanged && !this.apqpConfirm('project-owner', '负责人、截止日期或重要等级发生变化，确认提交受控修改？')) return;
    try {
      await APIClient.request(`/api/apqp/projects/${state.project.id}`, { method: 'PATCH', body: JSON.stringify(input) });
      await this.apqpAfterWrite(state.project.id, 'APQP 项目已更新');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpUpdateDeliverable(recordId) {
    const project = this.apqpState().project;
    const projectId = project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const input = {
      status: document.getElementById(`apqpDeliverableStatus-${recordId}`)?.value,
      owner: document.getElementById(`apqpDeliverableOwner-${recordId}`)?.value.trim(),
      due_date: document.getElementById(`apqpDeliverableDue-${recordId}`)?.value,
      is_applicable: document.getElementById(`apqpDeliverableApplicable-${recordId}`)?.checked ? 1 : 0,
      not_applicable_reason: document.getElementById(`apqpDeliverableReason-${recordId}`)?.value.trim()
    };
    if (!input.is_applicable && !input.not_applicable_reason) return this.apqpSetError(new Error('标记不适用必须填写理由'));
    const current = (project.deliverables || []).find(item => item.id === recordId);
    if (current && (input.owner !== current.owner || input.due_date !== current.due_date)
      && !this.apqpConfirm(input.owner !== current.owner ? 'project-owner' : 'project-due-date', '负责人或截止日期发生变化，确认提交受控修改？')) return;
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/deliverables/${recordId}`, { method: 'PATCH', body: JSON.stringify(input) });
      await this.apqpAfterWrite(projectId, '交付物已更新');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpAddEvidence() {
    const projectId = this.apqpState().project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const input = { deliverable_id: document.getElementById('apqpEvidenceDeliverable')?.value.trim(), file_name: document.getElementById('apqpEvidenceFile')?.value.trim() };
    if (!input.deliverable_id || !input.file_name) return this.apqpSetError(new Error('交付物 ID 和证据文件名不能为空'));
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/evidence`, { method: 'POST', body: JSON.stringify(input) });
      await this.apqpAfterWrite(projectId, '证据元数据记录已新增');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpDeleteEvidence(evidenceId) {
    const projectId = this.apqpState().project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const deleteReason = window.prompt('请输入证据软删除原因：', '') || '';
    const errors = APQPWorkspace.validateEvidenceDelete(deleteReason);
    if (errors.length) return this.apqpSetError(new Error(errors.join('；')));
    if (!this.apqpConfirm('evidence-delete', '证据删除会重新计算交付物与阶段阻塞，确认软删除？')) return;
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/evidence/${evidenceId}`, {
        method: 'DELETE', body: JSON.stringify({ delete_reason: deleteReason })
      });
      await this.apqpAfterWrite(projectId, '证据记录已软删除');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpAddRisk() {
    const projectId = this.apqpState().project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const input = { title: document.getElementById('apqpRiskTitle')?.value.trim(), severity: document.getElementById('apqpRiskSeverity')?.value };
    if (!input.title) return this.apqpSetError(new Error('风险标题不能为空'));
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/risks`, { method: 'POST', body: JSON.stringify(input) });
      await this.apqpAfterWrite(projectId, '风险已新增');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpUpdateRisk(recordId) {
    const project = this.apqpState().project;
    const projectId = project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const status = document.getElementById(`apqpRiskStatus-${recordId}`)?.value;
    const reason = document.getElementById(`apqpRiskReason-${recordId}`)?.value.trim();
    const input = { status, owner: document.getElementById(`apqpRiskOwner-${recordId}`)?.value.trim() };
    const current = (project.risks || []).find(item => item.id === recordId);
    if (current && input.owner !== current.owner
      && !this.apqpConfirm('project-owner', '风险负责人发生变化，确认提交受控修改？')) return;
    if (status === 'accepted') {
      if (!reason) return this.apqpSetError(new Error('风险接受必须填写接受理由'));
      if (!this.apqpConfirm('risk-accept', '确认接受该风险？接受不代表风险自动关闭。')) return;
      input.acceptance_reason = reason;
    }
    if (status === 'closed') {
      if (!reason) return this.apqpSetError(new Error('风险关闭必须填写关闭说明或证据'));
      if (!this.apqpConfirm('risk-close', '确认关闭该风险？')) return;
      input.closure_evidence = reason;
    }
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/risks/${recordId}`, { method: 'PATCH', body: JSON.stringify(input) });
      await this.apqpAfterWrite(projectId, '风险已更新');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpAddTask() {
    const projectId = this.apqpState().project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const input = { stage_id: document.getElementById('apqpTaskStage')?.value, title: document.getElementById('apqpTaskTitle')?.value.trim() };
    if (!input.stage_id || !input.title) return this.apqpSetError(new Error('阶段和任务标题不能为空'));
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(input) });
      await this.apqpAfterWrite(projectId, '任务已新增');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpUpdateTask(recordId) {
    const project = this.apqpState().project;
    const projectId = project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const input = {
      owner: document.getElementById(`apqpTaskOwner-${recordId}`)?.value.trim(),
      due_date: document.getElementById(`apqpTaskDue-${recordId}`)?.value,
      status: document.getElementById(`apqpTaskStatus-${recordId}`)?.value
    };
    const current = (project.tasks || []).find(item => item.id === recordId);
    if (current && (input.owner !== current.owner || input.due_date !== current.due_date)
      && !this.apqpConfirm(input.owner !== current.owner ? 'project-owner' : 'project-due-date', '任务负责人或截止日期发生变化，确认提交受控修改？')) return;
    if (['completed', 'cancelled'].includes(input.status)
      && !window.confirm(`确认将任务状态修改为 ${input.status}？`)) return;
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/tasks/${recordId}`, { method: 'PATCH', body: JSON.stringify(input) });
      await this.apqpAfterWrite(projectId, '任务已更新');
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpStageAction(stageId, action) {
    const projectId = this.apqpState().project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    const labels = { submit: '提交阶段评审', approve: '批准阶段', reject: '驳回阶段' };
    if (!this.apqpConfirm(`stage-${action}`, `确认${labels[action]}？`)) return;
    const reason = action === 'submit' ? '' : (window.prompt(`请输入${action === 'approve' ? '审批' : '驳回'}意见：`, '') || '');
    if (action === 'reject' && !reason.trim()) return this.apqpSetError(new Error('阶段驳回必须填写原因'));
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/stages/${stageId}/${action}`, {
        method: 'POST', body: JSON.stringify({ reason })
      });
      await this.apqpAfterWrite(projectId, `${labels[action]}操作已完成`);
    } catch (error) { this.apqpSetError(error); }
  },

  async apqpCloseProject() {
    const state = this.apqpState();
    const projectId = state.project?.id;
    if (!projectId || !this.apqpEnsureWritable()) return;
    if (!state.project.assessment?.can_close_project) return this.apqpSetError(new Error('项目不可关闭：请先处理后端 assessment 返回的阻塞项'));
    if (!this.apqpConfirm('project-close', '确认关闭 APQP 项目？该操作需要管理员审批权限。')) return;
    const reason = window.prompt('请输入项目关闭意见：', '') || '';
    if (!reason.trim()) return this.apqpSetError(new Error('项目关闭必须填写意见'));
    try {
      await APIClient.request(`/api/apqp/projects/${projectId}/close`, { method: 'POST', body: JSON.stringify({ reason }) });
      await this.apqpAfterWrite(projectId, 'APQP 项目已关闭');
    } catch (error) { this.apqpSetError(error); }
  },

  qualityModuleMap(label) {
    const map = {
      'AI Chat': 'chat',
      'OCR': 'ocr',
      'Excel': 'excel',
      'CSV': 'csv',
      'PDF': 'pdf',
      'Word': 'word',
      'PPT': 'ppt',
      'SQL': 'sql',
      'MES': 'mes',
      'ERP': 'erp',
      'BOM': 'bom',
      '生产计划': 'productionplan',
      '企业办公': 'enterprise',
      '数据管理': 'datamanagement',
      'Tool Center': 'toolcenter',
      'Agent Runtime': 'agentruntime'
    };
    return map[label] || String(label || 'general').toLowerCase().replace(/\s+/g, '-');
  },

  async qualityCheck(btn) {
    const ws = this.getWorkspace('quality');
    this.syncWorkspaceFromDom('quality');
    const moduleName = this.qualityModuleMap(ws.selected || 'AI Chat');
    await this.busy(btn, async () => {
      const res = await APIClient.request('/api/quality/check', {
        method: 'POST',
        body: JSON.stringify({
          module: moduleName,
          text: ws.prompt || '',
          allowAi: Boolean(Store.state.aiServerStatus?.enabled && Store.state.aiServerStatus?.healthy && !AuthClient.isDemo()),
          source: 'frontend'
        })
      }, { timeout: 30000 });
      const report = res.data || res.report || res;
      ws.result = [
        `模块：${report.module || moduleName}`,
        `风险：${report.risk || '低'}`,
        `请求ID：${report.requestId || '无'}`,
        '',
        report.summary || '未发现明显质量问题',
        '',
        '问题列表：',
        ...(report.issues || []).map((item, index) => `${index + 1}. [${item.severity || '中'}] ${item.message}${item.suggestion ? `\n   建议：${item.suggestion}` : ''}`)
      ].join('\n');
      ws.before = report.before || ws.prompt || '';
      ws.after = report.after || ws.prompt || '';
      ws.updatedAt = Date.now();
      Store.save();
      Store.addActivity(`质量检测：${moduleName}`, 'ai');
      this.toast('质量检测已完成');
      this.rerender();
    });
  },

  async qualityFix(btn) {
    const ws = this.getWorkspace('quality');
    this.syncWorkspaceFromDom('quality');
    const moduleName = this.qualityModuleMap(ws.selected || 'AI Chat');
    await this.busy(btn, async () => {
      const res = await APIClient.request('/api/quality/fix', {
        method: 'POST',
        body: JSON.stringify({
          module: moduleName,
          text: ws.prompt || '',
          before: ws.before || ws.prompt || '',
          after: ws.after || ws.prompt || '',
          allowAi: Boolean(Store.state.aiServerStatus?.enabled && Store.state.aiServerStatus?.healthy && !AuthClient.isDemo()),
          requireApproval: true,
          source: 'frontend'
        })
      }, { timeout: 30000 });
      const report = res.data || res.report || res;
      ws.result = [
        `模块：${report.module || moduleName}`,
        `风险：${report.risk || '低'}`,
        report.approvalRequired ? '修复建议需要人工确认。' : '修复建议已生成。',
        '',
        report.summary || '',
        '',
        '修复前：',
        report.before || ws.prompt || '',
        '',
        '修复后：',
        report.after || ws.prompt || ''
      ].join('\n');
      ws.before = report.before || ws.prompt || '';
      ws.after = report.after || ws.prompt || '';
      ws.updatedAt = Date.now();
      Store.save();
      if (report.approvalRequired) Store.addActivity(`质量修复待审批：${moduleName}`, 'warn');
      else Store.addActivity(`质量修复建议：${moduleName}`, 'ai');
      this.toast(report.approvalRequired ? '高风险修复建议已生成，请人工确认' : '修复建议已生成');
      this.rerender();
    });
  },

  async qualityExport(btn) {
    const ws = this.getWorkspace('quality');
    this.syncWorkspaceFromDom('quality');
    const moduleName = this.qualityModuleMap(ws.selected || 'AI Chat');
    await this.busy(btn, async () => {
      const res = await APIClient.request('/api/quality/export', {
        method: 'POST',
        body: JSON.stringify({
          module: moduleName,
          text: ws.prompt || '',
          before: ws.before || ws.prompt || '',
          after: ws.after || ws.prompt || '',
          source: 'frontend'
        })
      }, { timeout: 30000 });
      const text = res.data?.text || res.text || '';
      if (!text) throw new Error('导出报告为空');
      Utils.textDownload(text, `${safeName((ws.selected || 'quality') + '-quality-report')}.txt`);
      ws.result = text;
      ws.updatedAt = Date.now();
      Store.save();
      Store.addActivity(`导出质量报告：${moduleName}`, 'file');
      this.toast('质量报告已导出');
      this.rerender();
    });
  },

  getMailWorkspace() {
    const ws = this.getWorkspace('mail');
    ws.attachments = ws.attachments || [];
    ws.precheck = ws.precheck || [];
    ws.approvalStatus = ws.approvalStatus || '草稿';
    ws.type = ws.type || '标书提交邮件';
    return ws;
  },

  async mailGenerate(btn) {
    const ws = this.getMailWorkspace();
    await this.busy(btn, async () => {
      const values = {
        ...MailEngine.parsePrompt(ws.prompt || ''),
        customerName: MailEngine.parsePrompt(ws.prompt || '').customer,
        customer: MailEngine.parsePrompt(ws.prompt || '').customer,
        projectName: MailEngine.parsePrompt(ws.prompt || '').projectName || ws.title,
        bidder: MailEngine.parsePrompt(ws.prompt || '').bidder || '溧阳五四不锈钢有限公司'
      };
      ws.subject = MailEngine.subject(ws.type, values);
      ws.body = MailEngine.template(ws.type, values, ws.prompt || '');
      ws.result = `主题：${ws.subject}\n\n${ws.body}`;
      ws.precheck = MailEngine.check({
        type: ws.type,
        recipient: ws.recipient,
        subject: ws.subject,
        body: ws.body,
        attachments: ws.attachments,
        finalVersionChecked: ws.finalVersionChecked,
        prompt: ws.prompt
      });
      ws.updatedAt = Date.now();
      if (MailEngine.needsApproval(ws.type) && ws.approvalStatus === '草稿') ws.approvalStatus = '待确认';
      Store.save();
      Store.addActivity(`生成邮件：${ws.type}`, 'ai');
      this.rerender();
    });
  },

  async mailPolish(btn) {
    const ws = this.getMailWorkspace();
    if (!ws.body) throw new Error('请先生成邮件内容');
    await this.busy(btn, async () => {
      try {
        const res = await AIService.complete(ws.body, { mode: 'polish' });
        ws.body = res.text;
      } catch (error) {
        this.recordAiError(error, 'mail-polish');
        ws.body = `当前为演示模式，已使用内置演示数据生成结果。\n如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。\n\n${ws.body}`;
      }
      ws.result = `主题：${ws.subject}\n\n${ws.body}`;
      Store.save();
      this.rerender();
    });
  },

  async mailTranslate(btn) {
    const ws = this.getMailWorkspace();
    if (!ws.body) throw new Error('请先生成邮件内容');
    await this.busy(btn, async () => {
      try {
        const res = await AIService.complete(`请把下面邮件翻译成商务英文：\n${ws.body}`, { mode: 'rewrite' });
        ws.body = res.text;
      } catch (error) {
        this.recordAiError(error, 'mail-translate');
        ws.body = `Business Email Draft\n\n${ws.body}`;
      }
      ws.result = `主题：${ws.subject}\n\n${ws.body}`;
      Store.save();
      this.rerender();
    });
  },

  async mailSummary(btn) {
    const ws = this.getMailWorkspace();
    if (!ws.body) throw new Error('请先生成邮件内容');
    await this.busy(btn, async () => {
      try {
        const res = await AIService.complete(ws.body, { mode: 'summary' });
        ws.result = `邮件总结\n\n${res.text}\n\n主题：${ws.subject}\n收件人：${ws.recipient || '未填写'}\n附件：${(ws.attachments || []).map(item => item.name).join('、') || '无'}`;
      } catch (error) {
        this.recordAiError(error, 'mail-summary');
        ws.result = `邮件总结\n\n当前为演示模式，已使用内置演示数据生成结果。\n如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。\n\n主题：${ws.subject}\n收件人：${ws.recipient || '未填写'}\n附件：${(ws.attachments || []).map(item => item.name).join('、') || '无'}`;
      }
      Store.save();
      this.rerender();
    });
  },

  mailSaveDraft() {
    const ws = this.getMailWorkspace();
    const draft = {
      id: uid(),
      time: Date.now(),
      type: ws.type,
      recipient: ws.recipient,
      subject: ws.subject,
      body: ws.body,
      prompt: ws.prompt,
      attachments: structuredClone(ws.attachments || []),
      approvalStatus: ws.approvalStatus || '草稿'
    };
    Store.state.mailDrafts.unshift(draft);
    Store.state.mailDrafts = Store.state.mailDrafts.slice(0, 30);
    ws.approvalStatus = ws.approvalStatus || '草稿';
    Store.save();
    Store.addActivity(`保存邮件草稿：${ws.subject || ws.type}`, 'file');
    this.toast('邮件草稿已保存');
    this.rerender();
  },

  async mailCopyContent() {
    const ws = this.getMailWorkspace();
    const content = `收件人：${ws.recipient || ''}\n主题：${ws.subject || ''}\n\n${ws.body || ''}`;
    await this.copy(content);
  },

  async mailAddAttachments(files) {
    const ws = this.getMailWorkspace();
    for (const file of files) {
      const category = Utils.fileCategory(file);
      const ext = Utils.fileExt(file);
      const allowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'];
      ws.attachments.unshift({
        id: uid(),
        name: file.name,
        size: file.size,
        type: file.type,
        category,
        ext,
        previewable: ['PDF', '图片', '文档', '表格'].includes(category),
        compressed: false,
        invalid: allowed.includes(ext) ? '' : '附件类型需人工确认'
      });
    }
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  mailRemoveAttachment(id) {
    const ws = this.getMailWorkspace();
    ws.attachments = (ws.attachments || []).filter(item => item.id !== id);
    Store.save();
    this.rerender();
  },

  mailCompressAttachment(id) {
    const ws = this.getMailWorkspace();
    const attachment = (ws.attachments || []).find(item => item.id === id);
    if (!attachment) return;
    attachment.compressed = true;
    attachment.size = Math.round(attachment.size * 0.72);
    attachment.invalid = attachment.size > 20 * 1024 * 1024 ? '附件仍超过 20MB 限制' : '';
    Store.save();
    this.toast('附件已执行本地压缩标记');
    this.rerender();
  },

  mailPreviewAttachment(id) {
    const ws = this.getMailWorkspace();
    const attachment = (ws.attachments || []).find(item => item.id === id);
    if (!attachment) return;
    this.toast(`附件预览：${attachment.name}`);
  },

  mailPrecheck() {
    const ws = this.getMailWorkspace();
    const checks = MailEngine.check({
      type: ws.type,
      recipient: ws.recipient,
      subject: ws.subject,
      body: ws.body,
      attachments: ws.attachments,
      finalVersionChecked: ws.finalVersionChecked,
      prompt: ws.prompt
    });
    const oversized = (ws.attachments || []).filter(item => item.size > 20 * 1024 * 1024).map(item => `${item.name} 超过 20MB`);
    ws.precheck = checks.concat(oversized);
    if (!ws.precheck.length) ws.precheck = ['检查通过：收件人、主题、附件、关键字段已满足发送要求。'];
    Store.save();
    this.rerender();
  },

  mailApprove() {
    const ws = this.getMailWorkspace();
    ws.approvalStatus = '已确认';
    Store.save();
    this.rerender();
  },

  async mailSend() {
    const ws = this.getMailWorkspace();
    this.mailPrecheck();
    const blockingIssues = (ws.precheck || []).filter(item => !item.startsWith('检查通过'));
    const needsApproval = MailEngine.needsApproval(ws.type);
    const confirmInfo = `收件人：${ws.recipient || '未填写'}\n主题：${ws.subject || '未填写'}\n附件：${(ws.attachments || []).map(item => item.name).join('、') || '无'}\n发送方式：${Store.state.settings.agentMail?.enabled ? 'Agent Mail' : '演示模式'}`;
    if (needsApproval && ws.approvalStatus !== '已确认') {
      ws.approvalStatus = '待确认';
      Store.save();
      if (!confirm(`重要邮件需确认后发送。\n\n${confirmInfo}\n\n是否先标记为“已确认”并继续？`)) return;
      this.mailApprove();
    }
    if (blockingIssues.length) {
      if (!confirm(`发送前发现以下问题：\n\n${blockingIssues.join('\n')}\n\n仍然继续发送/演示发送吗？`)) return;
    } else if (!confirm(`请确认发送信息：\n\n${confirmInfo}\n\n确认后将继续发送。`)) {
      return;
    }
    await this.mailConfirmSend();
  },

  async mailConfirmSend() {
    const ws = this.getMailWorkspace();
    const mailSettings = Store.state.settings.agentMail || {};
    const today = new Date().toISOString().slice(0, 10);
    if (mailSettings.lastResetAt !== today) {
      mailSettings.sentToday = 0;
      mailSettings.lastResetAt = today;
    }
    let status = '演示模式';
    let failureReason = '';
    try {
      if (mailSettings.enabled && mailSettings.apiUrl && mailSettings.apiKey) {
        if (Number(mailSettings.sentToday || 0) >= Number(mailSettings.dailyQuota || 0)) throw new Error('已达到今日发送额度');
        const response = await fetch(`${mailSettings.apiUrl.replace(/\/$/, '')}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mailSettings.apiKey}`
          },
          body: JSON.stringify({
            from: mailSettings.mailbox,
            senderName: mailSettings.senderName,
            to: ws.recipient,
            subject: ws.subject,
            body: ws.body,
            attachments: (ws.attachments || []).map(item => ({ name: item.name, size: item.size, type: item.type }))
          })
        });
        if (!response.ok) {
          const { raw, json } = await Utils.safeReadResponse(response);
          throw new Error(json?.message || json?.detail || raw || `HTTP ${response.status}`);
        }
        status = '已发送';
        mailSettings.sentToday = Number(mailSettings.sentToday || 0) + 1;
      }
    } catch (error) {
      status = mailSettings.enabled ? '失败' : '演示模式';
      failureReason = Utils.friendlyErrorMessage(error.message || '发送失败');
    }
    if (!mailSettings.enabled || !mailSettings.apiUrl || !mailSettings.apiKey) {
      status = '演示模式';
      failureReason = '演示模式：邮件未真实发送';
    }
    const record = {
      id: uid(),
      time: Date.now(),
      recipient: ws.recipient,
      subject: ws.subject,
      type: ws.type,
      body: ws.body,
      attachments: structuredClone(ws.attachments || []),
      status,
      failureReason
    };
    Store.state.mailRecords.unshift(record);
    Store.state.mailRecords = Store.state.mailRecords.slice(0, 100);
    Store.state.operationLogs.unshift({ id: uid(), title: `邮件${status}：${ws.subject}`, type: 'mail', time: Date.now() });
    ws.approvalStatus = status === '已发送' || status === '演示模式' ? '已发送' : '已确认';
    ws.result = `收件人：${ws.recipient}\n主题：${ws.subject}\n\n${ws.body}\n\n状态：${status}${failureReason ? `\n原因：${failureReason}` : ''}`;
    const followStatus = status === '失败' ? '需要补充资料' : '等待客户回复';
    this.getWorkspace('worklog').result = `邮件跟进任务\n主题：${ws.subject}\n状态：${followStatus}\n时间：${Utils.formatDate(Date.now(), true)}`;
    const mailFile = new File(
      [new Blob([`收件人：${ws.recipient}\n主题：${ws.subject}\n类型：${ws.type}\n状态：${status}\n附件：${(ws.attachments || []).map(item => item.name).join('、') || '无'}\n\n${ws.body}`], { type: 'text/plain;charset=utf-8' })],
      `${safeName(ws.subject || ws.type || '邮件记录')}.txt`,
      { type: 'text/plain' }
    );
    await this.addFiles([mailFile]);
    Store.save();
    Store.addActivity(`邮件${status}：${ws.subject}`, 'mail');
    this.rerender();
    if (status === '失败') {
      if (confirm('发送失败。是否立即重新发送？\n\n取消后你仍可保存草稿或复制邮件内容。')) {
        return this.mailRetry(record.id);
      }
    } else {
      this.toast(status === '已发送' ? '邮件已发送' : '演示发送成功');
    }
  },

  mailOpenRecord(id) {
    const record = Store.state.mailRecords.find(item => item.id === id);
    if (!record) return;
    const ws = this.getMailWorkspace();
    ws.type = record.type;
    ws.recipient = record.recipient;
    ws.subject = record.subject;
    ws.body = record.body || '';
    ws.attachments = structuredClone(record.attachments || []);
    ws.result = `发送记录\n主题：${record.subject}\n收件人：${record.recipient}\n状态：${record.status}${record.failureReason ? `\n原因：${record.failureReason}` : ''}`;
    this.navigate('mail');
  },

  async mailRetry(id) {
    const record = Store.state.mailRecords.find(item => item.id === id);
    if (!record) throw new Error('未找到发送记录');
    const ws = this.getMailWorkspace();
    ws.type = record.type;
    ws.recipient = record.recipient;
    ws.subject = record.subject;
    ws.body = record.body || '';
    ws.attachments = structuredClone(record.attachments || []);
    ws.approvalStatus = '已确认';
    await this.mailConfirmSend();
  },

  biddingMail() {
    const bid = this.getWorkspace('bidding');
    const mail = this.getMailWorkspace();
    const content = bid.prompt || bid.result || '';
    const parsed = MailEngine.parsePrompt(content);
    mail.type = '标书提交邮件';
    mail.prompt = content;
    mail.title = parsed.projectName || '投标文件提交';
    mail.recipient = parsed.recipient || '';
    mail.subject = MailEngine.subject('标书提交邮件', {
      projectName: parsed.projectName || '项目',
      customer: parsed.customer || '招标单位'
    });
    mail.body = MailEngine.template('标书提交邮件', {
      customerName: parsed.customer || '招标单位',
      projectName: parsed.projectName || '项目',
      bidder: parsed.bidder || '溧阳五四不锈钢有限公司',
      contact: parsed.contact || '张三',
      phone: parsed.phone || '13800138000'
    });
    mail.attachments = [
      { id: uid(), name: `${safeName(parsed.projectName || '投标文件')}.docx`, size: 420000, category: '文档', previewable: true, compressed: false, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { id: uid(), name: `${safeName(parsed.projectName || '投标文件')}.pdf`, size: 560000, category: 'PDF', previewable: true, compressed: false, type: 'application/pdf' }
    ];
    mail.finalVersionChecked = true;
    mail.approvalStatus = '待确认';
    mail.result = `已从招投标助手生成邮件草稿\n主题：${mail.subject}\n附件：${mail.attachments.map(item => item.name).join('、')}`;
    Store.save();
    this.navigate('mail');
  },

  buildCostPlan(source = '') {
    const startedAt = Date.now();
    const parsed = typeof source === 'string' ? this.parseKeyValueText(source) : this.parseKeyValueText(source?.prompt || '');
    const kv = typeof source === 'object' && source ? { ...source, ...parsed } : parsed;
    const pick = (...keys) => {
      for (const key of keys) {
        const value = kv?.[key];
        if (value != null && value !== '') return value;
      }
      return '';
    };
    const qty = Utils.number(pick('quantity', '数量', 'qty'));
    const unit = String(pick('unit', '单位') || '件');
    const materialUnitPrice = Utils.number(pick('materialUnitPrice', '材料单价'));
    const materialUsage = Utils.number(pick('materialUsage', '单件材料用量'));
    const materialLossRate = Utils.number(pick('materialLossRate', '材料损耗率'));
    const processType = String(pick('processType', '工艺类型') || '');
    const unitProcessTime = Utils.number(pick('unitProcessTime', '单件加工时间'));
    const equipmentHourCost = Utils.number(pick('equipmentHourCost', '设备小时成本'));
    const processLossRate = Utils.number(pick('processLossRate', '加工损耗率'));
    const laborWage = Utils.number(pick('laborWage', '人工小时工资'));
    const unitLaborTime = Utils.number(pick('unitLaborTime', '单件人工时间'));
    const packagingCost = Utils.number(pick('packagingCost', '包装成本'));
    const transportCost = Utils.number(pick('transportCost', '运输成本'));
    const managementFee = Utils.number(pick('managementFee', '管理费'));
    const otherFee = Utils.number(pick('otherFee', '其他杂费'));
    const targetProfitRate = Utils.number(pick('targetProfitRate', '目标利润率'));
    const minimumProfitRate = Utils.number(pick('minimumProfitRate', '最低利润率'));
    const rush = String(pick('rush', '是否加急') || '否');
    const rushMultiplier = Utils.number(pick('rushMultiplier', '加急倍率')) || 1;
    const hasNegative = [qty, materialUnitPrice, materialUsage, materialLossRate, unitProcessTime, equipmentHourCost, processLossRate, laborWage, unitLaborTime, packagingCost, transportCost, managementFee, otherFee, targetProfitRate, minimumProfitRate, rushMultiplier].some(value => Number.isFinite(value) && value < 0);
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
    const safeMaterialUnitPrice = Number.isFinite(materialUnitPrice) ? materialUnitPrice : 0;
    const safeMaterialUsage = Number.isFinite(materialUsage) ? materialUsage : 0;
    const safeMaterialLossRate = Number.isFinite(materialLossRate) ? materialLossRate : 0;
    const safeUnitProcessTime = Number.isFinite(unitProcessTime) ? unitProcessTime : 0;
    const safeEquipmentHourCost = Number.isFinite(equipmentHourCost) ? equipmentHourCost : 0;
    const safeProcessLossRate = Number.isFinite(processLossRate) ? processLossRate : 0;
    const safeLaborWage = Number.isFinite(laborWage) ? laborWage : 0;
    const safeUnitLaborTime = Number.isFinite(unitLaborTime) ? unitLaborTime : 0;
    const safePackagingCost = Number.isFinite(packagingCost) ? packagingCost : 0;
    const safeTransportCost = Number.isFinite(transportCost) ? transportCost : 0;
    const safeManagementFee = Number.isFinite(managementFee) ? managementFee : 0;
    const safeOtherFee = Number.isFinite(otherFee) ? otherFee : 0;
    const safeTargetProfitRate = Number.isFinite(targetProfitRate) ? targetProfitRate : 0;
    const safeMinimumProfitRate = Number.isFinite(minimumProfitRate) ? minimumProfitRate : 0;
    const safeRushMultiplier = Number.isFinite(rushMultiplier) && rushMultiplier > 0 ? rushMultiplier : 1;
    const materialCost = safeMaterialUnitPrice * safeMaterialUsage * safeQty * (1 + safeMaterialLossRate / 100);
    const processCost = safeEquipmentHourCost * safeUnitProcessTime * safeQty * (1 + safeProcessLossRate / 100);
    const laborCost = safeLaborWage * safeUnitLaborTime * safeQty;
    const otherCost = safePackagingCost + safeTransportCost + safeManagementFee + safeOtherFee;
    const totalCost = materialCost + processCost + laborCost + otherCost;
    const suggestedProfit = totalCost * safeTargetProfitRate / 100;
    const quoteBeforeRush = totalCost + suggestedProfit;
    const finalQuote = rush === '是' ? quoteBeforeRush * safeRushMultiplier : quoteBeforeRush;
    const unitQuote = safeQty > 0 ? finalQuote / safeQty : NaN;
    const lowestAcceptableQuote = totalCost * (1 + safeMinimumProfitRate / 100);
    const profit = finalQuote - totalCost;
    const margin = finalQuote > 0 ? profit / finalQuote * 100 : NaN;
    const calcTime = Math.max(1, Date.now() - startedAt);
    const risks = [];
    if (safeMaterialLossRate > 10) risks.push('材料损耗率较高，建议复核图纸和下料方案。');
    if (safeTargetProfitRate < safeMinimumProfitRate) risks.push('当前目标利润率低于最低利润率，可能不适合接单。');
    if (safeQty > 0 && safeQty < 50) risks.push('数量较少，单件加工成本可能偏高。');
    if (rush === '是') risks.push('加急订单建议确认设备排产和交期风险。');
    if (Number.isFinite(unitQuote) && unitQuote < (safeQty > 0 ? totalCost / safeQty : Infinity)) risks.push('当前报价可能亏损。');
    if (hasNegative) {
      return {
        error: '输入异常：数量、单价、材料费、工时成本、加工费、报价金额不能为负数，请修正后再计算。',
        summary: [
          '成本核算结果',
          '输入异常：数量、单价、材料费、工时成本、加工费、报价金额不能为负数，请修正后再计算。'
        ].join('\n'),
        calcTime,
        fields: { qty, unit, materialUnitPrice, materialUsage, materialLossRate, processType, unitProcessTime, equipmentHourCost, processLossRate, laborWage, unitLaborTime, packagingCost, transportCost, managementFee, otherFee, targetProfitRate, minimumProfitRate, rush, rushMultiplier: safeRushMultiplier },
        costs: { materialCost, processCost, laborCost, otherCost, totalCost, suggestedProfit, quoteBeforeRush, finalQuote, unitQuote, lowestAcceptableQuote, profit, margin },
        risks: ['请先将所有数值修正为非负数。']
      };
    }
    const durationMs = Math.max(1, Date.now() - startedAt);
    const risk = Number.isFinite(margin)
      ? (margin < safeMinimumProfitRate ? '风险提示：利润率低于最低利润率，请复核材料费、工时成本、加工费与报价金额。' : '利润率正常：可继续保留当前报价策略。')
      : '利润率未计算：报价金额为空或为 0。';
    const materialLine = `材料成本：${materialCost.toFixed(2)}`;
    const processLine = `加工成本：${processCost.toFixed(2)}`;
    const laborLine = `人工成本：${laborCost.toFixed(2)}`;
    const otherLine = `其他成本：${otherCost.toFixed(2)}`;
    const totalLine = `总成本：${totalCost.toFixed(2)}`;
    const profitLine = `建议利润：${suggestedProfit.toFixed(2)}`;
    const quoteLine = `建议报价：${finalQuote.toFixed(2)}`;
    const unitQuoteLine = `单件报价：${Number.isFinite(unitQuote) ? unitQuote.toFixed(2) : '待补充'}`;
    const lowestLine = `最低可接受报价：${lowestAcceptableQuote.toFixed(2)}`;
    const marginLine = `利润率：${Number.isFinite(margin) ? `${margin.toFixed(2)}%` : '未计算'}`;
    const quantityLabel = safeQty > 0 ? `${safeQty}${unit}` : `待补充${unit}`;
    const summary = [
      '成本核算结果',
      `产品：${String(pick('productName', '产品名称') || '待补充')}`,
      `数量：${quantityLabel}`,
      materialLine,
      processLine,
      laborLine,
      otherLine,
      '↓',
      totalLine,
      '↓',
      profitLine,
      quoteLine,
      unitQuoteLine,
      lowestLine,
      marginLine,
      `计算时间：${calcTime} ms`,
      '',
      `报价说明：本次报价产品为【${String(pick('productName', '产品名称') || '待补充')}】, 数量为【${quantityLabel}】。主要材料为【${String(pick('materialName', '材料名称') || '待补充')}】, 加工工艺包含【${processType || '待补充'}】。系统根据材料成本、加工时间、人工成本、损耗率及目标利润率计算，建议总报价为【${finalQuote.toFixed(2)}】元，建议单价为【${Number.isFinite(unitQuote) ? unitQuote.toFixed(2) : '待补充'}】元/件。该报价仅供内部参考，最终价格需结合客户要求、图纸复杂度、交期和实际采购价格确认。`,
      ...risks
    ].join('\n');
    return {
      error: '',
      summary,
      calcTime,
      fields: {
        productName: String(pick('productName', '产品名称') || '待补充'),
        productCode: String(pick('productCode', '产品编码') || '待补充'),
        customerName: String(pick('customerName', '客户名称') || '待补充'),
        quoteDate: String(pick('quoteDate', '报价日期') || ''),
        qty: safeQty,
        unit,
        materialName: String(pick('materialName', '材料名称') || '待补充'),
        materialUnitPrice: safeMaterialUnitPrice,
        materialUsage: safeMaterialUsage,
        materialLossRate: safeMaterialLossRate,
        processType,
        unitProcessTime: safeUnitProcessTime,
        equipmentHourCost: safeEquipmentHourCost,
        processLossRate: safeProcessLossRate,
        laborWage: safeLaborWage,
        unitLaborTime: safeUnitLaborTime,
        packagingCost: safePackagingCost,
        transportCost: safeTransportCost,
        managementFee: safeManagementFee,
        otherFee: safeOtherFee,
        targetProfitRate: safeTargetProfitRate,
        minimumProfitRate: safeMinimumProfitRate,
        rush,
        rushMultiplier: safeRushMultiplier
      },
      costs: {
        materialCost,
        processCost,
        laborCost,
        otherCost,
        totalCost,
        suggestedProfit,
        quoteBeforeRush,
        finalQuote,
        unitQuote,
        lowestAcceptableQuote,
        profit,
        margin
      },
      risks,
      risk,
      durationMs: calcTime
    };
  },

  computeCostResult(source = '') {
    return this.buildCostPlan(source).summary;
  },

  detectCostCalculationBug(ws = {}) {
    const plan = ws.costPlan || this.buildCostPlan(ws);
    if (!plan || !ws.result) return;
    const mismatch = [
      ['totalCost', plan.costs?.totalCost, Number.isFinite(plan.costs?.totalCost) ? plan.costs.totalCost : NaN],
      ['finalQuote', plan.costs?.finalQuote, Number.isFinite(plan.costs?.finalQuote) ? plan.costs.finalQuote : NaN],
      ['unitQuote', plan.costs?.unitQuote, Number.isFinite(plan.costs?.unitQuote) ? plan.costs.unitQuote : NaN],
      ['margin', plan.costs?.margin, Number.isFinite(plan.costs?.margin) ? plan.costs.margin : NaN]
    ].some(([, actual, expected]) => Number.isFinite(expected) && (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.01));
    if (!mismatch) return;
    const bug = this.reportBug({
      module: '成本核算助手',
      feature: '开始计算',
      type: '结果与输入不一致',
      message: '用户输入了数值，但结果区未按当前输入正确计算。',
      description: `输入：数量=${plan.fields?.qty || 0}，材料单价=${plan.fields?.materialUnitPrice || 0}，材料用量=${plan.fields?.materialUsage || 0}，加工时间=${plan.fields?.unitProcessTime || 0}，人工工时=${plan.fields?.unitLaborTime || 0}。`,
      suggestion: '检查输入字段 id/name 与 JS 读取逻辑，确保使用 input.value 读取当前值，并重新计算。',
      source: 'business-detection'
    });
    return bug;
  },

  costCalc(btn) {
    const started = Date.now();
    const ws = this.syncWorkspaceFromDom('cost');
    const plan = this.buildCostPlan(ws);
    if (plan.error) {
      ws.costPlan = plan;
      ws.result = plan.summary;
      ws.costStatus = '⚠️ 输入异常';
      ws.updatedAt = Date.now();
      Store.save();
      this.reportBug({
        module: '成本核算助手',
        feature: '开始计算',
        type: '输入异常',
        message: plan.error,
        description: '成本核算助手不接受负数价格或数量。',
        suggestion: '请将数值修正为非负数后再重新计算。',
        source: 'business-detection'
      });
      this.rerender();
      this.toast('请先修正负数输入后再计算', 'error');
      return ws.result;
    }
    ws.costPlan = plan;
    ws.result = plan.summary;
    ws.costStatus = '✅ Production Ready';
    ws.updatedAt = Date.now();
    Store.save();
    this.saveReusableSession('cost', 'calculated');
    this.detectCostCalculationBug({ ...ws, costPlan: plan, result: ws.result, computedAt: started });
    ws.costStatus = '✅ Production Ready';
    this.rerender();
    this.toast('成本已重新计算');
    if (btn) {
      btn.disabled = false;
      btn.lastChild.textContent = '开始计算';
    }
    return ws.result;
  },

  costImportCurrentRfq() {
    const rfq = this.temp.manufacturing?.rfq;
    if (!rfq?.id) throw new Error('请先在 RFQ 页面打开一条真实 RFQ，再返回成本核算导入');
    const ws = this.getWorkspace('cost');
    Object.assign(ws, {
      productName: rfq.product_name || '',
      productCode: rfq.product_code || '',
      customerName: rfq.customer_name || rfq.customer?.name || '',
      quantity: rfq.quantity ?? '',
      unit: rfq.unit || '件',
      materialName: rfq.material || rfq.material_name || '',
      sourceMode: 'rfq',
      sourceRfqId: rfq.id,
      sourceRfqNo: rfq.rfq_no || '',
      sourceTrace: {
        type: 'rfq',
        rfqId: rfq.id,
        rfqNo: rfq.rfq_no || '',
        importedAt: new Date().toISOString(),
        importedFields: ['productName', 'productCode', 'customerName', 'quantity', 'unit', 'materialName'].filter(key => String({
          productName: rfq.product_name, productCode: rfq.product_code, customerName: rfq.customer_name || rfq.customer?.name,
          quantity: rfq.quantity, unit: rfq.unit, materialName: rfq.material || rfq.material_name
        }[key] ?? '').trim())
      }
    });
    ws.costPlan = null;
    ws.result = '';
    ws.costStatus = '已从真实 RFQ 带入已存在字段；价格、工时和费率仍需人工录入';
    Store.save();
    this.saveReusableSession('cost', 'rfq_imported');
    this.rerender();
    this.toast('已从 RFQ 带入真实字段；未提供的数据保持为空，不会自动编造。');
  },

  costFillSample() {
    const ws = this.getWorkspace('cost');
    Object.assign(ws, {
      productName: '304不锈钢连接件',
      productCode: 'WUSI-CNC-001',
      customerName: '新能源设备客户',
      quoteDate: new Date().toISOString().slice(0, 10),
      quantity: 500,
      unit: '件',
      materialName: '304不锈钢',
      materialUnitPrice: 18,
      materialUsage: 0.35,
      materialLossRate: 8,
      processType: 'CNC + 数控车',
      unitProcessTime: 0.12,
      equipmentHourCost: 80,
      processLossRate: 5,
      laborWage: 35,
      unitLaborTime: 0.05,
      packagingCost: 120,
      transportCost: 300,
      managementFee: 200,
      otherFee: 100,
      targetProfitRate: 25,
      minimumProfitRate: 15,
      rush: '否',
      rushMultiplier: 1.2
    });
    ws.costPlan = this.buildCostPlan(ws);
    ws.result = ws.costPlan.summary;
    ws.costStatus = '✅ Production Ready';
    ws.updatedAt = Date.now();
    Store.save();
    this.saveReusableSession('cost', 'sample_calculated');
    this.rerender();
    this.toast('已填充成本核算示例');
  },

  costClear() {
    const ws = this.getWorkspace('cost');
    Object.assign(ws, {
      productName: '',
      productCode: '',
      customerName: '',
      quoteDate: '',
      quantity: '',
      unit: '件',
      materialName: '',
      materialUnitPrice: '',
      materialUsage: '',
      materialLossRate: '',
      processType: '',
      unitProcessTime: '',
      equipmentHourCost: '',
      processLossRate: '',
      laborWage: '',
      unitLaborTime: '',
      packagingCost: '',
      transportCost: '',
      managementFee: '',
      otherFee: '',
      targetProfitRate: '',
      minimumProfitRate: '',
      rush: '否',
      rushMultiplier: '',
      prompt: '',
      costPlan: null,
      result: '',
      costStatus: '支持中文字段与自动计算'
    });
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
    this.toast('成本核算数据已清空');
  },

  costPrint() {
    const ws = this.syncWorkspaceFromDom('cost');
    const plan = ws.costPlan || this.buildCostPlan(ws);
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${Utils.escape(ws.productName || '成本报价单')}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111827}
      h1,h2,h3,p{margin:0 0 12px}
      .muted{color:#6b7280}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{border:1px solid #d1d5db;padding:8px;text-align:left;font-size:14px}
      th{background:#f9fafb}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px}
      .warn{color:#b45309}
      .ok{color:#047857}
    </style></head><body>
      <h1>成本报价单</h1>
      <p class="muted">本报价单由成本核算助手自动生成，仅供内部参考。</p>
      <div class="card">
        <div class="grid">
          <div><h3>产品信息</h3><p>产品名称：${Utils.escape(plan.fields?.productName || '待补充')}</p><p>产品编码：${Utils.escape(plan.fields?.productCode || '待补充')}</p><p>客户名称：${Utils.escape(plan.fields?.customerName || '待补充')}</p><p>报价日期：${Utils.escape(plan.fields?.quoteDate || '待补充')}</p></div>
          <div><h3>工艺信息</h3><p>工艺类型：${Utils.escape(plan.fields?.processType || '待补充')}</p><p>数量：${Utils.escape(String(plan.fields?.qty ?? 0))} ${Utils.escape(plan.fields?.unit || '件')}</p><p>加急：${Utils.escape(plan.fields?.rush || '否')}</p><p>加急倍率：${Utils.escape(String(plan.fields?.rushMultiplier ?? 1))}</p></div>
        </div>
      </div>
      <div class="card">
        <h3>成本拆分</h3>
        <table><thead><tr><th>项目</th><th>金额</th></tr></thead><tbody>
          <tr><td>材料成本</td><td>${plan.costs?.materialCost?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>加工成本</td><td>${plan.costs?.processCost?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>人工成本</td><td>${plan.costs?.laborCost?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>其他成本</td><td>${plan.costs?.otherCost?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>总成本</td><td>${plan.costs?.totalCost?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>建议利润</td><td>${plan.costs?.suggestedProfit?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>建议报价</td><td>${plan.costs?.finalQuote?.toFixed(2) || '0.00'}</td></tr>
          <tr><td>单件报价</td><td>${Number.isFinite(plan.costs?.unitQuote) ? plan.costs.unitQuote.toFixed(2) : '待补充'}</td></tr>
          <tr><td>最低可接受报价</td><td>${plan.costs?.lowestAcceptableQuote?.toFixed(2) || '0.00'}</td></tr>
        </tbody></table>
      </div>
      <div class="card">
        <h3>报价说明</h3>
        <p>${Utils.escape(plan.summary || '')}</p>
        <p class="${plan.risks?.length ? 'warn' : 'ok'}">${Utils.escape(plan.risks?.length ? plan.risks.join('；') : '当前参数下可继续保留报价策略。')}</p>
      </div>
    </body></html>`;
    const win = window.open('', '_blank', 'width=1100,height=900');
    if (!win) {
      this.toast('浏览器阻止了打印窗口，请允许弹窗后重试', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
    this.toast('已打开报价单打印窗口');
  },

  exceptionAdd() {
    const ws = this.getWorkspace('prodexception');
    const kv = this.parseKeyValueText(ws.prompt || '');
    const record = {
      id: uid(),
      problem: kv.问题 || kv.异常 || '未命名异常',
      owner: kv.责任人 || '未指定',
      action: kv.处理措施 || kv.措施 || '待补充',
      status: kv.状态 || '处理中',
      time: Date.now()
    };
    ws.records = ws.records || [];
    ws.records.unshift(record);
    ws.result = `已记录异常：${record.problem}\n责任人：${record.owner}\n处理措施：${record.action}\n状态：${record.status}`;
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  async exceptionReport() {
    const ws = this.getWorkspace('prodexception');
    const records = ws.records || [];
    const kv = this.parseKeyValueText(ws.prompt || '');
    const split = value => String(value || '').split(/[；;、,，\n]/).map(item => item.trim()).filter(Boolean);
    const incident = {
      caseId: kv.编号 || `8D-${Date.now()}`,
      problem: kv.问题 || kv.异常 || records[0]?.problem || '', owner: kv.责任人 || records[0]?.owner || '',
      team: kv.团队 || '', location: kv.地点 || '', impact: kv.影响 || '',
      containmentActions: split(kv.临时措施 || kv.遏制措施), rootCauses: split(kv.根因 || kv.原因),
      correctiveActions: split(kv.纠正措施 || kv.处理措施 || records[0]?.action),
      evidence: split(kv.验证证据 || kv.证据), preventiveActions: split(kv.防再发措施 || kv.预防措施)
    };
    if (!incident.problem) {
      ws.result = '请先填写问题，再生成 8D 闭环。';
      this.rerender();
      return;
    }
    if (Utils.isGitHubPagesHost()) {
      ws.result = '当前为静态演示模式，真实 8D API 需连接本地或生产服务。\n\nD0–D7 将基于问题、遏制、根因、纠正、验证和防再发证据推进；D8 必须管理员审批，绝不会自动结案。';
      ws.updatedAt = Date.now();
      Store.save();
      this.rerender();
      return;
    }
    try {
      const created = await APIClient.request('/api/agents/8d', { method: 'POST', body: JSON.stringify({ incident }) });
      const taskId = created?.data?.task?.id;
      await new Promise(resolve => setTimeout(resolve, 250));
      const latest = taskId ? await APIClient.request(`/api/agents/tasks/${taskId}`) : created;
      const task = latest?.data?.task || created?.data?.task || {};
      const report = task.output_payload?.eightD;
      ws.result = report ? [
        `8D 任务：${task.id}`, `完成度：${report.completionRate}%`, `下一步：${report.nextAction}`, '',
        ...report.stages.map(stage => `${stage.code} ${stage.name}｜${stage.status}｜${stage.output}`)
      ].join('\n') : `8D 任务已创建：${taskId || '处理中'}，请在 Agent 监控中心查看进度。`;
    } catch (error) {
      ws.result = `8D 任务创建失败：${this.recordAiError(error, '8d-workflow')}`;
    }
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  inspectionAdd() {
    const ws = this.getWorkspace('inspection');
    const kv = this.parseKeyValueText(ws.prompt || '');
    const record = {
      id: uid(),
      device: kv.设备 || '未命名设备',
      item: kv.项目 || kv.点检项目 || '待补充',
      cycle: kv.周期 || '未设置',
      result: kv.结果 || '未填写',
      alert: kv.异常提醒 || '无',
      time: Date.now()
    };
    ws.records = ws.records || [];
    ws.records.unshift(record);
    ws.result = `已记录点检：${record.device} / ${record.item}\n周期：${record.cycle}\n结果：${record.result}\n异常提醒：${record.alert}`;
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  inspectionReport() {
    const ws = this.getWorkspace('inspection');
    const records = ws.records || [];
    ws.result = records.length ? [
      '设备点检报告',
      ...records.map((item, index) => `${index + 1}. 设备：${item.device}；项目：${item.item}；周期：${item.cycle}；结果：${item.result}；异常提醒：${item.alert}`)
    ].join('\n') : '暂无点检记录，无法生成点检表。';
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  userAdd() {
    const ws = this.getWorkspace('users');
    const kv = this.parseKeyValueText(ws.prompt || '');
    const user = {
      id: uid(),
      name: kv.姓名 || kv.用户 || '未命名用户',
      role: kv.角色 || '普通用户',
      status: kv.状态 || '启用'
    };
    Store.state.users.unshift(user);
    ws.result = `已新增用户：${user.name}\n角色：${user.role}\n状态：${user.status}`;
    Store.save();
    this.rerender();
  },

  roleAdd() {
    const ws = this.getWorkspace('roles');
    const kv = this.parseKeyValueText(ws.prompt || '');
    const role = {
      id: uid(),
      name: kv.角色 || '未命名角色',
      permissions: kv.权限 || '未配置权限',
      status: kv.状态 || '启用'
    };
    Store.state.roles.unshift(role);
    ws.result = `已新增角色：${role.name}\n权限：${role.permissions}\n状态：${role.status}`;
    Store.save();
    this.rerender();
  },

  versionSave() {
    const ws = this.getWorkspace('versioning');
    if (!ws.title || !ws.prompt) throw new Error('请填写文件名称和版本内容');
    const version = {
      id: uid(),
      versionId: `v${(Store.state.fileVersions.filter(item => item.title === ws.title).length || 0) + 1}`,
      title: ws.title,
      content: ws.prompt,
      summary: KnowledgeEngine.summary(ws.prompt) || ws.prompt.slice(0, 80),
      time: Date.now()
    };
    Store.state.fileVersions.unshift(version);
    ws.result = `已保存版本：${version.title} ${version.versionId}`;
    Store.save();
    this.rerender();
  },

  versionRestore(id) {
    const ws = this.getWorkspace('versioning');
    const target = id ? Store.state.fileVersions.find(item => item.id === id) : Store.state.fileVersions[0];
    if (!target) throw new Error('暂无可恢复版本');
    ws.title = target.title;
    ws.prompt = target.content;
    ws.result = `已恢复版本：${target.title} ${target.versionId}\n时间：${Utils.formatDate(target.time, true)}\n\n${target.content}`;
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  versionCompare() {
    const ws = this.getWorkspace('versioning');
    const versions = Store.state.fileVersions.filter(item => !ws.title || item.title === ws.title).slice(0, 2);
    if (versions.length < 2) throw new Error('至少需要两个版本才能对比');
    const [latest, previous] = versions;
    const latestLines = new Set(String(latest.content).split('\n').map(line => line.trim()).filter(Boolean));
    const previousLines = new Set(String(previous.content).split('\n').map(line => line.trim()).filter(Boolean));
    const added = [...latestLines].filter(line => !previousLines.has(line));
    const removed = [...previousLines].filter(line => !latestLines.has(line));
    ws.result = [
      `版本对比：${latest.versionId} vs ${previous.versionId}`,
      `新增：${added.length ? added.join('；') : '无'}`,
      `删除：${removed.length ? removed.join('；') : '无'}`
    ].join('\n');
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  async biddingAnalyze(btn) {
    const ws = this.getWorkspace('bidding');
    await this.busy(btn, async () => {
      const source = [ws.prompt, ...(ws.files || []).map(item => item.content)].join('\n');
      const projectName = (source.match(/项目名称[:：]?\s*([^\n]+)/) || [])[1] || '未识别项目';
      const tender = (source.match(/招标单位[:：]?\s*([^\n]+)/) || [])[1] || '未识别招标单位';
      const deadline = (source.match(/(?:投标截止时间|截止时间)[:：]?\s*([^\n]+)/) || [])[1] || '未识别截止时间';
      const quality = (source.match(/质量要求[:：]?\s*([^\n]+)/) || [])[1] || '按招标文件执行';
      const payment = (source.match(/付款方式[:：]?\s*([^\n]+)/) || [])[1] || '按招标文件执行';
      const delivery = (source.match(/交货期|交货周期|交期[:：]?\s*([^\n]+)/) || [])[1] || '按招标文件执行';
      const quote = (source.match(/报价金额[:：]?\s*([^\n]+)/) || [])[1] || '待生成';
      ws.result = [
        '招投标解析结果',
        `项目名称：${projectName}`,
        `招标单位：${tender}`,
        `截止时间：${deadline}`,
        `质量要求：${quality}`,
        `交货期：${delivery}`,
        `付款方式：${payment}`,
        `报价金额：${quote}`,
        '',
        '一、投标文件目录',
        '1. 投标函',
        '2. 商务响应表',
        '3. 技术响应表',
        '4. 报价表',
        '5. 资质文件',
        '6. 标书检查报告',
        '',
        '二、商务标',
        `响应客户/项目：${projectName}，付款方式 ${payment}，交货期 ${delivery}。`,
        '',
        '三、技术标',
        `按质量要求执行：${quality}。重点检查尺寸、毛刺、表面划伤和批次一致性。`,
        '',
        '四、报价表',
        `建议报价：${quote}。`,
        '',
        '五、标书检查报告',
        '检查项：目录、页码、签字盖章、错别字、格式、漏项。当前结果：请在导出前再次核对签字盖章页。'
      ].join('\n');
      ws.updatedAt = Date.now();
      Store.save();
      Store.addActivity('招投标助手已解析招标文件', 'ai');
      this.rerender();
    });
  },

  demoBid() {
    const ws = this.getWorkspace('bidding');
    ws.title = '新能源设备不锈钢零部件采购项目';
    ws.prompt = [
      '项目名称：新能源设备不锈钢零部件采购项目',
      '招标单位：常州新能源科技有限公司',
      '投标单位：溧阳五四不锈钢有限公司',
      '投标截止时间：2026年7月5日 17:00',
      '采购内容：304不锈钢连接件760件',
      '质量要求：尺寸合格、无毛刺、无明显划伤',
      '交货期：7天',
      '付款方式：月结30天',
      '报价金额：9710元'
    ].join('\n');
    ws.result = [
      '标书制作流程演示已加载',
      '1. 读取招标文件',
      '2. 提取招标要求',
      '3. 生成投标目录',
      '4. 生成商务响应表',
      '5. 生成技术响应表',
      '6. 生成报价表',
      '7. 生成标书检查报告',
      '8. 保存到文件中心',
      '9. 导出Word/PDF'
    ].join('\n');
    ws.demoResult = `项目：新能源设备不锈钢零部件采购项目\n招标单位：常州新能源科技有限公司\n投标单位：溧阳五四不锈钢有限公司\n数量：760 件\n报价：9710 元\n付款：月结30天`;
    Store.state.workspaces.bidding = ws;
    Store.save();
    Store.addActivity('加载标书制作流程演示', 'ai');
    this.navigate('bidding');
  },

  applyProviderPreset(provider) {
    const presets = {
      '本地模式': ['', 'deepseek-v4-flash'],
      'DeepSeek OpenAI-compatible API': [window.PERSONAL_AI_OS_CONFIG?.API_BASE_URL || '', 'deepseek-v4-flash'],
      OpenAI: [window.PERSONAL_AI_OS_CONFIG?.API_BASE_URL || '', 'deepseek-v4-flash'],
      DeepSeek: [window.PERSONAL_AI_OS_CONFIG?.API_BASE_URL || '', 'deepseek-v4-flash'],
      Claude: [window.PERSONAL_AI_OS_CONFIG?.API_BASE_URL || '', 'deepseek-v4-flash'],
      Gemini: [window.PERSONAL_AI_OS_CONFIG?.API_BASE_URL || '', 'deepseek-v4-flash'],
      Qwen: [window.PERSONAL_AI_OS_CONFIG?.API_BASE_URL || '', 'deepseek-v4-flash'],
      '自定义': ['', '']
    };
    if (!presets[provider]) return;
    document.getElementById('apiUrl').value = presets[provider][0];
    document.getElementById('apiModel').value = presets[provider][1];
    const modeInput = document.getElementById('accessMode');
    if (modeInput) {
      modeInput.value = provider === '本地模式' ? 'local' : provider === '本地模型' ? 'api' : 'cloud';
    }
  },

  settingsSaveAI() {
    const accessMode = document.getElementById('accessMode')?.value || 'local';
    const syncMode = document.getElementById('syncMode')?.value || 'local';
    const provider = document.getElementById('apiProvider')?.value || '自定义';
    const apiUrl = document.getElementById('apiUrl')?.value.trim();
    const model = document.getElementById('apiModel')?.value.trim();
    const githubPagesUrl = document.getElementById('githubPagesUrl')?.value.trim();
    const temperature = Number(document.getElementById('apiTemperature')?.value || 0.2);
    const topP = Number(document.getElementById('apiTopP')?.value || 1);
    const maxTokens = Number(document.getElementById('apiMaxTokens')?.value || 2048);
    const timeout = Number(document.getElementById('apiTimeout')?.value || 30000);
    if (accessMode !== 'local' && (!apiUrl || !model)) throw new Error('真实 AI 模式下请填写 AI Gateway 地址和模型名称');
    Store.state.settings = {
      ...Store.state.settings,
      accessMode,
      syncMode,
      provider,
      apiEnabled: accessMode !== 'local',
      apiUrl: accessMode === 'local' ? '' : apiUrl,
      model,
      githubPagesUrl,
      temperature,
      topP,
      maxTokens,
      timeout
    };
    Store.save();
    this.updateApiState();
    this.rerender();
    delete Store.state.settings.apiKey;
    this.toast('AI Gateway 地址已保存；DeepSeek Key 仅允许配置在服务端环境变量中');
  },

  settingsDevToggle() {
    Store.state.settings.developerMode = !Store.state.settings.developerMode;
    Store.save();
    this.toast(Store.state.settings.developerMode ? 'Developer Mode 已开启' : 'Developer Mode 已关闭');
    this.rerender();
  },

  async settingsTestAI(btn) {
    this.settingsSaveAI();
    if (Store.state.settings.accessMode === 'local') throw new Error('当前未配置 DeepSeek API Key，无法调用真实 AI。');
    await this.busy(btn, async () => {
      const health = await APIClient.health();
      if (!health?.deepseekConfigured) {
        this.toast('AI 服务暂未配置', 'warning');
        return;
      }
      const res = await AIService.complete('请仅回复：连接成功', { module: 'gateway-test', mode: 'gateway-test' });
      if (res.mode === 'api') this.toast(`DeepSeek 已连接：${res.model || Store.state.settings.model || 'deepseek-v4-flash'}`);
      else if (Utils.isGitHubPagesHost()) this.toast('当前为 GitHub Pages 展示模式，真实 AI 后端未连接。', 'warning');
      else throw new Error(res.error || 'AI Gateway 测试失败');
    });
  },

  settingsMailToggle() {
    Store.state.settings.agentMail.enabled = !Store.state.settings.agentMail.enabled;
    Store.save();
    this.rerender();
  },

  settingsSaveMail() {
    const agentMail = Store.state.settings.agentMail || {};
    agentMail.mailbox = document.getElementById('mailboxAddress')?.value.trim() || '';
    agentMail.apiUrl = document.getElementById('agentMailApiUrl')?.value.trim() || '';
    agentMail.apiKey = document.getElementById('agentMailApiKey')?.value.trim() || '';
    agentMail.senderName = document.getElementById('agentMailSender')?.value.trim() || 'Personal AI OS';
    agentMail.dailyQuota = Math.max(1, Number(document.getElementById('agentMailQuota')?.value || 20));
    if (!agentMail.lastResetAt) agentMail.lastResetAt = new Date().toISOString().slice(0, 10);
    Store.state.settings.agentMail = agentMail;
    Store.save();
    this.toast('Agent Mail 设置已保存');
  },

  async settingsTestMail(btn) {
    this.settingsSaveMail();
    const config = Store.state.settings.agentMail;
    await this.busy(btn, async () => {
      if (!config.apiUrl || !config.apiKey || !config.mailbox) {
        this.toast('未配置完整 Agent Mail，当前以演示模式通过测试');
        return;
      }
      try {
        const response = await fetch(`${config.apiUrl.replace(/\/$/, '')}/health`, {
          headers: { Authorization: `Bearer ${config.apiKey}` }
        });
        if (!response.ok) {
          const { raw, json } = await Utils.safeReadResponse(response);
          throw new Error(json?.message || json?.detail || raw || `HTTP ${response.status}`);
        }
        config.enabled = true;
        Store.save();
        this.toast('Agent Mail 连接成功');
      } catch (error) {
        this.toast(`当前未配置 DeepSeek API Key，无法调用真实 AI。${error.message ? `（${error.message}）` : ''}`, 'error');
      }
      this.rerender();
    });
  },

  async tryPromoteDemoSession(email = DEMO_ACCOUNT.email, password = DEMO_ACCOUNT.password) {
    if (!RuntimeConfig.API_BASE_URL && !Store.state.settings.apiUrl) return false;
    try {
      const res = await APIClient.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }, { timeout: 8000 });
      if (!res.data?.token) return false;
      AuthClient.save({ ...res.data, demo: false });
      Store.syncStatus = { mode: 'server', state: 'connected', message: '已连接企业 SQLite', updatedAt: Date.now() };
      return true;
    } catch (error) {
      Store.syncStatus = { mode: 'local', state: 'offline', message: `后端登录不可用：${error.message}`, updatedAt: Date.now() };
      return false;
    }
  },

  async authLogin() {
    const email = document.getElementById('accountEmail')?.value.trim();
    const password = document.getElementById('accountPassword')?.value.trim();
    if (!email || !password) throw new Error('请输入邮箱和密码');
    if (window.PERSONAL_AI_OS_CONFIG?.DEMO_LOGIN_ENABLED) {
      const customDemoPassword = localStorage.getItem('personal-ai-os-demo-password') || DEMO_ACCOUNT.password;
      if (email === DEMO_ACCOUNT.email && password === customDemoPassword) {
        const connected = await this.tryPromoteDemoSession(email, password);
        if (connected) {
          await Store.hydrateFromServer();
          await this.refreshDashboard();
          await this.refreshOrders();
          await this.refreshInventory();
          await this.refreshAgentRuntime(true);
          this.toast('登录成功，业务数据已连接后端 SQLite。');
          this.renderNav();
          this.navigate('home');
          this.rerender();
          return;
        }
        AuthClient.save({
          token: 'demo-local-session',
          demo: true,
          user: {
            id: 'demo-admin',
            enterpriseId: 'demo-enterprise',
            email: DEMO_ACCOUNT.email,
            name: DEMO_ACCOUNT.name,
            role: DEMO_ACCOUNT.role,
            status: '启用'
          },
          enterprise: {
            id: 'demo-enterprise',
            name: DEMO_ACCOUNT.enterpriseName
          }
        });
        this.toast('后端不可用，已进入 localStorage 演示降级。', 'warning');
        this.renderNav();
        this.navigate('home');
        this.rerender();
        return;
      }
      if (window.PERSONAL_AI_OS_CONFIG?.DEMO_LOGIN_ONLY) {
        throw new Error('账号或密码错误，请使用演示账号 admin@personal-ai-os.local / 123456');
      }
    }
    const res = await APIClient.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    AuthClient.save(res.data);
    await Store.hydrateFromServer();
    await this.refreshDashboard();
    await this.refreshOrders();
    await this.refreshInventory();
    await this.refreshAgentRuntime(true);
    this.toast('登录成功');
    this.renderNav();
    this.navigate('home');
    this.rerender();
  },

  async authRegister() {
    const enterpriseName = document.getElementById('accountEnterpriseName')?.value.trim();
    const name = document.getElementById('accountName')?.value.trim();
    const email = document.getElementById('accountEmail')?.value.trim();
    const password = document.getElementById('accountPassword')?.value.trim();
    const confirmPassword = document.getElementById('accountNextPassword')?.value.trim();
    const role = document.getElementById('accountRole')?.value || '企业管理员';
    if (!enterpriseName || !name || !email || !password) throw new Error('请填写企业名称、姓名、邮箱和密码');
    if (confirmPassword && password !== confirmPassword) throw new Error('两次密码不一致');
    if (window.PERSONAL_AI_OS_CONFIG?.DEMO_LOGIN_ONLY) {
      AuthClient.save({
        token: 'demo-local-session',
        demo: true,
        user: {
          id: uid(),
          enterpriseId: 'demo-enterprise',
          email,
          name,
          role,
          status: '启用'
        },
        enterprise: {
          id: 'demo-enterprise',
          name: enterpriseName
        }
      });
      this.toast('已在演示模式下创建本地企业账号');
      this.renderNav();
      this.navigate('home');
      this.rerender();
      return;
    }
    const res = await APIClient.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ enterpriseName, name, email, password, role })
    });
    AuthClient.save(res.data);
    await Store.hydrateFromServer();
    await this.refreshDashboard();
    await this.refreshOrders();
    await this.refreshInventory();
    await this.refreshAgentRuntime(true);
    this.toast('注册成功，已自动登录');
    this.renderNav();
    this.navigate('home');
    this.rerender();
  },

  authLogout() {
    AuthClient.clear();
    this.renderNav();
    this.toast('已退出登录');
    this.navigate('login');
    this.rerender();
  },

  async authChangePassword() {
    const currentPassword = document.getElementById('accountPassword')?.value.trim();
    const newPassword = document.getElementById('accountNextPassword')?.value.trim();
    if (!currentPassword || !newPassword) throw new Error('请输入当前密码和新密码');
    if (AuthClient.isDemo()) {
      const saved = localStorage.getItem('personal-ai-os-demo-password') || DEMO_ACCOUNT.password;
      if (currentPassword !== saved) throw new Error('当前密码错误');
      localStorage.setItem('personal-ai-os-demo-password', newPassword);
      this.toast('演示账号密码已保存在当前浏览器');
      return;
    }
    await APIClient.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    this.toast('密码修改成功');
  },

  async authSaveEnterprise() {
    const name = document.getElementById('accountEnterpriseName')?.value.trim();
    if (!name) throw new Error('请输入企业名称');
    if (AuthClient.isDemo()) {
      const session = AuthClient.session;
      AuthClient.save({
        ...session,
        enterprise: {
          ...(session.enterprise || {}),
          name
        }
      });
      this.toast('演示企业信息已保存到本地');
      this.rerender();
      return;
    }
    await APIClient.request('/api/enterprise', {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
    const session = AuthClient.session;
    AuthClient.save({
      ...session,
      enterprise: {
        ...(session.enterprise || {}),
        name
      }
    });
    this.toast('企业信息已保存');
    this.rerender();
  },

  async refreshOrders(showToast = false) {
    if (!AuthClient.isLoggedIn() || AuthClient.isDemo()) {
      if (showToast) this.toast('当前为本地演示数据');
      if (this.route === 'orders' || this.route === 'home' || this.route === 'productionplan' || this.route === 'riskcenter') this.rerender();
      return;
    }
    const res = await APIClient.request('/api/orders');
    Store.state.orders = res.data.items || [];
    Store.save();
    await this.refreshDashboard();
    if (showToast) this.toast('订单已刷新');
    if (this.route === 'orders' || this.route === 'home' || this.route === 'productionplan' || this.route === 'riskcenter') this.rerender();
  },

  async saveOrder() {
    if (!AuthClient.isLoggedIn()) throw new Error('请先登录');
    const payload = {
      orderNo: document.getElementById('orderNo')?.value.trim(),
      customer: document.getElementById('orderCustomer')?.value.trim(),
      product: document.getElementById('orderProduct')?.value.trim(),
      quantity: document.getElementById('orderQuantity')?.value.trim(),
      deliveryDate: document.getElementById('orderDeliveryDate')?.value.trim(),
      status: document.getElementById('orderStatus')?.value,
      priority: document.getElementById('orderPriority')?.value
    };
    if (!payload.orderNo || !payload.customer || !payload.product) throw new Error('请填写订单号、客户、产品');
    if (AuthClient.isDemo()) {
      const now = Date.now();
      Store.state.orders.unshift({
        id: uid(),
        order_no: payload.orderNo,
        customer: payload.customer,
        product: payload.product,
        quantity: Number(payload.quantity || 0),
        delivery_date: payload.deliveryDate,
        status: payload.status,
        priority: payload.priority,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString()
      });
      Store.save();
      await this.refreshDashboard();
      this.toast('订单已保存到本地演示数据');
      return;
    }
    await APIClient.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await this.refreshOrders();
    this.toast('订单已保存');
  },

  async deleteOrder(id) {
    if (!confirm('确定删除这条订单？')) return;
    if (AuthClient.isDemo()) {
      Store.state.orders = Store.state.orders.filter(item => item.id !== id);
      Store.save();
      await this.refreshDashboard();
      this.toast('订单已从本地演示数据删除');
      return;
    }
    await APIClient.request(`/api/orders/${id}`, { method: 'DELETE' });
    await this.refreshOrders();
    this.toast('订单已删除');
  },

  async refreshInventory(showToast = false) {
    if (!AuthClient.isLoggedIn() || AuthClient.isDemo()) {
      if (showToast) this.toast('当前为本地演示数据');
      if (this.route === 'inventory' || this.route === 'home' || this.route === 'productionplan' || this.route === 'riskcenter') this.rerender();
      return;
    }
    const res = await APIClient.request('/api/inventory');
    Store.state.inventory = res.data.items || [];
    Store.save();
    await this.refreshDashboard();
    if (showToast) this.toast('库存已刷新');
    if (this.route === 'inventory' || this.route === 'home' || this.route === 'riskcenter') this.rerender();
  },

  async saveInventory() {
    if (!AuthClient.isLoggedIn()) throw new Error('请先登录');
    const payload = {
      productCode: document.getElementById('inventoryCode')?.value.trim(),
      productName: document.getElementById('inventoryName')?.value.trim(),
      stockQuantity: document.getElementById('inventoryQuantity')?.value.trim(),
      safetyStock: document.getElementById('inventorySafety')?.value.trim(),
      location: document.getElementById('inventoryLocation')?.value.trim()
    };
    if (!payload.productName) throw new Error('请填写产品名称');
    if (AuthClient.isDemo()) {
      Store.state.inventory.unshift({
        id: uid(),
        product_code: payload.productCode,
        product_name: payload.productName,
        stock_quantity: Number(payload.stockQuantity || 0),
        safety_stock: Number(payload.safetyStock || 0),
        location: payload.location,
        updated_at: new Date().toISOString()
      });
      Store.save();
      await this.refreshDashboard();
      this.toast('库存已保存到本地演示数据');
      return;
    }
    await APIClient.request('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await this.refreshInventory();
    this.toast('库存已保存');
  },

  async deleteInventory(id) {
    if (!confirm('确定删除这条库存记录？')) return;
    if (AuthClient.isDemo()) {
      Store.state.inventory = Store.state.inventory.filter(item => item.id !== id);
      Store.save();
      await this.refreshDashboard();
      this.toast('库存已从本地演示数据删除');
      return;
    }
    await APIClient.request(`/api/inventory/${id}`, { method: 'DELETE' });
    await this.refreshInventory();
    this.toast('库存已删除');
  },

  getPlanWorkspace() {
    Store.state.workspaces.productionplan = Store.state.workspaces.productionplan || {};
    return Store.state.workspaces.productionplan;
  },

  parseCsvRows(text = '') {
    const rows = [];
    let row = [], field = '', quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"' && quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[index + 1] === '\n') index += 1;
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        row = []; field = '';
      } else field += char;
    }
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  },

  async loadPlanCsv(file) {
    if (!file || !/\.csv$/i.test(file.name || '')) throw new Error('请选择 CSV 文件');
    this.toast('正在读取 CSV 订单...', 'success');
    const text = await file.text();
    const rows = this.parseCsvRows(text);
    if (rows.length < 2) throw new Error('CSV 没有可导入的订单数据');
    const headers = rows[0].map(value => String(value).trim());
    const aliases = {
      order_no: ['订单号','单号','order_no','order'], customer: ['客户','客户名称','customer'],
      product: ['产品','产品名称','product'], quantity: ['数量','订单数量','quantity'],
      delivery_date: ['交期','交货日期','delivery_date'], process: ['工艺','加工工艺','process'],
      machine: ['设备需求','设备','machine','equipment'], priority: ['优先级','priority'], status: ['状态','status']
    };
    const indexOf = key => headers.findIndex(header => aliases[key].some(alias => header.toLowerCase() === alias.toLowerCase()));
    for (const required of ['customer','product','quantity','delivery_date']) {
      if (indexOf(required) < 0) throw new Error(`CSV 缺少必需字段：${aliases[required][0]}`);
    }
    const imported = rows.slice(1).filter(row => row.some(Boolean)).map((row, index) => ({
      order_no: row[indexOf('order_no')] || `CSV-${String(index + 1).padStart(3, '0')}`,
      customer: row[indexOf('customer')] || '', product: row[indexOf('product')] || '',
      quantity: Number(String(row[indexOf('quantity')] || 0).replace(/[^\d.-]/g, '')) || 0,
      delivery_date: row[indexOf('delivery_date')] || '', process: row[indexOf('process')] || '',
      machine: row[indexOf('machine')] || '', priority: row[indexOf('priority')] || '中',
      status: row[indexOf('status')] || '待处理'
    })).filter(item => item.customer && item.product);
    if (!imported.length) throw new Error('CSV 中没有客户和产品完整的有效订单');
    const ws = this.getPlanWorkspace();
    ws.prompt = imported.map(item => [item.order_no,item.customer,item.product,item.quantity,item.delivery_date,item.process,item.machine,item.priority,item.status].join(',')).join('\n');
    ws.parsedOrders = imported;
    ws.csvImportedAt = Date.now();
    ws.csvStatus = `已成功导入 ${file.name}，共 ${imported.length} 条有效订单。`;
    ws.metrics = { ...(ws.metrics || {}), totalOrders: imported.length, totalQuantity: imported.reduce((sum, item) => sum + item.quantity, 0) };
    Store.save();
    this.rerender();
    this.toast(`CSV 导入成功：${imported.length} 条订单`);
  },

  async downloadPlanCsvTemplate(button) {
    await this.busy(button, async () => {
      const csv = '\uFEFF订单号,客户,产品,数量,交期,工艺,设备需求,优先级,状态\nSO-2026-001,常州新能源科技有限公司,304不锈钢连接件,760,2026-07-05,CNC加工,CNC加工中心,高,待处理';
      Utils.textDownload(csv, '生产计划订单导入模板.csv');
      this.toast('CSV 示例模板已下载');
    });
  },

  async equipmentSave(button) {
    await this.busy(button, async () => {
      const rows = [...document.querySelectorAll('[data-equipment-row]')];
      if (!rows.length) throw new Error('暂无设备数据，请先重置示例设备');
      const items = rows.map(row => {
        const value = field => row.querySelector(`[data-equipment-field="${field}"]`)?.value.trim() || '';
        return { id: value('id'), name: value('name'), status: value('status'), load: Math.max(0, Math.min(100, Number(value('load')) || 0)), processes: value('processes'), maintenance: value('maintenance') };
      });
      if (items.some(item => !item.id || !item.name)) throw new Error('设备编号和设备名称不能为空');
      Store.state.equipment = items;
      Store.addActivity(`保存设备台账：${items.length} 台`, 'file');
      Store.save();
      this.rerender();
      this.toast(`设备台账保存成功：${items.length} 台`);
    });
  },

  async equipmentReset(button) {
    await this.busy(button, async () => {
      Store.state.equipment = structuredClone(DefaultState.equipment);
      Store.save();
      this.rerender();
      this.toast('已重置 8 台示例设备');
    });
  },

  async planSample(button) {
    await this.busy(button, async () => {
      const ws = this.getPlanWorkspace();
      ws.prompt = [
      'SO-2026-001,常州新能源科技有限公司,304不锈钢连接件,760,2026-07-05,CNC加工,CNC加工中心,高,待处理',
      'SO-2026-002,苏州精工机械有限公司,支架组件,180,2026-07-04,铣削,铣床,中,待处理',
      'SO-2026-003,无锡智造科技有限公司,销轴件,320,2026-07-03,车削,数控车床,高,生产中',
      'SO-2026-004,上海工业贸易有限公司,锻压件,90,2026-07-08,锻造,锻压机,低,待处理',
      'SO-2026-005,南京制造中心,热处理板件,250,2026-07-02,淬火,淬火炉,高,待处理'
      ].join('\n');
      ws.planResult = '';
      ws.riskResult = '';
      ws.dailySchedule = '';
      ws.dailyReport = '';
      ws.parsedOrders = [];
      ws.metrics = {};
      ws.updatedAt = Date.now();
      Store.save();
      this.rerender();
      this.toast('已填充制造业示例订单');
    });
  },

  parsePlanOrders(text = '') {
    const source = String(text || '').trim();
    if (!source) return [];
    if (source.startsWith('[')) {
      try {
        const json = JSON.parse(source);
        if (Array.isArray(json)) return json;
      } catch {}
    }
    const rows = source.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const orders = [];
    for (const line of rows) {
      if (/^#|^备注|^说明/.test(line)) continue;
      if (/订单号|客户|产品|数量|交期/.test(line) && !/\d{4}-\d{2}-\d{2}/.test(line) && !/\d/.test(line.replace(/[^\d]/g, ''))) continue;
      const parts = line.split(/[,，\t|]/).map(part => part.trim()).filter(Boolean);
      const fromParts = parts.length >= 5 ? {
        order_no: parts[0],
        customer: parts[1],
        product: parts[2],
        quantity: parts[3],
        delivery_date: parts[4],
        process: parts[5] || '',
        machine: parts[6] || '',
        priority: parts[7] || '中',
        status: parts[8] || '待处理'
      } : {};
      const pick = (label, fallback = '') => {
        const reg = new RegExp(`${label}[:：]\\s*([^,，\\n]+)`);
        return (line.match(reg) || [])[1] || fallback;
      };
      const order = {
        order_no: fromParts.order_no || pick('订单号') || pick('单号') || line.slice(0, 20),
        customer: fromParts.customer || pick('客户'),
        product: fromParts.product || pick('产品'),
        quantity: Number(String(fromParts.quantity || pick('数量') || 0).replace(/[^\d.-]/g, '')) || 0,
        delivery_date: fromParts.delivery_date || pick('交期') || pick('截止时间'),
        process: fromParts.process || pick('工艺'),
        status: fromParts.status || pick('状态') || '待处理',
        priority: fromParts.priority || pick('优先级') || '中',
        machine: fromParts.machine || pick('设备') || pick('机台') || ''
      };
      if (order.order_no || order.customer || order.product) orders.push(order);
    }
    return orders;
  },

  buildPlanAnalysis(orders = []) {
    const sorted = [...orders].filter(item => item.order_no || item.customer || item.product).sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || '')));
    const urgent = sorted.filter(item => /高/.test(String(item.priority || '')) || (item.delivery_date && new Date(item.delivery_date) <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 2)));
    const totalQuantity = sorted.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const deliveryRisk = sorted.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date()).length;
    const equipment = Store.state.equipment || [];
    const machineGroups = sorted.reduce((map, item) => {
      const key = item.machine || '未指定设备';
      map[key] = map[key] || [];
      map[key].push(item);
      return map;
    }, {});
    const machineLoad = Object.entries(machineGroups).map(([machine, list]) => {
      const ledger = equipment.find(item => item.name === machine || item.id === machine || (item.processes || '').includes(list[0]?.process || '___'));
      const ledgerText = ledger ? `台账负载 ${ledger.load}% / ${ledger.status} / 维护 ${ledger.maintenance}` : '台账未匹配';
      return `${machine}：${list.length} 单 / ${list.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} 件 / ${ledgerText}`;
    }).join('\n');
    const equipmentRisks = sorted.map(order => {
      const ledger = equipment.find(item => item.name === order.machine || item.id === order.machine || (item.processes || '').includes(order.process || '___'));
      if (!ledger) return `${order.order_no}：未匹配设备台账`;
      if (ledger.status === '维护' || ledger.status === '停机' || ledger.maintenance === '维护中') return `${order.order_no}：${ledger.name}当前不可排产`;
      if (Number(ledger.load) >= 80) return `${order.order_no}：${ledger.name}负载${ledger.load}%，建议分流`;
      return '';
    }).filter(Boolean);
    const materialRisk = sorted.filter(item => /铝|不锈钢|钢|板|轴|件/.test(`${item.product}${item.customer}`)).length ? '中' : '低';
    const planLines = sorted.map((item, index) => `${index + 1}. ${item.order_no} / ${item.customer} / ${item.product} / 数量 ${item.quantity} / 交期 ${item.delivery_date} / 优先级 ${item.priority} / 设备 ${item.machine || '未指定'}`).join('\n');
    const riskLines = [
      `交期风险：${deliveryRisk} 单`,
      `紧急订单：${urgent.length} 单`,
      `设备风险：${equipmentRisks.length} 项`,
      `物料风险：${materialRisk}`,
      `总数量：${totalQuantity}`
    ].join('\n');
    const dailySchedule = sorted.slice(0, 10).map((item, index) => `${index + 1}. ${item.delivery_date || '待确认'} · ${item.order_no} · ${item.customer} · ${item.product} · ${item.quantity} 件 · ${item.machine || '未指定设备'}`).join('\n');
    return {
      sorted,
      urgent,
      totalQuantity,
      deliveryRisk,
      equipmentRisks,
      materialRisk,
      machineLoad,
      planLines,
      riskLines,
      dailySchedule
    };
  },

  async planAnalyze(btn) {
    const ws = this.getPlanWorkspace();
    const input = document.getElementById('planInput')?.value ?? ws.prompt ?? '';
    ws.prompt = input;
    const orders = this.parsePlanOrders(input);
    if (!orders.length) throw new Error('请先填写或粘贴订单数据');
    await this.busy(btn, async () => {
      let analysis = this.buildPlanAnalysis(orders);
      let result = '';
      let riskResult = '';
      let schedule = '';
      const buildPlanMock = reason => [
        'AI Gateway 已自动降级 Mock。',
        `原因：${reason}`,
        '', '生产计划：', analysis.planLines,
        '', '交期风险：', analysis.riskLines,
        '', '设备负载建议：', analysis.machineLoad || '未发现可计算设备负载',
        '', '每日安排：', analysis.dailySchedule || '暂无安排'
      ].join('\n');
      try {
        const equipmentContext = (Store.state.equipment || []).map(item => `${item.id} | ${item.name} | ${item.status} | 负载${item.load}% | ${item.processes} | ${item.maintenance}`).join('\n');
        const ai = await AIService.complete(
          `你是 AI 生产计划助手。请结合订单和设备台账输出：1.生产计划 2.交期风险 3.设备负载建议 4.物料风险 5.每日安排。不得把维护或停机设备安排生产。\n\n订单数据：\n${orders.map(item => `${item.order_no} | ${item.customer} | ${item.product} | ${item.quantity} | ${item.delivery_date} | 工艺${item.process || '未指定'} | ${item.priority} | ${item.machine || '未指定'}`).join('\n')}\n\n设备台账：\n${equipmentContext || '暂无设备台账'}`,
          { module: 'production-plan', mode: 'production-plan', temperature: 0.2, mockFallback: buildPlanMock }
        );
        result = ai.text;
        ws.aiMode = ai.mode;
        ws.aiError = ai.error || '';
      } catch (error) {
        this.recordAiError(error, 'productionplan-analyze');
        result = buildPlanMock(AIService.friendlyMessage?.(error) || error.message);
        ws.aiMode = 'mock';
        ws.aiError = AIService.friendlyMessage?.(error) || error.message;
      }
      riskResult = [
        `交期风险：${analysis.deliveryRisk} 单`,
        `设备负载建议：`,
        analysis.machineLoad || '未指定设备，建议先补齐机台字段。',
        analysis.equipmentRisks.length ? `设备异常：\n${analysis.equipmentRisks.join('\n')}` : '设备异常：无',
        `物料风险：${analysis.materialRisk}`,
        `紧急订单：${analysis.urgent.length} 单`
      ].join('\n');
      schedule = analysis.dailySchedule || '';
      ws.parsedOrders = analysis.sorted;
      ws.planResult = result;
      ws.result = result;
      ws.riskResult = riskResult;
      ws.dailySchedule = schedule;
      ws.metrics = {
        totalOrders: analysis.sorted.length,
        totalQuantity: analysis.totalQuantity,
        urgentOrders: analysis.urgent.length,
        materialRisk: analysis.materialRisk
        ,equipmentRisk: analysis.equipmentRisks.length ? `${analysis.equipmentRisks.length} 项` : '正常'
      };
      ws.updatedAt = Date.now();
      Store.state.dashboard = {
        ...Store.state.dashboard,
        todayPlan: analysis.sorted.length,
        productionPlanOrders: analysis.sorted.length,
        productionPlanRisk: analysis.deliveryRisk,
        aiSuggestions: [
          `订单 ${analysis.sorted.length} 单，建议按交期优先排产。`,
          analysis.deliveryRisk ? `发现 ${analysis.deliveryRisk} 单延期风险。` : '当前未发现延期风险。'
        ]
      };
      Store.save();
      this.rerender();
    });
  },

  planGenerate() {
    return this.planAnalyze();
  },

  async planReport(btn) {
    const ws = this.getPlanWorkspace();
    const orders = ws.parsedOrders || this.parsePlanOrders(ws.prompt || '');
    if (!orders.length) throw new Error('请先填写订单数据并完成分析');
    await this.busy(btn, async () => {
      const analysis = this.buildPlanAnalysis(orders);
      ws.dailyReport = [
      '生产日报',
      `日期：${new Date().toLocaleDateString('zh-CN')}`,
      `订单总数：${analysis.sorted.length}`,
      `总数量：${analysis.totalQuantity}`,
      `紧急订单：${analysis.urgent.length}`,
      `交期风险：${analysis.deliveryRisk}`,
      `物料风险：${analysis.materialRisk}`,
      `设备风险：${analysis.equipmentRisks.length} 项`,
      '',
      '今日安排：',
      analysis.dailySchedule || '暂无',
      '',
      '建议：按交期优先推进紧急订单，优先释放高负载设备。'
      ].join('\n');
      ws.result = ws.dailyReport;
      ws.updatedAt = Date.now();
      Store.save();
      this.rerender();
      this.toast('生产日报已生成');
    });
  },

  async planCopy(button) {
    const ws = this.getPlanWorkspace();
    const text = [ws.planResult, ws.dailyReport, ws.riskResult].filter(Boolean).join('\n\n');
    if (!text) throw new Error('暂无可复制内容');
    await this.busy(button, async () => this.copy(text));
  },

  async planExport(button) {
    const ws = this.getPlanWorkspace();
    const text = [ws.planResult, ws.dailyReport, ws.riskResult].filter(Boolean).join('\n\n');
    if (!text) throw new Error('暂无可导出的内容');
    await this.busy(button, async () => {
      Utils.textDownload(text, `生产计划报告_${new Date().toISOString().slice(0, 10)}.txt`);
      Store.addActivity('导出生产计划TXT', 'file');
      this.toast('生产计划 TXT 已导出');
    });
  },

  riskRefresh() {
    this.rerender();
  },

  async assistantRun() {
    const ws = this.getWorkspace('assistant');
    const prompt = ws.prompt || '';
    if (!prompt.trim()) throw new Error('请输入任务');
    const orders = Store.state.orders || [];
    const inventory = Store.state.inventory || [];
    const context = [
      `订单数：${orders.length}`,
      `库存记录数：${inventory.length}`,
      `最近邮件：${(Store.state.mailInbox || []).slice(0, 3).map(item => `${item.subject}/${item.from}`).join('；') || '无'}`,
      `知识条目：${(Store.state.knowledge || []).length}`
    ].join('\n');
    const normalizedPrompt = String(prompt || '').trim();
    const skillMap = [
      [/企业介绍|公司介绍|企业简介/, 'enterprise-intro'],
      [/产品介绍|产品说明/, 'product-intro'],
      [/报价说明|报价单|报价/, 'quote-summary'],
      [/询盘回复|客户回复|询盘/, 'inquiry-reply'],
      [/OCR.*总结|识别结果总结|图片总结/, 'ocr-summary'],
      [/错误中心|错误总结|Bug总结/, 'error-summary']
    ];
    const matchedSkillId = skillMap.find(([pattern]) => pattern.test(normalizedPrompt))?.[1] || '';
    let result = '';
    if (!matchedSkillId && /优先|订单/.test(prompt)) {
      result += `优先订单：\n${orders.slice().sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || ''))).slice(0, 5).map(item => `${item.order_no} / ${item.customer} / ${item.delivery_date}`).join('\n') || '暂无订单'}\n\n`;
    }
    if (!matchedSkillId && /库存|不足/.test(prompt)) {
      const low = inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0));
      result += `库存不足：\n${low.map(item => `${item.product_name} / 当前 ${item.stock_quantity} / 安全 ${item.safety_stock}`).join('\n') || '暂无低库存'}\n\n`;
    }
    if (!matchedSkillId && /延期|风险/.test(prompt)) {
      const delayed = orders.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成');
      result += `延期风险：\n${delayed.map(item => `${item.order_no} / ${item.customer} / ${item.delivery_date}`).join('\n') || '暂无延期风险'}\n\n`;
    }
    if (!matchedSkillId && /邮件/.test(prompt)) {
      result += `待回复邮件：\n${Store.state.mailInbox.map(item => `${item.subject} / ${item.from}`).join('\n') || '暂无邮件'}\n\n`;
    }
    if (!matchedSkillId && /计划/.test(prompt)) {
      await this.planGenerate();
      const planWs = this.getPlanWorkspace();
      result += `今日生产计划：\n${planWs.planResult || planWs.dailyReport || '暂无计划'}\n\n`;
    }
    if (!matchedSkillId && /日报/.test(prompt)) {
      result += `日报建议：\n订单 ${orders.length} 条；低库存 ${inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0)).length} 条；请人工确认后导出。\n\n`;
    }
    if (Store.state.settings.accessMode !== 'local' && matchedSkillId) {
      const skillInput = {
        enterpriseName: Store.state.settings.enterpriseName || '',
        customerRequest: normalizedPrompt,
        product: normalizedPrompt,
        quantity: '',
        material: '',
        delivery: '',
        contact: Store.state.settings.agentMail?.mailbox || ''
      };
      const ai = await AIService.complete('', {
        mode: 'skill',
        module: 'assistant',
        skillId: matchedSkillId,
        skillInput,
        mockFallback: () => this.skillMockOutput(matchedSkillId, skillInput)
      });
      result = this.skillMockOutput(matchedSkillId, skillInput) || ai.text;
    } else if (Store.state.settings.accessMode !== 'local') {
      const ai = await AIService.complete(`你是企业 AI 助手中心，请根据上下文完成任务。\n\n系统上下文：\n${context}\n\n用户任务：${prompt}`, {
        mode: 'chat',
        module: 'assistant'
      });
      result = ai.text;
    } else if (!result) {
      const low = inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0));
      const delayed = orders.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成');
      result = [
        '当前为演示模式，已使用内置演示数据生成结果。',
        '如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。',
        '',
        `优先处理订单：\n${orders.slice().sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || ''))).slice(0, 5).map(item => `${item.order_no} / ${item.customer} / ${item.delivery_date}`).join('\n') || '暂无订单'}`,
        `库存预警：\n${low.map(item => `${item.product_name} / 当前 ${item.stock_quantity} / 安全 ${item.safety_stock}`).join('\n') || '暂无低库存'}`,
        `延期风险：\n${delayed.map(item => `${item.order_no} / ${item.customer} / ${item.delivery_date}`).join('\n') || '暂无延期风险'}`,
        `待回复邮件：\n${(Store.state.mailInbox || []).slice(0, 5).map(item => `${item.subject} / ${item.from}`).join('\n') || '暂无邮件'}`,
        '建议：优先处理低库存与临期订单，并生成生产计划和跟进邮件。'
      ].join('\n');
    }
    ws.result = result.trim();
    Store.save();
    this.rerender();
  },

  searchRun() {
    const ws = this.getWorkspace('searchcenter');
    const q = String(ws.prompt || '').trim().toLowerCase();
    if (!q) throw new Error('请输入搜索关键词');
    const results = [];
    (Store.state.orders || []).forEach(item => {
      if (`${item.order_no} ${item.customer} ${item.product}`.toLowerCase().includes(q)) results.push(`订单：${item.order_no} / ${item.customer} / ${item.product}`);
    });
    (Store.state.inventory || []).forEach(item => {
      if (`${item.product_code} ${item.product_name}`.toLowerCase().includes(q)) results.push(`库存：${item.product_name} / 库存 ${item.stock_quantity}`);
    });
    (Store.state.mailInbox || []).forEach(item => {
      if (`${item.subject} ${item.preview}`.toLowerCase().includes(q)) results.push(`邮件：${item.subject}`);
    });
    (Store.state.knowledge || []).forEach(item => {
      if (`${item.title} ${item.content}`.toLowerCase().includes(q)) results.push(`知识：${item.title}`);
    });
    (Store.state.chats || []).forEach(item => {
      if (`${item.title} ${item.messages.map(m => m.content).join(' ')}`.toLowerCase().includes(q)) results.push(`对话：${item.title}`);
    });
    (Store.state.operationLogs || []).forEach(item => {
      if (`${item.title} ${item.type}`.toLowerCase().includes(q)) results.push(`日志：${item.title}`);
    });
    ws.result = results.join('\n') || '未找到相关结果';
    Store.save();
    this.rerender();
  },

  rlQuickRate(label) {
    const select = document.getElementById('rlRating');
    if (select) select.value = label === '有用' ? '★★★★★' : '不可用';
    const reason = document.getElementById('rlReason');
    if (reason && !reason.value.trim()) reason.value = label === '有用' ? '结果可直接使用' : '结果需要重新生成或修正';
  },

  async rlRun(btn, forceRetry = false) {
    const ws = this.getWorkspace('rlcenter');
    const task = document.getElementById('rlTask')?.value.trim() || ws.task || '';
    if (!task) throw new Error('请输入任务');
    ws.task = task;
    const history = (Store.state.rlFeedback || []).filter(item => String(item.task || '').includes(task.slice(0, 6))).slice(0, 5);
    const preference = history.length ? history.map(item => `${item.rating || item.success}\n${item.reason || ''}\n${item.modifiedContent || item.modified_content || ''}`).join('\n---\n') : '暂无历史反馈';
    await this.busy(btn, async () => {
      const demoMode = Store.state.settings.accessMode === 'local' || !Store.state.settings.apiEnabled || !Store.state.settings.apiUrl;
      const plannerSeed = [
        `任务输入：${task}`,
        `历史反馈：${preference}`,
        forceRetry ? '复用策略：避免上次错误，优先给出更稳妥的步骤。' : ''
      ].filter(Boolean).join('\n');
      const fallbackSteps = [
        '识别任务目标与关键业务字段',
        '检查相关订单、库存、邮件或文档',
        '生成可执行步骤与责任人',
        '汇总结果并提醒人工确认',
        '记录反馈用于下次优化'
      ];
      let plannedText = '';
      if (demoMode) {
        plannedText = fallbackSteps.join('\n');
      } else {
        const planRes = await AIService.complete(
          `Planner 生成真实步骤。请基于以下信息输出 3-6 个可执行步骤，每行一个步骤，不要输出多余说明。\n${plannerSeed}`,
          { mode: 'rl-plan', module: 'agentic-rl' }
        );
        plannedText = planRes.text;
      }
      ws.prompt = task;
      ws.steps = plannedText.split('\n').map(line => line.replace(/^\d+[\.\、\s]*/, '').trim()).filter(Boolean).slice(0, 6);
      ws.stepResults = [];
      for (const step of ws.steps) {
        let reply = '';
        if (demoMode) {
          reply = `已完成：${step}。基于当前演示数据，结果已整理并可供人工确认。`;
        } else {
          const stepRes = await AIService.complete(`Executor 逐步执行。\n原始任务：${task}\n当前步骤：${step}\n请只返回本步骤的执行结果，不要输出 Prompt。`, {
            mode: 'rl-step',
            module: 'agentic-rl'
          });
          reply = stepRes.text;
        }
        ws.stepResults.push({ step, reply });
        Store.save();
        this.rerender();
      }
      if (demoMode) {
        ws.result = [
          '当前为演示模式，已使用内置演示数据生成结果。',
          '如需真实AI，请配置 Vercel + DEEPSEEK_API_KEY。',
          '',
          'Aggregator 汇总最终结果：',
          `任务：${task}`,
          `步骤数：${ws.steps.length}`,
          '建议：先人工确认计划，再执行关键业务变更。'
        ].join('\n');
      } else {
        const finalRes = await AIService.complete(
          `Aggregator 汇总最终结果。\n原始任务：${task}\n步骤结果：\n${ws.stepResults.map(item => `${item.step}\n${item.reply}`).join('\n\n')}`,
          { mode: 'rl-final', module: 'agentic-rl' }
        );
        ws.result = finalRes.text;
      }
      ws.updatedAt = Date.now();
      Store.addActivity(`Agentic RL 任务：${task.slice(0, 20)}`, 'ai');
      Store.save();
      this.rerender();
    });
  },

  async rlSave() {
    const rating = document.getElementById('rlRating')?.value;
    const reason = document.getElementById('rlReason')?.value.trim();
    const modifiedContent = document.getElementById('rlModifiedContent')?.value.trim();
    if (!rating) throw new Error('请选择评分');
    const ws = this.getWorkspace('rlcenter');
    const record = {
      id: uid(),
      task: ws.task || '',
      module: 'agentic-rl',
      prompt: ws.prompt || '',
      reply: ws.result || '',
      rating,
      reason,
      modifiedContent,
      modified_content: modifiedContent,
      success: !/★☆☆☆☆|不可用|无用/.test(rating),
      createdAt: Date.now(),
      time: Date.now()
    };
    ws.records = ws.records || [];
    ws.records.unshift(record);
    Store.state.rlFeedback = Store.state.rlFeedback || [];
    Store.state.rlFeedback.unshift(record);
    Store.state.rlFeedback = Store.state.rlFeedback.slice(0, 100);
    if (AuthClient.isLoggedIn()) {
      try {
        await APIClient.request('/api/feedback', {
          method: 'POST',
          body: JSON.stringify({ category: 'agent', rating, reason, modifiedContent })
        });
      } catch (error) {
        console.warn('Feedback sync failed:', error.message);
      }
    }
    Store.save();
    this.toast('RL 反馈已保存');
    this.rerender();
  },

  async rlRefresh() {
    if (!AuthClient.isLoggedIn() || AuthClient.isDemo()) {
      const ws = this.getWorkspace('rlcenter');
      ws.records = Store.state.rlFeedback || [];
      Store.save();
      this.rerender();
      return;
    }
    try {
      const res = await APIClient.request('/api/feedback');
      const ws = this.getWorkspace('rlcenter');
      const items = (res.data.items || []).map(item => ({
        id: item.id,
        task: item.category,
        module: 'agentic-rl',
        rating: item.rating,
        reason: item.reason,
        modifiedContent: item.modified_content,
        modified_content: item.modified_content,
        createdAt: new Date(item.created_at).getTime(),
        time: new Date(item.created_at).getTime()
      }));
      ws.records = items;
      Store.state.rlFeedback = items;
      Store.save();
      this.rerender();
    } catch (error) {
      console.warn(error.message);
    }
  },

  async refreshDashboard() {
    if (!AuthClient.isLoggedIn()) return;
    const connectors = Store.state.connectors || [];
    const connectorSummary = {
      unconfigured: connectors.filter(item => item.status === '未配置' || !item.enabled).length,
      connected: connectors.filter(item => item.status === '已连接').length,
      failed: connectors.filter(item => item.status === '连接失败').length
    };
    if (AuthClient.isDemo()) {
      const delayedOrders = (Store.state.orders || []).filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成');
      const inventoryAlerts = (Store.state.inventory || []).filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0)).length;
      Store.state.dashboard = {
        todayOrders: (Store.state.orders || []).length,
        inventoryAlerts,
        delayedOrders: delayedOrders.length,
        todayPlan: Math.min((Store.state.orders || []).length, 8),
        productionPlanOrders: App.getWorkspace('productionplan')?.parsedOrders?.length || 0,
        productionPlanRisk: App.getWorkspace('productionplan')?.riskCount || 0,
        connectorUnconfigured: connectorSummary.unconfigured,
        connectorConnected: connectorSummary.connected,
        connectorFailed: connectorSummary.failed,
        aiSuggestions: [
          inventoryAlerts ? `发现 ${inventoryAlerts} 条低库存，请优先补料。` : '暂无低库存风险。',
          delayedOrders.length ? `发现 ${delayedOrders.length} 条延期订单，请优先排产。` : '当前未发现延期订单。'
        ],
        agentExecutions: (Store.state.agentRuns || []).length,
        aiLearningTimes: (Store.state.rlFeedback || []).length,
        systemStatus: 'GitHub Pages Demo'
      };
      Store.save();
      return;
    }
    try {
      const res = await APIClient.request('/api/dashboard');
      Store.state.dashboard = {
        ...(res.data.dashboard || Store.state.dashboard),
        connectorUnconfigured: connectorSummary.unconfigured,
        connectorConnected: connectorSummary.connected,
        connectorFailed: connectorSummary.failed
      };
      Store.save();
    } catch (error) {
      console.warn('Dashboard refresh failed:', error.message);
    }
  },

  settingsBackup() {
    Utils.textDownload(JSON.stringify(Store.backup(), null, 2), `Personal-AI-OS-备份-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    this.toast('数据备份已导出');
  },

  async restoreBackup(file) {
    const data = JSON.parse(await file.text());
    Store.restore(data);
    this.renderNav();
    this.applyTheme();
    this.toast('数据已恢复');
    this.rerender();
  },

  async settingsClear() {
    if (!confirm('确定清空全部本地数据？此操作无法撤销。')) return;
    await FileDB.clear();
    localStorage.removeItem('personal-ai-os-word-draft');
    localStorage.removeItem('personal-ai-os-writing-draft');
    Store.reset();
    this.temp.word = { title: '', content: '', sourceFile: null };
    this.temp.writing = { type: '日报', prompt: '', output: '' };
    this.createChat();
    this.renderNav();
    this.updateApiState();
    this.toast('本地数据已清空');
    this.navigate('home');
  },

  toggleTheme() {
    Store.state.settings.dark = !Store.state.settings.dark;
    Store.save();
    this.applyTheme();
    if (this.route === 'settings') this.rerender();
  },

  applyTheme() {
    document.body.classList.toggle('dark', !!Store.state.settings.dark);
    document.querySelectorAll('[data-action="toggle-theme"] [data-icon]').forEach(el => {
      el.dataset.icon = Store.state.settings.dark ? 'sun' : 'moon';
      delete el.dataset.drawn;
    });
    this.renderStaticIcons();
  },

  updateApiState() {
    const el = document.getElementById('apiState');
    if (!el) return;
    const displayMode = Utils.isDisplayMode();
    const mode = Store.state.settings.accessMode || 'local';
    el.textContent = displayMode ? '展示模式' : mode === 'local' ? '本地模式' : mode === 'api' ? 'API模式' : '云端模式';
    el.classList.toggle('live', !displayMode && mode !== 'local');
    el.classList.toggle('display', displayMode);
  },

  async updateStorage() {
    const bytes = Store.state.files.reduce((sum, file) => sum + (file.size || 0), 0) + new Blob([JSON.stringify(Store.state)]).size;
    document.getElementById('storageText').textContent = Utils.formatBytes(bytes);
    document.getElementById('storageBar').style.width = `${Math.min(100, Math.max(3, bytes / (100 * 1024 * 1024) * 100))}%`;
  },

  async copy(text) {
    if (!text) throw new Error('暂无可复制内容');
    await Utils.copy(text);
    this.toast('已复制到剪贴板');
  },

  copyResult(id) {
    const el = document.getElementById(id);
    this.copy(el?.value || el?.innerText || '');
  },

  toast(message, type = 'success') {
    const text = type === 'error' ? Utils.friendlyErrorMessage(message) : String(message);
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${icon(type === 'error' ? 'x' : 'check')}<span>${Utils.escape(text)}</span>`;
    document.getElementById('toastStack').appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(6px)';
    }, 2700);
    setTimeout(() => t.remove(), 3000);
  },

  async busy(button, work) {
    if (!button) return work();
    const old = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loading-line" style="width:54px"><i></i></span>';
    try {
      return await work();
    } finally {
      button.disabled = false;
      button.innerHTML = old;
    }
  },

  openModal(html) {
    const layer = document.getElementById('modalLayer');
    document.getElementById('modalContent').innerHTML = html;
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    this.renderStaticIcons(layer);
  },

  closeModal() {
    const layer = document.getElementById('modalLayer');
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
  },

  openQuickNew() {
    const items = [['chat', '新建聊天'], ['word', '新建文档'], ['excel', '处理表格'], ['ocr', '识别图片'], ['knowledge', '添加知识'], ['agent', '运行Agent']];
    this.openModal(`<div class="modal-head"><h3>快速新建</h3><button class="icon-btn" data-action="modal-close">${icon('x')}</button></div><div class="modal-body quick-new-grid">${items.map(([id, name]) => `<button class="quick-new-item" data-route="${id}"><span>${icon(moduleById(id).icon)}</span><b>${name}</b></button>`).join('')}</div>`);
  },

  openCommand() {
    const files = Store.state.files.slice(0, 6);
    this.openModal(`<div class="command-input">${icon('search')}<input id="commandInput" placeholder="搜索功能或文件"><kbd>ESC</kbd></div><div class="command-list" id="commandList">${this.commandItems('', files)}</div>`);
    setTimeout(() => document.getElementById('commandInput')?.focus(), 30);
  },

  commandItems(q = '', files = Store.state.files) {
    const modules = MODULES.filter(m => m.group !== 'system' && (!q || m.name.toLowerCase().includes(q.toLowerCase())));
    const matched = files.filter(f => !q || f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    return `${modules.map(m => `<button class="command-item" data-route="${m.id}"><span>${icon(m.icon)}</span><div><b>${m.name}</b><small>打开工作区</small></div></button>`).join('')}${matched.map(f => `<button class="command-item" data-action="file-open" data-id="${f.id}"><span>${icon('folder')}</span><div><b>${Utils.escape(f.name)}</b><small>${f.category} · ${Utils.formatBytes(f.size)}</small></div></button>`).join('')}`;
  }
};

window.App = App;
window.Store = Store;

document.addEventListener('input', event => {
  if (event.target.id === 'commandInput') document.getElementById('commandList').innerHTML = App.commandItems(event.target.value);
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-action="modal-close"]')) App.closeModal();
  if (event.target.closest('.modal [data-route]')) App.closeModal();
});

function formatSQL(sql) {
  return sql
    .replace(/\s+(FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|SET|VALUES|FETCH FIRST)\s+/gi, '\n$1 ')
    .replace(/\b(select|from|where|and|or|join|left|right|inner|group by|order by|having|limit|update|delete|insert into|values|set|as|on|fetch first)\b/gi, match => match.toUpperCase())
    .replace(/,\s*/g, ',\n       ');
}

function imageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

async function processImage(url, processor, quality = 0.8, type = 'image/jpeg') {
  const img = new Image();
  img.src = url;
  await img.decode();
  const max = 2000;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  processor(ctx, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

App.init();
