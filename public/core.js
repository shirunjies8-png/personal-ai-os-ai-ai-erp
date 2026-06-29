const APP_KEY = 'personal-ai-os-v1';
const AUTH_KEY = 'personal-ai-os-auth';

const DefaultState = {
  version: 2,
  settings: {
    accessMode: 'local',
    apiEnabled: false,
    apiUrl: '',
    apiKey: '',
    model: 'gpt-4o-mini',
    provider: '本地模式',
    syncMode: 'local',
    dark: false,
    agentMail: {
      enabled: false,
      apiUrl: '',
      apiKey: '',
      mailbox: '',
      senderName: 'Personal AI OS',
      dailyQuota: 20,
      sentToday: 0,
      lastResetAt: new Date().toISOString().slice(0, 10)
    }
  },
  chats: [],
  activeChatId: null,
  documents: [],
  files: [],
  knowledge: [],
  agentRuns: [],
  activities: [],
  recentOpenIds: [],
  workspaces: {},
  fileVersions: [],
  users: [
    { id: 'admin', name: '管理员', role: '管理员', status: '启用' },
    { id: 'user-1', name: '普通用户', role: '普通用户', status: '启用' },
    { id: 'viewer', name: '只读用户', role: '只读用户', status: '启用' }
  ],
  roles: [
    { id: 'role-admin', name: '管理员', permissions: '全部模块、文件、操作日志' },
    { id: 'role-user', name: '普通用户', permissions: '办公模块、文件中心、知识库' },
    { id: 'role-viewer', name: '只读用户', permissions: '只读查看、下载' }
  ],
  operationLogs: [],
  mailDrafts: [],
  mailRecords: [],
  orders: [],
  inventory: [],
  dashboard: {
    todayOrders: 0,
    inventoryAlerts: 0,
    delayedOrders: 0,
    todayPlan: 0,
    aiSuggestions: [],
    agentExecutions: 0,
    aiLearningTimes: 0,
    systemStatus: '本地模式'
  },
  mailInbox: [
    {
      id: 'demo-mail-1',
      subject: '标书确认回执',
      from: 'tender@demo-company.com',
      preview: '已收到贵司投标文件，请等待后续评审通知。',
      time: Date.now() - 1000 * 60 * 60 * 2,
      status: '未读'
    },
    {
      id: 'demo-mail-2',
      subject: '报价确认邮件',
      from: 'buyer@nova-gmbh.com',
      preview: '报价已收到，请补充交货周期说明。',
      time: Date.now() - 1000 * 60 * 60 * 6,
      status: '未读'
    },
    {
      id: 'demo-mail-3',
      subject: '客户资料补充邮件',
      from: 'service@demo-client.com',
      preview: '请补充联系人手机号和签章页扫描件。',
      time: Date.now() - 1000 * 60 * 60 * 24,
      status: '已读'
    }
  ]
};

const AuthClient = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') || { token: '', user: null, enterprise: null };
    } catch {
      return { token: '', user: null, enterprise: null };
    }
  },
  save(payload) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
  },
  clear() {
    localStorage.removeItem(AUTH_KEY);
  },
  get token() {
    return this.load().token || '';
  },
  get session() {
    return this.load();
  },
  isLoggedIn() {
    return !!this.token;
  }
};

const APIClient = {
  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (AuthClient.token) headers.Authorization = `Bearer ${AuthClient.token}`;
    const response = await fetch(path, {
      ...options,
      headers
    });
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload.message || payload.detail || JSON.stringify(payload);
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }
    return response.json();
  }
};

const Store = {
  state: null,
  syncTimer: null,
  syncing: false,
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(APP_KEY) || 'null');
      this.state = saved ? {
        ...structuredClone(DefaultState),
        ...saved,
        settings: { ...DefaultState.settings, ...(saved.settings || {}) },
        recentOpenIds: Array.isArray(saved.recentOpenIds) ? saved.recentOpenIds : []
      } : structuredClone(DefaultState);
      if (!Array.isArray(this.state.files)) this.state.files = [];
      if (!Array.isArray(this.state.knowledge)) this.state.knowledge = [];
      if (!Array.isArray(this.state.agentRuns)) this.state.agentRuns = [];
      if (!Array.isArray(this.state.activities)) this.state.activities = [];
      if (!Array.isArray(this.state.chats)) this.state.chats = [];
      if (!this.state.workspaces || typeof this.state.workspaces !== 'object') this.state.workspaces = {};
      if (!Array.isArray(this.state.fileVersions)) this.state.fileVersions = [];
      if (!Array.isArray(this.state.users)) this.state.users = structuredClone(DefaultState.users);
      if (!Array.isArray(this.state.roles)) this.state.roles = structuredClone(DefaultState.roles);
      if (!Array.isArray(this.state.operationLogs)) this.state.operationLogs = [];
      if (!this.state.settings.accessMode) this.state.settings.accessMode = this.state.settings.apiEnabled ? 'api' : 'local';
      if (!this.state.settings.syncMode) this.state.settings.syncMode = 'local';
      if (!this.state.settings.provider) this.state.settings.provider = this.state.settings.accessMode === 'local' ? '本地模式' : '自定义';
      this.state.settings.agentMail = {
        ...structuredClone(DefaultState.settings.agentMail),
        ...(this.state.settings.agentMail || {})
      };
      if (!Array.isArray(this.state.mailDrafts)) this.state.mailDrafts = [];
      if (!Array.isArray(this.state.mailRecords)) this.state.mailRecords = [];
      if (!Array.isArray(this.state.orders)) this.state.orders = [];
      if (!Array.isArray(this.state.inventory)) this.state.inventory = [];
      if (!this.state.dashboard || typeof this.state.dashboard !== 'object') this.state.dashboard = structuredClone(DefaultState.dashboard);
      if (!Array.isArray(this.state.mailInbox) || !this.state.mailInbox.length) this.state.mailInbox = structuredClone(DefaultState.mailInbox);
    } catch {
      this.state = structuredClone(DefaultState);
    }
    return this.state;
  },
  save() {
    localStorage.setItem(APP_KEY, JSON.stringify(this.state));
    this.scheduleSync();
    document.dispatchEvent(new CustomEvent('app:saved'));
  },
  update(mutator) {
    mutator(this.state);
    this.save();
  },
  addActivity(title, type = 'action') {
    this.state.activities.unshift({ id: uid(), title, type, time: Date.now() });
    this.state.activities = this.state.activities.slice(0, 60);
    this.state.operationLogs.unshift({ id: uid(), title, type, time: Date.now() });
    this.state.operationLogs = this.state.operationLogs.slice(0, 200);
    this.save();
  },
  touchRecentFile(id) {
    this.state.recentOpenIds = [id, ...this.state.recentOpenIds.filter(item => item !== id)].slice(0, 20);
    this.save();
  },
  reset() {
    this.state = structuredClone(DefaultState);
    this.save();
  },
  backup() {
    const clone = structuredClone(this.state);
    clone.settings.apiKey = '';
    if (clone.settings.agentMail) clone.settings.agentMail.apiKey = '';
    clone.backupAt = new Date().toISOString();
    return clone;
  },
  restore(data) {
    if (!data || typeof data !== 'object' || !data.settings) throw new Error('备份文件格式不正确');
    const currentKey = this.state.settings.apiKey;
    const currentMailKey = this.state.settings.agentMail?.apiKey || '';
    this.state = {
      ...structuredClone(DefaultState),
      ...data,
      settings: {
        ...DefaultState.settings,
        ...data.settings,
        apiKey: currentKey,
        agentMail: {
          ...structuredClone(DefaultState.settings.agentMail),
          ...(data.settings.agentMail || {}),
          apiKey: currentMailKey
        }
      }
    };
    this.save();
  },
  scheduleSync() {
    if (!AuthClient.isLoggedIn()) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncToServer(), 400);
  },
  async hydrateFromServer() {
    if (!AuthClient.isLoggedIn()) return this.state;
    try {
      const [stateRes, dashboardRes, enterpriseRes, logRes] = await Promise.all([
        APIClient.request('/api/state'),
        APIClient.request('/api/dashboard'),
        APIClient.request('/api/enterprise'),
        APIClient.request('/api/logs?limit=100')
      ]);
      if (stateRes.data?.state) {
        this.state = {
          ...this.state,
          ...stateRes.data.state,
          settings: {
            ...this.state.settings,
            ...(stateRes.data.state.settings || {})
          }
        };
      }
      if (dashboardRes.data?.dashboard) this.state.dashboard = dashboardRes.data.dashboard;
      if (enterpriseRes.data?.users) this.state.users = enterpriseRes.data.users.map(item => ({
        id: item.id,
        name: item.name,
        role: item.role,
        status: item.status
      }));
      if (logRes.data?.items) {
        this.state.operationLogs = logRes.data.items.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          time: new Date(item.created_at).getTime()
        }));
      }
      localStorage.setItem(APP_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn('Server hydration failed:', error.message);
    }
    return this.state;
  },
  async syncToServer() {
    if (!AuthClient.isLoggedIn() || this.syncing) return;
    this.syncing = true;
    try {
      await APIClient.request('/api/state', {
        method: 'PUT',
        body: JSON.stringify({ state: this.state })
      });
    } catch (error) {
      console.warn('State sync failed:', error.message);
    } finally {
      this.syncing = false;
    }
  }
};

const FileDB = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('personal-ai-os-files', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('files')) {
          request.result.createObjectStore('files', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  },
  async run(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const store = tx.objectStore('files');
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  put(record) { return this.run('readwrite', store => store.put(record)); },
  get(id) { return this.run('readonly', store => store.get(id)); },
  delete(id) { return this.run('readwrite', store => store.delete(id)); },
  clear() { return this.run('readwrite', store => store.clear()); }
};

const Utils = {
  formatBytes(bytes = 0) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
  },
  formatDate(time, withTime = false) {
    const d = new Date(time);
    return d.toLocaleString('zh-CN', withTime ? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    } : {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  },
  escape(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  },
  textToHtml(text = '') {
    return this.escape(text).replace(/\n/g, '<br>');
  },
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  },
  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  textDownload(text, filename, type = 'text/plain;charset=utf-8') {
    this.download(new Blob([text], { type }), filename);
  },
  fileExt(file) {
    return (file?.name?.split('.').pop() || '').toLowerCase();
  },
  fileCategory(file) {
    const ext = this.fileExt(file);
    if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return '表格';
    if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return '文档';
    if (ext === 'pdf') return 'PDF';
    if (/^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return '图片';
    if (['sql', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return '代码';
    return '其他';
  },
  async readText(file) {
    return file.text();
  },
  number(value) {
    if (value == null || value === '') return NaN;
    const raw = String(value).replace(/[,，\s]/g, '').replace(/[^\d.\-]/g, '');
    if (!raw || /^-?\.$/.test(raw)) return NaN;
    return Number(raw);
  },
  isMostlyText(text = '') {
    return text.replace(/\s/g, '').length > 30;
  },
  sliceText(text = '', max = 120000) {
    return String(text).slice(0, max);
  },
  async extractPdfTextRaw(file) {
    const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.mjs';
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push({
        page: i,
        text: content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim()
      });
    }
    return { pdf, pages, text: pages.map(item => `# 第 ${item.page} 页\n${item.text}`).join('\n\n') };
  },
  async renderPdfPageToBlob(pdf, pageNo, scale = 2) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  },
  async extractPdfTextSmart(file) {
    try {
      const raw = await this.extractPdfTextRaw(file);
      const useful = raw.pages.filter(item => item.text.replace(/\s/g, '').length > 25);
      if (useful.length >= Math.max(1, Math.ceil(raw.pages.length * 0.4))) {
        return {
          mode: 'text',
          text: this.sliceText(raw.text),
          reason: '检测到可提取文字层'
        };
      }
      const texts = [];
      for (let i = 1; i <= raw.pdf.numPages; i += 1) {
        const blob = await this.renderPdfPageToBlob(raw.pdf, i, 2);
        const imageFile = new File([blob], `${safeName(file.name)}-page-${i}.png`, { type: 'image/png' });
        const text = await OCRService.recognize(imageFile);
        texts.push(`# 第 ${i} 页\n${text}`);
      }
      return {
        mode: 'ocr',
        text: this.sliceText(texts.join('\n\n')),
        reason: '检测为扫描版 PDF，已自动 OCR'
      };
    } catch (error) {
      throw new Error(`PDF 解析失败：${error.message}`);
    }
  },
  async extractFileText(file) {
    const category = this.fileCategory(file);
    const ext = this.fileExt(file);
    if (category === '表格') {
      const data = await file.arrayBuffer();
      const book = XLSX.read(data, { cellDates: true, raw: false });
      return book.SheetNames.map(name => `# ${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`).join('\n\n').slice(0, 80000);
    }
    if (category === 'PDF') {
      const parsed = await this.extractPdfTextSmart(file);
      return parsed.text;
    }
    if (ext === 'docx' && window.mammoth) {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return this.sliceText(result.value);
    }
    if (ext === 'doc') {
      throw new Error('暂不支持直接读取 .doc，请先转换为 .docx 后再导入');
    }
    if (category === '图片') {
      const raw = await OCRService.recognize(file);
      const corrected = OCRService.correct(raw);
      return corrected;
    }
    if (file.size < 3 * 1024 * 1024) return this.sliceText(await file.text(), 80000);
    return `[文件] ${file.name}\n大小：${this.formatBytes(file.size)}`;
  },
  async exportDocx(title, content, filename) {
    if (!window.JSZip) throw new Error('JSZip 未加载，无法生成标准 docx');
    const zip = new JSZip();
    const docTitle = this.escapeXml(title || '未命名文档');
    const bodyXml = String(content || '')
      .split(/\n{2,}/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean)
      .map(paragraph => {
        const lines = paragraph.split('\n').filter(Boolean);
        const inner = lines.map((line, index) => `<w:r><w:t xml:space="preserve">${this.escapeXml(line)}</w:t></w:r>${index < lines.length - 1 ? '<w:r><w:br/></w:r>' : ''}`).join('');
        return `<w:p>${inner}</w:p>`;
      }).join('');
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.folder('docProps').file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Personal AI OS</Application>
</Properties>`);
    const now = new Date().toISOString();
    zip.folder('docProps').file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${docTitle}</dc:title>
  <dc:creator>Personal AI OS</dc:creator>
  <cp:lastModifiedBy>Personal AI OS</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);
    zip.folder('word').folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
    zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${docTitle}</w:t></w:r></w:p>
    ${bodyXml || '<w:p><w:r><w:t></w:t></w:r></w:p>'}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    this.download(blob, `${safeName(filename || title || '未命名文档')}.docx`);
    return blob;
  },
  async exportPdf(title, content) {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.create();
    const lines = wrapText(`${title || '未命名文档'}\n\n${content || ''}`, 34);
    const perPage = 38;
    for (let start = 0; start < lines.length || start === 0; start += perPage) {
      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1b1e24';
      ctx.textBaseline = 'top';
      lines.slice(start, start + perPage).forEach((line, index) => {
        ctx.font = index === 0 && start === 0 ? 'bold 42px sans-serif' : '28px sans-serif';
        ctx.fillText(line, 90, 90 + index * 40);
      });
      const image = await doc.embedPng(canvas.toDataURL('image/png'));
      const page = doc.addPage([595.28, 841.89]);
      page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    this.download(new Blob([await doc.save()], { type: 'application/pdf' }), `${safeName(title || '未命名文档')}.pdf`);
  },
  escapeXml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
};

const ExcelBusiness = {
  aliases: {
    index: ['序号', '行号', '项次', '项号'],
    code: ['产品编码', '编码', '物料编码', '货号', '产品代码', '料号'],
    name: ['产品名称', '品名', '名称', '物料名称', '货品名称'],
    spec: ['规格型号', '规格', '型号', '规格/型号', '型号规格'],
    unit: ['单位', 'unit'],
    quantity: ['发货数量', '数量', '出货数量', '交货数量', '送货数量'],
    price: ['单价', '含税单价', '未税单价'],
    amount: ['金额', '总金额', '含税金额', '货款金额'],
    customer: ['客户', '客户名称', '购货单位', '收货单位'],
    date: ['发货日期', '日期', '交期', '出货日期', '送货日期'],
    status: ['状态', '订单状态', '发货状态'],
    payment: ['付款方式', '结算方式'],
    transport: ['运输方式', '物流方式', '发运方式'],
    phone: ['电话', '联系电话', '手机', '手机号']
  },
  normalize(text = '') {
    return String(text).replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
  },
  matchField(text = '') {
    const normalized = this.normalize(text);
    for (const [field, names] of Object.entries(this.aliases)) {
      if (names.some(name => normalized.includes(this.normalize(name)))) return field;
    }
    return '';
  },
  detectHeaderRow(rows = []) {
    let best = { index: 0, score: -1 };
    rows.slice(0, 15).forEach((row, idx) => {
      const score = row.reduce((sum, cell) => sum + (this.matchField(cell) ? 1 : 0), 0);
      if (score > best.score) best = { index: idx, score };
    });
    return best.score >= 2 ? best.index : 0;
  },
  buildSchema(headerRow = []) {
    const map = {};
    headerRow.forEach((cell, index) => {
      const field = this.matchField(cell);
      if (field && map[field] == null) map[field] = index;
    });
    return map;
  },
  isDetailRow(row = [], schema = {}) {
    const values = Object.values(schema).filter(index => index != null).map(index => row[index]);
    const quantity = schema.quantity != null ? Utils.number(row[schema.quantity]) : NaN;
    const amount = schema.amount != null ? Utils.number(row[schema.amount]) : NaN;
    const code = schema.code != null ? String(row[schema.code] || '').trim() : '';
    const name = schema.name != null ? String(row[schema.name] || '').trim() : '';
    const spec = schema.spec != null ? String(row[schema.spec] || '').trim() : '';
    const hasBusinessFields = [code, name, spec].filter(Boolean).length >= 1;
    const hasNumeric = Number.isFinite(quantity) || Number.isFinite(amount);
    const text = values.join(' ');
    const looksMeta = /联系电话|电话|备注|说明|地址|日期|订单号|客户|传真|邮箱/.test(text) && !hasNumeric;
    return !looksMeta && (hasBusinessFields || hasNumeric);
  },
  extract(rows = []) {
    if (!rows.length) throw new Error('表格为空');
    const headerIndex = this.detectHeaderRow(rows);
    const header = rows[headerIndex] || [];
    const schema = this.buildSchema(header);
    const detailRows = [];
    for (let i = headerIndex + 1; i < rows.length; i += 1) {
      const row = rows[i] || [];
      if (!row.some(cell => String(cell || '').trim())) continue;
      if (this.isDetailRow(row, schema)) detailRows.push(row);
    }
    const meta = {};
    rows.slice(0, headerIndex + 1).concat(rows.slice(headerIndex + 1)).forEach(row => {
      row.forEach((cell, idx) => {
        const text = String(cell || '').trim();
        if (!text) return;
        if (!meta.customer && /客户/.test(text) && row[idx + 1]) meta.customer = String(row[idx + 1]).trim();
        if (!meta.date && /日期|交期/.test(text) && row[idx + 1]) meta.date = String(row[idx + 1]).trim();
        if (!meta.payment && /付款/.test(text) && row[idx + 1]) meta.payment = String(row[idx + 1]).trim();
        if (!meta.transport && /运输|物流|发运/.test(text) && row[idx + 1]) meta.transport = String(row[idx + 1]).trim();
        if (!meta.status && /状态/.test(text) && row[idx + 1]) meta.status = String(row[idx + 1]).trim();
        if (!meta.orderNo) {
          const hit = text.match(/(?:订单号|单号|SO[- ]?\d[\w-]*)[:：]?\s*([A-Za-z0-9-]+)/);
          if (hit) meta.orderNo = hit[1];
        }
      });
    });
    return { headerIndex, header, schema, detailRows, meta };
  },
  toObjects(extracted) {
    return extracted.detailRows.map(row => ({
      index: extracted.schema.index != null ? String(row[extracted.schema.index] || '').trim() : '',
      code: extracted.schema.code != null ? String(row[extracted.schema.code] || '').trim() : '',
      name: extracted.schema.name != null ? String(row[extracted.schema.name] || '').trim() : '',
      spec: extracted.schema.spec != null ? String(row[extracted.schema.spec] || '').trim() : '',
      unit: extracted.schema.unit != null ? String(row[extracted.schema.unit] || '').trim() : '',
      quantity: extracted.schema.quantity != null ? Utils.number(row[extracted.schema.quantity]) : NaN,
      price: extracted.schema.price != null ? Utils.number(row[extracted.schema.price]) : NaN,
      amount: extracted.schema.amount != null ? Utils.number(row[extracted.schema.amount]) : NaN,
      customer: extracted.schema.customer != null ? String(row[extracted.schema.customer] || '').trim() : extracted.meta.customer || '',
      date: extracted.schema.date != null ? String(row[extracted.schema.date] || '').trim() : extracted.meta.date || '',
      status: extracted.schema.status != null ? String(row[extracted.schema.status] || '').trim() : extracted.meta.status || '',
      payment: extracted.schema.payment != null ? String(row[extracted.schema.payment] || '').trim() : extracted.meta.payment || '',
      transport: extracted.schema.transport != null ? String(row[extracted.schema.transport] || '').trim() : extracted.meta.transport || ''
    }));
  },
  classifyRows(records = []) {
    return records.map(item => ({
      ...item,
      businessCategory: /轴承|齿轮|传动|支架|电机|阀|组件/.test(item.name + item.spec) ? '产品明细' : '其他明细'
    }));
  },
  dedupe(records = []) {
    const seen = new Set();
    const kept = [];
    const removed = [];
    records.forEach(item => {
      const key = [item.index, item.code, item.name, item.spec].map(part => String(part || '').trim()).join('|');
      if (seen.has(key)) removed.push(item);
      else {
        seen.add(key);
        kept.push(item);
      }
    });
    return { kept, removed };
  },
  stats(records = [], meta = {}) {
    const validQty = records.map(item => item.quantity).filter(Number.isFinite);
    const validAmount = records.map(item => item.amount).filter(Number.isFinite);
    const validPrice = records.map(item => item.price).filter(Number.isFinite);
    return {
      lineCount: records.length,
      totalQuantity: validQty.reduce((sum, value) => sum + value, 0),
      totalAmount: validAmount.reduce((sum, value) => sum + value, 0),
      avgPrice: validPrice.length ? validPrice.reduce((sum, value) => sum + value, 0) / validPrice.length : 0,
      productKinds: new Set(records.map(item => `${item.code}|${item.name}|${item.spec}`).filter(text => text.replace(/\|/g, '').trim())).size,
      customer: records.find(item => item.customer)?.customer || meta.customer || '未识别',
      deliveryDate: records.find(item => item.date)?.date || meta.date || '未识别',
      status: records.find(item => item.status)?.status || meta.status || '待确认',
      payment: records.find(item => item.payment)?.payment || meta.payment || '未识别',
      transport: records.find(item => item.transport)?.transport || meta.transport || '未识别'
    };
  },
  anomalies(records = [], stats = {}) {
    const issues = [];
    if (!records.length) issues.push('未识别到产品明细区');
    if (records.some(item => !item.code && !item.name)) issues.push('存在缺少产品编码或名称的行');
    if (records.some(item => Number.isFinite(item.quantity) && item.quantity <= 0)) issues.push('存在数量小于等于 0 的行');
    if (records.some(item => Number.isFinite(item.amount) && Number.isFinite(item.quantity) && item.amount < item.quantity)) issues.push('部分金额与数量不匹配，建议复核单价');
    if (stats.payment === '未识别') issues.push('未识别到付款方式');
    if (stats.transport === '未识别') issues.push('未识别到运输方式');
    return issues;
  },
  report(records = [], meta = {}) {
    const stats = this.stats(records, meta);
    const issues = this.anomalies(records, stats);
    return [
      `产品明细行数：${stats.lineCount}`,
      `总数量：${stats.totalQuantity}`,
      `总金额：${stats.totalAmount.toFixed(2)}`,
      `平均单价：${stats.avgPrice.toFixed(2)}`,
      `产品种类：${stats.productKinds}`,
      `客户：${stats.customer}`,
      `发货日期：${stats.deliveryDate}`,
      `状态：${stats.status}`,
      `付款方式：${stats.payment}`,
      `运输方式：${stats.transport}`,
      `异常：${issues.length ? issues.join('；') : '未发现明显异常'}`,
      `建议：${issues.length ? '优先核对异常字段后再导出日报或入库。' : '可直接生成日报、PDF 和知识条目。'}`
    ].join('\n');
  }
};

const OCRService = {
  worker: null,
  async getWorker(onProgress = () => {}) {
    if (!window.Tesseract) throw new Error('OCR 引擎未加载');
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('chi_sim', 1, {
        workerPath: './vendor/tesseract/worker.min.js',
        corePath: './vendor/tesseract-core',
        langPath: './assets/ocr',
        logger: message => {
          if (typeof message.progress === 'number') onProgress(message.progress, message.status);
        }
      });
    }
    return this.worker;
  },
  correct(text = '') {
    return String(text)
      .replace(/[|丨]/g, '1')
      .replace(/O(?=\d)/g, '0')
      .replace(/(\d)\s+(\d{2,})/g, '$1$2')
      .replace(/发货 数量/g, '发货数量')
      .replace(/产 品/g, '产品')
      .replace(/规 格/g, '规格')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
  detectTemplate(text = '') {
    const source = String(text);
    if (/发货|送货|交期|客户/.test(source)) return '发货单';
    if (/采购|供应商|采购单/.test(source)) return '采购单';
    if (/生产|日报|工序|产量/.test(source)) return '生产日报';
    if (/合同|甲方|乙方/.test(source)) return '合同';
    if (/标签|产品编码|规格/.test(source)) return '产品标签';
    return '通用';
  },
  structure(text = '') {
    const lines = String(text).split('\n').map(line => line.trim()).filter(Boolean);
    const template = this.detectTemplate(text);
    const pairs = [];
    lines.forEach(line => {
      const match = line.match(/^([^:：]{1,20})[:：]?\s+(.+)$/);
      if (match) pairs.push([match[1], match[2]]);
    });
    return { template, lines, pairs };
  },
  async recognize(file, onProgress = () => {}) {
    const worker = await this.getWorker(onProgress);
    const result = await worker.recognize(file);
    return this.correct(result.data.text || '');
  }
};

const KnowledgeEngine = {
  keywords(content = '') {
    const source = String(content);
    const hits = [];
    ['客户', '产品', '发货', '数量', '金额', '付款', '运输', '合同', '交期', '生产', '采购', '日报'].forEach(word => {
      if (source.includes(word)) hits.push(word);
    });
    return hits.slice(0, 8);
  },
  category(title = '', content = '') {
    const text = `${title}\n${content}`;
    if (/合同|甲方|乙方/.test(text)) return '合同';
    if (/发货|送货|交期|物流/.test(text)) return '发货';
    if (/采购|供应商/.test(text)) return '采购';
    if (/生产|工序|日报/.test(text)) return '生产';
    if (/报价|客户|开发信|邮件/.test(text)) return '业务';
    return '通用';
  },
  summary(content = '') {
    const lines = String(content).split(/\n+/).map(line => line.trim()).filter(Boolean);
    const head = lines.slice(0, 3).join('；');
    const stats = [];
    const qty = content.match(/(?:发货数量|数量)[:：]?\s*([\d.]+)/);
    const amount = content.match(/金额[:：]?\s*([\d.]+)/);
    const customer = content.match(/客户(?:名称)?[:：]?\s*([^\n]+)/);
    if (customer) stats.push(`客户 ${customer[1].trim()}`);
    if (qty) stats.push(`数量 ${qty[1]}`);
    if (amount) stats.push(`金额 ${amount[1]}`);
    return [head, stats.join('，')].filter(Boolean).join('。');
  },
  extractFacts(content = '') {
    const facts = [];
    const patterns = [
      ['发货数量', /(?:发货数量|数量)[:：]?\s*([\d.]+)/g],
      ['总金额', /(?:总金额|金额)[:：]?\s*([\d.]+)/g],
      ['客户', /客户(?:名称)?[:：]?\s*([^\n]+)/g],
      ['付款方式', /付款方式[:：]?\s*([^\n]+)/g],
      ['运输方式', /运输方式[:：]?\s*([^\n]+)/g],
      ['交期', /交期[:：]?\s*([^\n]+)/g]
    ];
    patterns.forEach(([key, regex]) => {
      for (const match of content.matchAll(regex)) {
        facts.push({ key, value: String(match[1]).trim() });
      }
    });
    return facts;
  },
  buildEntry({ title, content, sourceType, fileName }) {
    const summary = this.summary(content);
    const keywords = this.keywords(content);
    const category = this.category(title || fileName || '', content);
    const facts = this.extractFacts(content);
    return {
      id: uid(),
      title: title || fileName || '未命名知识',
      content,
      sourceType,
      category,
      tags: keywords,
      summary,
      facts,
      createdAt: Date.now()
    };
  },
  rank(question, items = []) {
    const tokens = String(question).toLowerCase().split(/[\s，。？、:：]+/).filter(Boolean);
    return items.map(item => {
      const base = `${item.title}\n${item.summary}\n${item.content}\n${(item.tags || []).join(' ')}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (base.includes(token) ? 3 : 0), 0) + (item.facts || []).reduce((sum, fact) => sum + (question.includes(fact.key) ? 5 : 0), 0);
      return { item, score };
    }).sort((a, b) => b.score - a.score);
  },
  answer(question, items = []) {
    const ranked = this.rank(question, items).filter(item => item.score > 0);
    if (!ranked.length) return { text: '知识库中没有找到可直接回答该问题的资料。', refs: [] };
    const top = ranked.slice(0, 4).map(item => item.item);
    const directFact = top.flatMap(item => item.facts || []).find(fact => question.includes(fact.key) || fact.key.includes(question.replace(/这份文件主要讲什么/g, '')));
    if (/主要讲什么|内容是什么|讲了什么/.test(question)) {
      const first = top[0];
      return {
        text: `《${first.title}》主要内容：${first.summary || first.content.slice(0, 180)}。分类：${first.category}。关键词：${(first.tags || []).join('、') || '未提取'}。`,
        refs: top.map(item => item.title)
      };
    }
    if (directFact) {
      const source = top.find(item => (item.facts || []).some(fact => fact.key === directFact.key && fact.value === directFact.value));
      return {
        text: `${directFact.key}是 ${directFact.value}。来源：${source?.title || '知识条目'}。`,
        refs: top.map(item => item.title)
      };
    }
    const snippets = top.map(item => `【${item.title}】${item.summary || item.content.slice(0, 160)}`);
    return {
      text: `综合 ${top.length} 份资料：${snippets.join('；')}`,
      refs: top.map(item => item.title)
    };
  }
};

const SQLBuilder = {
  dialectLimit(sql, dialect, limit) {
    if (!limit) return sql;
    if (dialect === 'SQL Server') return sql.replace(/^SELECT/i, `SELECT TOP ${limit}`);
    if (dialect === 'Oracle') return `${sql}\nFETCH FIRST ${limit} ROWS ONLY`;
    return `${sql}\nLIMIT ${limit}`;
  },
  build(dialect, prompt) {
    const text = String(prompt || '').trim();
    const table = (text.match(/(?:表|table)\s*[`"']?([a-zA-Z_][\w]*)/i) || [])[1] || 'deliveries';
    const wantsCustomerShipment = /每个客户.*(发货总数量|总数量).*(总金额)|每个客户发货总数量和总金额/.test(text);
    const limit = Number((text.match(/(?:前|top|最近)\s*(\d+)/i) || [])[1] || 0);
    let sql;
    if (wantsCustomerShipment) {
      sql = `SELECT customer_name,\n       SUM(delivery_quantity) AS total_delivery_quantity,\n       SUM(amount) AS total_amount\nFROM ${table}\nGROUP BY customer_name\nORDER BY total_amount DESC`;
    } else if (/按客户|每个客户/.test(text) && /金额|数量/.test(text)) {
      sql = `SELECT customer_name,\n       SUM(delivery_quantity) AS total_delivery_quantity,\n       SUM(amount) AS total_amount\nFROM ${table}\nGROUP BY customer_name\nORDER BY total_amount DESC`;
    } else if (/库存/.test(text)) {
      sql = `SELECT product_code,\n       product_name,\n       stock_quantity,\n       safety_stock\nFROM ${table}\nWHERE stock_quantity < safety_stock\nORDER BY stock_quantity ASC`;
    } else if (/交期|延期/.test(text)) {
      sql = `SELECT order_no,\n       customer_name,\n       product_name,\n       delivery_date,\n       status\nFROM ${table}\nWHERE delivery_date < CURRENT_DATE\n  AND status <> '已完成'\nORDER BY delivery_date ASC`;
    } else if (/删除/.test(text)) {
      sql = `DELETE FROM ${table}\nWHERE id = ?;`;
    } else if (/更新|修改/.test(text)) {
      sql = `UPDATE ${table}\nSET column_name = ?\nWHERE id = ?;`;
    } else if (/新增|插入/.test(text)) {
      sql = `INSERT INTO ${table} (column_1, column_2)\nVALUES (?, ?);`;
    } else {
      sql = `SELECT *\nFROM ${table}\nWHERE 1 = 1\nORDER BY created_at DESC`;
    }
    if (/^SELECT/i.test(sql) && limit) sql = this.dialectLimit(sql, dialect, limit);
    if (!/;\s*$/.test(sql)) sql += ';';
    const explanation = [
      'SQL 解释：按真实业务字段生成，优先使用 customer_name、delivery_quantity、amount 等字段。',
      '优化建议：为 customer_name、delivery_date、status 建立索引；聚合查询在大表上建议配合日期条件。',
      '执行计划提示：执行前查看 EXPLAIN / 执行计划，确认是否走索引和是否存在全表扫描。'
    ].join('\n');
    return { sql: `-- ${dialect}\n-- 根据需求生成：${text}\n${sql}`, explanation };
  }
};

const WritingTemplates = {
  parseFields(prompt = '') {
    const text = String(prompt);
    return {
      customer: (text.match(/客户[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      quantity: (text.match(/(?:数量|发货数量)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      product: (text.match(/(?:产品|货物)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      delivery: (text.match(/(?:交期|发货日期|交货日期)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      payment: (text.match(/付款方式[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      transport: (text.match(/运输方式[:：]?\s*([^\n，,；;]+)/) || [])[1] || ''
    };
  },
  generate(type, prompt) {
    const f = this.parseFields(prompt);
    const source = String(prompt).trim();
    const templates = {
      '日报': `制造业生产日报

日期：${f.delivery || new Date().toLocaleDateString('zh-CN')}
客户：${f.customer || '请补充'}
产品：${f.product || '请补充'}
数量：${f.quantity || '请补充'}

一、今日完成
1. 已完成 ${f.product || '相关产品'} 的生产/发货处理，数量 ${f.quantity || '待确认'}。
2. 已跟进客户 ${f.customer || '待确认'} 的交付要求与现场协同。

二、异常与风险
1. ${f.delivery ? `需确保在 ${f.delivery} 前完成交付。` : '需继续确认交期。'}
2. ${f.payment ? `付款方式为 ${f.payment}，请同步财务核对。` : '付款方式需进一步确认。'}

三、明日计划
1. 跟进 ${f.product || '产品'} 的后续进度与质量状态。
2. 核对运输与签收安排${f.transport ? `，运输方式：${f.transport}` : ''}。

原始要求：
${source}`,
      '合同': `产品购销合同

甲方：${f.customer || '甲方名称待补充'}
乙方：________________

一、产品信息
产品名称：${f.product || '待补充'}
数量：${f.quantity || '待补充'}
交期：${f.delivery || '待补充'}

二、付款方式
${f.payment || '付款方式待补充'}

三、质量要求
乙方应按双方确认的规格、图纸或样品组织交付，确保产品符合约定质量标准。

四、交付与运输
${f.transport ? `运输方式：${f.transport}。` : '运输方式待补充。'} 双方应明确交货地点、签收人与风险转移节点。

五、违约责任
任何一方未按约履行交付、付款或质量义务的，应承担相应违约责任并赔偿因此造成的损失。

六、签字盖章
甲方（签字盖章）：_______________
乙方（签字盖章）：_______________
签署日期：_______________

补充说明：
${source}`,
      '产品介绍': `产品说明 / 官网介绍

产品名称：${f.product || '待补充'}
适用客户：${f.customer || '工业客户'}

产品概述
${f.product || '该产品'}面向制造业与交付场景，强调稳定性、交期协同和批量处理能力。

核心参数
数量/供货能力：${f.quantity || '按订单执行'}
交付周期：${f.delivery || '按排产确认'}
运输方式：${f.transport || '按客户要求'}
付款方式：${f.payment || '支持协商'}

应用价值
1. 提升交付准确率。
2. 降低沟通与对账成本。
3. 便于生产、采购、仓储协同。

原始要求：
${source}`,
      '邮件': `商务邮件

主题：关于${f.product || '项目'}的沟通

尊敬的${f.customer || '客户'}：

您好！现就 ${f.product || '相关产品'} 向您同步如下信息：
1. 数量：${f.quantity || '待确认'}
2. 交期：${f.delivery || '待确认'}
3. 付款方式：${f.payment || '待确认'}
4. 运输方式：${f.transport || '待确认'}

如上述信息无误，请您确认，我们将据此推进后续安排。

此致
敬礼

补充说明：
${source}`,
      '招聘': `招聘需求

岗位名称：待补充
所属部门：待补充

岗位职责
1. 负责 ${source || '相关岗位工作'}。
2. 协同生产、计划、采购、仓储或业务团队完成日常任务。

任职要求
1. 具备相关岗位经验。
2. 能独立处理数据、文档或跨部门协同工作。

薪资福利
面议。`,
      '外贸开发信': `外贸开发信

Subject: ${f.product || 'Product'} supply proposal for ${f.customer || 'your team'}

Dear ${f.customer || 'Sir/Madam'},

We can support your demand for ${f.product || 'industrial products'}.
Quantity: ${f.quantity || 'to be confirmed'}
Lead time: ${f.delivery || 'to be confirmed'}
Payment terms: ${f.payment || 'negotiable'}
Shipping: ${f.transport || 'as requested'}

If you are interested, we can send quotation and technical details immediately.

Best regards,

Original notes:
${source}`
    };
    return templates[type] || `写作类型：${type}\n\n${source}`;
  }
};

const MailEngine = {
  importantTypes: new Set(['标书提交邮件', '报价邮件', '合同发送邮件']),
  templates: [
    '标书提交邮件',
    '报价邮件',
    '发货通知邮件',
    '合同发送邮件',
    '会议纪要邮件',
    '催款邮件',
    '客户跟进邮件',
    '外贸开发信',
    '售后服务邮件',
    '资料补充邮件'
  ],
  sensitiveWords: ['绝对最低价', '保证中标', '返现', '私下付款', '回扣'],
  variables(input = {}) {
    const now = new Date();
    return {
      '客户名称': input.customerName || input.customer || '',
      '项目名称': input.projectName || '',
      '投标单位': input.bidder || '',
      '报价金额': input.quoteAmount || '',
      '交货期': input.delivery || '',
      '联系人': input.contact || '',
      '联系电话': input.phone || '',
      '日期': input.date || now.toLocaleDateString('zh-CN')
    };
  },
  replaceVariables(text = '', vars = {}) {
    return String(text).replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? '');
  },
  parsePrompt(prompt = '') {
    const text = String(prompt);
    return {
      customer: (text.match(/(?:客户名称|客户|招标单位)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      projectName: (text.match(/(?:项目名称|项目)[:：]?\s*([^\n]+)/) || [])[1] || '',
      bidder: (text.match(/(?:投标单位|我司|公司名称)[:：]?\s*([^\n]+)/) || [])[1] || '',
      quoteAmount: (text.match(/(?:报价金额|报价)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      delivery: (text.match(/(?:交货期|交期|交货周期)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      contact: (text.match(/联系人[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      phone: (text.match(/(?:联系电话|电话|手机号)[:：]?\s*([^\n，,；;]+)/) || [])[1] || '',
      recipient: (text.match(/(?:收件人|邮箱|Email)[:：]?\s*([^\s\n]+)/i) || [])[1] || '',
      attachments: [...text.matchAll(/(?:附件|附加文件)[:：]?\s*([^\n]+)/g)].map(match => match[1].trim()).filter(Boolean)
    };
  },
  template(type, values = {}, extra = '') {
    const vars = this.variables(values);
    const map = {
      '标书提交邮件': `尊敬的 {{客户名称}} 招标负责人：\n\n您好！\n\n我司根据贵方招标文件要求，现提交《{{项目名称}}》投标文件，附件中包含投标文件、报价表及相关资料，请查收。\n\n如需补充材料，请随时与我司联系。\n\n此致\n敬礼！\n\n{{投标单位}}\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n日期：{{日期}}`,
      '报价邮件': `尊敬的 {{客户名称}}：\n\n您好！现提交 {{项目名称}} / {{报价金额}} 的报价资料，请查收附件中的报价单与说明。\n\n交货期：{{交货期}}\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n\n如需调整规格、数量或付款条款，请随时联系。\n\n{{投标单位}}\n{{日期}}`,
      '发货通知邮件': `尊敬的 {{客户名称}}：\n\n您好！贵司 {{项目名称}} 相关货物已安排发出，附件中包含发货单及相关资料。\n\n交货期/发货节点：{{交货期}}\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n\n请查收并安排签收。\n\n{{投标单位}}\n{{日期}}`,
      '合同发送邮件': `尊敬的 {{客户名称}}：\n\n您好！现提交 {{项目名称}} 合同文件，请查收附件并确认盖章回传。\n\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n\n如需补充条款，请及时反馈。\n\n{{投标单位}}\n{{日期}}`,
      '会议纪要邮件': `尊敬的 {{客户名称}}：\n\n您好！现发送 {{项目名称}} 会议纪要，请查收附件。\n\n如对纪要内容有补充，请在收到后回复。\n\n{{投标单位}}\n{{日期}}`,
      '催款邮件': `尊敬的 {{客户名称}}：\n\n您好！关于 {{项目名称}} / {{报价金额}} 的应收款项，烦请协助安排。\n\n如已付款，请忽略本邮件并告知回单信息。\n\n{{投标单位}}\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n{{日期}}`,
      '客户跟进邮件': `尊敬的 {{客户名称}}：\n\n您好！跟进 {{项目名称}} 当前进度，现同步资料并期待您的反馈。\n\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n\n{{投标单位}}\n{{日期}}`,
      '外贸开发信': `Dear {{客户名称}},\n\nWe are pleased to submit information regarding {{项目名称}}.\nQuotation amount: {{报价金额}}\nLead time: {{交货期}}\nContact: {{联系人}} / {{联系电话}}\n\nPlease feel free to contact us if you need further details.\n\n{{投标单位}}\n{{日期}}`,
      '售后服务邮件': `尊敬的 {{客户名称}}：\n\n您好！关于 {{项目名称}} 的售后服务事项，现将处理进展同步如下。\n\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n\n{{投标单位}}\n{{日期}}`,
      '资料补充邮件': `尊敬的 {{客户名称}}：\n\n您好！根据当前沟通情况，现补充 {{项目名称}} 相关资料，请查收附件。\n\n如仍需其他文件，请随时联系。\n\n{{投标单位}}\n联系人：{{联系人}}\n联系电话：{{联系电话}}\n{{日期}}`
    };
    const body = this.replaceVariables(map[type] || map['客户跟进邮件'], vars);
    return `${body}${extra ? `\n\n补充说明：\n${extra}` : ''}`.trim();
  },
  subject(type, values = {}) {
    const project = values.projectName || values.product || '项目资料';
    const customer = values.customer || values.customerName || '';
    const map = {
      '标书提交邮件': `${project}投标文件提交`,
      '报价邮件': `${project}报价资料发送`,
      '发货通知邮件': `${project}发货通知`,
      '合同发送邮件': `${project}合同文件发送`,
      '会议纪要邮件': `${project}会议纪要`,
      '催款邮件': `${project}付款提醒`,
      '客户跟进邮件': `${customer || project}项目跟进`,
      '外贸开发信': `${project} cooperation proposal`,
      '售后服务邮件': `${project}售后服务说明`,
      '资料补充邮件': `${project}资料补充`
    };
    return map[type] || `${project}邮件`;
  },
  check(mail) {
    const issues = [];
    const vars = this.parsePrompt(mail.prompt || '');
    if (!String(mail.recipient || '').trim()) issues.push('收件人为空');
    if (!String(mail.subject || '').trim()) issues.push('邮件主题为空');
    if (!Array.isArray(mail.attachments) || !mail.attachments.length) issues.push('附件未上传');
    if (this.importantTypes.has(mail.type) && (!mail.finalVersionChecked)) issues.push('重要邮件未确认附件为最终版');
    if (!vars.phone && !String(mail.body || '').includes('联系电话')) issues.push('可能遗漏联系电话');
    if (!(vars.bidder || String(mail.body || '').includes('有限公司') || String(mail.body || '').includes('公司'))) issues.push('可能遗漏公司名称');
    if (!vars.projectName && !String(mail.subject || '').trim()) issues.push('可能遗漏项目名称');
    const hit = this.sensitiveWords.filter(word => String(mail.body || '').includes(word) || String(mail.subject || '').includes(word));
    if (hit.length) issues.push(`包含敏感词：${hit.join('、')}`);
    return issues;
  },
  needsApproval(type = '') {
    return this.importantTypes.has(type);
  }
};

const ImageAssistant = {
  classify(file) {
    const name = String(file?.name || '').toLowerCase();
    if (/invoice|delivery|order|bill|单|合同|label|标签/.test(name)) return '单据';
    if (/product|产品|goods|item/.test(name)) return '产品图';
    if (/screenshot|截图|screen/.test(name)) return '截图';
    if (/id|passport|证件/.test(name)) return '证件';
    return '普通图片';
  },
  analyzeByType(type, ocrText = '', meta = {}) {
    if (type === '单据') {
      return `图片类型：单据\n已自动执行 OCR 纠错。\n识别摘要：${KnowledgeEngine.summary(ocrText)}\n建议：核对数量、金额、客户和交期后再归档。`;
    }
    if (type === '产品图') {
      return `图片类型：产品图\n产品描述：适合用于产品档案、报价资料或官网详情页。\n瑕疵检查：建议关注边缘缺口、表面划痕、色差与污点。\n用途建议：可生成产品介绍、质检记录和客户发送素材。\n尺寸：${meta.width || '-'} × ${meta.height || '-'}`;
    }
    if (type === '截图') {
      return `图片类型：截图\n建议优先提取界面文字、错误提示和操作路径，用于问题排查或流程记录。`;
    }
    if (type === '证件') {
      return `图片类型：证件\n建议仅做 OCR 与关键信息核对，不默认执行去背景或破坏原图处理。`;
    }
    return `图片类型：普通图片\n建议根据用途选择 OCR、压缩或下载。`;
  }
};

const AIService = {
  lastMode: 'mock',
  async complete(prompt, options = {}) {
    const settings = Store.state.settings;
    if (settings.apiEnabled && settings.apiUrl && settings.model && settings.accessMode !== 'local' && (settings.apiKey || settings.provider === '本地模型')) {
      try {
        const base = settings.apiUrl.replace(/\/$/, '');
        const messages = [
          { role: 'system', content: options.system || '你是 Personal AI OS 企业版中的严谨中文办公助手。回答必须可执行、保留关键业务字段、避免空泛表述。' },
          { role: 'user', content: prompt }
        ];
        const headers = { 'Content-Type': 'application/json' };
        if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
        const response = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: settings.model, messages, temperature: options.temperature ?? 0.2 })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 180)}`);
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('模型返回为空');
        this.lastMode = 'api';
        return { text, mode: 'api' };
      } catch (error) {
        this.lastMode = 'fallback';
        return { text: this.mock(prompt, options.mode), mode: 'fallback', error: error.message };
      }
    }
    this.lastMode = 'mock';
    await wait(220);
    return { text: this.mock(prompt, options.mode), mode: 'mock' };
  },
  mock(prompt, mode = 'chat') {
    const input = String(prompt || '').trim();
    if (mode === 'polish') return input.replace(/然后/g, '随后').replace(/非常/g, '较为').trim();
    if (mode === 'summary') return KnowledgeEngine.summary(input) || input.slice(0, 180);
    if (mode === 'rewrite') return `改写结果：\n${input}`;
    if (mode === 'proofread') return `纠错结果：\n${input.replace(/的的/g, '的').replace(/了了/g, '了')}`;
    if (mode === 'format') return input.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
    if (mode === 'continue') return `${input}\n\n后续建议：补充负责人、交期、风险与验收标准。`;
    if (mode === 'pdf') return `PDF 业务总结\n\n${KnowledgeEngine.summary(input)}\n\n建议：继续核对关键字段并归档。`;
    if (mode === 'kb') return KnowledgeEngine.summary(input);
    if (mode === 'vision') return `图像分析：${input}`;
    if (mode === 'writing') {
      const matchType = input.match(/类型[:：]\s*([^\n]+)/);
      const matchPrompt = input.match(/要求[:：]\s*([\s\S]+)/);
      return WritingTemplates.generate(matchType?.[1] || '文档', matchPrompt?.[1] || input);
    }
    return `已收到：${input}\n\n当前处于本地模拟模式。我会保留关键业务字段，并优先给出可执行结果。`;
  }
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function safeName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
function wrapText(text, max) {
  const lines = [];
  String(text).split('\n').forEach(raw => {
    if (!raw) lines.push('');
    else for (let i = 0; i < raw.length; i += max) lines.push(raw.slice(i, i + max));
  });
  return lines;
}
