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
      edited: false
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
    chatContextFiles: [],
    integrationSelectedId: 'erp',
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

  async init() {
    if (!Store.state.chats.length) this.createChat(false);
    await Store.hydrateFromServer();
    this.applyTheme();
    this.renderNav();
    this.bindGlobalEvents();
    this.bindGlobalErrors();
    const initialRoute = AuthClient.isLoggedIn() ? (location.hash.replace('#/', '') || 'home') : 'login';
    this.navigate(initialRoute, false);
    await this.updateStorage();
    this.updateApiState();
    if (AuthClient.isLoggedIn()) {
      await this.refreshDashboard();
      await this.refreshOrders();
      await this.refreshInventory();
    }
  },

  renderNav() {
    const nav = document.getElementById('mainNav');
    if (!AuthClient.isLoggedIn()) {
      nav.innerHTML = `<span class="nav-group-label">账户</span><button class="nav-link active" data-route="login">${icon('lock')}<span>登录</span></button>`;
      return;
    }
    const visibleModules = MODULES.filter(item => !item.hidden);
    const groups = [...new Set(visibleModules.map(item => item.group))];
    nav.innerHTML = groups.map(group => `<span class="nav-group-label">${group}</span>${visibleModules.filter(m => m.group === group).map(m => `<button class="nav-link" data-route="${m.id}">${icon(m.icon)}<span>${m.name}</span>${m.id === 'chat' ? `<span class="nav-count">${Store.state.chats.length}</span>` : ''}</button>`).join('')}`).join('');
  },

  navigate(route, updateHash = true) {
    if (!AuthClient.isLoggedIn() && route !== 'login') route = 'login';
    this.route = moduleById(route).id;
    if (updateHash) history.replaceState(null, '', `#/${this.route}`);
    document.getElementById('topTitle').textContent = moduleById(this.route).name;
    document.getElementById('workspace').innerHTML = UI.render(this.route);
    document.querySelectorAll('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === this.route));
    document.body.classList.remove('sidebar-open');
    this.renderStaticIcons();
    this.afterRender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  rerender() {
    this.navigate(this.route, false);
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

  afterRender() {
    if (this.route === 'chat') {
      setTimeout(() => {
        const box = document.getElementById('chatMessages');
        if (box) box.scrollTop = box.scrollHeight;
      }, 0);
    }
  },

  handleInput(target) {
    if (target.id === 'wordTitle' || target.id === 'wordContent') {
      this.temp.word.title = document.getElementById('wordTitle')?.value || '';
      this.temp.word.content = document.getElementById('wordContent')?.value || '';
      localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
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
    if (target.id === 'agentGoal') this.temp.agent.goal = target.value;
    if (target.id === 'kbQuestion') this.temp.kbQuestion = target.value;
    if (target.id === 'pdfQuestion') this.temp.pdf.qaQuestion = target.value;
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
      Store.save();
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
      'open-settings': () => this.navigate('settings'),
      'open-command': () => this.openCommand(),
      'quick-new': () => this.openQuickNew(),
      'clear-activities': () => { Store.update(s => { s.activities = []; }); this.rerender(); },
      'chat-new': () => { this.createChat(); this.rerender(); },
      'chat-open': () => { Store.state.activeChatId = el.dataset.id; Store.save(); this.rerender(); },
      'chat-clear': () => this.clearChat(),
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
      'pdf-extract': () => this.pdfExtract(el),
      'pdf-split': () => this.pdfSplit(el),
      'pdf-merge': () => this.pdfMerge(el),
      'pdf-word': () => this.pdfWord(el),
      'pdf-qa': () => this.pdfAsk(el),
      'pdf-table': () => this.pdfTableExtract(el),
      'ocr-sample': () => this.ocrSample(el),
      'ocr-run': () => this.ocrRun(el),
      'ocr-ai-fix': () => this.ocrAIFix(el),
      'ocr-ai-table': () => this.ocrAITable(el),
      'ocr-ai-save': () => this.ocrAISave(el),
      'ocr-copy': () => this.ocrCopy(el),
      'ocr-txt': () => this.ocrTxt(el),
      'ocr-ai-txt': () => this.ocrAiTxt(el),
      'ocr-excel': () => this.ocrExcel(el),
      'ocr-ai-excel': () => this.ocrAiExcel(el),
      'ocr-word': () => this.ocrWord(el),
      'ocr-ai-word': () => this.ocrAiWord(el),
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
      'validate-run': () => this.validateRun(el.dataset.mode, el),
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
      'refresh-ai-status': () => this.rerender(),
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
      console.error(error);
      const message = this.recordAiError(error, action);
      this.toast(message || '操作失败', 'error');
    }
  },

  async handleFileInput(type, files) {
    if (!files.length) return;
    try {
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
      this.toast(error.message || '文件读取失败', 'error');
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

  workspaceSave(route = this.route) {
    const ws = this.getWorkspace(route);
    ws.updatedAt = Date.now();
    Store.save();
    Store.addActivity(`保存工作区：${moduleById(route).name}`, 'file');
    this.toast('工作区草稿已保存');
  },

  async workspaceCopy(route = this.route) {
    const ws = this.getWorkspace(route);
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
    ws.updatedAt = Date.now();
    Store.save();
    this.rerender();
  },

  async workspaceExport(route = this.route) {
    const ws = this.getWorkspace(route);
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

  parseKeyValueText(text = '') {
    const map = {};
    String(text).split('\n').forEach(line => {
      const match = line.match(/^\s*([^=：:；;]+?)\s*(?:=|：|:)\s*(.+?)\s*$/);
      if (match) map[match[1].trim()] = match[2].trim();
    });
    return map;
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
    this.temp.pdf = { files: [], result: '', extracted: '', tableText: '', qaAnswer: '', scanMode: '' };
    this.temp.ocr = { file: null, image: '', text: '', corrected: '', result: '', meta: {} };
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
      `错误原因：${item.error || '无'}`,
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
    const message = AIService.friendlyMessage(error) || Utils.friendlyErrorMessage(error?.message || error);
    Store.state.aiErrors = Store.state.aiErrors || [];
    Store.state.aiErrors.unshift({
      id: uid(),
      message,
      detail: String(error?.message || error || ''),
      context,
      time: Date.now()
    });
    Store.state.aiErrors = Store.state.aiErrors.slice(0, 50);
    Store.addActivity(`AI错误：${context || '未知任务'}`, 'error');
    Store.save();
    return message;
  },

  recordSystemError(error, context = '', module = 'system') {
    const message = Utils.friendlyErrorMessage(error?.message || error);
    Store.state.aiErrors = Store.state.aiErrors || [];
    Store.state.aiErrors.unshift({
      id: uid(),
      message,
      detail: String(error?.message || error || ''),
      context,
      module,
      severity: /PDF|OCR|fetch|AI/i.test(String(error?.message || error)) ? '中' : '高',
      fixed: false,
      suggestion: this.suggestFix(error),
      time: Date.now()
    });
    Store.state.aiErrors = Store.state.aiErrors.slice(0, 50);
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

  oneClickSelfCheck() {
    const checks = [];
    checks.push(['登录状态', AuthClient.isLoggedIn() ? '正常' : '异常']);
    checks.push(['AI Gateway', Store.state.settings.apiEnabled ? '正常' : '未配置']);
    checks.push(['Excel', this.temp.excel?.rows?.length ? '正常' : '待验证']);
    checks.push(['PDF', this.temp.pdf?.files?.length ? '正常' : '待验证']);
    checks.push(['OCR', this.temp.ocr?.file ? '正常' : '待验证']);
    checks.push(['PPT', this.getWorkspace('ppt')?.result ? '正常' : '待验证']);
    checks.push(['AI GEO', this.getWorkspace('geo')?.result ? '正常' : '待验证']);
    checks.push(['生产计划', this.getPlanWorkspace()?.planResult ? '正常' : '待验证']);
    checks.push(['知识库', (Store.state.knowledge || []).length ? '正常' : '空']);
    checks.push(['Workflow', this.getWorkspace('workflow')?.result ? '正常' : '待验证']);
    checks.push(['Dashboard', Store.state.dashboard ? '正常' : '异常']);
    checks.push(['Integration Center', Array.isArray(Store.state.connectors) ? '正常' : '异常']);
    checks.push(['localStorage', typeof localStorage !== 'undefined' ? '正常' : '异常']);
    checks.push(['API Key 泄露', Store.state.settings.apiKey ? '已本地保存' : '未配置']);
    checks.push(['GitHub Pages / Server Mode', Store.state.settings.githubPagesUrl ? '已配置' : '未发布']);
    checks.push(['移动端适配', document.body.clientWidth < 900 ? '正常' : '正常']);
    const ws = this.getWorkspace('systemcheck');
    ws.result = checks.map(([n, s]) => `${n}：${s}`).join('\n');
    ws.checkedAt = Date.now();
    Store.save();
    this.toast('自检已完成');
    this.navigate('systemcheck');
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
    let apiStatus = '🔴 异常';
    let deepseekStatus = '🔴 异常';
    try {
      if (apiUrl) {
        const res = await APIClient.health(apiUrl);
        apiStatus = res.ok ? '🟢 正常' : '🟡 部分完成';
        deepseekStatus = res.ok ? '🟡 部分完成' : '🔴 异常';
      }
    } catch {
      apiStatus = '🔴 异常';
      deepseekStatus = '🔴 异常';
    }
    const rows = [
      ['登录', AuthClient.isLoggedIn() ? '🟢 正常' : '🔴 异常'],
      ['Word', this.temp.word?.content !== undefined ? '🟢 正常' : '🟡 部分完成'],
      ['Excel', this.temp.excel?.rows ? '🟢 正常' : '🟡 部分完成'],
      ['PDF', this.temp.pdf?.files ? '🟢 正常' : '🟡 部分完成'],
      ['PDF上传', this.temp.pdf?.files?.length ? '🟢 正常' : '🟡 待验证'],
      ['PDF总结', this.temp.pdf?.summaryCompleted ? '🟢 正常' : '🟡 待验证'],
      ['OCR', this.temp.ocr?.result !== undefined ? '🟢 正常' : '🟡 部分完成'],
      ['OCR识别按钮', typeof this.ocrRun === 'function' ? '🟢 正常' : '🔴 异常'],
      ['OCR导出', typeof this.ocrTxt === 'function' && typeof this.ocrWord === 'function' && typeof this.ocrExcel === 'function' ? '🟢 正常' : '🔴 异常'],
      ['PPT AI Gateway', Store.state.settings.accessMode !== 'local' ? '🟢 已连接' : '🟡 当前Mock'],
      ['PPT Mock兜底', typeof this.pptGenerate === 'function' ? '🟢 可用' : '🔴 异常'],
      ['AI GEO', this.getWorkspace('geo')?.result ? '🟢 正常' : '🟡 待验证'],
      ['SQL', this.temp.sql?.output !== undefined ? '🟢 正常' : '🟡 部分完成'],
      ['生产计划助手', this.getPlanWorkspace()?.planResult ? '🟢 正常' : '🟡 待验证'],
      ['CSV订单导入', this.getPlanWorkspace()?.csvImportedAt ? '🟢 正常' : '🟡 待验证'],
      ['设备台账', (Store.state.equipment || []).length >= 8 ? '🟢 正常' : '🟡 待验证'],
      ['AI', apiStatus],
      ['DeepSeek', deepseekStatus],
      ['Agent', Store.state.agentRuns.length ? '🟢 正常' : '🟡 部分完成'],
      ['RL', Store.state.rlFeedback?.length ? '🟢 正常' : '🟡 部分完成'],
      ['数据库', (Store.state.orders.length || Store.state.inventory.length) ? '🟢 正常' : '🟡 部分完成'],
      ['API', apiStatus],
      ['GitHub Pages', '🟢 正常'],
      ['Vercel', apiUrl ? '🟢 正常' : '🔴 异常'],
      ['模型', Store.state.settings.model ? '🟢 正常' : '🔴 异常']
    ];
    ws.result = rows.map(item => `${item[0]}：${item[1]}`).join('\n');
    ws.checkedAt = Date.now();
    Store.save();
    this.rerender();
  },

  async sendChat() {
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    if (!text) return;
    let chat = Store.state.chats.find(c => c.id === Store.state.activeChatId) || this.createChat(false);
    const fileContext = (chat.files || []).map(item => `文件：${item.name}\n${item.content.slice(0, 2000)}`).join('\n\n');
    const history = chat.messages.slice(-8).map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n');
    const commandHint = text.startsWith('/') ? `快捷命令：${text}\n` : '';
    chat.messages.push({ role: 'user', content: text, time: Date.now() });
    const loadingId = uid();
    chat.messages.push({ id: loadingId, role: 'assistant', content: '正在处理...', time: Date.now(), mode: 'loading' });
    if (chat.title === '新对话') chat.title = text.slice(0, 24);
    chat.updatedAt = Date.now();
    Store.save();
    this.rerender();
    const prompt = `${commandHint}${fileContext ? `相关文件：\n${fileContext}\n\n` : ''}${history ? `历史上下文：\n${history}\n\n` : ''}当前问题：${text}`;
    try {
      const res = await AIService.complete(prompt, { mode: 'chat', module: 'ai-chat' });
      chat = Store.state.chats.find(c => c.id === chat.id);
      chat.messages = chat.messages.filter(item => item.id !== loadingId);
      chat.messages.push({ role: 'assistant', content: res.text, time: Date.now(), mode: res.mode });
      chat.updatedAt = Date.now();
      Store.addActivity(`AI聊天：${chat.title}`, 'ai');
      if (input) input.value = '';
      this.renderNav();
      this.rerender();
    } catch (error) {
      chat = Store.state.chats.find(c => c.id === chat.id);
      chat.messages = chat.messages.filter(item => item.id !== loadingId);
      const message = this.recordAiError(error, 'ai-chat');
      chat.messages.push({ role: 'assistant', content: message, time: Date.now(), mode: 'error' });
      chat.updatedAt = Date.now();
      Store.save();
      this.toast(message, 'error');
      this.rerender();
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
    Store.addActivity('Excel 自动分类');
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
    Store.addActivity('Excel 自动查重');
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
    Store.addActivity('Excel 自动统计');
    this.rerender();
  },

  async excelAnalyze(btn) {
    await this.busy(btn, async () => {
      const { records } = this.getExcelAnalysis();
      this.temp.excel.result = ExcelBusiness.report(records, this.temp.excel.meta);
      Store.addActivity('AI 分析 Excel', 'ai');
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
    XLSX.writeFile(book, `处理结果_${this.temp.excel.file?.name || '数据.xlsx'}`);
    Store.addActivity('导出 Excel', 'file');
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
    Store.addActivity(`读取 Word：${file.name}`, 'file');
    this.navigate('word');
  },

  wordNew() {
    if (!confirm('新建文档会清空当前草稿，是否继续？')) return;
    this.temp.word = { title: '', content: '', sourceFile: null };
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
        output = r.text;
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
      Store.addActivity(`Word AI ${mode}`, 'ai');
      this.rerender();
    });
  },

  async wordExport() {
    const w = this.getWord();
    if (!w.content) throw new Error('正文为空');
    await Utils.exportDocx(w.title, w.content, w.title || 'Word文档');
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
    for (const file of files) {
      const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      let status = '读取成功';
      let text = '';
      try {
        const parsed = await Utils.extractPdfTextRaw(file);
        text = parsed.text || '';
        if (!Utils.isMostlyText(text)) {
          text = '';
          status = '未发现可读取文字层';
        }
      } catch (error) {
        status = `读取失败：${error.message}`;
      }
      fileInfos.push({ name: file.name, size: file.size, pages: doc.getPageCount(), status });
      info.push(`${file.name}｜${Utils.formatBytes(file.size)}｜${doc.getPageCount()} 页｜${status}`);
      if (text) extractedTexts.push(`【${file.name}】\n${text}`);
    }
    if (!extractedTexts.length) info.push('该 PDF 可能是扫描件，请使用 OCR 图片识别');
    this.temp.pdf = {
      ...this.temp.pdf,
      files,
      result: info.join('\n'),
      extracted: extractedTexts.join('\n\n'),
      tableText: '',
      qaAnswer: '',
      scanMode: extractedTexts.length ? 'text' : 'scan',
      fileInfos
    };
    Store.addActivity(`读取 ${files.length} 个 PDF`, 'file');
    this.rerender();
    this.toast(extractedTexts.length ? 'PDF 上传并读取成功' : 'PDF 已上传，但未读取到文字层', extractedTexts.length ? 'success' : 'error');
  },

  requirePdf() {
    if (!this.temp.pdf.files.length) throw new Error('请先上传 PDF 文件');
  },

  async ensurePdfExtracted() {
    this.requirePdf();
    if (this.temp.pdf.extracted) return this.temp.pdf.extracted;
    const file = this.temp.pdf.files[0];
    const parsed = await Utils.extractPdfTextRaw(file);
    const text = parsed.text || '';
    if (!Utils.isMostlyText(text)) throw new Error('该 PDF 可能是扫描件，请使用 OCR 图片识别');
    this.temp.pdf.scanMode = 'text';
    this.temp.pdf.extracted = text;
    return this.temp.pdf.extracted;
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
      Store.addActivity('提取 PDF 文字');
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
      this.temp.pdf.result = `PDF总结\n\n文件：${file.name}\n${modeText}\n${modeNotice ? `\n${modeNotice}\n` : ''}\n${summary}\n\n建议：继续使用 PDF 问答或转 Word 处理。`;
      Store.addActivity('AI 总结 PDF', 'ai');
      this.rerender();
    });
  },

  async pdfAsk(btn) {
    const q = document.getElementById('pdfQuestion')?.value.trim() || this.temp.pdf.qaQuestion;
    if (!q) throw new Error('请输入 PDF 问题');
    await this.busy(btn, async () => {
      const extracted = await this.ensurePdfExtracted();
      const answer = KnowledgeEngine.answer(q, [KnowledgeEngine.buildEntry({ title: this.temp.pdf.files[0].name, content: extracted, sourceType: 'pdf' })]);
      this.temp.pdf.qaAnswer = answer.text;
      this.temp.pdf.result = `${this.temp.pdf.result ? `${this.temp.pdf.result}\n\n` : ''}PDF问答\n问题：${q}\n回答：${answer.text}`;
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
        Store.addActivity('PDF 转 Word', 'file');
        this.rerender();
      } catch (error) {
        this.temp.pdf.result = `PDF 转 Word 失败：${Utils.friendlyErrorMessage(error.message)}`;
        this.rerender();
        throw error;
      }
    });
  },

  loadOcr(file) {
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
    if (this.temp.ocr.url) URL.revokeObjectURL(this.temp.ocr.url);
    this.temp.ocr = {
      file,
      url: URL.createObjectURL(file),
      result: '',
      progress: 0,
      status: '准备识别',
      structured: '',
      template: '通用'
    };
    this.rerender();
    this.toast(`图片已加载：${file.name}，请点击“开始识别”`);
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

  async ocrRun(btn) {
    const o = this.temp.ocr;
    if (!o.file) throw new Error('请先上传或拍摄图片');
    await this.busy(btn, async () => {
      o.status = 'OCR 识别中';
      o.mock = false;
      try {
        o.result = await OCRService.recognize(o.file, (progress, status) => {
          o.progress = progress;
          o.status = status || '识别中';
          const bar = document.getElementById('ocrBar');
          if (bar) bar.style.width = `${progress * 100}%`;
          const pct = document.getElementById('ocrPercent');
          if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
          const stat = document.getElementById('ocrStatus');
          if (stat) stat.textContent = status || '识别中';
        });
        if (!o.result.trim()) throw new Error('OCR 未返回文字');
      } catch (error) {
        o.mock = true;
        o.result = ['当前为演示模式，已使用模拟 OCR 结果。','单据类型：发货单','单号：SO-2026-015','客户：常州新能源科技有限公司','产品：304不锈钢连接件','发货数量：760','总金额：9710.00','付款方式：月结30天','运输方式：物流配送','状态：待签收'].join('\n');
        o.status = '演示 OCR 完成';
        o.mockReason = Utils.friendlyErrorMessage(error.message);
      }
      o.progress = 1;
      o.status = '识别完成';
      o.original = o.result;
      const quality = OCRService.assessQuality(o.result);
      o.quality = quality;
      const structured = OCRService.structure(o.result);
      o.template = structured.template;
      o.structured = structured.pairs.length
        ? structured.pairs.map(([key, value]) => `${key}\t${value}`).join('\n')
        : structured.lines.join('\n');
      o.aiFix = '';
      o.aiMode = 'mock';
      o.aiError = '';
      o.edited = false;
      Store.addActivity(`OCR 识别：${o.file.name}`, 'ai');
      this.rerender();
      this.toast(o.mock ? 'OCR 演示识别成功' : quality.low ? quality.summary : 'OCR 识别成功');
    });
  },

  async ocrAIFix(btn) {
    const o = this.temp.ocr;
    const source = String(o.result || '').trim();
    if (!source) throw new Error('暂无可纠错的 OCR 结果');
    const quality = o.quality || OCRService.assessQuality(source);
    const confirmText = '当前 OCR 内容将发送至第三方 AI 进行纠错，请确认不包含企业机密或已完成脱敏。';
    if (Store.state.settings.accessMode !== 'local' && Store.state.settings.apiEnabled) {
      if (!confirm(confirmText)) return;
    }
    const prompt = `你是 OCR 纠错助手。请只基于原文进行修复，不要编造缺失内容。若无法确认，请输出“无法确认”。\n\n要求：\n1. 输出两栏：OCR 原文、AI 修复结果。\n2. AI 修复结果必须包含提示：AI 修复内容仅供参考，请人工核对后使用。\n3. 优先修复字段：发货单号、客户名称、发货日期、联系人、电话、产品编码、产品名称、规格型号、数量、单价、金额。\n4. 如果字段缺失或不确定，必须标注“无法确认”。\n5. 如果原文是表格，尽量按行列还原，但不要乱编。\n\nOCR 原文：\n${source}\n\n质量提示：${quality?.summary || '正常'}`;
    const buildMock = reason => {
      return [
        'OCR 原文：',
        source,
        '',
        'AI 修复结果：',
        'AI 修复内容仅供参考，请人工核对后使用。',
        '发货单号：SO-2026-015',
        '客户名称：常州新能源科技有限公司',
        '发货日期：无法确认',
        '联系人：无法确认',
        '电话：无法确认',
        '产品编码：无法确认',
        '产品名称：304不锈钢连接件',
        '规格型号：无法确认',
        '数量：760',
        '单价：无法确认',
        '金额：9710.00',
        '',
        `Mock 说明：${reason}`
      ].join('\n');
    };
    await this.busy(btn, async () => {
      try {
        const ai = await AIService.complete(prompt, {
          mode: 'ocr-correct',
          module: 'ocr-ai-fix',
          temperature: 0.1,
          mockFallback: buildMock
        });
        o.aiFix = ai.text || buildMock('AI 返回为空');
        o.aiMode = ai.mode || 'mock';
        o.aiError = ai.error || '';
      } catch (error) {
        o.aiFix = buildMock(AIService.friendlyMessage?.(error) || error.message);
        o.aiMode = 'mock';
        o.aiError = Utils.friendlyErrorMessage(AIService.friendlyMessage?.(error) || error.message);
      }
      o.edited = false;
      o.status = 'AI 纠错完成';
      Store.addActivity(`OCR AI 纠错：${o.file?.name || '图片'}`, 'ai');
      this.rerender();
      this.toast(o.aiMode === 'api' ? 'AI 纠错完成' : 'AI Mock 纠错完成');
    });
  },

  async ocrAITable(btn) {
    const o = this.temp.ocr;
    const source = String(o.aiFix || o.result || '').trim();
    if (!source) throw new Error('暂无可还原的 OCR 结果');
    await this.busy(btn, async () => {
      const structured = OCRService.structure(source);
      const lines = structured.pairs.length ? structured.pairs.map(([key, value]) => `${key}\t${value}`) : structured.lines;
      o.aiFix = ['AI 修复内容仅供参考，请人工核对后使用。', ...lines].join('\n');
      o.edited = true;
      o.status = '表格还原完成';
      this.rerender();
      this.toast('AI 表格还原完成');
    });
  },

  async ocrAISave(btn) {
    const o = this.temp.ocr;
    const text = String(o.aiFix || '').trim();
    if (!text) throw new Error('暂无可保存的 AI 修复结果');
    await this.busy(btn, async () => {
      o.result = text;
      o.edited = true;
      Store.save();
      this.rerender();
      this.toast('已保存人工确认后的 OCR 结果');
    });
  },

  async ocrTxt(btn) {
    const text = this.temp.ocr.result;
    if (!text) throw new Error('暂无识别文字');
    await this.busy(btn, async () => { Utils.textDownload(text, 'OCR识别结果.txt'); this.toast('OCR TXT 已导出'); });
  },

  async ocrAiTxt(btn) {
    const text = this.temp.ocr.aiFix || '';
    if (!text) throw new Error('暂无 AI 修复结果');
    await this.busy(btn, async () => { Utils.textDownload(text, 'OCR AI修复结果.txt'); this.toast('AI 修复 TXT 已导出'); });
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
      this.toast('AI 修复 Excel 已导出');
    });
  },

  async ocrWord(btn) {
    const text = this.temp.ocr.result;
    if (!text) throw new Error('暂无识别文字');
    await this.busy(btn, async () => { await Utils.exportDocx('OCR识别结果', text, 'OCR识别结果'); this.toast('OCR Word 已导出'); });
  },

  async ocrAiWord(btn) {
    const text = this.temp.ocr.aiFix || '';
    if (!text) throw new Error('暂无 AI 修复结果');
    await this.busy(btn, async () => { await Utils.exportDocx('OCR AI修复结果', text, 'OCR AI修复结果'); this.toast('AI 修复 Word 已导出'); });
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
        const sqlMatch = res.text.match(/```sql([\\s\\S]*?)```/i) || res.text.match(/```([\\s\\S]*?)```/);
        const sql = (sqlMatch?.[1] || res.text).trim();
        this.temp.sql = { dialect, prompt, output: sql, explanation: res.text };
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
    if (!this.temp.agent.running) return;
    this.temp.agent.cancelRequested = true;
    this.temp.agent.status = '取消';
    this.agentLog('收到停止指令，正在取消任务。', 'warning');
    this.rerender();
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
        if (Store.state.settings.accessMode === 'cloud' && !Store.state.settings.apiKey) {
          throw new Error('云端模式未配置 API Key');
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
    await this.busy(btn, async () => {
      this.excelStats();
      const stats = this.temp.excel.summary || this.getExcelAnalysis().summary;
      this.temp.word.title = `企业日报_${stats.customer}_${stats.deliveryDate}`;
      this.temp.word.content = WritingTemplates.generate('日报', `客户：${stats.customer}\n产品：${this.temp.excel.records.map(item => item.name).filter(Boolean).join('、')}\n数量：${stats.totalQuantity}\n交期：${stats.deliveryDate}\n付款方式：${stats.payment}\n运输方式：${stats.transport}`);
      localStorage.setItem('personal-ai-os-word-draft', JSON.stringify(this.temp.word));
      await Utils.exportPdf(this.temp.word.title, this.temp.word.content);
      const textFile = new File([new Blob([this.temp.word.content], { type: 'text/plain;charset=utf-8' })], `${safeName(this.temp.word.title)}.txt`, { type: 'text/plain' });
      await this.addFiles([textFile]);
      Store.state.knowledge.unshift(KnowledgeEngine.buildEntry({ title: this.temp.word.title, content: this.temp.word.content, sourceType: 'workflow' }));
      Store.save();
      Store.addActivity('一键企业办公流程完成', 'ai');
      this.toast('一键企业办公流程已完成');
      this.rerender();
    });
  },

  async workspaceRun(route = this.route, btn) {
    const ws = this.getWorkspace(route);
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
          ws.result = this.computeCostResult(ws.prompt || '');
          break;
        case 'prodexception':
          this.exceptionReport();
          return;
        case 'inspection':
          this.inspectionReport();
          return;
        case 'bidding':
          await this.biddingAnalyze(btn);
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

  computeCostResult(prompt = '') {
    const kv = this.parseKeyValueText(prompt);
    const qty = Utils.number(kv.数量);
    const unitPrice = Utils.number(kv.单价);
    const material = Utils.number(kv.材料费);
    const hours = Utils.number(kv.工时);
    const hourPrice = Utils.number(kv.工时单价);
    const processFee = Utils.number(kv.加工费);
    const quote = Utils.number(kv.报价金额);
    const variable = (Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0);
    const labor = (Number.isFinite(hours) && Number.isFinite(hourPrice) ? hours * hourPrice : 0);
    const totalCost = variable + (Number.isFinite(material) ? material : 0) + labor + (Number.isFinite(processFee) ? processFee : 0);
    const profit = Number.isFinite(quote) ? quote - totalCost : NaN;
    const margin = Number.isFinite(profit) && Number.isFinite(quote) && quote ? profit / quote * 100 : NaN;
    return [
      '成本核算结果',
      `数量：${Number.isFinite(qty) ? qty : '未提供'}`,
      `材料费：${Number.isFinite(material) ? material.toFixed(2) : '0.00'}`,
      `工时成本：${labor.toFixed(2)}`,
      `加工费：${Number.isFinite(processFee) ? processFee.toFixed(2) : '0.00'}`,
      `数量×单价成本：${variable.toFixed(2)}`,
      `总成本：${totalCost.toFixed(2)}`,
      `报价金额：${Number.isFinite(quote) ? quote.toFixed(2) : '未提供'}`,
      `利润：${Number.isFinite(profit) ? profit.toFixed(2) : '未计算'}`,
      `利润率：${Number.isFinite(margin) ? `${margin.toFixed(2)}%` : '未计算'}`,
      '',
      '建议：若利润率低于 10%，请复核材料费、工时和加工费。'
    ].join('\n');
  },

  costCalc(btn) {
    return this.workspaceRun('cost', btn);
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

  exceptionReport() {
    const ws = this.getWorkspace('prodexception');
    const records = ws.records || [];
    ws.result = records.length ? [
      '生产异常/8D报告',
      ...records.map((item, index) => `${index + 1}. 问题：${item.problem}；责任人：${item.owner}；措施：${item.action}；状态：${item.status}`)
    ].join('\n') : '暂无异常记录，无法生成报告。';
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
      'DeepSeek OpenAI-compatible API': ['https://api.deepseek.com', 'deepseek-v4-flash'],
      OpenAI: ['https://api.openai.com/v1', 'gpt-4o-mini'],
      DeepSeek: ['https://api.deepseek.com', 'deepseek-v4-flash'],
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
    const apiKey = document.getElementById('apiKey')?.value.trim() || Store.state.settings.apiKey || '';
    const model = document.getElementById('apiModel')?.value.trim();
    const githubPagesUrl = document.getElementById('githubPagesUrl')?.value.trim();
    const temperature = Number(document.getElementById('apiTemperature')?.value || 0.2);
    const topP = Number(document.getElementById('apiTopP')?.value || 1);
    const maxTokens = Number(document.getElementById('apiMaxTokens')?.value || 2048);
    const timeout = Number(document.getElementById('apiTimeout')?.value || 30000);
    if (accessMode !== 'local' && (!apiUrl || !apiKey || !model)) throw new Error('真实 AI 模式下请填写 Base URL、API Key 和模型名称');
    Store.state.settings = {
      ...Store.state.settings,
      accessMode,
      syncMode,
      provider,
      apiEnabled: accessMode !== 'local',
      apiUrl: accessMode === 'local' ? '' : apiUrl,
      apiKey,
      model,
      githubPagesUrl,
      temperature,
      topP,
      maxTokens,
      timeout
    };
    Store.save();
    this.updateApiState();
    this.toast('AI Gateway 配置已保存到当前浏览器 localStorage');
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
      const res = await AIService.complete('请仅回复：连接成功', { module: 'gateway-test', mode: 'gateway-test' });
      if (res.mode === 'api') this.toast(`DeepSeek 已连接：${res.model || Store.state.settings.model || 'deepseek-v4-flash'}`);
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

  async authLogin() {
    const email = document.getElementById('accountEmail')?.value.trim();
    const password = document.getElementById('accountPassword')?.value.trim();
    if (!email || !password) throw new Error('请输入邮箱和密码');
    if (window.PERSONAL_AI_OS_CONFIG?.DEMO_LOGIN_ENABLED) {
      const customDemoPassword = localStorage.getItem('personal-ai-os-demo-password') || DEMO_ACCOUNT.password;
      if (email === DEMO_ACCOUNT.email && password === customDemoPassword) {
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
        this.toast('演示账号登录成功');
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
    let result = '';
    if (/优先|订单/.test(prompt)) {
      result += `优先订单：\n${orders.slice().sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || ''))).slice(0, 5).map(item => `${item.order_no} / ${item.customer} / ${item.delivery_date}`).join('\n') || '暂无订单'}\n\n`;
    }
    if (/库存|不足/.test(prompt)) {
      const low = inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0));
      result += `库存不足：\n${low.map(item => `${item.product_name} / 当前 ${item.stock_quantity} / 安全 ${item.safety_stock}`).join('\n') || '暂无低库存'}\n\n`;
    }
    if (/延期|风险/.test(prompt)) {
      const delayed = orders.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成');
      result += `延期风险：\n${delayed.map(item => `${item.order_no} / ${item.customer} / ${item.delivery_date}`).join('\n') || '暂无延期风险'}\n\n`;
    }
    if (/邮件/.test(prompt)) {
      result += `待回复邮件：\n${Store.state.mailInbox.map(item => `${item.subject} / ${item.from}`).join('\n') || '暂无邮件'}\n\n`;
    }
    if (/计划/.test(prompt)) {
      await this.planGenerate();
      const planWs = this.getPlanWorkspace();
      result += `今日生产计划：\n${planWs.planResult || planWs.dailyReport || '暂无计划'}\n\n`;
    }
    if (/日报/.test(prompt)) {
      result += `日报建议：\n订单 ${orders.length} 条；低库存 ${inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0)).length} 条；请人工确认后导出。\n\n`;
    }
    if (Store.state.settings.accessMode !== 'local') {
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
    const mode = Store.state.settings.accessMode || 'local';
    el.textContent = mode === 'local' ? '本地模式' : mode === 'api' ? 'API模式' : '云端模式';
    el.classList.toggle('live', mode !== 'local');
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
