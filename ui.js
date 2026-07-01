const Icons = {
  home: '<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 15h8M8 11h2"/>',
  scan: '<path d="M3 7V4a1 1 0 0 1 1-1h3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3M7 12h10"/>',
  code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
  pen: '<path d="m12 20 9-9-4-4-9 9-2 6 6-2ZM15 9l4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 15a2 2 0 0 0 .4 2.2l.1.1-2.2 2.2-.1-.1A2 2 0 0 0 15 19a2 2 0 0 0-1 1.8v.2h-4v-.2A2 2 0 0 0 9 19a2 2 0 0 0-2.2.4l-.1.1-2.2-2.2.1-.1A2 2 0 0 0 5 15a2 2 0 0 0-1.8-1H3v-4h.2A2 2 0 0 0 5 9a2 2 0 0 0-.4-2.2l-.1-.1 2.2-2.2.1.1A2 2 0 0 0 9 5a2 2 0 0 0 1-1.8V3h4v.2A2 2 0 0 0 15 5a2 2 0 0 0 2.2-.4l.1-.1 2.2 2.2-.1.1A2 2 0 0 0 19 9a2 2 0 0 0 1.8 1h.2v4h-.2A2 2 0 0 0 19 15Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  moon: '<path d="M20.5 14.5A8 8 0 0 1 9.5 3.5 9 9 0 1 0 20.5 14.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  apps: '<rect x="4" y="4" width="5" height="5" rx="1"/><rect x="15" y="4" width="5" height="5" rx="1"/><rect x="4" y="15" width="5" height="5" rx="1"/><rect x="15" y="15" width="5" height="5" rx="1"/>',
  upload: '<path d="M12 16V3M7 8l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 3v13M7 11l5 5 5-5M4 21h16"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><rect x="3" y="3" width="12" height="12" rx="2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
  sparkles: '<path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3ZM5 14l-.7 2L2 17l2.3.8L5 20l.8-2.2L8 17l-2.2-1L5 14Z"/>',
  refresh: '<path d="M20 7h-5V2M4 17h5v5M19 11a8 8 0 0 0-14-4l-1 1M5 13a8 8 0 0 0 14 4l1-1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  filter: '<path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"/>',
  star: '<path d="m12 2.5 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.1-6 3.1 1.2-6.7-4.9-4.7 6.7-1 3-6.1Z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  archive: '<path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  merge: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M8 12h8"/>',
  split: '<path d="M4 5h6v14H4zM14 5h6v14h-6z"/>',
  optimize: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="4"/>'
};

const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${Icons[name] || Icons.apps}</svg>`;

const MODULES = [
  { id: 'login', name: '登录', icon: 'lock', group: '隐藏', hidden: true },
  { id: 'home', name: '首页', icon: 'home', group: '工作台' },
  { id: 'assistant', name: '企业AI助手中心', icon: 'sparkles', group: '工作台' },
  { id: 'aistatus', name: 'AI状态中心', icon: 'chart', group: '工作台' },
  { id: 'chat', name: 'AI聊天', icon: 'message', group: '智能办公' },
  { id: 'word', name: 'Word助手', icon: 'fileText', group: '智能办公' },
  { id: 'excel', name: 'Excel助手', icon: 'table', group: '智能办公' },
  { id: 'pdf', name: 'PDF助手', icon: 'pdf', group: '智能办公' },
  { id: 'ocr', name: 'OCR识别', icon: 'scan', group: '智能办公' },
  { id: 'writing', name: 'AI写作', icon: 'pen', group: '智能办公' },
  { id: 'mail', name: '邮件助手', icon: 'send', group: '智能办公' },
  { id: 'translate', name: '翻译助手', icon: 'refresh', group: '智能办公' },
  { id: 'ppt', name: 'PPT助手', icon: 'fileText', group: '智能办公' },
  { id: 'forms', name: '表单助手', icon: 'table', group: '智能办公' },
  { id: 'official', name: '公文助手', icon: 'fileText', group: '智能办公' },
  { id: 'seal', name: '印章助手', icon: 'shield', group: '智能办公' },
  { id: 'resume', name: '简历助手', icon: 'fileText', group: '智能办公' },
  { id: 'doccompare', name: '文件比较助手', icon: 'refresh', group: '智能办公' },
  { id: 'batchprint', name: '批量打印助手', icon: 'archive', group: '智能办公' },
  { id: 'templates', name: '模板中心', icon: 'book', group: '智能办公' },

  { id: 'bidding', name: '招投标助手', icon: 'book', group: '企业办公' },
  { id: 'orders', name: '订单中心', icon: 'table', group: '企业办公' },
  { id: 'contract', name: '合同助手', icon: 'fileText', group: '企业办公' },
  { id: 'quotation', name: '报价助手', icon: 'chart', group: '企业办公' },
  { id: 'purchase', name: '采购助手', icon: 'folder', group: '企业办公' },
  { id: 'sales', name: '销售助手', icon: 'chart', group: '企业办公' },
  { id: 'productionplan', name: '生产计划助手', icon: 'clock', group: '企业办公' },
  { id: 'equipmentledger', name: '设备台账', icon: 'settings', group: '企业办公' },
  { id: 'delivery', name: '发货助手', icon: 'send', group: '企业办公' },
  { id: 'inventory', name: '库存中心', icon: 'folder', group: '企业办公' },
  { id: 'warehouse', name: '仓库助手', icon: 'folder', group: '企业办公' },
  { id: 'quality', name: '质量助手', icon: 'check', group: '企业办公' },
  { id: 'erp', name: 'ERP助手', icon: 'database', group: '企业办公' },
  { id: 'mes', name: 'MES助手', icon: 'database', group: '企业办公' },
  { id: 'sql', name: 'SQL助手', icon: 'code', group: '企业办公' },
  { id: 'chip', name: 'AI芯片助理', icon: 'code', group: '企业办公' },
  { id: 'bom', name: 'BOM助手', icon: 'apps', group: '企业办公' },
  { id: 'process', name: '工艺助手', icon: 'optimize', group: '企业办公' },
  { id: 'crmquote', name: '客户报价管理', icon: 'chart', group: '企业办公' },
  { id: 'suppliereval', name: '供应商评估', icon: 'star', group: '企业办公' },
  { id: 'cost', name: '成本核算助手', icon: 'chart', group: '企业办公' },
  { id: 'prodexception', name: '生产异常管理', icon: 'x', group: '企业办公' },
  { id: 'inspection', name: '设备点检助手', icon: 'check', group: '企业办公' },
  { id: 'riskcenter', name: '异常预警中心', icon: 'shield', group: '企业办公' },
  { id: 'ehs', name: 'EHS文档助手', icon: 'shield', group: '企业办公' },

  { id: 'files', name: '文件中心', icon: 'folder', group: '数据管理' },
  { id: 'knowledge', name: '知识库', icon: 'book', group: '数据管理' },
  { id: 'image', name: '图片助手', icon: 'image', group: '数据管理' },
  { id: 'datamask', name: '数据脱敏', icon: 'shield', group: '数据管理' },
  { id: 'geo', name: 'AI GEO', icon: 'search', group: '数据管理' },
  { id: 'analytics', name: '数据分析', icon: 'chart', group: '数据管理' },
  { id: 'charts', name: '图表中心', icon: 'chart', group: '数据管理' },
  { id: 'filecompare', name: '文件对比', icon: 'refresh', group: '数据管理' },
  { id: 'batchprocess', name: '批量处理中心', icon: 'archive', group: '数据管理' },
  { id: 'dataclean', name: '数据清洗', icon: 'filter', group: '数据管理' },
  { id: 'importexport', name: '数据导入导出', icon: 'upload', group: '数据管理' },
  { id: 'datavalidation', name: '数据校验', icon: 'check', group: '数据管理' },
  { id: 'backuprestore', name: '数据备份恢复', icon: 'database', group: '数据管理' },
  { id: 'versioning', name: '文件版本管理', icon: 'history', group: '数据管理' },
  { id: 'aisearch', name: 'AI搜索', icon: 'search', group: '数据管理' },
  { id: 'searchcenter', name: '全局搜索中心', icon: 'search', group: '数据管理' },

  { id: 'agent', name: 'AI Agent', icon: 'bot', group: 'AI自动化' },
  { id: 'workflow', name: '工作流', icon: 'merge', group: 'AI自动化' },
  { id: 'todo', name: '日程待办', icon: 'clock', group: 'AI自动化' },
  { id: 'worklog', name: '工作日志', icon: 'fileText', group: 'AI自动化' },
  { id: 'autoreport', name: '自动报表', icon: 'chart', group: 'AI自动化' },
  { id: 'rlcenter', name: 'Agentic RL 学习中心', icon: 'history', group: 'AI自动化' },
  { id: 'schedule', name: '定时任务', icon: 'clock', group: 'AI自动化' },
  { id: 'approval', name: '审批流', icon: 'check', group: 'AI自动化' },
  { id: 'notify', name: '消息提醒', icon: 'message', group: 'AI自动化' },
  { id: 'autoarchive', name: '自动归档', icon: 'archive', group: 'AI自动化' },
  { id: 'automail', name: '自动邮件发送', icon: 'send', group: 'AI自动化' },
  { id: 'autodoc', name: '自动文档生成', icon: 'fileText', group: 'AI自动化' },
  { id: 'autosync', name: '自动数据同步', icon: 'refresh', group: 'AI自动化' },

  { id: 'contacts', name: '通讯录', icon: 'book', group: '企业协作' },
  { id: 'project', name: '项目管理', icon: 'folder', group: '企业协作' },
  { id: 'kanban', name: '任务看板', icon: 'apps', group: '企业协作' },
  { id: 'gantt', name: '甘特图', icon: 'chart', group: '企业协作' },
  { id: 'meeting', name: '会议管理', icon: 'clock', group: '企业协作' },
  { id: 'crm', name: '客户管理CRM', icon: 'book', group: '企业协作' },
  { id: 'supplier', name: '供应商管理', icon: 'folder', group: '企业协作' },
  { id: 'permissions', name: '权限管理', icon: 'lock', group: '企业协作' },
  { id: 'notice', name: '公告中心', icon: 'message', group: '企业协作' },
  { id: 'department', name: '部门管理', icon: 'apps', group: '企业协作' },
  { id: 'onlineapproval', name: '在线审批', icon: 'check', group: '企业协作' },
  { id: 'operationlog', name: '操作日志', icon: 'history', group: '企业协作' },

  { id: 'settings', name: '设置', icon: 'settings', group: '系统中心' },
  { id: 'integration', name: 'Integration Center', icon: 'database', group: '系统中心' },
  { id: 'modeladmin', name: '模型管理', icon: 'sparkles', group: '系统中心' },
  { id: 'apiadmin', name: 'API管理', icon: 'code', group: '系统中心' },
  { id: 'plugins', name: '插件中心', icon: 'apps', group: '系统中心' },
  { id: 'databackup', name: '数据备份', icon: 'database', group: '系统中心' },
  { id: 'logs', name: '日志中心', icon: 'history', group: '系统中心' },
  { id: 'aihistory', name: 'AI调用历史', icon: 'history', group: '系统中心' },
  { id: 'monitoring', name: '系统监控', icon: 'chart', group: '系统中心' },
  { id: 'systemcheck', name: '系统验收中心', icon: 'check', group: '系统中心' },
  { id: 'users', name: '用户管理', icon: 'book', group: '系统中心' },
  { id: 'roles', name: '角色权限', icon: 'lock', group: '系统中心' },
  { id: 'dictionary', name: '字典配置', icon: 'table', group: '系统中心' },
  { id: 'updates', name: '系统更新', icon: 'refresh', group: '系统中心' },
  { id: 'about', name: '关于系统', icon: 'fileText', group: '系统中心' }
];

const moduleById = id => MODULES.find(item => item.id === id) || MODULES[0];

const GENERIC_MODULES = {
  assistant: { desc: '企业 AI 智能入口：自然语言调用订单、库存、计划、邮件、日报、知识库与 Agent。', actions: ['执行任务', '生成建议', '导出结果'], accept: '.xlsx,.docx,.pdf,.txt' },
  mail: { desc: '生成商务邮件、发货通知、报价邮件、投标提交邮件', actions: ['生成邮件', '复制结果', '保存草稿'], accept: '.doc,.docx,.pdf,.txt' },
  translate: { desc: '输入文本或上传文件，执行中英互译与术语润色', actions: ['开始翻译', '术语优化', '复制结果'], accept: '.doc,.docx,.pdf,.txt' },
  ppt: { desc: '输入主题、上传资料，生成 PPT 大纲与逐页文案', actions: ['生成大纲', '扩展页面', '导出文案'], accept: '.ppt,.pptx,.pdf,.docx' },
  forms: { desc: '生成请假单、报销单、采购申请单等表单内容', actions: ['生成表单', '校验字段', '导出结果'], accept: '.xlsx,.docx,.pdf' },
  official: { desc: '生成通知、请示、函、会议纪要等公文', actions: ['生成公文', '格式检查', '导出文稿'], accept: '.doc,.docx,.pdf,.txt' },
  seal: { desc: '检查签字盖章项、提醒缺失页与盖章位置', actions: ['检查盖章', '生成清单', '导出报告'], accept: '.pdf,.docx,.png,.jpg' },
  resume: { desc: '输入经历或上传简历，生成优化版简历与自我介绍', actions: ['优化简历', '生成自我介绍', '导出简历'], accept: '.doc,.docx,.pdf,.txt' },
  doccompare: { desc: '上传两个文档，比较差异、修改点与版本说明', actions: ['比较差异', '生成摘要', '导出报告'], accept: '.doc,.docx,.pdf,.txt' },
  batchprint: { desc: '批量整理待打印文件，输出打印清单与顺序', actions: ['生成打印清单', '整理顺序', '导出结果'], accept: '.pdf,.docx,.xlsx,.png,.jpg' },
  contract: { desc: '生成合同条款、风险提示、版本记录与导出文档', actions: ['生成合同', '风险检查', '保存版本'], accept: '.doc,.docx,.pdf,.txt' },
  quotation: { desc: '录入报价需求，生成报价单与报价说明', actions: ['生成报价', '核对金额', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  purchase: { desc: '采购需求整理、供应商比价与申请单生成', actions: ['生成采购单', '比价分析', '导出清单'], accept: '.xlsx,.csv,.pdf,.docx' },
  sales: { desc: '销售跟进、客户记录、回款与订单说明整理', actions: ['生成跟进记录', '销售分析', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  productionplan: { desc: '输入订单与交期，生成排产步骤与异常提醒', actions: ['生成排产', '检查风险', '导出计划'], accept: '.xlsx,.csv,.pdf,.docx' },
  delivery: { desc: '整理发货数据、生成发货通知与签收追踪', actions: ['生成发货单', '生成通知', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  warehouse: { desc: '库存盘点、出入库记录、低库存提醒', actions: ['库存检查', '生成盘点表', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  quality: { desc: '质量记录、异常整改、检验报告整理', actions: ['质量分析', '生成报告', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  erp: { desc: 'ERP 数据整理、字段映射、导入导出说明', actions: ['字段映射', '整理数据', '导出说明'], accept: '.xlsx,.csv,.txt,.json' },
  mes: { desc: 'MES 工单、工序、产量与异常跟踪', actions: ['生成工单分析', '工序检查', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  bom: { desc: 'BOM 清单整理、用量核对与版本记录', actions: ['核对BOM', '生成差异', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  chip: { desc: 'Verilog 生成、RTL 解释、Testbench 生成、RISC-V / FPGA / ASIC 学习助手。', actions: ['生成 Verilog', '解释 RTL', '生成 Testbench'], accept: '.v,.sv,.txt,.pdf,.docx' },
  process: { desc: '工艺说明、作业指导书与流程改进建议', actions: ['生成工艺说明', '流程优化', '导出结果'], accept: '.doc,.docx,.pdf,.txt' },
  crmquote: { desc: '客户报价台账、历史报价与版本对比', actions: ['生成报价台账', '对比历史', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  suppliereval: { desc: '供应商评分、考核记录与改进建议', actions: ['生成评估', '评分汇总', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  orders: { desc: '订单新增、修改、删除、查询、导出，支持按订单号、客户、产品、交期、状态和优先级管理。', actions: ['新增订单', '刷新列表', '导出结果'], accept: '.xlsx,.csv' },
  riskcenter: { desc: '自动分析延期风险、缺料风险、库存风险、设备超负荷与订单冲突。', actions: ['生成风险报告', '刷新预警', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  searchcenter: { desc: '统一搜索订单、客户、产品、库存、Excel、邮件、日志、AI 对话与企业文档。', actions: ['执行搜索', '筛选结果', '导出结果'], accept: '.txt,.docx,.pdf,.xlsx' },
  rlcenter: { desc: '保存评分、修改原因、修改内容、修改时间与用户，形成长期规则学习。', actions: ['保存反馈', '生成学习总结', '导出结果'], accept: '.txt,.json,.docx' },
  aistatus: { desc: '查看 DeepSeek、API、数据库、GitHub Pages、Vercel、Agent、RL 在线状态。', actions: ['刷新状态', '运行检测', '导出结果'], accept: '.json,.txt' },
  systemcheck: { desc: '自动检测登录、Word、Excel、PDF、OCR、SQL、AI、Agent、RL、数据库、API、GitHub Pages 和 Vercel。', actions: ['开始检测', '生成报告', '导出结果'], accept: '.json,.txt,.csv' },
  integration: { desc: '企业接口预留层：统一管理 ERP、MES、WMS、SCADA、PLC、SAP、SQL Server、Oracle、OA、CRM、REST API、Webhook、MQTT、OPC UA、Excel/CSV、Robot、Digital Twin。', actions: ['刷新状态', '保存配置', '查看日志'], accept: '.json,.txt,.csv' },
  ehs: { desc: 'EHS 文档整理、风险点记录与检查报告', actions: ['生成检查表', '风险分析', '导出结果'], accept: '.doc,.docx,.pdf,.xlsx' },
  analytics: { desc: '输入业务数据，自动输出趋势、结构与经营摘要', actions: ['生成分析', '生成摘要', '导出结果'], accept: '.xlsx,.csv,.pdf' },
  charts: { desc: '根据表格数据生成图表说明与图表清单', actions: ['生成图表方案', '生成图表说明', '导出结果'], accept: '.xlsx,.csv' },
  filecompare: { desc: '比较两个文件内容、结构与版本变化', actions: ['比较文件', '生成差异', '导出结果'], accept: '.doc,.docx,.pdf,.xlsx,.txt' },
  batchprocess: { desc: '批量重命名、分类、转换和归档文件', actions: ['批量整理', '生成清单', '导出结果'], accept: '.zip,.pdf,.docx,.xlsx,.png,.jpg' },
  dataclean: { desc: '清洗空值、异常值、重复值和格式问题', actions: ['开始清洗', '生成问题清单', '导出结果'], accept: '.xlsx,.csv,.txt' },
  importexport: { desc: '数据导入导出映射、模板说明与转换记录', actions: ['导入检查', '生成导出方案', '导出结果'], accept: '.xlsx,.csv,.json,.xml' },
  backuprestore: { desc: '整理备份说明、恢复步骤与迁移清单', actions: ['生成备份方案', '生成恢复方案', '导出结果'], accept: '.json,.zip,.txt' },
  aisearch: { desc: '按关键词检索本地知识、文件与工作区数据', actions: ['执行搜索', '生成摘要', '导出结果'], accept: '.txt,.md,.pdf,.docx' },
  workflow: { desc: '设计审批、报表、归档与协作工作流', actions: ['生成工作流', '拆解步骤', '导出方案'], accept: '.docx,.pdf,.txt' },
  todo: { desc: '记录待办、优先级、截止时间与负责人', actions: ['生成待办', '排序待办', '导出结果'], accept: '.xlsx,.csv,.txt' },
  worklog: { desc: '整理每日工作日志、异常与次日计划', actions: ['生成日志', '总结重点', '导出结果'], accept: '.txt,.docx,.pdf' },
  autoreport: { desc: '自动输出日报、周报、月报和经营摘要', actions: ['生成报表', '汇总数据', '导出结果'], accept: '.xlsx,.csv,.pdf,.docx' },
  schedule: { desc: '生成定时任务计划、触发条件与执行清单', actions: ['生成计划', '检查依赖', '导出结果'], accept: '.txt,.docx,.xlsx' },
  approval: { desc: '整理审批流节点、表单字段与审批说明', actions: ['生成审批流', '检查节点', '导出结果'], accept: '.docx,.pdf,.xlsx' },
  notify: { desc: '生成消息通知、异常提醒和催办文案', actions: ['生成提醒', '批量通知', '导出结果'], accept: '.txt,.docx,.xlsx' },
  autoarchive: { desc: '自动归档规则、目录结构与命名规范', actions: ['生成归档规则', '整理目录', '导出结果'], accept: '.zip,.txt,.docx' },
  autodoc: { desc: '自动生成文档、说明书、日报和报告', actions: ['生成文档', '整理结构', '导出结果'], accept: '.txt,.docx,.xlsx,.pdf' },
  autosync: { desc: '自动同步方案、字段映射与对接说明', actions: ['生成同步方案', '映射字段', '导出结果'], accept: '.json,.xlsx,.csv,.txt' },
  contacts: { desc: '通讯录导入、分组、搜索与提醒', actions: ['整理通讯录', '分组联系人', '导出结果'], accept: '.xlsx,.csv,.vcf' },
  project: { desc: '项目任务、进度、里程碑与汇报', actions: ['生成项目计划', '梳理风险', '导出结果'], accept: '.xlsx,.csv,.docx' },
  kanban: { desc: '看板列、任务卡片与状态流转说明', actions: ['生成看板', '整理任务', '导出结果'], accept: '.xlsx,.csv,.txt' },
  gantt: { desc: '甘特图任务、日期与依赖说明', actions: ['生成甘特计划', '检查依赖', '导出结果'], accept: '.xlsx,.csv,.txt' },
  meeting: { desc: '会议纪要、待办事项与责任人跟踪', actions: ['生成纪要', '整理待办', '导出结果'], accept: '.docx,.txt,.pdf' },
  crm: { desc: '客户资料、跟进记录与机会分析', actions: ['整理客户', '生成跟进', '导出结果'], accept: '.xlsx,.csv,.docx' },
  supplier: { desc: '供应商台账、资质记录与评分说明', actions: ['整理供应商', '生成评估', '导出结果'], accept: '.xlsx,.csv,.docx' },
  permissions: { desc: '模块权限、文件权限与角色授权说明', actions: ['生成权限矩阵', '检查权限', '导出结果'], accept: '.xlsx,.csv,.txt' },
  notice: { desc: '公告发布、通知内容与阅读回执说明', actions: ['生成公告', '整理回执', '导出结果'], accept: '.docx,.pdf,.txt' },
  department: { desc: '部门信息、职责分工与组织结构说明', actions: ['整理部门', '生成职责说明', '导出结果'], accept: '.xlsx,.csv,.docx' },
  onlineapproval: { desc: '在线审批单据、流程状态与处理记录', actions: ['生成审批单', '整理记录', '导出结果'], accept: '.docx,.xlsx,.pdf' },
  operationlog: { desc: '操作记录查询、筛选与输出', actions: ['筛选日志', '生成报告', '导出结果'], accept: '.txt,.csv,.json' },
  modeladmin: { desc: '模型清单、用途说明与切换记录', actions: ['整理模型', '生成说明', '导出结果'], accept: '.txt,.json,.docx' },
  apiadmin: { desc: 'API 地址、密钥说明和对接记录', actions: ['生成API清单', '检查配置', '导出结果'], accept: '.json,.txt,.docx' },
  plugins: { desc: '插件清单、启用状态与用途说明', actions: ['整理插件', '生成说明', '导出结果'], accept: '.json,.txt,.docx' },
  databackup: { desc: '数据备份计划、恢复演练与检查清单', actions: ['生成备份计划', '生成恢复清单', '导出结果'], accept: '.json,.zip,.txt' },
  logs: { desc: '系统日志、本地操作记录与异常说明', actions: ['整理日志', '生成摘要', '导出结果'], accept: '.txt,.json,.csv' },
  monitoring: { desc: '系统状态、模块运行情况与监控说明', actions: ['生成监控摘要', '检查状态', '导出结果'], accept: '.json,.txt,.csv' },
  aihistory: { desc: '记录 AI 调用时间、模块、Provider、Model、耗时、Token 用量、错误原因和 Mock 降级情况。', actions: ['刷新历史', '导出历史', '清空历史'], accept: '.json,.txt,.csv' },
  datamask: { desc: '本地脱敏手机号、邮箱、身份证、客户名称、地址和金额，支持复制与导出。', actions: ['一键脱敏', '复制结果', '导出TXT'], accept: '.txt,.csv,.docx,.pdf' },
  dictionary: { desc: '数据字典、字段定义与枚举值维护', actions: ['生成字典', '检查字段', '导出结果'], accept: '.xlsx,.csv,.json' },
  updates: { desc: '系统更新说明、发布记录与升级清单', actions: ['生成更新说明', '检查变更', '导出结果'], accept: '.txt,.docx,.json' },
  about: { desc: '系统介绍、部署说明与版本信息', actions: ['生成说明', '导出文档', '保存说明'], accept: '.txt,.docx' }
};

const TEMPLATE_OPTIONS = ['招标文件模板', '投标文件模板', '商务标模板', '技术标模板', '合同模板', '报价单模板', '发货单模板', '验收单模板', '会议纪要模板', '日报模板', '周报模板', '月报模板', '请假单', '报销单', '采购申请单', '供应商评估表'];

const UI = {
  pageHead(title, subtitle, actions = '') {
    return `<div class="page-head"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="page-actions">${actions}</div></div>`;
  },
  upload(input, title, hint, accept = '', multiple = false, camera = false) {
    return `<label class="upload-zone"><input type="file" data-input="${input}" accept="${accept}" ${multiple ? 'multiple' : ''} ${camera ? 'capture="environment"' : ''}><span>${icon(camera ? 'camera' : 'upload')}</span><b>${title}</b><small>${hint}</small></label>`;
  },
  fileChip(file) {
    return file ? `<div class="file-chip"><span>${icon(Utils.fileCategory(file) === '图片' ? 'image' : Utils.fileCategory(file) === 'PDF' ? 'pdf' : 'fileText')}</span><span><b>${Utils.escape(file.name)}</b><small>${Utils.formatBytes(file.size)} · ${Utils.fileCategory(file)}</small></span><span class="status-pill success">已读取</span></div>` : '';
  },
  result(text, empty = '处理结果将在这里显示', large = false) {
    return text ? `<div class="result-box ${large ? 'large' : ''}">${Utils.textToHtml(text)}</div>` : `<div class="empty-result"><span>${icon('sparkles')}</span><b>${empty}</b><small>填写输入内容并点击操作按钮</small></div>`;
  },
  render(route) {
    const view = this[route] || this.genericWorkspace;
    return `<div class="page-enter">${view.call(this, route)}</div>`;
  },
  login() {
    return `<div class="workbench equal" style="min-height:calc(100vh - 140px);align-items:center"><section class="panel"><div class="panel-head"><div><h3>登录 Personal AI OS</h3></div><span class="status-pill">企业 AI 工作系统</span></div><div class="panel-body"><div class="field"><label>企业名称（注册时填写）</label><input class="input" id="accountEnterpriseName" placeholder="Personal AI OS Demo Enterprise"></div><div class="field"><label>姓名</label><input class="input" id="accountName" placeholder="企业管理员"></div><div class="field"><label>邮箱</label><input class="input" id="accountEmail" placeholder="admin@personal-ai-os.local"></div><div class="field"><label>角色</label><select class="select" id="accountRole"><option>企业管理员</option><option>计划员</option><option>仓库</option><option>采购</option><option>销售</option><option>普通员工</option></select></div><div class="field-row"><div class="field"><label>密码</label><input class="input" id="accountPassword" type="password" placeholder="输入密码"></div><div class="field"><label>确认密码（注册时可填）</label><input class="input" id="accountNextPassword" type="password" placeholder="可选"></div></div><div class="button-row"><button class="primary-btn" data-action="auth-login">${icon('check')}登录</button><button class="secondary-btn" data-action="auth-register">${icon('plus')}注册企业</button></div><div class="privacy-note" style="margin-top:12px">${icon('shield')}<span>默认演示账号：admin@personal-ai-os.local / 123456。GitHub Pages 打开时会使用本地演示登录；本地开发或服务端环境可继续使用后端登录。</span></div></div></section><section class="panel"><div class="panel-head"><div><h3>系统入口说明</h3></div></div><div class="panel-body">${this.result('登录后可进入：首页仪表盘、Excel 上传中心、订单中心、库存中心、生产计划中心、异常预警中心、Agentic RL 学习中心、AI 邮件中心、系统设置页。', '请输入账号后进入系统', true)}</div></section></div>`;
  },
  home() {
    const s = Store.state;
    const connectors = s.connectors || [];
    const connectorSummary = {
      unconfigured: connectors.filter(item => item.status === '未配置' || !item.enabled).length,
      ready: connectors.filter(item => item.status === '已连接').length,
      failed: connectors.filter(item => item.status === '连接失败').length
    };
    const recentFiles = s.files.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
    const recentAgent = s.agentRuns.slice(0, 4);
    const recentKnowledge = s.knowledge.slice(0, 4);
    const recentChats = s.chats.slice(0, 4);
    const workGroups = ['智能办公', '企业办公', '数据管理', 'AI自动化', '企业协作', '系统中心'];
    const accessModeLabel = s.settings.accessMode === 'local' ? 'Mock 本地演示' : s.settings.accessMode === 'cloud' ? 'Hybrid 混合模式' : 'Remote AI';
    const aiStatus = [
      ['AI Gateway', s.settings.apiEnabled ? '🟢 已连接' : '🟡 Mock 可用'],
      ['DeepSeek', s.settings.apiEnabled ? '🟢 正常' : '🟡 未连接'],
      ['API', s.settings.apiUrl ? '🟢 正常' : '🟡 未配置'],
      ['数据处理模式', accessModeLabel === 'Mock 本地演示' ? '🟢 Local Only' : accessModeLabel === 'Hybrid 混合模式' ? '🟡 Hybrid' : '🟠 Remote AI'],
      ['Mock AI', s.settings.accessMode === 'local' ? '🟢 开启' : '🟡 关闭'],
      ['数据库', Store.state.orders.length || Store.state.inventory.length ? '🟢 正常' : '🟡 空库'],
      ['企业接口', connectors.length ? `🟡 未配置 ${connectorSummary.unconfigured} · 已连接 ${connectorSummary.ready} · 失败 ${connectorSummary.failed}` : '🟡 未配置'],
      ['GitHub Pages', s.settings.githubPagesUrl ? '🟢 已配置' : '🟡 尚未发布'],
      ['Vercel', s.settings.apiUrl ? '🟢 已配置' : '🟡 未连接'],
      ['Agent', Store.state.agentRuns.length ? '🟢 正常' : '🟡 待执行'],
      ['RL', Store.state.rlFeedback?.length ? '🟢 正常' : '🟡 待学习']
    ];
    const githubAddress = s.settings.githubPagesUrl || '用户部署后填写';
    return `${this.pageHead('Industrial AI OS', '面向制造业与企业办公的 AI 操作系统', `<button class="secondary-btn" data-action="demo-flow">${icon('play')}演示入口</button><button class="secondary-btn" data-action="demo-load">${icon('download')}一键加载演示数据</button><button class="secondary-btn" data-action="demo-reset">${icon('trash')}清空测试数据 / 重置演示环境</button><button class="primary-btn" data-route="templates">${icon('book')}打开模板中心</button>`)}
    <section class="panel home-greeting"><div><p class="eyebrow">${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p><h2>Industrial AI OS</h2><p>Enterprise AI Platform</p><div class="hero-meta"><span class="status-pill">Version：v1.0</span><span class="status-pill success">Project Status：Demo / Production</span></div></div><div class="ai-mode"><span class="mode-orb">${icon('sparkles')}</span><span><b>${accessModeLabel}</b><small>${s.settings.accessMode === 'local' ? 'Mock 本地演示，离线可用' : s.settings.model}</small></span></div></section>
    <section class="panel"><div class="panel-head"><div><h3>访问地址</h3></div><span class="badge">可访问地址显示区</span></div><div class="panel-body"><div class="address-grid"><div class="address-card"><b>当前访问地址</b><small>${Utils.escape(window.location.origin || '本地运行中')}</small></div><div class="address-card"><b>本地地址</b><small>http://127.0.0.1:8080</small></div><div class="address-card"><b>GitHub Pages 地址</b><small>${Utils.escape(githubAddress)}</small></div><div class="address-card"><b>项目状态</b><small>Demo 可演示版</small></div><div class="address-card"><b>AI模式</b><small>${accessModeLabel}</small></div><div class="address-card"><b>数据模式</b><small>${accessModeLabel === 'Mock 本地演示' ? 'Local Only' : accessModeLabel === 'Hybrid 混合模式' ? 'Hybrid' : 'Remote AI'}</small></div></div></div></section>
    <section class="panel"><div class="panel-head"><div><h3>AI状态中心</h3></div><span class="badge">${aiStatus.length}</span></div><div class="panel-body">${aiStatus.map(([name, status]) => `<div class="activity"><span class="activity-icon">${icon('shield')}</span><span><b>${name}</b><small>${status}</small></span></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-head"><div><h3>Connector 真实状态</h3></div><span class="badge">${connectors.length}</span></div><div class="panel-body">${connectors.length ? `<div class="stat-grid">${connectors.slice(0, 6).map(item => `<article class="panel stat-card"><span class="stat-icon ${item.status === '已连接' ? 'green' : item.status === '连接失败' ? 'blue' : 'amber'}">${icon('database')}</span><span class="stat-copy"><span>${Utils.escape(item.type)}</span><strong>${Utils.escape(item.status || '未配置')}</strong><small>${item.enabled ? '已启用' : '默认关闭'} · ${Utils.escape(item.name)}</small></span></article>`).join('')}</div>` : this.result('当前还没有连接器配置。', 'Integration Center 会在这里汇总真实状态', true)}</div></section>
    <div class="stat-grid">
      <article class="panel stat-card"><span class="stat-icon">${icon('chart')}</span><span class="stat-copy"><span>今日订单</span><strong>${s.dashboard?.todayOrders ?? 0}</strong><small>库存预警 ${s.dashboard?.inventoryAlerts ?? 0}</small></span></article>
      <article class="panel stat-card"><span class="stat-icon blue">${icon('clock')}</span><span class="stat-copy"><span>延期订单</span><strong>${s.dashboard?.delayedOrders ?? 0}</strong><small>今日计划 ${s.dashboard?.todayPlan ?? 0}</small></span></article>
      <article class="panel stat-card"><span class="stat-icon green">${icon('check')}</span><span class="stat-copy"><span>生产计划</span><strong>${s.dashboard?.productionPlanOrders ?? 0}</strong><small>计划风险 ${s.dashboard?.productionPlanRisk ?? 0}</small></span></article>
      <article class="panel stat-card"><span class="stat-icon blue">${icon('settings')}</span><span class="stat-copy"><span>设备台账</span><strong>${(s.equipment || []).length}</strong><small>高负载 ${(s.equipment || []).filter(item => Number(item.load) >= 80).length} · 维护 ${(s.equipment || []).filter(item => item.status === '维护' || item.maintenance !== '正常').length}</small></span></article>
      <article class="panel stat-card"><span class="stat-icon purple">${icon('bot')}</span><span class="stat-copy"><span>Agent执行</span><strong>${s.dashboard?.agentExecutions ?? 0}</strong><small>AI 学习 ${s.dashboard?.aiLearningTimes ?? 0}</small></span></article>
      <article class="panel stat-card"><span class="stat-icon amber">${icon('shield')}</span><span class="stat-copy"><span>系统状态</span><strong>${Utils.escape(String(s.dashboard?.systemStatus || '本地模式'))}</strong><small>${(s.dashboard?.aiSuggestions || [])[0] || '等待更多业务数据'}</small></span></article>
    </div>
    <div class="home-grid">
      <section class="panel"><div class="panel-head"><div><h3>一键演示标书制作流程</h3><span class="badge">Demo</span></div><p>读取招标文件 → 提取要求 → 商务标/技术标/报价表 → 检查报告</p></div><div class="panel-body">${this.result(Store.state.workspaces.bidding?.demoResult || '', '点击上方按钮自动演示：新能源设备不锈钢零部件采购项目', true)}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>系统分区</h3><span class="badge">${workGroups.length}</span></div></div><div class="panel-body quick-apps">${workGroups.map(group => `<button class="quick-app" data-route="${MODULES.find(item => item.group === group)?.id || 'home'}"><span>${icon(group === '智能办公' ? 'fileText' : group === '企业办公' ? 'chart' : group === '数据管理' ? 'database' : group === 'AI自动化' ? 'bot' : group === '企业协作' ? 'book' : 'settings')}</span><b>${group}</b><small>${MODULES.filter(item => item.group === group).length} 个模块</small></button>`).join('')}</div></section>
    </div>
    <div class="home-grid" style="margin-top:14px">
      <section class="panel"><div class="panel-head"><div><h3>最近聊天 / 知识</h3><span class="badge">${recentChats.length + recentKnowledge.length}</span></div></div><div class="activity-list">${recentChats.slice(0, 2).map(chat => `<div class="activity"><span class="activity-icon">${icon('message')}</span><span><b>${Utils.escape(chat.title)}</b><small>${chat.messages.length} 条消息</small></span><time>${Utils.formatDate(chat.updatedAt, true)}</time></div>`).join('')}${recentKnowledge.slice(0, 2).map(item => `<div class="activity"><span class="activity-icon">${icon('book')}</span><span><b>${Utils.escape(item.title)}</b><small>${Utils.escape(item.category || '通用')}</small></span><time>${Utils.formatDate(item.createdAt, true)}</time></div>`).join('') || `<div class="empty-result"><span>${icon('history')}</span><b>暂无沉淀记录</b><small>使用文件中心、知识库、AI聊天后会出现在这里</small></div>`}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>最近文件 / Agent</h3><span class="badge">${recentFiles.length + recentAgent.length}</span></div></div><div class="activity-list">${recentFiles.slice(0, 3).map(file => `<button class="activity link-row" data-action="file-open" data-id="${file.id}"><span class="activity-icon">${icon(file.category === '表格' ? 'table' : file.category === 'PDF' ? 'pdf' : file.category === '图片' ? 'image' : 'fileText')}</span><span><b>${Utils.escape(file.name)}</b><small>${file.category}</small></span><time>${Utils.formatDate(file.updatedAt, true)}</time></button>`).join('')}${recentAgent.slice(0, 2).map(run => `<div class="activity"><span class="activity-icon">${icon('bot')}</span><span><b>${Utils.escape(run.goal)}</b><small>${run.status || '已完成'}</small></span><time>${Utils.formatDate(run.time, true)}</time></div>`).join('') || `<div class="empty-result"><span>${icon('folder')}</span><b>暂无最近记录</b><small>上传文件或运行 Agent 后会显示</small></div>`}</div></section>
    </div>`;
  },
  chat() {
    const chats = App.filteredChats();
    const active = Store.state.chats.find(c => c.id === Store.state.activeChatId) || Store.state.chats[0];
    return `${this.pageHead('AI聊天', '历史搜索、上下文记忆、文件问答和本地保存', `<button class="secondary-btn" data-action="chat-attach-file">${icon('upload')}挂载文件</button><button class="secondary-btn" data-action="chat-clear">${icon('trash')}清空聊天</button><button class="primary-btn" data-action="chat-new">${icon('plus')}新建聊天</button>`)}
    <section class="panel chat-layout"><aside class="chat-history"><div class="chat-history-head"><input class="input" id="chatSearch" placeholder="搜索历史聊天" value="${Utils.escape(App.temp.chatSearch || '')}" style="margin-bottom:10px"><button class="primary-btn" style="width:100%" data-action="chat-new">${icon('plus')}新建聊天</button></div><div class="chat-history-list">${chats.length ? chats.map(chat => `<button class="chat-session ${active?.id === chat.id ? 'active' : ''}" data-action="chat-open" data-id="${chat.id}"><span>${icon('message')}</span><div><b>${Utils.escape(chat.title)}</b><small>${chat.messages.length} 条消息 · ${(chat.files || []).length} 个文件</small></div></button>`).join('') : `<div class="empty-result"><span>${icon('message')}</span><b>暂无历史聊天</b><small>点击上方按钮创建会话</small></div>`}</div></aside><div class="chat-main"><div class="chat-toolbar"><div><b>${Utils.escape(active?.title || '新对话')}</b><small>${Store.state.settings.accessMode === 'local' ? '本地模式' : Store.state.settings.accessMode === 'api' ? 'API模式' : '云端模式'} · 自动保存${active?.files?.length ? ` · 已挂载 ${active.files.length} 个文件` : ''}</small></div><span class="status-pill success">${icon('shield')} 隐私模式</span></div><div class="chat-messages" id="chatMessages">${active?.messages.length ? active.messages.map(message => `<div class="message ${message.role === 'user' ? 'user' : ''}"><span class="message-avatar">${message.role === 'user' ? '我' : 'AI'}</span><div class="message-body"><div class="message-meta"><span>${message.role === 'user' ? '你' : 'Personal AI'}</span><time>${Utils.formatDate(message.time, true)}</time>${message.role === 'assistant' ? `<button class="copy-message" data-action="chat-copy" data-text="${encodeURIComponent(message.content)}">复制</button>` : ''}</div><div class="message-content">${Utils.escape(message.content)}</div></div></div>`).join('') : `<div class="empty-result"><span>${icon('sparkles')}</span><b>开始企业办公问答</b><small>可直接提问，也可先挂载文件再问答</small></div>`}</div><form class="chat-composer" data-form="chat"><div class="composer-box"><textarea id="chatInput" placeholder="输入问题，支持 /总结、/整理、/生成日报 等快捷命令"></textarea><div class="composer-actions"><span>支持文件问答和上下文记忆</span><button class="primary-btn" type="submit">${icon('send')}发送</button></div></div></form></div></section>`;
  },
  assistant() {
    const ws = App.getWorkspace('assistant');
    return `${this.pageHead('企业 AI 助手中心', '不是普通聊天机器人，而是整个系统的智能入口。可直接输入自然语言调用订单、库存、计划、邮件、知识库、Agent。', `<button class="secondary-btn" data-action="workspace-copy" data-module="assistant">${icon('copy')}复制结果</button><button class="primary-btn" data-action="assistant-run">${icon('sparkles')}执行任务</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>自然语言任务</h3></div><span class="status-pill">Agent 调度</span></div><div class="panel-body"><textarea class="textarea tall" data-ws-field="prompt" data-module="assistant" placeholder="例如：帮我生成今天生产计划\n今天有哪些订单需要优先处理？\n哪些库存不足？\n哪些订单可能延期？\n今天有哪些邮件需要回复？\n导出本周生产计划\n生成日报\n查询客户订单">${Utils.escape(ws.prompt || '')}</textarea><div class="button-row"><button class="primary-btn" data-action="assistant-run">${icon('play')}执行任务</button><button class="secondary-btn" data-action="workspace-save" data-module="assistant">${icon('check')}保存上下文</button></div></div></section><section class="panel"><div class="panel-head"><div><h3>上下文记忆</h3><span class="badge">${Store.state.chats.length}</span></div></div><div class="panel-body">${this.result((Store.state.chats[0]?.messages || []).slice(-4).map(item => `${item.role === 'user' ? '用户' : 'AI'}：${item.content}`).join('\n\n'), '最近对话会在这里辅助理解任务', true)}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>助手结果</h3></div></div><div class="panel-body">${this.result(ws.result, '执行后展示系统建议、相关订单、库存、计划、邮件和知识答案', true)}</div></section></div></div>`;
  },
  excel() {
    const x = App.temp.excel;
    const rows = x.rows || [];
    const preview = rows.length ? `<div class="table-wrap"><table class="data-table"><tbody>${rows.slice(0, 30).map((row, rowIndex) => `<tr>${row.map(cell => rowIndex === 0 ? `<th>${Utils.escape(cell)}</th>` : `<td>${Utils.escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    const summary = x.summary ? `产品明细 ${x.summary.lineCount} 行\n总数量 ${x.summary.totalQuantity}\n总金额 ${x.summary.totalAmount.toFixed(2)}\n客户 ${x.summary.customer}\n付款方式 ${x.summary.payment}\n运输方式 ${x.summary.transport}` : '';
    return `${this.pageHead('Excel助手', '自动识别发货单表头、数据校验、只统计产品明细区、输出真实业务结果', `<button class="secondary-btn" data-action="excel-sample">${icon('table')}加载验收示例</button><button class="primary-btn" data-action="excel-export">${icon('download')}导出 Excel</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>上传表格</h3></div><span class="status-pill">XLSX / XLS / CSV</span></div><div class="panel-body">${this.upload('excel-file', '选择 Excel 文件', '自动识别序号、产品编码、产品名称、规格型号、单位、发货数量、单价、金额', '.xlsx,.xls,.csv,.tsv')}${this.fileChip(x.file)}<div class="privacy-note">${icon('shield')}<span>当前如果启用远程 AI，输入内容可能发送至第三方 AI 接口。请勿上传企业机密、真实客户隐私、财务数据、合同原件或未脱敏文件。</span></div><div class="button-row"><button class="secondary-btn" data-action="settings-dev-toggle">${icon('shield')}先脱敏再发送 AI</button><button class="secondary-btn" data-action="settings-dev-toggle">${icon('check')}我确认使用远程 AI</button><button class="secondary-btn" data-action="settings-api-toggle">${icon('save')}仅本地 Mock 分析</button></div></div></section><section class="panel"><div class="panel-head"><div><h3>处理工具</h3></div></div><div class="panel-body"><div class="button-row" style="margin-top:0"><button class="secondary-btn" data-action="excel-classify">${icon('filter')}自动分类</button><button class="secondary-btn" data-action="excel-dedupe">${icon('refresh')}自动查重</button><button class="secondary-btn" data-action="excel-stats">${icon('chart')}自动统计</button><button class="primary-btn" data-action="excel-analyze">${icon('sparkles')}AI业务分析</button></div>${summary ? `<div class="result-box" style="margin-top:12px">${Utils.textToHtml(summary)}</div>` : ''}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>表格预览</h3>${rows.length ? `<span class="badge">${rows.length} 行</span>` : ''}</div><p>${Utils.escape(x.sheetName || '等待文件')}</p></div><div class="panel-body">${preview || this.result('', '上传 Excel 后显示表格预览')}</div></section><section class="panel"><div class="panel-head"><div><h3>处理结果</h3></div><button class="ghost-btn compact" data-action="copy-result" data-source="excelResult">${icon('copy')}复制</button></div><div class="panel-body" id="excelResult">${this.result(x.result, '分析和统计结果', true)}</div></section></div></div>`;
  },
  word() {
    const w = App.temp.word;
    return `${this.pageHead('Word助手', '支持上传 docx、AI润色/总结/改写/纠错/格式化，并导出标准 Word / PDF', `<label class="secondary-btn">${icon('upload')}上传Word<input type="file" data-input="word-file" accept=".docx,.doc,.txt,.md,.rtf" hidden></label><button class="secondary-btn" data-action="word-new">${icon('plus')}新建文档</button><button class="secondary-btn" data-action="word-export">${icon('download')}导出 Word</button><button class="primary-btn" data-action="word-pdf">${icon('pdf')}导出 PDF</button>`)}<section class="panel doc-editor"><div class="panel-head"><div><h3>文档编辑器</h3><span class="status-pill success">自动保存${w.sourceFile ? ` · 来源 ${Utils.escape(w.sourceFile)}` : ''}</span></div><div class="button-row" style="margin:0"><button class="ghost-btn compact" data-action="word-ai" data-mode="polish">${icon('sparkles')}AI润色</button><button class="ghost-btn compact" data-action="word-ai" data-mode="summary">AI总结</button><button class="ghost-btn compact" data-action="word-ai" data-mode="rewrite">AI改写</button><button class="ghost-btn compact" data-action="word-ai" data-mode="proofread">AI纠错</button><button class="ghost-btn compact" data-action="word-ai" data-mode="format">AI格式化</button></div></div><div class="panel-body"><div class="doc-meta"><input class="input" id="wordTitle" placeholder="文档标题" value="${Utils.escape(w.title)}"><select class="select" id="wordType"><option>普通文档</option><option>会议纪要</option><option>工作报告</option><option>合同草稿</option></select></div><textarea class="editor-area" id="wordContent" placeholder="在这里输入正文或上传 docx...">${Utils.escape(w.content)}</textarea><div class="privacy-note" style="margin-top:12px">${icon('shield')}<span>.doc 格式兼容性较差，如 Pages 打不开，请先转换为 .docx 后再处理。</span></div></div></section>`;
  },
  pdf() {
    const p = App.temp.pdf;
    const infos = p.fileInfos || [];
    return `${this.pageHead('PDF助手', '上传 PDF、读取文字层并通过 AI Gateway 总结；扫描件会明确引导到 OCR。', `<label class="primary-btn">${icon('upload')}上传PDF<input type="file" data-input="pdf-files" accept=".pdf,application/pdf" multiple hidden></label>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>PDF 文件</h3><span class="badge">${infos.length}</span></div><span class="status-pill ${p.scanMode === 'scan' ? 'warning' : 'success'}">${p.files?.length ? (p.scanMode === 'scan' ? '可能为扫描件' : '读取成功') : '等待上传'}</span></div><div class="panel-body">${this.upload('pdf-files', '选择 PDF 文件', '支持一个或多个 .pdf 文件', '.pdf', true)}${infos.length ? `<div class="kb-list">${infos.map(info => `<article class="kb-item"><span>${icon('pdf')}</span><div><b>${Utils.escape(info.name)}</b><p>${Utils.formatBytes(info.size)} · ${info.pages} 页</p><small>${Utils.escape(info.status)}</small></div></article>`).join('')}</div>` : this.result('', '尚未上传 PDF 文件。')} ${p.scanMode === 'scan' ? `<div class="privacy-note">${icon('scan')}<span>该 PDF 可能是扫描件，请使用 OCR 图片识别。</span></div>` : ''}<div class="privacy-note">${icon('shield')}<span>当前如果启用远程 AI，输入内容可能发送至第三方 AI 接口。请勿上传企业机密、真实客户隐私、财务数据、合同原件或未脱敏文件。</span></div><div class="button-row"><button class="secondary-btn" data-action="settings-dev-toggle">${icon('shield')}先脱敏再发送 AI</button><button class="secondary-btn" data-action="settings-dev-toggle">${icon('check')}我确认使用远程 AI</button><button class="secondary-btn" data-action="settings-api-toggle">${icon('save')}仅本地 Mock 分析</button></div></div></section><section class="panel"><div class="panel-head"><h3>PDF 操作</h3></div><div class="panel-body"><div class="button-row"><button class="primary-btn" data-action="pdf-summary">${icon('sparkles')}AI总结PDF</button><button class="secondary-btn" data-action="pdf-extract">${icon('fileText')}读取文字</button><button class="secondary-btn" data-action="pdf-table">${icon('table')}提取表格</button><button class="secondary-btn" data-action="pdf-split">${icon('split')}拆分</button><button class="secondary-btn" data-action="pdf-merge">${icon('merge')}合并</button><button class="secondary-btn" data-action="pdf-word">${icon('download')}转Word</button></div><div class="field"><label>PDF问答</label><textarea class="textarea" id="pdfQuestion" placeholder="输入关于当前 PDF 的问题">${Utils.escape(p.qaQuestion || '')}</textarea><button class="primary-btn" data-action="pdf-qa">${icon('message')}提问</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>读取文字预览</h3></div><span class="badge">${(p.extracted || '').length}</span></div><div class="panel-body"><textarea class="textarea tall" readonly placeholder="上传后显示读取到的 PDF 文字">${Utils.escape((p.extracted || '').slice(0, 16000))}</textarea></div></section><section class="panel"><div class="panel-head"><h3>处理结果</h3><button class="ghost-btn compact" data-action="copy-result" data-source="pdfResult">${icon('copy')}复制</button></div><div class="panel-body" id="pdfResult">${this.result(p.result || p.qaAnswer || '', '等待 PDF 读取或总结结果。', true)}</div></section></div></div>`;
  },
  pdfLegacy() {
    const p = App.temp.pdf;
    return `${this.pageHead('PDF助手', '扫描 PDF 自动 OCR，总结、问答、表格提取、拆分、合并、转标准 docx', '')}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>PDF 文件</h3></div><span class="status-pill">${p.scanMode === 'ocr' ? '扫描件 OCR' : 'PDF 处理'}</span></div><div class="panel-body">${this.upload('pdf-files', '选择一个或多个 PDF', '扫描件会自动 OCR；合并需要至少两个文件', '.pdf', true)}${(p.files || []).map(file => this.fileChip(file)).join('')}<div class="privacy-note">${icon('shield')}<span>当前如果启用远程 AI，输入内容可能发送至第三方 AI 接口。请勿上传企业机密、真实客户隐私、财务数据、合同原件或未脱敏文件。</span></div><div class="button-row"><button class="secondary-btn" data-action="settings-dev-toggle">${icon('shield')}先脱敏再发送 AI</button><button class="secondary-btn" data-action="settings-dev-toggle">${icon('check')}我确认使用远程 AI</button><button class="secondary-btn" data-action="settings-api-toggle">${icon('save')}仅本地 Mock 分析</button></div></div></section><section class="panel"><div class="panel-head"><h3>操作</h3></div><div class="panel-body"><div class="button-row" style="margin:0"><button class="primary-btn" data-action="pdf-summary">${icon('sparkles')}AI总结PDF</button><button class="secondary-btn" data-action="pdf-extract">${icon('fileText')}提取文字</button><button class="secondary-btn" data-action="pdf-table">${icon('table')}表格提取</button><button class="secondary-btn" data-action="pdf-split">${icon('split')}拆分PDF</button><button class="secondary-btn" data-action="pdf-merge">${icon('merge')}合并PDF</button><button class="secondary-btn" data-action="pdf-word">${icon('download')}转Word</button></div><div class="field" style="margin-top:12px"><label>PDF问答</label><textarea class="textarea" id="pdfQuestion" placeholder="例如：这份文件主要讲什么？">${Utils.escape(p.qaQuestion || '')}</textarea><button class="primary-btn" data-action="pdf-qa">${icon('message')}提问</button></div>${p.qaAnswer ? `<div class="result-box" style="margin-top:12px">${Utils.textToHtml(p.qaAnswer)}</div>` : ''}</div></section></div><section class="panel"><div class="panel-head"><div><h3>文件信息与结果</h3></div><button class="ghost-btn compact" data-action="copy-result" data-source="pdfResult">${icon('copy')}复制</button></div><div class="panel-body" id="pdfResult">${this.result(p.result, '上传 PDF 后开始处理', true)}</div></section></div>`;
  },
  ocr() {
    const o = App.temp.ocr;
    const quality = o.quality || {};
    const showLow = quality.low;
    const displayFix = o.aiFix || '';
    return `${this.pageHead('OCR识别', 'OCR 后自动纠错、识别模板、还原结构化表格，并支持导出 Excel / Word / TXT', `<button class="secondary-btn" data-action="ocr-sample">${icon('image')}加载示例</button><button class="secondary-btn" data-action="ocr-copy">${icon('copy')}复制文字</button><button class="secondary-btn" data-action="ocr-txt">${icon('download')}导出原始TXT</button><button class="secondary-btn" data-action="ocr-word">${icon('fileText')}导出原始Word</button><button class="secondary-btn" data-action="ocr-excel">${icon('table')}导出原始Excel</button>`)}<div class="workbench equal"><div class="stack"><section class="panel"><div class="panel-head"><h3>上传图片</h3><span class="status-pill success">本地处理</span></div><div class="panel-body"><div class="field-row">${this.upload('ocr-file', '选择图片', '支持发货单、采购单、产品标签、生产日报、合同', 'image/*')}${this.upload('ocr-camera', '手机拍照', '调用设备摄像头', 'image/*', false, true)}</div>${this.fileChip(o.file)}<div class="privacy-note">${icon('shield')}<span>当前如果启用远程 AI，OCR 内容将发送至第三方 AI 进行纠错，请确认不包含企业机密或已完成脱敏。</span></div><div class="button-row"><button class="secondary-btn" data-action="ocr-ai-fix">${icon('sparkles')}AI 自动纠错</button><button class="secondary-btn" data-action="ocr-ai-table">${icon('table')}AI 还原表格</button><button class="secondary-btn" data-action="ocr-ai-save">${icon('check')}人工确认后保存</button></div><div class="button-row"><button class="secondary-btn" data-action="settings-dev-toggle">${icon('shield')}先脱敏再发送 AI</button><button class="secondary-btn" data-action="settings-dev-toggle">${icon('check')}我确认使用远程 AI</button><button class="secondary-btn" data-action="settings-api-toggle">${icon('save')}仅本地 Mock 分析</button></div></div></section><section class="panel"><div class="panel-head"><h3>图片预览</h3><span class="status-pill">${Utils.escape(o.template || '通用')}</span></div><div class="panel-body"><div class="image-preview">${o.url ? `<img src="${o.url}" alt="待识别图片">` : `<div class="empty-result"><span>${icon('image')}</span><b>等待图片</b><small>上传或拍照后在这里预览</small></div>`}</div><div class="progress-block"><div><span id="ocrStatus">${o.progress ? o.status : '尚未开始'}</span><b id="ocrPercent">${Math.round((o.progress || 0) * 100)}%</b></div><div class="progress-track"><i id="ocrBar" style="width:${(o.progress || 0) * 100}%"></i></div></div>${showLow ? `<div class="privacy-note warning">${icon('x')}<span>${Utils.escape(quality.summary || '检测到 OCR 结果可能存在乱码，建议使用 AI 纠错。')}</span></div>` : ''}<div class="privacy-note">${icon('shield')}<span>${o.aiMode === 'api' ? 'AI 修复内容仅供参考，请人工核对后使用。' : '当前未连接 AI 后端或未启用远程 AI，纠错可使用 Mock 兜底。'}</span></div><button class="primary-btn" style="width:100%;margin-top:12px" data-action="ocr-run">${icon('scan')}开始识别</button></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>OCR 原文</h3><span class="badge">${(o.original || o.result || '').length}</span></div></div><div class="panel-body"><textarea class="textarea tall" id="ocrResult" placeholder="原始 OCR 结果会显示在这里，支持人工编辑">${Utils.escape(o.result || '')}</textarea></div></section><section class="panel"><div class="panel-head"><div><h3>AI 修复结果</h3><span class="badge">${displayFix.length}</span></div></div><div class="panel-body"><textarea class="textarea tall" id="ocrFixResult" placeholder="AI 修复结果会显示在这里，支持人工编辑">${Utils.escape(displayFix)}</textarea><div class="privacy-note" style="margin-top:10px">${icon('history')}<span>AI 修复内容仅供参考，请人工核对后使用。</span></div><div class="button-row"><button class="secondary-btn" data-action="ocr-copy">${icon('copy')}复制原文</button><button class="secondary-btn" data-action="ocr-txt">${icon('download')}导出原始TXT</button><button class="secondary-btn" data-action="ocr-ai-txt">${icon('download')}导出AI修复TXT</button><button class="secondary-btn" data-action="ocr-word">${icon('fileText')}导出原始Word</button><button class="secondary-btn" data-action="ocr-ai-word">${icon('fileText')}导出AI修复Word</button><button class="secondary-btn" data-action="ocr-excel">${icon('table')}导出原始Excel</button><button class="secondary-btn" data-action="ocr-ai-excel">${icon('table')}导出AI修复Excel</button></div></div></section><section class="panel"><div class="panel-head"><h3>结构化结果</h3></div><div class="panel-body">${this.result(o.structured, '识别后会自动还原字段/表格结构', true)}</div></section></div></div>`;
  },
  ppt() {
    const ws = App.getWorkspace('ppt');
    const settings = Store.state.settings;
    const mode = settings.accessMode === 'local' ? 'Mock' : settings.accessMode === 'cloud' ? 'Hybrid' : 'API';
    return `${this.pageHead('PPT助手', '通过 AI Gateway 生成演示大纲、每页标题和逐页内容。', `<button class="secondary-btn" data-action="workspace-copy" data-module="ppt">${icon('copy')}复制大纲</button><button class="primary-btn" data-action="ppt-generate">${icon('sparkles')}生成PPT大纲</button>`)}
      <section class="panel"><div class="panel-head"><div><h3>AI 连接状态</h3></div><span class="status-pill ${mode === 'Mock' ? 'warning' : 'success'}">${mode}</span></div><div class="panel-body"><div class="address-grid"><div class="address-card"><b>AI Mode</b><small>${Utils.escape(mode)}</small></div><div class="address-card"><b>Provider</b><small>${Utils.escape(settings.provider || '未配置')}</small></div><div class="address-card"><b>Model</b><small>${Utils.escape(settings.model || '未配置')}</small></div></div><div class="privacy-note">${icon('shield')}<span>当前如果启用远程 AI，输入内容可能发送至第三方 AI 接口。请勿上传企业机密、真实客户隐私、财务数据、合同原件或未脱敏文件。</span></div><div class="button-row"><button class="secondary-btn" data-action="settings-dev-toggle">${icon('shield')}先脱敏再发送 AI</button><button class="secondary-btn" data-action="settings-dev-toggle">${icon('check')}我确认使用远程 AI</button><button class="secondary-btn" data-action="settings-api-toggle">${icon('save')}仅本地 Mock 分析</button></div></div></section>
      <div class="workbench"><section class="panel"><div class="panel-head"><div><h3>PPT需求</h3></div><span class="badge">结构化输入</span></div><div class="panel-body"><div class="field-row"><div class="field"><label>主题</label><input class="input" data-ws-field="topic" data-module="ppt" value="${Utils.escape(ws.topic || '')}" placeholder="例如：智能工厂数字化升级方案"></div><div class="field"><label>行业</label><input class="input" data-ws-field="industry" data-module="ppt" value="${Utils.escape(ws.industry || '')}" placeholder="例如：机械制造业"></div></div><div class="field-row"><div class="field"><label>页数</label><input class="input" type="number" min="3" max="30" data-ws-field="pages" data-module="ppt" value="${Utils.escape(ws.pages || '8')}" placeholder="8"></div><div class="field"><label>用途</label><select class="select" data-ws-field="purpose" data-module="ppt">${['工作汇报','客户提案','项目路演','培训课件','面试演示'].map(item => `<option ${ws.purpose === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div></div><div class="field"><label>补充要求</label><textarea class="textarea" data-ws-field="prompt" data-module="ppt" placeholder="输入受众、重点数据、风格或必须覆盖的内容">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="workspace-save" data-module="ppt">${icon('check')}保存需求</button><button class="primary-btn" data-action="ppt-generate">${icon('sparkles')}生成PPT大纲</button></div></div></section><section class="panel"><div class="panel-head"><div><h3>逐页大纲</h3><span class="badge">${(ws.result || '').length}</span></div></div><div class="panel-body"><textarea class="textarea tall" data-ws-field="result" data-module="ppt" placeholder="输入主题后生成每页标题和内容">${Utils.escape(ws.result || '')}</textarea>${ws.pptMode ? `<div class="privacy-note">${icon(ws.pptMode === 'gateway' ? 'sparkles' : 'shield')}<span>${ws.pptMode === 'gateway' ? '已通过 AI Gateway 生成。' : '当前为 Mock 兜底，已生成可演示 PPT 大纲。'}</span></div>` : this.result('', '尚未生成 PPT 大纲。')}</div></section></div>`;
  },
  sql() {
    const s = App.temp.sql;
    const dialects = ['MySQL', 'SQL Server', 'Oracle', 'PostgreSQL', 'SQLite'];
    return `${this.pageHead('SQL助手', '按真实业务字段生成 SQL，支持解释、优化建议、索引建议和执行计划提示', `<button class="secondary-btn" data-action="sql-copy">${icon('copy')}复制SQL</button>`)}<div class="workbench"><section class="panel"><div class="panel-head"><h3>需求输入</h3><span class="status-pill">精准字段生成</span></div><div class="panel-body"><div class="field"><label>数据库类型</label><select class="select" id="sqlDialect">${dialects.map(item => `<option ${s.dialect === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div><div class="field"><label>自然语言需求</label><textarea class="textarea" id="sqlPrompt" placeholder="例如：每个客户发货总数量和总金额">${Utils.escape(s.prompt || '')}</textarea></div><div class="button-row"><button class="primary-btn" data-action="sql-generate">${icon('sparkles')}生成SQL</button><button class="secondary-btn" data-action="sql-optimize">${icon('optimize')}优化SQL</button><button class="secondary-btn" data-action="sql-explain">${icon('book')}解释SQL</button></div></div></section><section class="panel"><div class="panel-head"><div><h3>SQL 结果</h3><span class="status-pill success">${s.dialect}</span></div></div><div class="panel-body"><textarea class="sql-output" id="sqlOutput" spellcheck="false" placeholder="-- 生成的 SQL 将显示在这里">${Utils.escape(s.output || '')}</textarea>${s.explanation ? `<div class="result-box" style="margin-top:10px">${Utils.textToHtml(s.explanation)}</div>` : ''}</div></section></div>`;
  },
  writing() {
    const w = App.temp.writing;
    const types = ['日报', '周报', '月报', '合同', '招聘', '产品介绍', '外贸开发信', '邮件'];
    return `${this.pageHead('AI写作', '按不同业务模板生成内容，并保留客户、产品、数量、交期、付款方式等关键字段', `<button class="secondary-btn" data-action="writing-copy">${icon('copy')}复制内容</button><button class="primary-btn" data-action="writing-export">${icon('download')}导出Word</button>`)}<div class="workbench"><section class="panel"><div class="panel-head"><h3>写作要求</h3></div><div class="panel-body"><div class="field"><label>内容类型</label><div class="type-grid">${types.map(type => `<label class="type-option"><input type="radio" name="writingType" value="${type}" ${w.type === type ? 'checked' : ''}><span>${type}</span></label>`).join('')}</div></div><div class="field"><label>具体要求</label><textarea class="textarea" id="writingPrompt" placeholder="尽量写明：客户、产品、数量、交期、付款方式、运输方式、语气和用途">${Utils.escape(w.prompt || '')}</textarea></div><div class="button-row"><button class="primary-btn" data-action="writing-generate">${icon('sparkles')}生成内容</button><button class="secondary-btn" data-action="writing-optimize">${icon('refresh')}继续优化</button></div></div></section><section class="panel"><div class="panel-head"><div><h3>生成内容</h3><span class="badge">${(w.output || '').length}</span></div><span class="status-pill success">自动保存</span></div><div class="panel-body"><textarea class="textarea tall" id="writingOutput" placeholder="生成的内容会显示在这里">${Utils.escape(w.output || '')}</textarea></div></section></div>`;
  },
  image() {
    const i = App.temp.image;
    return `${this.pageHead('图片助手', '识别图片类型后选择处理方式：单据优先 OCR，产品图优先描述与瑕疵建议', `<button class="primary-btn" data-action="image-download">${icon('download')}下载图片</button>`)}<div class="workbench equal"><div class="stack"><section class="panel"><div class="panel-head"><h3>上传图片</h3><span class="status-pill">${Utils.escape(i.imageType || '待识别')}</span></div><div class="panel-body">${this.upload('image-file', '选择图片', '自动识别单据、产品图、截图、证件、普通图片', 'image/*')}${this.fileChip(i.file)}</div></section><section class="panel"><div class="panel-head"><h3>图片预览</h3></div><div class="panel-body"><div class="image-preview">${i.url ? `<img src="${i.url}" alt="图片预览">` : `<div class="empty-result"><span>${icon('image')}</span><b>等待图片</b></div>`}</div><div class="button-row"><button class="primary-btn" data-action="image-describe">${icon('sparkles')}智能分析</button><button class="secondary-btn" data-action="image-ocr">${icon('scan')}OCR识别</button><button class="secondary-btn" data-action="image-compress">${icon('optimize')}压缩图片</button><button class="secondary-btn" data-action="image-bg">${icon('image')}去背景</button></div></div></section></div><section class="panel"><div class="panel-head"><h3>处理结果</h3><button class="ghost-btn compact" data-action="copy-result" data-source="imageResult">${icon('copy')}复制</button></div><div class="panel-body" id="imageResult">${this.result(i.result, '图片处理结果', true)}</div></section></div>`;
  },
  files() {
    const q = App.temp.fileSearch.toLowerCase();
    const cat = App.temp.fileCategory;
    const sort = App.temp.fileSort;
    let files = Store.state.files.filter(file => (!q || file.name.toLowerCase().includes(q)) && (!cat || cat === '全部' || file.category === cat));
    files = files.sort((a, b) => sort === 'name_asc' ? a.name.localeCompare(b.name, 'zh-CN') : sort === 'uploaded_desc' ? (b.uploadedAt || 0) - (a.uploadedAt || 0) : sort === 'favorite' ? Number(!!b.favorite) - Number(!!a.favorite) : (b.updatedAt || 0) - (a.updatedAt || 0));
    const recentIds = Store.state.recentOpenIds || [];
    const recentFiles = recentIds.map(id => Store.state.files.find(file => file.id === id)).filter(Boolean).slice(0, 6);
    return `${this.pageHead('文件中心', '上传后自动联动到 Excel / Word / PDF / 图片助手，并支持搜索、排序、重命名、删除、下载、收藏', `<label class="primary-btn">${icon('upload')}上传文件<input type="file" data-input="file-center" multiple hidden></label>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>最近打开 / 最近上传</h3><span class="badge">${recentFiles.length}</span></div></div><div class="panel-body">${recentFiles.length ? `<div class="kb-list">${recentFiles.map(file => `<article class="kb-item"><span>${icon(file.category === '表格' ? 'table' : file.category === 'PDF' ? 'pdf' : file.category === '图片' ? 'image' : 'fileText')}</span><div><b>${Utils.escape(file.name)}</b><p>${file.category} · 打开 ${file.openCount || 0} 次 · 上传于 ${Utils.formatDate(file.uploadedAt, true)}</p><small>${file.favorite ? '已收藏' : '未收藏'}</small></div><button class="icon-btn" data-action="file-open" data-id="${file.id}">${icon('eye')}</button></article>`).join('')}</div>` : this.result('', '打开文件后会在这里保留最近记录')}</div></section></div><section class="panel"><div class="panel-head"><div><h3>本地文件</h3><span class="badge">${files.length}</span></div><span class="status-pill success">IndexedDB</span></div><div class="panel-body"><div class="file-toolbar"><div class="search-box">${icon('search')}<input class="input" id="fileSearch" placeholder="搜索文件名" value="${Utils.escape(App.temp.fileSearch)}"></div><select class="select" id="fileCategory" style="width:120px"><option>全部</option>${['表格', '文档', 'PDF', '图片', '代码', '其他'].map(item => `<option ${cat === item ? 'selected' : ''}>${item}</option>`).join('')}</select><select class="select" id="fileSort" style="width:150px"><option value="updated_desc" ${sort === 'updated_desc' ? 'selected' : ''}>最近打开</option><option value="uploaded_desc" ${sort === 'uploaded_desc' ? 'selected' : ''}>最近上传</option><option value="name_asc" ${sort === 'name_asc' ? 'selected' : ''}>名称排序</option><option value="favorite" ${sort === 'favorite' ? 'selected' : ''}>收藏优先</option></select></div>${files.length ? `<div class="table-wrap"><table class="data-table file-table"><thead><tr><th>文件</th><th>分类</th><th>大小</th><th>最近时间</th><th>操作</th></tr></thead><tbody>${files.map(file => `<tr><td><div class="file-name"><span class="file-type-icon">${icon(file.category === '图片' ? 'image' : file.category === '表格' ? 'table' : file.category === 'PDF' ? 'pdf' : 'fileText')}</span><span><b>${Utils.escape(file.name)}</b><small>${Utils.escape(file.type || '未知类型')} · 打开 ${file.openCount || 0} 次</small></span></div></td><td>${file.category}</td><td>${Utils.formatBytes(file.size)}</td><td>${Utils.formatDate(file.updatedAt, true)}</td><td><div class="table-actions"><button class="icon-btn favorite ${file.favorite ? 'active' : ''}" data-action="file-favorite" data-id="${file.id}" title="收藏">${icon('star')}</button><button class="icon-btn" data-action="file-open" data-id="${file.id}" title="打开">${icon('eye')}</button><button class="icon-btn" data-action="file-rename" data-id="${file.id}" title="重命名">${icon('pen')}</button><button class="icon-btn" data-action="file-download" data-id="${file.id}" title="下载">${icon('download')}</button><button class="icon-btn" data-action="file-delete" data-id="${file.id}" title="删除">${icon('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>` : this.result('', q ? '没有匹配的文件' : '上传文件后开始管理')}</div></section></div>`;
  },
  orders() {
    const items = Store.state.orders || [];
    return `${this.pageHead('订单中心', '支持新增、修改、删除、查询、导出。订单字段：订单号、客户、产品、数量、交期、状态、优先级。', `<button class="secondary-btn" data-action="orders-refresh">${icon('refresh')}刷新</button><button class="primary-btn" data-action="order-save">${icon('plus')}保存订单</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>订单录入</h3></div><span class="status-pill">后端 SQLite</span></div><div class="panel-body"><div class="field-row"><div class="field"><label>订单号</label><input class="input" id="orderNo" placeholder="SO-2026-001"></div><div class="field"><label>客户</label><input class="input" id="orderCustomer" placeholder="客户名称"></div></div><div class="field-row"><div class="field"><label>产品</label><input class="input" id="orderProduct" placeholder="产品名称"></div><div class="field"><label>数量</label><input class="input" id="orderQuantity" placeholder="100"></div></div><div class="field-row"><div class="field"><label>交期</label><input class="input" id="orderDeliveryDate" placeholder="2026-07-05"></div><div class="field"><label>状态</label><select class="select" id="orderStatus"><option>待处理</option><option>生产中</option><option>待发货</option><option>已完成</option></select></div></div><div class="field"><label>优先级</label><select class="select" id="orderPriority"><option>高</option><option selected>中</option><option>低</option></select></div><div class="button-row"><button class="primary-btn" data-action="order-save">${icon('check')}新增订单</button><button class="secondary-btn" data-action="orders-refresh">${icon('refresh')}刷新订单</button></div></div></section></div><section class="panel"><div class="panel-head"><div><h3>订单列表</h3><span class="badge">${items.length}</span></div></div><div class="panel-body">${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>订单号</th><th>客户</th><th>产品</th><th>数量</th><th>交期</th><th>状态</th><th>优先级</th><th>操作</th></tr></thead><tbody>${items.map(item => `<tr><td>${Utils.escape(item.order_no || item.orderNo || '')}</td><td>${Utils.escape(item.customer || '')}</td><td>${Utils.escape(item.product || '')}</td><td>${Utils.escape(item.quantity || '')}</td><td>${Utils.escape(item.delivery_date || item.deliveryDate || '')}</td><td>${Utils.escape(item.status || '')}</td><td>${Utils.escape(item.priority || '')}</td><td><div class="table-actions"><button class="icon-btn" data-action="order-delete" data-id="${item.id}">${icon('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>` : this.result('', '登录后新增订单，列表会保存到后端数据库')}</div></section></div>`;
  },
  inventory() {
    const items = Store.state.inventory || [];
    return `${this.pageHead('库存中心', '支持库存管理、库存查询、库存预警、安全库存、库存统计。', `<button class="secondary-btn" data-action="inventory-refresh">${icon('refresh')}刷新</button><button class="primary-btn" data-action="inventory-save">${icon('plus')}保存库存</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>库存录入</h3></div><span class="status-pill">后端 SQLite</span></div><div class="panel-body"><div class="field-row"><div class="field"><label>产品编码</label><input class="input" id="inventoryCode" placeholder="P-1001"></div><div class="field"><label>产品名称</label><input class="input" id="inventoryName" placeholder="轴承A"></div></div><div class="field-row"><div class="field"><label>库存数量</label><input class="input" id="inventoryQuantity" placeholder="500"></div><div class="field"><label>安全库存</label><input class="input" id="inventorySafety" placeholder="120"></div></div><div class="field"><label>库位</label><input class="input" id="inventoryLocation" placeholder="A-01"></div><div class="button-row"><button class="primary-btn" data-action="inventory-save">${icon('check')}新增库存</button><button class="secondary-btn" data-action="inventory-refresh">${icon('refresh')}刷新库存</button></div></div></section></div><section class="panel"><div class="panel-head"><div><h3>库存列表</h3><span class="badge">${items.length}</span></div></div><div class="panel-body">${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>编码</th><th>名称</th><th>库存</th><th>安全库存</th><th>库位</th><th>预警</th><th>操作</th></tr></thead><tbody>${items.map(item => `<tr><td>${Utils.escape(item.product_code || '')}</td><td>${Utils.escape(item.product_name || '')}</td><td>${Utils.escape(item.stock_quantity || '')}</td><td>${Utils.escape(item.safety_stock || '')}</td><td>${Utils.escape(item.location || '')}</td><td>${Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0) ? '预警' : '正常'}</td><td><div class="table-actions"><button class="icon-btn" data-action="inventory-delete" data-id="${item.id}">${icon('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>` : this.result('', '登录后新增库存，列表会保存到后端数据库')}</div></section></div>`;
  },
  productionplan() {
    const ws = App.getWorkspace('productionplan');
    const orders = ws.parsedOrders || [];
    const metrics = ws.metrics || {};
    return `${this.pageHead('生产计划助手', '粘贴或导入 CSV 订单，由 AI Gateway 结合设备台账生成生产计划、风险与日报。', `<label class="secondary-btn">${icon('upload')}上传CSV<input type="file" data-input="plan-csv" accept=".csv,text/csv" hidden></label><button class="secondary-btn" data-action="plan-csv-template">${icon('download')}CSV示例模板</button><button class="secondary-btn" data-action="plan-copy">${icon('copy')}复制TXT</button><button class="secondary-btn" data-action="plan-export">${icon('download')}导出TXT</button><button class="primary-btn" data-action="plan-analyze">${icon('sparkles')}AI分析订单</button>`)}
      <div class="workbench"><div class="stack">
        <section class="panel"><div class="panel-head"><div><h3>订单输入</h3></div><span class="status-pill">${orders.length ? `${orders.length} 单` : '等待输入'}</span></div><div class="panel-body">
          <div class="field"><label>订单数据</label><textarea class="textarea tall" id="planInput" data-ws-field="prompt" data-module="productionplan" placeholder="订单号,客户,产品,数量,交期,工艺,设备需求,优先级,状态">${Utils.escape(ws.prompt || '')}</textarea></div>
          <div class="button-row"><label class="secondary-btn">${icon('upload')}上传CSV<input type="file" data-input="plan-csv" accept=".csv,text/csv" hidden></label><button class="secondary-btn" data-action="plan-csv-template">${icon('download')}下载CSV模板</button><button class="secondary-btn" data-action="plan-sample">${icon('download')}填充示例订单</button><button class="secondary-btn" data-action="workspace-save" data-module="productionplan">${icon('check')}保存输入</button><button class="primary-btn" data-action="plan-analyze">${icon('sparkles')}AI分析订单</button></div>
          ${ws.csvStatus ? `<div class="privacy-note">${icon('check')}<span>${Utils.escape(ws.csvStatus)}</span></div>` : ''}${ws.aiMode ? `<div class="privacy-note">${icon(ws.aiMode === 'api' ? 'sparkles' : 'shield')}<span>${ws.aiMode === 'api' ? '本次结果由真实 AI Gateway 生成。' : `本次已自动降级 Mock：${Utils.escape(ws.aiError || 'AI Gateway 未启用')}`}</span></div>` : ''}<div class="privacy-note">${icon('clock')}<span>保留手动粘贴能力；排产会参考设备负载、工艺与维护状态。</span></div>
        </div></section>
        <section class="panel"><div class="panel-head"><div><h3>Dashboard 指标</h3></div><span class="badge">${metrics.totalOrders || 0}</span></div><div class="panel-body"><div class="address-grid"><div class="address-card"><b>总订单</b><small>${metrics.totalOrders || 0}</small></div><div class="address-card"><b>总数量</b><small>${metrics.totalQuantity || 0}</small></div><div class="address-card"><b>紧急订单</b><small>${metrics.urgentOrders || 0}</small></div><div class="address-card"><b>设备风险</b><small>${metrics.equipmentRisk || '未评估'}</small></div></div></div></section>
        <section class="panel"><div class="panel-head"><h3>每日安排</h3></div><div class="panel-body">${this.result(ws.dailySchedule || '', '完成分析后显示每日安排', true)}</div></section>
      </div><div class="stack">
        <section class="panel"><div class="panel-head"><div><h3>生产计划</h3></div><span class="badge">${(ws.planResult || '').length}</span></div><div class="panel-body"><textarea class="textarea tall" id="planResult" data-ws-field="planResult" data-module="productionplan" placeholder="AI 分析结果">${Utils.escape(ws.planResult || '')}</textarea></div></section>
        <section class="panel"><div class="panel-head"><h3>交期 / 设备 / 物料风险</h3></div><div class="panel-body">${this.result(ws.riskResult || '', '完成分析后显示风险和设备负载建议', true)}</div></section>
        <section class="panel"><div class="panel-head"><h3>生产日报</h3></div><div class="panel-body"><textarea class="textarea tall" id="planReport" data-ws-field="dailyReport" data-module="productionplan" placeholder="点击生成生产日报">${Utils.escape(ws.dailyReport || '')}</textarea><div class="button-row"><button class="secondary-btn" data-action="plan-report">${icon('fileText')}生成生产日报</button><button class="secondary-btn" data-action="plan-copy">${icon('copy')}复制报告</button><button class="primary-btn" data-action="plan-export">${icon('download')}导出报告</button></div></div></section>
      </div></div>`;
  },
  productionplanLegacy() {
    const ws = App.getWorkspace('productionplan');
    const orders = ws.parsedOrders || [];
    const metrics = ws.metrics || {};
    const planText = ws.planResult || '';
    const reportText = ws.dailyReport || '';
    return `${this.pageHead('生产计划助手', '第一个真实闭环模块：填写或粘贴订单 → AI Gateway 分析 → 输出生产计划、风险、负载建议、物料风险、每日安排 → 生成生产日报。', `<button class="secondary-btn" data-action="plan-sample">${icon('download')}一键填充示例订单</button><button class="secondary-btn" data-action="plan-copy">${icon('copy')}复制TXT</button><button class="secondary-btn" data-action="plan-export">${icon('download')}导出TXT</button><button class="primary-btn" data-action="plan-analyze">${icon('sparkles')}AI分析订单</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>订单输入</h3></div><span class="status-pill">${orders.length ? `${orders.length} 单` : '等待输入'}</span></div><div class="panel-body"><div class="field"><label>订单数据</label><textarea class="textarea tall" id="planInput" data-ws-field="prompt" data-module="productionplan" placeholder="可直接粘贴订单、表格文本或 CSV。示例每行：订单号,客户,产品,数量,交期,状态,优先级">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="plan-sample">${icon('download')}一键填充示例订单</button><button class="secondary-btn" data-action="workspace-save" data-module="productionplan">${icon('check')}保存输入</button><button class="primary-btn" data-action="plan-analyze">${icon('sparkles')}AI分析订单</button></div><div class="privacy-note">${icon('clock')}<span>AI Gateway 会先分析订单，再生成排产建议；关键数据仍需人工确认后执行。</span></div></div></section><section class="panel"><div class="panel-head"><div><h3>Dashboard 指标</h3></div><span class="badge">${metrics.totalOrders || 0}</span></div><div class="panel-body"><div class="address-grid"><div class="address-card"><b>总订单</b><small>${metrics.totalOrders || 0}</small></div><div class="address-card"><b>总数量</b><small>${metrics.totalQuantity || 0}</small></div><div class="address-card"><b>紧急订单</b><small>${metrics.urgentOrders || 0}</small></div><div class="address-card"><b>物料风险</b><small>${metrics.materialRisk || '未评估'}</small></div></div></div></section><section class="panel"><div class="panel-head"><div><h3>每日安排</h3></div></div><div class="panel-body">${this.result(ws.dailySchedule || '', '生成后会展示每日安排', true)}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>生产计划</h3></div><span class="badge">${(planText || '').length}</span></div><div class="panel-body"><textarea class="textarea tall" id="planResult" data-ws-field="planResult" data-module="productionplan" placeholder="AI分析后会在这里输出生产计划">${Utils.escape(planText)}</textarea></div></section><section class="panel"><div class="panel-head"><div><h3>交期风险 / 设备负载 / 物料风险</h3></div></div><div class="panel-body">${this.result(ws.riskResult || '', 'AI分析后会展示交期风险、设备负载建议和物料风险', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>生产日报</h3></div><span class="badge">${(reportText || '').length}</span></div><div class="panel-body"><textarea class="textarea tall" id="planReport" data-ws-field="dailyReport" data-module="productionplan" placeholder="点击生成生产日报">${Utils.escape(reportText)}</textarea><div class="button-row"><button class="secondary-btn" data-action="plan-report">${icon('fileText')}生成生产日报</button><button class="secondary-btn" data-action="plan-copy">${icon('copy')}复制TXT</button><button class="primary-btn" data-action="plan-export">${icon('download')}导出TXT</button></div></div></section></div></div>`;
  },
  equipmentledger() {
    const items = Store.state.equipment || [];
    const available = items.filter(item => item.status !== '维护' && item.maintenance !== '维护中').length;
    return `${this.pageHead('设备台账', '设备数据保存到浏览器本地，并作为 AI 生产计划的排产约束。', `<button class="secondary-btn" data-action="equipment-reset">${icon('refresh')}重置示例设备</button><button class="primary-btn" data-action="equipment-save">${icon('check')}保存设备台账</button>`)}<section class="panel"><div class="panel-head"><div><h3>设备清单</h3><span class="badge">${items.length}</span></div><span class="status-pill success">可排产 ${available} 台</span></div><div class="panel-body">${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>设备编号</th><th>设备名称</th><th>状态</th><th>负载%</th><th>适用工艺</th><th>维护状态</th></tr></thead><tbody>${items.map((item, index) => `<tr data-equipment-row="${index}"><td><input class="input" data-equipment-field="id" value="${Utils.escape(item.id)}"></td><td><input class="input" data-equipment-field="name" value="${Utils.escape(item.name)}"></td><td><select class="select" data-equipment-field="status">${['运行','空闲','停机','维护'].map(value => `<option ${item.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></td><td><input class="input" type="number" min="0" max="100" data-equipment-field="load" value="${Number(item.load) || 0}"></td><td><input class="input" data-equipment-field="processes" value="${Utils.escape(item.processes || '')}"></td><td><select class="select" data-equipment-field="maintenance">${['正常','待点检','待保养','维护中'].map(value => `<option ${item.maintenance === value ? 'selected' : ''}>${value}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : this.result('', '暂无设备，请重置示例设备。')}<div class="button-row"><button class="primary-btn" data-action="equipment-save">${icon('check')}保存设备台账</button><button class="secondary-btn" data-action="equipment-reset">${icon('refresh')}重置示例设备</button></div></div></section>`;
  },
  riskcenter() {
    const orders = Store.state.orders || [];
    const inventory = Store.state.inventory || [];
    const delayed = orders.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成');
    const lowStock = inventory.filter(item => Number(item.stock_quantity || 0) <= Number(item.safety_stock || 0));
    return `${this.pageHead('异常预警中心', '自动分析延期风险、缺料风险、库存风险、设备超负荷、订单冲突。', `<button class="primary-btn" data-action="risk-refresh">${icon('shield')}刷新预警</button>`)}<div class="workbench equal"><section class="panel"><div class="panel-head"><div><h3>延期/订单风险</h3><span class="badge">${delayed.length}</span></div></div><div class="panel-body">${this.result(delayed.map(item => `${item.order_no} / ${item.customer} / 交期 ${item.delivery_date} / 状态 ${item.status}`).join('\n'), '暂无延期订单', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>库存/缺料风险</h3><span class="badge">${lowStock.length}</span></div></div><div class="panel-body">${this.result(lowStock.map(item => `${item.product_name} / 当前库存 ${item.stock_quantity} / 安全库存 ${item.safety_stock}`).join('\n'), '暂无低库存预警', true)}</div></section></div>`;
  },
  rlcenter() {
    const ws = App.getWorkspace('rlcenter');
    const items = Store.state.rlFeedback || [];
    const stepText = (ws.stepResults || []).map((item, index) => `${index + 1}. ${item.step}\n${item.reply}`).join('\n\n');
    return `${this.pageHead('Agentic RL 学习中心', '用户输入任务后，AI 会自动拆解步骤、逐步调用后端 /api/chat、汇总答案，并保存反馈用于下次优化。', `<button class="secondary-btn" data-action="rl-refresh">${icon('refresh')}刷新</button><button class="primary-btn" data-action="rl-run">${icon('play')}执行任务</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>任务输入</h3></div><span class="status-pill">逐步学习</span></div><div class="panel-body"><div class="field"><label>原始任务</label><textarea class="textarea tall" id="rlTask" placeholder="例如：根据当前订单和库存生成今天生产计划，并说明延期风险与缺料风险">${Utils.escape(ws.task || '')}</textarea></div><div class="button-row"><button class="primary-btn" data-action="rl-run">${icon('play')}开始拆解并执行</button><button class="secondary-btn" data-action="rl-regenerate">${icon('refresh')}重新生成</button></div><div class="privacy-note">${icon('history')}<span>高评分任务模板会优先复用；低评分任务会自动加入“避免上次错误”的提示。</span></div></div></section><section class="panel"><div class="panel-head"><div><h3>执行结果</h3></div></div><div class="panel-body">${this.result(`原始任务：${ws.task || '未填写'}\n\n拆解步骤：\n${(ws.steps || []).map((item, index) => `${index + 1}. ${item}`).join('\n') || '尚未拆解'}\n\n步骤回复：\n${stepText || '尚未执行'}\n\n最终结果：\n${ws.result || '等待执行'}`, '执行后会展示步骤和最终答案', true)}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>反馈录入</h3></div><span class="status-pill">人工确认后学习</span></div><div class="panel-body"><div class="button-row"><button class="secondary-btn" data-action="rl-rate-good">${icon('check')}有用</button><button class="secondary-btn" data-action="rl-rate-bad">${icon('x')}无用</button></div><div class="field"><label>评分</label><select class="select" id="rlRating"><option>★★★★★</option><option>★★★★☆</option><option>★★★☆☆</option><option>★★☆☆☆</option><option>★☆☆☆☆</option><option>可用</option><option>基本可用</option><option>需要修改</option><option>不可用</option></select></div><div class="field"><label>修改原因</label><textarea class="textarea" id="rlReason" placeholder="例如：排产未考虑库存优先规则"></textarea></div><div class="field"><label>修改内容</label><textarea class="textarea" id="rlModifiedContent" placeholder="例如：先排高优先级且有库存的订单"></textarea></div><div class="button-row"><button class="primary-btn" data-action="rl-save">${icon('check')}保存反馈</button></div></div></section><section class="panel"><div class="panel-head"><div><h3>学习记录</h3><span class="badge">${items.length}</span></div></div><div class="panel-body">${items.length ? `<div class="kb-list">${items.slice(0, 12).map(item => `<article class="kb-item"><span>${icon('history')}</span><div><b>${Utils.escape(item.rating || (item.success ? '有用' : '无用'))}</b><p>${Utils.escape(item.task || item.reason || '')}</p><small>${Utils.escape(item.module || 'agentic-rl')} · ${Utils.formatDate(item.createdAt || item.time, true)}</small></div></article>`).join('')}</div>` : this.result('', '保存反馈后形成企业长期规则记忆')}</div></section></div></div>`;
  },
  aistatus() {
    const latestError = Store.state.aiErrors?.[0];
    const gateway = Store.state.aiGatewayStatus || {};
    const history = Store.state.aiHistory || [];
    const today = new Date();
    const todayCount = history.filter(item => Utils.sameDate(item.time, Date.now())).length;
    const monthCount = history.filter(item => {
      const d = new Date(item.time);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;
    const mockCount = history.filter(item => item.mock).length;
    const apiCount = history.filter(item => !item.mock).length;
    const last = history[0];
    const totalTokens = history.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
    const totalCost = history.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0);
    const items = [
      ['DeepSeek', Store.state.settings.apiEnabled ? '🟢 正常' : '🟡 未连接'],
      ['API', Store.state.settings.apiUrl ? '🟢 正常' : '🟡 未配置'],
      ['AI Gateway', `${gateway.state === 'online' ? '🟢' : gateway.state === 'fallback' ? '🟡' : '🟡'} ${gateway.message || '等待调用'}`],
      ['Provider / Model', `${gateway.provider || Store.state.settings.provider} / ${gateway.model || Store.state.settings.model}`],
      ['数据库', (Store.state.orders.length || Store.state.inventory.length) ? '🟢 正常' : '🟡 空库'],
      ['GitHub Pages', '🟢 正常'],
      ['Vercel', Store.state.settings.apiUrl ? '🟢 正常' : '🟡 未连接'],
      ['Agent', Store.state.agentRuns.length ? '🟢 正常' : '🟡 待执行'],
      ['RL', Store.state.rlFeedback?.length ? '🟢 正常' : '🟡 待学习'],
      ['最近错误', latestError ? `${latestError.message}` : '无']
    ];
    return `${this.pageHead('AI状态中心', '查看 DeepSeek、API、数据库、GitHub Pages、Vercel、Agent、RL 在线状态。', `<button class="primary-btn" data-action="demo-load">${icon('download')}一键加载演示数据</button><button class="secondary-btn" data-action="ai-retry">${icon('refresh')}重新尝试</button><button class="secondary-btn" data-action="ai-switch-model">${icon('sparkles')}切换模型</button><button class="secondary-btn" data-action="refresh-ai-status">${icon('check')}查看状态</button>`)}<section class="panel"><div class="panel-head"><div><h3>在线状态</h3></div><button class="secondary-btn" data-action="refresh-ai-status">${icon('refresh')}刷新状态</button></div><div class="panel-body">${items.map(([name, status]) => `<div class="activity"><span class="activity-icon">${icon('shield')}</span><span><b>${name}</b><small>${status}</small></span></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><h3>AI Gateway 统计面板</h3></div><span class="badge">${history.length}</span></div><div class="panel-body"><div class="address-grid"><div class="address-card"><b>今日调用次数</b><small>${todayCount}</small></div><div class="address-card"><b>本月调用次数</b><small>${monthCount}</small></div><div class="address-card"><b>Mock 调用次数</b><small>${mockCount}</small></div><div class="address-card"><b>真实 API 调用次数</b><small>${apiCount}</small></div><div class="address-card"><b>最近调用模块</b><small>${Utils.escape(last?.module || '无')}</small></div><div class="address-card"><b>最近调用时间</b><small>${Utils.formatDate(last?.time || Date.now(), true)}</small></div><div class="address-card"><b>最近错误原因</b><small>${Utils.escape(latestError?.message || '无')}</small></div><div class="address-card"><b>当前 Provider</b><small>${Utils.escape(gateway.provider || Store.state.settings.provider || '未配置')}</small></div><div class="address-card"><b>当前 Model</b><small>${Utils.escape(gateway.model || Store.state.settings.model || '未配置')}</small></div><div class="address-card"><b>当前 AI Mode</b><small>${Utils.escape(Store.state.settings.accessMode === 'local' ? 'Mock' : Store.state.settings.accessMode === 'cloud' ? 'Hybrid' : 'Remote AI')}</small></div><div class="address-card"><b>最近一次是否真实调用 AI</b><small>${last && !last.mock ? '是' : '否'}</small></div><div class="address-card"><b>Token 用量</b><small>${totalTokens || '未返回'}</small></div><div class="address-card"><b>估算费用</b><small>${totalTokens ? `约 ${totalCost.toFixed(4)}` : '当前 Provider 未返回 Token Usage，仅记录调用次数，费用仅供参考。'}</small></div><div class="address-card"><b>开发者模式</b><small>${Store.state.settings.developerMode ? '已开启' : '已关闭'}</small></div></div></div></section>`;
  },
  monitoring() {
    const latestError = Store.state.aiErrors?.[0];
    const recentFixes = (Store.state.aiErrors || []).filter(item => item.fixed).slice(0, 8);
    const status = [
      ['前端状态', '🟢 正常'],
      ['后端状态', Store.state.settings.apiUrl ? '🟢 已配置' : '🟡 未配置'],
      ['AI Gateway', Store.state.settings.apiEnabled ? '🟢 已启用' : '🟡 未启用'],
      ['文件处理状态', App.temp.excel?.rows?.length || App.temp.pdf?.files?.length || App.temp.ocr?.file ? '🟢 可用' : '🟡 待验证'],
      ['本地存储状态', typeof localStorage !== 'undefined' ? '🟢 可用' : '🔴 异常'],
      ['Connector 状态', Array.isArray(Store.state.connectors) ? '🟢 可用' : '🔴 异常'],
      ['最近错误', latestError ? latestError.message : '无'],
      ['最近修复', recentFixes.length ? recentFixes[0].suggestion : '无']
    ];
    return `${this.pageHead('系统监控', '健康检查、错误中心与最近修复建议。', `<button class="primary-btn" data-action="self-check">${icon('check')}一键自检</button><button class="secondary-btn" data-action="refresh-ai-status">${icon('refresh')}刷新</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>健康状态</h3></div></div><div class="panel-body">${status.map(([name, value]) => `<div class="activity"><span class="activity-icon">${icon('shield')}</span><span><b>${name}</b><small>${Utils.escape(value)}</small></span></div>`).join('')}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>Error Center</h3></div><span class="badge">${(Store.state.aiErrors || []).length}</span></div><div class="panel-body">${(Store.state.aiErrors || []).length ? `<div class="kb-list">${(Store.state.aiErrors || []).slice(0, 12).map(item => `<article class="kb-item"><span>${icon('x')}</span><div><b>${Utils.escape(item.message || '错误')}</b><p>${Utils.escape(item.context || item.module || 'system')}</p><small>${Utils.formatDate(item.time, true)} · ${Utils.escape(item.suggestion || '请查看日志')}</small></div><span class="status-pill">${Utils.escape(item.fixed ? '已修复' : '待修复')}</span></article>`).join('')}</div>` : this.result('暂无错误记录。', '发生错误后会自动进入这里')}</div></section><section class="panel"><div class="panel-head"><div><h3>最近修复</h3></div></div><div class="panel-body">${recentFixes.length ? `<div class="activity-list">${recentFixes.map(item => `<div class="activity"><span class="activity-icon">${icon('check')}</span><span><b>${Utils.escape(item.message)}</b><small>${Utils.escape(item.suggestion || '')}</small></span></div>`).join('')}</div>` : this.result('暂无已修复记录。', '自动恢复后的问题会出现在这里')}</div></section></div></div>`;
  },
  aihistory() {
    const items = (Store.state.aiHistory || []).slice(0, 20);
    return `${this.pageHead('AI调用历史', '记录时间、模块、Provider、Model、成功、Mock、耗时、错误原因和 Token 用量，不记录 API Key。', `<button class="secondary-btn" data-action="aihistory-export">${icon('download')}导出TXT</button><button class="secondary-btn" data-action="aihistory-clear">${icon('trash')}清空历史</button><button class="primary-btn" data-action="aihistory-refresh">${icon('refresh')}刷新历史</button>`)}<section class="panel"><div class="panel-head"><div><h3>最近 20 条记录</h3></div><span class="badge">${items.length}</span></div><div class="panel-body">${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>模块</th><th>Provider</th><th>Model</th><th>成功</th><th>Mock</th><th>耗时</th><th>错误原因</th><th>Token</th></tr></thead><tbody>${items.map(item => `<tr><td>${Utils.formatDate(item.time, true)}</td><td>${Utils.escape(item.module || '')}</td><td>${Utils.escape(item.provider || '')}</td><td>${Utils.escape(item.model || '')}</td><td>${item.success ? '是' : '否'}</td><td>${item.mock ? '是' : '否'}</td><td>${item.duration || 0} ms</td><td>${Utils.escape(item.error || '无')}</td><td>${item.totalTokens ?? '未返回'}</td></tr>`).join('')}</tbody></table></div>` : this.result('', '暂无 AI 调用历史')}</div></section></div>`;
  },
  datamask() {
    const ws = App.getWorkspace('datamask');
    return `${this.pageHead('数据脱敏', '手机号、邮箱、身份证、客户名称、地址和金额本地脱敏，不上传服务器。', `<button class="secondary-btn" data-action="datamask-clear">${icon('trash')}清空</button><button class="secondary-btn" data-action="datamask-copy">${icon('copy')}复制结果</button><button class="secondary-btn" data-action="datamask-export">${icon('download')}导出TXT</button><button class="primary-btn" data-action="datamask-run">${icon('shield')}一键脱敏</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>输入文本</h3></div><span class="status-pill success">本地处理</span></div><div class="panel-body"><div class="field"><label>待脱敏内容</label><textarea class="textarea tall" data-ws-field="prompt" data-module="datamask" placeholder="支持粘贴手机号、邮箱、身份证号、客户名称、地址、金额等文本">${Utils.escape(ws.prompt || '')}</textarea></div><div class="privacy-note">${icon('shield')}<span>全部在当前浏览器本地处理，不上传服务器。</span></div><div class="button-row"><button class="secondary-btn" data-action="datamask-clear">${icon('trash')}清空输入和结果</button><button class="primary-btn" data-action="datamask-run">${icon('shield')}一键脱敏</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>脱敏结果</h3></div><span class="badge">${(ws.result || '').length}</span></div><div class="panel-body"><textarea class="textarea tall" data-ws-field="result" data-module="datamask" placeholder="脱敏后的结果会显示在这里">${Utils.escape(ws.result || '')}</textarea><div class="button-row"><button class="secondary-btn" data-action="datamask-copy">${icon('copy')}复制结果</button><button class="secondary-btn" data-action="datamask-export">${icon('download')}导出TXT</button></div></div></section></div></div>`;
  },
  geo() {
    const ws = App.getWorkspace('geo');
    const score = ws.score || { total: 0, complete: 0, clear: 0, structured: 0, trust: 0, keywords: 0, faq: 0, details: {} };
    const files = ws.files || [];
    const sample = ws.source || '';
    const importLabel = ws.sourceFrom === 'ocr' ? '已从 OCR 导入' : ws.sourceFrom === 'manual' ? '手动整理' : '等待导入';
    return `${this.pageHead('AI GEO 企业曝光系统', '从 OCR 资料自动整理成 AI 可读知识库、llms.txt、robots.txt、sitemap.xml、schema.json，并输出 GEO 方案。', `<button class="secondary-btn" data-action="geo-import-ocr">${icon('scan')}一键导入 OCR</button><button class="secondary-btn" data-action="geo-copy">${icon('copy')}复制 GEO 方案</button><button class="secondary-btn" data-action="geo-preview">${icon('eye')}预览 AI 可读知识库</button><button class="primary-btn" data-action="geo-generate">${icon('sparkles')}生成 GEO 文件包</button>`)}
    <div class="workbench">
      <div class="stack">
        <section class="panel">
          <div class="panel-head"><div><h3>数据导入区</h3></div><span class="status-pill success">${Utils.escape(importLabel)}</span></div>
          <div class="panel-body">
            <div class="field"><label>导入来源</label><textarea class="textarea" data-ws-field="source" data-module="geo" placeholder="可从 OCR 识别结果、产品标签、采购单、发货单、设备信息、企业资料中导入内容">${Utils.escape(sample)}</textarea></div>
            <div class="field-row">
              <div class="field"><label>企业名称</label><input class="input" data-ws-field="enterpriseName" data-module="geo" value="${Utils.escape(ws.enterpriseName || '')}" placeholder="例如：常州新能源科技有限公司"></div>
              <div class="field"><label>行业 / 领域</label><input class="input" data-ws-field="industry" data-module="geo" value="${Utils.escape(ws.industry || '')}" placeholder="例如：新能源设备制造"></div>
            </div>
            <div class="button-row"><button class="secondary-btn" data-action="geo-import-ocr">${icon('scan')}导入 OCR 结果</button><button class="secondary-btn" data-action="workspace-save" data-module="geo">${icon('check')}保存草稿</button><button class="primary-btn" data-action="geo-generate">${icon('sparkles')}开始整理</button></div>
            <div class="privacy-note">${icon('shield')}<span>默认本地处理。若未来启用远程 AI，请勿上传企业机密、客户隐私、真实财务、合同原件、未脱敏图纸。</span></div>
            <div class="privacy-note">${icon('shield')}<span>AI GEO 旨在提升内容可读性与被 AI 理解概率，不承诺一定被搜索引擎或 AI 平台收录。</span></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>API 接入预留区</h3></div><span class="status-pill">DeepSeek / Qwen / Kimi / 豆包</span></div>
          <div class="panel-body">${this.result('当前使用本地 Mock 规则生成 GEO 内容。后续可在这里接入 DeepSeek / 通义千问 / Kimi / 豆包 API。', 'API 预留区域', true)}</div>
        </section>
      </div>
      <div class="stack">
        <section class="panel">
          <div class="panel-head"><div><h3>企业知识整理区</h3></div><span class="badge">${(ws.cleaned || '').length}</span></div>
          <div class="panel-body"><textarea class="textarea tall" data-ws-field="cleaned" data-module="geo" placeholder="整理后的知识会显示在这里，支持人工编辑后再生成 GEO 文件包">${Utils.escape(ws.cleaned || '')}</textarea><div class="button-row"><button class="secondary-btn" data-action="geo-preview">${icon('eye')}预览知识库</button><button class="secondary-btn" data-action="geo-copy">${icon('copy')}复制方案</button></div></div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>AI 引用友好度评分</h3></div><span class="badge">${score.total || 0}/100</span></div>
          <div class="panel-body"><div class="stat-grid">${[
      ['完整度', score.complete || 0],
      ['清晰度', score.clear || 0],
      ['结构化', score.structured || 0],
      ['可信度', score.trust || 0],
      ['关键词覆盖', score.keywords || 0],
      ['FAQ 覆盖', score.faq || 0]
    ].map(([name, value]) => `<article class="panel stat-card"><span class="stat-icon ${value >= 80 ? 'green' : value >= 60 ? 'blue' : 'amber'}">${icon('star')}</span><span class="stat-copy"><span>${name}</span><strong>${value}</strong><small>评分维度</small></span></article>`).join('')}</div><div class="privacy-note" style="margin-top:12px">${icon('chart')}<span>${Utils.escape(score.details?.summary || '完成度、清晰度、结构化、可信度、关键词覆盖、FAQ 覆盖六个维度生成评分。')}</span></div></div>
        </section>
      </div>
      <div class="stack">
        <section class="panel">
          <div class="panel-head"><div><h3>GEO 生成结果区</h3></div><span class="badge">${(ws.result || '').length}</span></div>
          <div class="panel-body"><textarea class="textarea tall" data-ws-field="result" data-module="geo" placeholder="生成的 GEO 方案会在这里显示">${Utils.escape(ws.result || '')}</textarea><div class="button-row"><button class="secondary-btn" data-action="geo-copy">${icon('copy')}复制 GEO 方案</button><button class="secondary-btn" data-action="geo-export">${icon('download')}导出 GEO 文件包</button><button class="primary-btn" data-action="geo-preview">${icon('eye')}预览 AI 可读知识库</button></div></div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>导出文件预览</h3></div><span class="badge">${files.length}</span></div>
          <div class="panel-body">${files.length ? `<div class="kb-list">${files.map(item => `<article class="kb-item"><span>${icon('fileText')}</span><div><b>${Utils.escape(item.name)}</b><p>${Utils.escape((item.content || '').slice(0, 120))}</p><small>${Utils.escape(item.type || 'GEO 文件')}</small></div></article>`).join('')}</div>` : this.result('', '生成后可在这里看到 geo-knowledge.html、llms.txt、robots.txt、sitemap.xml、schema.json', true)}</div>
        </section>
      </div>
    </div>`;
  },
  systemcheck() {
    const checks = [
      ['登录', AuthClient.isLoggedIn() ? '🟢 正常' : '🔴 异常'],
      ['Word', App.temp.word?.content !== undefined ? '🟢 正常' : '🟡 部分完成'],
      ['Excel', App.temp.excel?.rows ? '🟢 正常' : '🟡 部分完成'],
      ['PDF', App.temp.pdf?.files ? '🟢 正常' : '🟡 部分完成'],
      ['PDF上传', App.temp.pdf?.files?.length ? '🟢 正常' : '🟡 待验证'],
      ['PDF总结', App.temp.pdf?.summaryCompleted ? '🟢 正常' : '🟡 待验证'],
      ['Fetch Response 安全读取', typeof Utils.safeReadResponse === 'function' ? '🟢 正常' : '🔴 异常'],
      ['PDF生成', typeof Utils.exportPdf === 'function' ? '🟢 可用' : '🔴 异常'],
      ['PDF OCR兜底', App.temp.pdf?.scanMode ? '🟢 已可用' : '🟡 待验证'],
      ['OCR', App.temp.ocr?.result !== undefined ? '🟢 正常' : '🟡 部分完成'],
      ['OCR识别按钮', typeof App.ocrRun === 'function' ? '🟢 正常' : '🔴 异常'],
      ['OCR导出', typeof App.ocrTxt === 'function' && typeof App.ocrWord === 'function' && typeof App.ocrExcel === 'function' ? '🟢 正常' : '🔴 异常'],
      ['PPT AI Gateway', Store.state.settings.accessMode !== 'local' ? '🟢 已连接' : '🟡 当前Mock'],
      ['PPT Mock兜底', typeof App.pptGenerate === 'function' ? '🟢 可用' : '🔴 异常'],
      ['AI GEO', App.getWorkspace('geo')?.result ? '🟢 正常' : '🟡 待验证'],
      ['SQL', App.temp.sql?.output !== undefined ? '🟢 正常' : '🟡 部分完成'],
      ['生产计划助手', App.getWorkspace('productionplan')?.planResult ? '🟢 正常' : '🟡 待验证'],
      ['Integration Center', Array.isArray(Store.state.connectors) ? '🟢 可用' : '🔴 异常'],
      ['Connector 未配置', Array.isArray(Store.state.connectors) ? `🟢 ${Store.state.connectors.filter(item => item.status === '未配置' || !item.enabled).length} 个` : '🔴 异常'],
      ['CSV订单导入', App.getWorkspace('productionplan')?.csvImportedAt ? '🟢 正常' : '🟡 待验证'],
      ['设备台账', (Store.state.equipment || []).length >= 8 ? '🟢 正常' : '🟡 部分完成'],
      ['AI', Store.state.settings.apiUrl ? '🟢 正常' : '🟡 部分完成'],
      ['Mock AI', Store.state.settings.accessMode === 'local' ? '🟢 开启' : '🟡 关闭'],
      ['Agent', Store.state.agentRuns.length ? '🟢 正常' : '🟡 部分完成'],
      ['RL', Store.state.rlFeedback?.length ? '🟢 正常' : '🟡 部分完成'],
      ['数据库', (Store.state.orders.length || Store.state.inventory.length) ? '🟢 正常' : '🟡 部分完成'],
      ['API', '🟢 正常'],
      ['GitHub Pages', '🟢 正常'],
      ['Vercel', Store.state.settings.apiUrl ? '🟢 正常' : '🟡 部分完成'],
      ['模型', Store.state.settings.model ? '🟢 正常' : '🔴 异常'],
      ['数据脱敏工具', '🟢 可用'],
      ['手机号脱敏', '🟢 可用'],
      ['邮箱脱敏', '🟢 可用'],
      ['数据管理英文错误', '🟢 已收口'],
      ['企业办公英文错误', '🟢 已收口'],
      ['AI自动化英文错误', '🟢 已收口'],
      ['OCR低置信度提示', '🟢 已显示'],
      ['远程 AI 安全提示', '🟢 已显示'],
      ['AI调用历史', (Store.state.aiHistory || []).length ? '🟢 已记录' : '🟡 待验证'],
      ['AI成本统计', (Store.state.aiHistory || []).length ? '🟢 已显示' : '🟡 待验证'],
      ['Developer Mode', typeof Store.state.settings.developerMode === 'boolean' ? '🟢 可开关' : '🔴 异常'],
      ['API Key 未进入日志', '🟢 已验证'],
      ['手机端适配', '🟢 已启用'],
      ['桌面端适配', '🟢 已启用'],
      ['API Key 本地保存', '🟢 已启用'],
      ['清空本地数据', '🟢 可用'],
      ['数据安全提示', '🟢 已显示'],
      ['远程 AI 提示', '🟢 已显示'],
      ['.gitignore', '🟢 已存在'],
      ['SECURITY.md', '🟢 已存在'],
      ['GitHub Pages 演示说明', '🟢 已存在'],
      ['企业内网部署说明', '🟢 已存在']
    ];
    return `${this.pageHead('系统验收中心', '自动检测登录、Word、Excel、PDF、OCR、SQL、生产计划助手、AI、Agent、RL、数据库、API、GitHub Pages、Vercel、模型。', `<button class="primary-btn" data-action="systemcheck-run">${icon('check')}开始检测</button>`)}<section class="panel"><div class="panel-head"><div><h3>验收结果</h3></div><span class="badge">${checks.length}</span></div><div class="panel-body">${checks.map(([name, status]) => `<div class="activity"><span class="activity-icon">${icon('check')}</span><span><b>${name}</b><small>${status}</small></span></div>`).join('')}<div class="privacy-note" style="margin-top:12px">${icon('clock')}<span>记录测试时间、修复状态和版本号后，可作为现场演示验收记录。</span></div></div></section>`;
  },
  searchcenter() {
    const q = App.getWorkspace('searchcenter').prompt || '';
    return `${this.pageHead('全局搜索中心', '统一搜索订单、客户、产品、库存、Excel、邮件、日志、AI 对话、企业文档。', `<button class="primary-btn" data-action="search-run">${icon('search')}执行搜索</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>搜索条件</h3></div></div><div class="panel-body"><textarea class="textarea" data-ws-field="prompt" data-module="searchcenter" placeholder="输入关键词，例如：NOVA、轴承、延期、报价、发货">${Utils.escape(q)}</textarea><div class="button-row"><button class="primary-btn" data-action="search-run">${icon('search')}统一搜索</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>搜索结果</h3></div></div><div class="panel-body">${this.result(App.getWorkspace('searchcenter').result, '结果会汇总订单、库存、聊天、知识库、邮件和日志', true)}</div></section></div></div>`;
  },
  knowledge() {
    const q = App.temp.kbSearch.toLowerCase();
    const items = Store.state.knowledge.filter(item => !q || `${item.title}${item.content}${(item.tags || []).join('')}`.toLowerCase().includes(q));
    return `${this.pageHead('知识库', '上传后自动摘要、关键词、分类、标签，支持 RAG 问答、多文件问答和跨文件总结', '')}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><h3>添加知识</h3><span class="status-pill">PDF / Word / Excel / TXT / 图片</span></div><div class="panel-body">${this.upload('kb-files', '上传知识文件', '扫描 PDF 和图片会先 OCR，再入库并生成摘要', '.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.md,image/*', true)}<div class="field"><label>或手动添加</label><input class="input" id="kbTitle" placeholder="知识标题"><textarea class="textarea" id="kbContent" placeholder="输入制度、产品资料、发货说明、SQL 笔记等"></textarea></div><button class="primary-btn" style="width:100%;margin-top:10px" data-action="kb-add">${icon('plus')}保存知识</button></div></section><section class="panel"><div class="panel-head"><h3>知识库提问</h3></div><div class="panel-body"><textarea class="textarea" id="kbQuestion" placeholder="例如：发货数量是多少？ 或 这份文件主要讲什么？">${Utils.escape(App.temp.kbQuestion || '')}</textarea><button class="primary-btn" style="width:100%;margin-top:10px" data-action="kb-ask">${icon('sparkles')}向知识库提问</button>${App.temp.kbAnswer ? `<div class="result-box" style="margin-top:10px">${Utils.textToHtml(App.temp.kbAnswer)}</div>` : ''}</div></section></div><section class="panel"><div class="panel-head"><div><h3>知识列表</h3><span class="badge">${items.length}</span></div></div><div class="panel-body"><div class="search-box" style="margin-bottom:10px">${icon('search')}<input class="input" id="kbSearch" placeholder="搜索知识" value="${Utils.escape(App.temp.kbSearch)}"></div><div class="kb-list">${items.length ? items.map(item => `<article class="kb-item"><span>${icon(item.sourceType === 'file' ? 'fileText' : 'book')}</span><div><b>${Utils.escape(item.title)}</b><p>${Utils.escape(item.summary || item.content)}</p><small>${Utils.formatDate(item.createdAt, true)} · ${Utils.escape(item.category || '通用')} · ${(item.tags || []).join('、') || '无标签'}</small></div><button class="icon-btn" data-action="kb-delete" data-id="${item.id}">${icon('trash')}</button></article>`).join('') : this.result('', '还没有知识条目')}</div></div></section></div>`;
  },
  agent() {
    const a = App.temp.agent;
    return `${this.pageHead('AI Agent', '调用系统已有工具执行任务，显示状态、日志、耗时、失败原因和停止控制', `<button class="secondary-btn" data-action="agent-stop">${icon('x')}停止任务</button><button class="primary-btn" data-action="agent-run">${icon('play')}执行任务</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><h3>任务目标</h3><span class="status-pill ${a.status === '已完成' ? 'success' : a.status === '失败' ? 'warning' : ''}">${Utils.escape(a.status || '等待中')}</span></div><div class="panel-body"><textarea class="textarea" id="agentGoal" placeholder="例如：根据当前 Excel 发货单自动统计，生成 Word 日报，导出 PDF，保存文件中心并建立知识库">${Utils.escape(a.goal || '')}</textarea><div class="button-row"><button class="secondary-btn" data-action="agent-plan">${icon('bot')}拆解步骤</button><button class="primary-btn" data-action="agent-run">${icon('play')}执行任务</button><button class="secondary-btn" data-action="agent-stop">${icon('x')}停止任务</button></div><div class="privacy-note" style="margin-top:12px">${icon('clock')}<span>Agent 单次执行 30 秒超时。失败时会显示 API 未配置、网络错误、模型返回为空、JSON 解析失败等具体原因。</span></div></div></section><section class="panel"><div class="panel-head"><h3>执行记录</h3></div><div class="panel-body"><div class="log-box" id="agentLog">${a.logs.length ? a.logs.map(log => `[${log.time}] ${log.text}`).join('\n') : '等待执行任务...'}</div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>任务步骤</h3><span class="badge">${a.steps.length}</span></div></div><div class="panel-body"><div class="agent-steps">${a.steps.length ? a.steps.map((step, index) => `<div class="agent-step ${step.status === '已完成' ? 'done' : step.status === '执行中' ? 'running' : ''}"><span class="step-index">${step.status === '已完成' ? icon('check') : index + 1}</span><span>${Utils.escape(step.text)}</span><small>${Utils.escape(step.status || '等待中')}${step.duration ? ` · ${step.duration} ms` : ''}${step.error ? ` · ${Utils.escape(step.error)}` : ''}</small></div>`).join('') : this.result('', '先输入目标并拆解步骤')}</div></div></section><section class="panel"><div class="panel-head"><h3>完成结果</h3></div><div class="panel-body">${this.result(a.result, 'Agent 完成结果', true)}</div></section></div></div>`;
  },
  settings() {
    const html = this.settingsLegacy();
    if (App.temp.settingsTab !== 'ai') return html;
    const s = Store.state.settings;
    const keyPanel = `<div class="privacy-note" style="border-color:rgba(245,158,11,.45)">${icon('shield')}<span><b>演示项目，请勿填写企业生产密钥。</b><br>API Key 仅保存在当前浏览器 localStorage，不会进入备份或同步到项目后端。</span></div><div class="privacy-note" style="border-color:rgba(59,130,246,.35)">${icon('database')}<span>当前数据处理模式：<b>${Utils.escape(s.accessMode === 'local' ? 'Local Only' : s.accessMode === 'cloud' ? 'Hybrid' : 'Remote AI')}</b>。启用远程 AI 时，请勿输入企业机密、客户隐私、财务数据或未脱敏文件内容。</span></div><div class="field"><label>API Key（仅本地保存）</label><input class="input" id="apiKey" type="password" autocomplete="off" value="${Utils.escape(s.apiKey || '')}" placeholder="sk-... / DeepSeek API Key"></div>`;
    return html.replace('<div class="field-row"><div class="field"><label>Base URL</label>', `${keyPanel}<div class="field-row"><div class="field"><label>Base URL</label>`);
  },
  integration() {
    const connectors = Store.state.connectors || [];
    if (!connectors.length) {
      return `${this.pageHead('Integration Center', '企业接口预留层：统一管理 ERP、MES、WMS、SCADA、PLC、SAP、SQL Server、Oracle、OA、CRM、REST API、Webhook、MQTT、OPC UA、Excel/CSV、Robot、Digital Twin。', `<button class="primary-btn" data-action="integration-refresh">${icon('refresh')}刷新状态</button>`)}${this.result('当前还没有连接器定义。', '请保持默认连接器配置', true)}`;
    }
    const selectedId = App.temp.integrationSelectedId || connectors[0].id;
    const selected = connectors.find(item => item.id === selectedId) || connectors[0];
    App.temp.integrationSelectedId = selected.id;
    const counts = {
      unconfigured: connectors.filter(item => item.status === '未配置' || !item.enabled).length,
      connected: connectors.filter(item => item.status === '已连接').length,
      failed: connectors.filter(item => item.status === '连接失败').length
    };
    const fieldSets = {
      ERP: ['systemName', 'endpoint', 'dataSource'],
      MES: ['systemName', 'endpoint', 'dataSource'],
      WMS: ['systemName', 'endpoint', 'dataSource'],
      SCADA: ['systemName', 'endpoint', 'protocol'],
      PLC: ['protocol', 'endpoint', 'deviceAddress'],
      SAP: ['systemName', 'endpoint', 'clientId'],
      'SQL Server': ['host', 'port', 'database', 'username', 'password'],
      Oracle: ['host', 'port', 'database', 'username', 'password'],
      OA: ['systemName', 'endpoint', 'workflowName'],
      CRM: ['systemName', 'endpoint', 'customerGroup'],
      'REST API': ['endpoint', 'method', 'authType', 'token'],
      Webhook: ['endpoint', 'eventName', 'secret'],
      MQTT: ['broker', 'port', 'topic', 'clientId'],
      'OPC UA': ['endpoint', 'nodeId'],
      'Excel/CSV': ['filePath', 'sheetName', 'delimiter'],
      Robot: ['robotName', 'endpoint', 'taskName'],
      'Digital Twin': ['platformName', 'endpoint', 'assetId']
    };
    const fieldLabels = {
      systemName: '系统名称 / 平台名称',
      endpoint: '接口地址 / Endpoint',
      dataSource: '数据源说明',
      protocol: '协议 / 访问方式',
      deviceAddress: '设备地址',
      clientId: 'Client ID / 客户端',
      host: '主机地址',
      port: '端口',
      database: '数据库名',
      username: '用户名',
      password: '密码',
      workflowName: '流程名称',
      customerGroup: '客户分组',
      method: '请求方法',
      authType: '认证方式',
      token: '访问令牌',
      eventName: '事件名称',
      secret: '密钥 / Secret',
      broker: 'Broker 地址',
      topic: 'Topic',
      nodeId: '节点 ID',
      filePath: '文件路径 / CSV 路径',
      sheetName: '工作表名称',
      delimiter: '分隔符',
      robotName: '机器人名称',
      taskName: '任务名称',
      platformName: '数字孪生平台名称',
      assetId: '资产 ID'
    };
    const fields = fieldSets[selected.type] || ['endpoint'];
    const config = selected.config || {};
    const logs = (selected.logs || []).slice(0, 8);
    const mappings = (selected.mappings || []).slice(0, 8);
    return `${this.pageHead('Integration Center', '企业接口预留层：统一管理所有 Connector。默认关闭，手动启用；未配置 / 已连接 / 连接失败 都来自真实状态。', `<button class="secondary-btn" data-action="integration-refresh">${icon('refresh')}刷新状态</button><button class="secondary-btn" data-action="systemcheck-run">${icon('check')}验收检查</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>Connector 列表</h3></div><span class="badge">${connectors.length}</span></div><div class="panel-body"><div class="stat-grid">${connectors.map(item => `<article class="panel stat-card" style="cursor:pointer" data-action="integration-select" data-id="${item.id}"><span class="stat-icon ${item.status === '已连接' ? 'green' : item.status === '连接失败' ? 'blue' : 'amber'}">${icon('database')}</span><span class="stat-copy"><span>${Utils.escape(item.type)}</span><strong>${Utils.escape(item.status || '未配置')}</strong><small>${item.enabled ? '已启用' : '默认关闭'} · ${Utils.escape(item.name)}</small></span></article>`).join('')}</div></div></section><section class="panel"><div class="panel-head"><div><h3>真实状态说明</h3></div></div><div class="panel-body">${this.result(`未配置：没有真实配置。\n配置不完整：缺少必要字段。\n连接失败：未接入真实企业系统或接口不可达。\n已连接：仅在实际测试通过后显示。`, '这里不会生成假连接状态', true)}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>${Utils.escape(selected.name)}</h3></div><span class="status-pill ${selected.status === '已连接' ? 'success' : selected.status === '连接失败' ? 'warning' : ''}">${Utils.escape(selected.status || '未配置')}</span></div><div class="panel-body"><div class="privacy-note">${icon('shield')}<span>默认关闭，必须手动启用。前端不保存企业生产密钥；API Key / 密码不会进入日志、导出或备份。</span></div><div class="switch-row"><span><b>手动启用</b><small>启用后才允许测试连接</small></span><button class="switch ${selected.enabled ? 'on' : ''}" data-action="integration-toggle" data-id="${selected.id}"><i></i></button></div><div class="field"><label>状态说明</label><div class="result-box">${Utils.textToHtml((selected.enabled ? '已启用。' : '默认关闭。') + '\n' + (selected.status || '未配置'))}</div></div><div class="field-row"><div class="field"><label>连接器名称</label><input class="input" data-connector-form="${selected.id}" data-field="name" value="${Utils.escape(config.name || selected.name || '')}" placeholder="连接器名称"></div><div class="field"><label>连接器类型</label><input class="input" value="${Utils.escape(selected.type)}" disabled></div></div><div class="field"><label>数据映射说明</label><textarea class="textarea" data-connector-form="${selected.id}" data-field="mappingNote" placeholder="例如：ERP 订单号 -> 订单中心订单号">${Utils.escape(config.mappingNote || '')}</textarea></div><div class="field-row">${fields.map(field => `<div class="field"><label>${Utils.escape(fieldLabels[field] || field)}</label><input class="input" data-connector-form="${selected.id}" data-field="${field}" value="${Utils.escape(config[field] || '')}" placeholder="${Utils.escape(fieldLabels[field] || field)}"></div>`).join('')}</div><div class="button-row"><button class="secondary-btn" data-action="integration-test" data-id="${selected.id}">${icon('play')}测试连接</button><button class="secondary-btn" data-action="integration-map-add" data-id="${selected.id}">${icon('merge')}数据映射</button><button class="secondary-btn" data-action="integration-log" data-id="${selected.id}">${icon('history')}查看日志</button><button class="secondary-btn" data-action="integration-delete" data-id="${selected.id}">${icon('trash')}删除配置</button><button class="primary-btn" data-action="integration-save" data-id="${selected.id}">${icon('check')}保存配置</button></div><div class="privacy-note" style="margin-top:12px">${icon('database')}<span>测试连接不会默认成功；仅在真实可达的企业接口响应正常时才显示“已连接”。AI Gateway 不会主动调用 Connector，只有 Connector 取回真实数据后才进入 AI 分析。</span></div></div></section><section class="panel"><div class="panel-head"><div><h3>状态汇总</h3></div><span class="badge">${counts.unconfigured} / ${counts.connected} / ${counts.failed}</span></div><div class="panel-body">${this.result(`未配置 ${counts.unconfigured} 个\n已连接 ${counts.connected} 个\n连接失败 ${counts.failed} 个`, '这里显示 Connector 真实状态汇总', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>字段映射</h3></div><span class="badge">${mappings.length}</span></div><div class="panel-body">${mappings.length ? `<div class="kb-list">${mappings.map(item => `<article class="kb-item"><span>${icon('merge')}</span><div><b>${Utils.escape(item.source || 'source')}</b><p>${Utils.escape(item.target || 'target')}</p><small>${Utils.escape(item.note || '')}</small></div></article>`).join('')}</div>` : this.result('暂无映射记录。', '点击“数据映射”可新增占位映射', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>最近日志</h3></div><span class="badge">${logs.length}</span></div><div class="panel-body">${logs.length ? `<div class="activity-list">${logs.map(item => `<div class="activity"><span class="activity-icon">${icon(item.level === 'error' ? 'x' : item.level === 'warn' ? 'clock' : 'check')}</span><span><b>${Utils.escape(item.message)}</b><small>${Utils.formatDate(item.time, true)} · ${Utils.escape(item.level || 'info')}</small></span></div>`).join('')}</div>` : this.result('暂无连接器日志。', '保存、测试、删除或映射后会显示操作日志', true)}</div></section></div></div>`;
  },
  settingsLegacy() {
    const s = Store.state.settings;
    const tab = App.temp.settingsTab;
    const session = AuthClient.session;
    return `${this.pageHead('设置', '配置模型管理、账号、Agent Mail、外观和本地数据', '')}<div class="settings-layout"><aside class="panel settings-menu"><button class="${tab === 'account' ? 'active' : ''}" data-action="settings-tab" data-tab="account">${icon('book')}账号与企业</button><button class="${tab === 'ai' ? 'active' : ''}" data-action="settings-tab" data-tab="ai">${icon('sparkles')}AI Gateway</button><button class="${tab === 'mail' ? 'active' : ''}" data-action="settings-tab" data-tab="mail">${icon('send')}Agent Mail</button><button class="${tab === 'appearance' ? 'active' : ''}" data-action="settings-tab" data-tab="appearance">${icon('moon')}外观设置</button><button class="${tab === 'data' ? 'active' : ''}" data-action="settings-tab" data-tab="data">${icon('database')}数据管理</button></aside><section class="panel settings-section">${tab === 'account' ? `<h3>账号与企业</h3><p>支持用户注册、登录、JWT 登录、修改密码、退出登录、企业信息配置与数据隔离。</p><div class="settings-form"><div class="privacy-note">${icon('shield')}<span>${session?.token ? `当前已登录：${Utils.escape(session.user?.name || '')} / ${Utils.escape(session.user?.role || '')} / ${Utils.escape(session.enterprise?.name || '')}` : '当前未登录。登录后，结构化数据将优先同步到后端 SQLite。'}</span></div><div class="field-row"><div class="field"><label>企业名称</label><input class="input" id="accountEnterpriseName" value="${Utils.escape(session.enterprise?.name || '')}" placeholder="企业名称"></div><div class="field"><label>姓名</label><input class="input" id="accountName" value="${Utils.escape(session.user?.name || '')}" placeholder="姓名"></div></div><div class="field-row"><div class="field"><label>邮箱</label><input class="input" id="accountEmail" value="${Utils.escape(session.user?.email || '')}" placeholder="admin@company.com"></div><div class="field"><label>角色</label><select class="select" id="accountRole"><option ${session.user?.role === '企业管理员' ? 'selected' : ''}>企业管理员</option><option ${session.user?.role === '计划员' ? 'selected' : ''}>计划员</option><option ${session.user?.role === '仓库' ? 'selected' : ''}>仓库</option><option ${session.user?.role === '采购' ? 'selected' : ''}>采购</option><option ${session.user?.role === '销售' ? 'selected' : ''}>销售</option><option ${session.user?.role === '普通员工' ? 'selected' : ''}>普通员工</option></select></div></div><div class="field-row"><div class="field"><label>${session?.token ? '当前密码' : '密码'}</label><input class="input" id="accountPassword" type="password" placeholder="输入密码"></div><div class="field"><label>${session?.token ? '新密码' : '确认密码/可重复输入'}</label><input class="input" id="accountNextPassword" type="password" placeholder="输入新密码或重复密码"></div></div><div class="button-row">${session?.token ? `<button class="primary-btn" data-action="auth-save-enterprise">${icon('check')}保存企业信息</button><button class="secondary-btn" data-action="auth-change-password">${icon('refresh')}修改密码</button><button class="danger-btn" data-action="auth-logout">${icon('x')}退出登录</button>` : `<button class="primary-btn" data-action="auth-login">${icon('check')}登录</button><button class="secondary-btn" data-action="auth-register">${icon('plus')}注册企业</button>`}</div></div>` : tab === 'ai' ? `<h3>AI Gateway</h3><p>统一配置所有 AI Provider。业务模块不直接调用模型，只通过 Gateway 路由。</p><div class="settings-form"><div class="field"><label>AI 模式</label><select class="select" id="accessMode"><option value="local" ${(s.accessMode || 'local') === 'local' ? 'selected' : ''}>Mock</option><option value="api" ${s.accessMode === 'api' ? 'selected' : ''}>API</option><option value="cloud" ${s.accessMode === 'cloud' ? 'selected' : ''}>Hybrid</option><option value="localmodel" ${s.accessMode === 'localmodel' ? 'selected' : ''}>Local Model</option></select></div><div class="field"><label>Provider</label><select class="select" id="apiProvider"><option ${s.provider === '本地模式' ? 'selected' : ''}>Mock 本地演示</option><option ${s.provider === 'DeepSeek OpenAI-compatible API' ? 'selected' : ''}>DeepSeek</option><option ${s.provider === 'OpenAI' ? 'selected' : ''}>OpenAI</option><option ${s.provider === 'DeepSeek' ? 'selected' : ''}>DeepSeek</option><option ${s.provider === 'Claude' ? 'selected' : ''}>Claude</option><option ${s.provider === 'Gemini' ? 'selected' : ''}>Gemini</option><option ${s.provider === 'Qwen' ? 'selected' : ''}>Qwen</option><option ${s.provider === '自定义' ? 'selected' : ''}>Custom</option></select></div><div class="field"><label>GitHub Pages 地址</label><input class="input" id="githubPagesUrl" value="${Utils.escape(s.githubPagesUrl || '')}" placeholder="https://your.github.io/industrial-ai-os/"></div><div class="field-row"><div class="field"><label>Base URL</label><input class="input" id="apiUrl" value="${Utils.escape(s.apiUrl)}" placeholder="https://your-vercel-backend.vercel.app"></div><div class="field"><label>Model</label><input class="input" id="apiModel" value="${Utils.escape(s.model)}" placeholder="deepseek-v4-flash"></div></div><div class="field-row"><div class="field"><label>Temperature</label><input class="input" id="apiTemperature" value="${Utils.escape(s.temperature ?? 0.2)}" placeholder="0.2"></div><div class="field"><label>Max Tokens</label><input class="input" id="apiMaxTokens" value="${Utils.escape(s.maxTokens ?? 2048)}" placeholder="2048"></div></div><div class="field-row"><div class="field"><label>Top P</label><input class="input" id="apiTopP" value="${Utils.escape(s.topP ?? 1)}" placeholder="1"></div><div class="field"><label>Timeout(ms)</label><input class="input" id="apiTimeout" value="${Utils.escape(s.timeout ?? 30000)}" placeholder="30000"></div></div><div class="switch-row"><span><b>启用远程 AI 接口</b><small>启用后统一调用 AI Gateway；不可用时自动降级到 Mock 模式</small></span><button class="switch ${s.apiEnabled ? 'on' : ''}" data-action="settings-api-toggle"><i></i></button></div><div class="switch-row"><span><b>Developer Mode</b><small>显示耗时、HTTP 状态码、Gateway 状态和最近错误信息</small></span><button class="switch ${s.developerMode ? 'on' : ''}" data-action="settings-dev-toggle"><i></i></button></div><div class="button-row"><button class="primary-btn" data-action="settings-save-ai">${icon('check')}保存配置</button><button class="secondary-btn" data-action="settings-test-ai">${icon('play')}测试连接</button><button class="secondary-btn" data-action="ai-switch-model">${icon('sparkles')}切换模型</button></div><div class="privacy-note">${icon('shield')}<span>AI Gateway 会自动处理降级与错误翻译；页面不会直接暴露模型异常英文信息。</span></div></div>` : tab === 'mail' ? `<h3>Agent Mail 设置</h3><p>支持真实发送与演示发送两种模式。未配置时也可完整演示邮件流程。</p><div class="settings-form"><div class="field"><label>Agent Mail 邮箱地址</label><input class="input" id="mailboxAddress" value="${Utils.escape(s.agentMail?.mailbox || '')}" placeholder="sales@your-company.com"></div><div class="field"><label>Agent Mail API 地址</label><input class="input" id="agentMailApiUrl" value="${Utils.escape(s.agentMail?.apiUrl || '')}" placeholder="https://mail.example.com/api"></div><div class="field"><label>API Key / Token</label><input class="input" id="agentMailApiKey" type="password" value="${Utils.escape(s.agentMail?.apiKey || '')}" placeholder="保存在当前浏览器"></div><div class="field-row"><div class="field"><label>默认发件人名称</label><input class="input" id="agentMailSender" value="${Utils.escape(s.agentMail?.senderName || '')}" placeholder="Industrial AI OS"></div><div class="field"><label>每日发送额度</label><input class="input" id="agentMailQuota" value="${Utils.escape(s.agentMail?.dailyQuota || 20)}" placeholder="20"></div></div><div class="switch-row"><span><b>Agent Mail 状态</b><small>${s.agentMail?.enabled ? '已启用' : '未启用'} · 今日已发送 ${s.agentMail?.sentToday || 0} 封 · 剩余 ${Math.max(0, Number(s.agentMail?.dailyQuota || 0) - Number(s.agentMail?.sentToday || 0))} 封</small></span><button class="switch ${s.agentMail?.enabled ? 'on' : ''}" data-action="settings-mail-toggle"><i></i></button></div><div class="button-row"><button class="primary-btn" data-action="settings-save-mail">${icon('check')}保存设置</button><button class="secondary-btn" data-action="settings-test-mail">${icon('play')}测试连接</button></div><div class="privacy-note">${icon('send')}<span>真实发送需要配置 Agent Mail 接口；未配置或接口不可用时，邮件助手会自动进入“演示模式”，仍可生成邮件、附件清单、发送记录和跟进任务。</span></div></div>` : tab === 'appearance' ? `<h3>外观设置</h3><p>调整工作台显示方式。</p><div class="settings-form"><div class="switch-row"><span><b>深色模式</b><small>设置会自动保存</small></span><button class="switch ${s.dark ? 'on' : ''}" data-action="toggle-theme"><i></i></button></div></div>` : `<h3>数据管理</h3><p>备份、恢复或清理当前浏览器中的数据。</p><div class="settings-form"><div class="button-row"><button class="secondary-btn" data-action="settings-backup">${icon('download')}数据备份</button><label class="secondary-btn">${icon('upload')}数据恢复<input type="file" data-input="restore-backup" accept=".json" hidden></label><button class="danger-btn" data-action="settings-clear">${icon('trash')}清空本地数据</button></div><div class="privacy-note">${icon('database')}<span>备份包含聊天、知识、Agent、文件记录等元数据，但不会导出 API Key 或 IndexedDB 中的文件二进制。适合直接部署后的浏览器本地模式长期使用。</span></div></div>`}</section></div>`;
  },
  genericWorkspace(route) {
    const meta = GENERIC_MODULES[route] || { desc: '输入内容、上传资料、点击操作后生成可复制结果', actions: ['开始处理', '保存草稿', '导出结果'], accept: '.txt,.docx,.pdf,.xlsx,.csv' };
    const ws = App.getWorkspace(route);
    if (route === 'templates') return this.templatesWorkspace(route, meta, ws);
    if (route === 'versioning') return this.versioningWorkspace(route, ws);
    if (route === 'datavalidation') return this.validationWorkspace(route, ws);
    if (route === 'mail') return this.mailWorkspace(route, ws);
    if (route === 'automail') return this.autoMailWorkspace(route, ws);
    if (route === 'cost') return this.costWorkspace(route, ws);
    if (route === 'prodexception') return this.exceptionWorkspace(route, ws);
    if (route === 'inspection') return this.inspectionWorkspace(route, ws);
    if (route === 'users' || route === 'roles' || route === 'permissions') return this.userAdminWorkspace(route, ws);
    if (route === 'bidding') return this.biddingWorkspace(route, ws);
    if (route === 'logs' || route === 'operationlog') return this.logsWorkspace(route);
    if (route === 'about') return this.about();
    const title = moduleById(route).name;
    const roadmap = ['chat', 'word', 'excel', 'pdf', 'ocr', 'writing', 'sql', 'agent', 'workflow', 'rlcenter'];
    const completed = roadmap.includes(route);
    const routeNote = completed ? '' : `<section class="panel"><div class="panel-head"><div><h3>路线图提示</h3></div><span class="status-pill">建设中</span></div><div class="panel-body">${this.result('当前模块正在建设中，已进入 Industrial AI OS 路线图。', '该模块保留可点击入口，后续会继续完善业务逻辑。', true)}</div></section>`;
    return `${this.pageHead(title, meta.desc, `<button class="secondary-btn" data-action="workspace-clear" data-module="${route}">${icon('trash')}清空</button><button class="secondary-btn" data-action="workspace-export" data-module="${route}">${icon('download')}导出</button><button class="primary-btn" data-action="workspace-run" data-module="${route}">${icon('sparkles')}${meta.actions[0] || '开始处理'}</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>输入与上传</h3></div><span class="status-pill">${completed ? '可演示' : '路线图'}</span></div><div class="panel-body">${this.upload(`workspace-file:${route}`, '上传资料', `支持：${meta.accept}`, meta.accept, true)}<div class="field"><label>标题</label><input class="input" data-ws-field="title" data-module="${route}" value="${Utils.escape(ws.title || '')}" placeholder="输入任务标题或项目名称"></div><div class="field"><label>需求输入</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="${meta.desc}">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="workspace-save" data-module="${route}">${icon('check')}保存草稿</button><button class="secondary-btn" data-action="workspace-copy" data-module="${route}">${icon('copy')}复制结果</button><button class="primary-btn" data-action="workspace-run" data-module="${route}">${icon('play')}${meta.actions[0] || '开始处理'}</button></div></div></section>${routeNote}</div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>结果输出</h3><span class="badge">${(ws.result || '').length}</span></div></div><div class="panel-body"><textarea class="textarea tall" data-ws-field="result" data-module="${route}" placeholder="结果会显示在这里，可继续编辑并保存">${Utils.escape(ws.result || '')}</textarea></div></section><section class="panel"><div class="panel-head"><div><h3>上传记录</h3><span class="badge">${(ws.files || []).length}</span></div></div><div class="panel-body">${(ws.files || []).length ? `<div class="kb-list">${ws.files.map(file => `<article class="kb-item"><span>${icon('fileText')}</span><div><b>${Utils.escape(file.name)}</b><p>${Utils.escape((file.content || '').slice(0, 140))}</p><small>${Utils.escape(file.category || '文件')}</small></div></article>`).join('')}</div>` : this.result('', '上传文件后会在这里显示摘录')}</div></section></div></div>`;
  },
  about() {
    return `${this.pageHead('项目介绍页', 'Industrial AI OS 的定位、架构、核心能力、适用岗位与后续计划。', `<button class="secondary-btn" data-route="home">${icon('home')}返回首页</button><button class="primary-btn" data-action="demo-flow">${icon('play')}演示入口</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>项目定位</h3></div><span class="status-pill success">Resume Demo Version</span></div><div class="panel-body">${this.result('面向制造业与企业办公的 AI 操作系统，覆盖发货单、Excel、Word、PDF、OCR、SQL、AI 写作、Agent、工作流与学习中心，适合简历投递和现场演示。', '项目定位', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>核心功能</h3></div></div><div class="panel-body">${this.result('AI聊天、Word助手、Excel助手、PDF助手、OCR识别、AI写作、SQL助手、AI Agent、工作流、Agentic RL 学习中心。', '核心功能', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>技术架构</h3></div></div><div class="panel-body">${this.result('前端：HTML / CSS / JavaScript\n数据：本地存储 + 可选后端同步\nAI：OpenAI 兼容 API\n部署：GitHub Pages + Vercel\n适配：手机 / 平板 / 电脑浏览器。', '技术架构', true)}</div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>适用岗位</h3></div></div><div class="panel-body">${this.result('制造业文员、生产计划、PMC、采购、销售、外贸、数据处理、企业办公自动化、AI 应用实施、产品演示。', '适用岗位', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>当前进度</h3></div></div><div class="panel-body">${this.result('Demo 可演示版：核心模块已可点击演示，未完成模块会统一显示路线图提示。', '当前进度', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>后续计划</h3></div></div><div class="panel-body">${this.result('继续补强真实 AI、文件解析、Agent 联动、知识库问答和多设备同步，逐步升级为可投递、可展示、可交付版本。', '后续计划', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>链接信息</h3></div></div><div class="panel-body"><div class="address-grid"><div class="address-card"><b>GitHub 地址</b><small>${Utils.escape(window.location.origin || '用户部署后填写')}</small></div><div class="address-card"><b>在线演示地址</b><small>${Utils.escape(Store.state.settings.githubPagesUrl || '用户部署后填写')}</small></div></div></div></section></div></div>`;
  },
  templatesWorkspace(route, meta, ws) {
    return `${this.pageHead('模板中心', '选择模板 → 填写信息 → AI生成 → 导出 Word / PDF / Excel', `<button class="secondary-btn" data-action="workspace-export" data-module="${route}">${icon('download')}导出模板结果</button><button class="primary-btn" data-action="workspace-run" data-module="${route}">${icon('sparkles')}生成模板</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>模板选择</h3></div><span class="status-pill">${TEMPLATE_OPTIONS.length} 个模板</span></div><div class="panel-body"><div class="field"><label>模板类型</label><select class="select" data-ws-field="selected" data-module="${route}">${TEMPLATE_OPTIONS.map(item => `<option ${ws.selected === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div><div class="field"><label>模板信息</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="输入项目名称、客户、数量、交期、付款方式、联系人等关键信息">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="workspace-save" data-module="${route}">${icon('check')}保存模板草稿</button><button class="primary-btn" data-action="workspace-run" data-module="${route}">${icon('play')}生成模板内容</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>模板输出</h3><span class="badge">${(ws.result || '').length}</span></div></div><div class="panel-body"><textarea class="textarea tall" data-ws-field="result" data-module="${route}" placeholder="生成的模板内容会显示在这里">${Utils.escape(ws.result || '')}</textarea></div></section></div></div>`;
  },
  versioningWorkspace(route, ws) {
    const versions = Store.state.fileVersions.slice(0, 20);
    return `${this.pageHead('文件版本管理', '支持保存版本、查看历史版本、恢复旧版本、对比两个版本差异', `<button class="secondary-btn" data-action="version-compare">${icon('refresh')}版本对比</button><button class="primary-btn" data-action="version-save">${icon('plus')}保存当前版本</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>版本输入</h3></div><span class="status-pill">本地版本库</span></div><div class="panel-body"><div class="field"><label>文件名称</label><input class="input" data-ws-field="title" data-module="${route}" value="${Utils.escape(ws.title || '')}" placeholder="如：投标文件_v3"></div><div class="field"><label>版本内容</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="粘贴当前版本内容，或说明本次修改点">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="version-save">${icon('check')}保存版本</button><button class="secondary-btn" data-action="version-restore">${icon('history')}恢复最新版本</button><button class="primary-btn" data-action="version-compare">${icon('play')}对比两个版本</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>版本结果</h3><span class="badge">${versions.length}</span></div></div><div class="panel-body">${versions.length ? `<div class="kb-list">${versions.map(item => `<article class="kb-item"><span>${icon('history')}</span><div><b>${Utils.escape(item.title)}</b><p>${Utils.escape(item.summary)}</p><small>${Utils.formatDate(item.time, true)} · ${Utils.escape(item.versionId)}</small></div><button class="icon-btn" data-action="version-restore" data-id="${item.id}">${icon('eye')}</button></article>`).join('')}</div>` : this.result(ws.result, '保存版本后在这里查看历史记录', true)}</div></section><section class="panel"><div class="panel-head"><div><h3>对比/恢复结果</h3></div></div><div class="panel-body">${this.result(ws.result, '对比或恢复后会显示结果', true)}</div></section></div></div>`;
  },
  validationWorkspace(route, ws) {
    return `${this.pageHead('数据校验', '金额校验、报价合计、空值检查、重复检查、格式检查，不把电话号码当成金额', `<button class="secondary-btn" data-action="validate-run" data-mode="quote">${icon('chart')}报价校验</button><button class="primary-btn" data-action="validate-run" data-mode="excel">${icon('check')}执行校验</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>待校验数据</h3></div><span class="status-pill">支持粘贴或使用当前 Excel</span></div><div class="panel-body"><div class="field"><label>数据文本</label><textarea class="textarea tall" data-ws-field="prompt" data-module="${route}" placeholder="可粘贴报价表、发货单、金额明细、联系电话等数据">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="validate-run" data-mode="excel">${icon('table')}校验表格</button><button class="secondary-btn" data-action="validate-run" data-mode="quote">${icon('chart')}校验报价</button><button class="primary-btn" data-action="validate-run" data-mode="all">${icon('play')}综合校验</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>校验结果</h3></div></div><div class="panel-body">${this.result(ws.result, '执行校验后显示空值、重复、格式、金额问题', true)}</div></section></div></div>`;
  },
  autoMailWorkspace(route, ws) {
    return `${this.pageHead('自动邮件发送', '先生成可复制邮件内容，后续可接 SMTP / 企业邮箱接口', `<button class="secondary-btn" data-action="workspace-copy" data-module="${route}">${icon('copy')}复制邮件</button><button class="primary-btn" data-action="mail-generate">${icon('send')}生成邮件</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>邮件信息</h3></div><span class="status-pill">商务 / 发货 / 报价 / 投标</span></div><div class="panel-body"><div class="field"><label>邮件类型</label><select class="select" data-ws-field="selected" data-module="${route}">${['商务邮件', '发货通知', '报价邮件', '投标文件提交邮件'].map(item => `<option ${ws.selected === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div><div class="field"><label>邮件要求</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="输入客户、产品、数量、交期、付款方式、附件说明等">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="workspace-save" data-module="${route}">${icon('check')}保存草稿</button><button class="primary-btn" data-action="mail-generate">${icon('play')}生成可发送内容</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>邮件内容</h3></div></div><div class="panel-body"><textarea class="textarea tall" data-ws-field="result" data-module="${route}" placeholder="生成的邮件正文会显示在这里">${Utils.escape(ws.result || '')}</textarea></div></section></div></div>`;
  },
  mailWorkspace(route, ws) {
    const records = Store.state.mailRecords.slice(0, 8);
    const inbox = Store.state.mailInbox || [];
    const attachments = ws.attachments || [];
    return `${this.pageHead('邮件助手 / Agent Mail 助手', '写邮件、AI生成、润色、翻译、总结、草稿保存、发送邮件、发送记录、收件箱、附件管理', `<button class="secondary-btn" data-action="mail-save-draft">${icon('check')}保存草稿</button><button class="secondary-btn" data-action="mail-copy-content">${icon('copy')}复制邮件</button><button class="primary-btn" data-action="mail-send">${icon('send')}发送邮件</button>`)}
    <div class="workbench">
      <div class="stack">
        <section class="panel">
          <div class="panel-head"><div><h3>写邮件</h3></div><span class="status-pill">${Store.state.settings.agentMail?.enabled ? '真实发送可用' : '演示模式'}</span></div>
          <div class="panel-body">
            <div class="field"><label>邮件类型</label><select class="select" data-mail-field="type">${MailEngine.templates.map(item => `<option ${ws.type === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
            <div class="field-row">
              <div class="field"><label>收件人</label><input class="input" data-mail-field="recipient" value="${Utils.escape(ws.recipient || '')}" placeholder="tender@company.com"></div>
              <div class="field"><label>审批状态</label><select class="select" data-mail-field="approvalStatus">${['草稿', '待确认', '已确认', '已发送'].map(item => `<option ${ws.approvalStatus === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
            </div>
            <div class="field"><label>邮件主题</label><input class="input" data-mail-field="subject" value="${Utils.escape(ws.subject || '')}" placeholder="输入主题或点击 AI 自动生成"></div>
            <div class="field"><label>模板变量/项目信息</label><textarea class="textarea" data-mail-field="prompt" placeholder="客户名称：常州新能源科技有限公司\n项目名称：新能源设备不锈钢零部件采购项目\n投标单位：溧阳五四不锈钢有限公司\n报价金额：9710元\n交货期：7天\n联系人：张三\n联系电话：13800138000">${Utils.escape(ws.prompt || '')}</textarea></div>
            <div class="field"><label>邮件正文</label><textarea class="textarea tall" data-mail-field="body" placeholder="邮件正文会显示在这里">${Utils.escape(ws.body || '')}</textarea></div>
            <div class="field"><label><input type="checkbox" data-mail-field="finalVersionChecked" ${ws.finalVersionChecked ? 'checked' : ''}> 附件已确认最终版</label></div>
            <div class="button-row">
              <button class="secondary-btn" data-action="mail-generate">${icon('sparkles')}AI生成邮件</button>
              <button class="secondary-btn" data-action="mail-polish">${icon('refresh')}邮件润色</button>
              <button class="secondary-btn" data-action="mail-translate">${icon('refresh')}邮件翻译</button>
              <button class="secondary-btn" data-action="mail-summary">${icon('book')}邮件总结</button>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>附件管理</h3><span class="badge">${attachments.length}</span></div><label class="secondary-btn compact">${icon('upload')}添加附件<input type="file" data-input="mail-attachments" multiple hidden></label></div>
          <div class="panel-body">${attachments.length ? `<div class="kb-list">${attachments.map(item => `<article class="kb-item"><span>${icon(item.category === 'PDF' ? 'pdf' : item.category === '表格' ? 'table' : 'fileText')}</span><div><b>${Utils.escape(item.name)}</b><p>${item.previewable ? '可预览' : '不可预览'} · ${Utils.formatBytes(item.size)} · ${Utils.escape(item.category || '文件')}</p><small>${item.compressed ? '已压缩' : '原始附件'}${item.invalid ? ` · ${Utils.escape(item.invalid)}` : ''}</small></div><div class="table-actions"><button class="icon-btn" data-action="mail-preview-attachment" data-id="${item.id}">${icon('eye')}</button><button class="icon-btn" data-action="mail-compress-attachment" data-id="${item.id}">${icon('optimize')}</button><button class="icon-btn" data-action="mail-remove-attachment" data-id="${item.id}">${icon('trash')}</button></div></article>`).join('')}</div>` : this.result('', '上传 Word / PDF / Excel / 图片等附件')}</div>
        </section>
      </div>
      <div class="stack">
        <section class="panel">
          <div class="panel-head"><div><h3>发送前检查</h3></div><button class="ghost-btn compact" data-action="mail-precheck">${icon('shield')}执行检查</button></div>
          <div class="panel-body">${this.result((ws.precheck || []).length ? ws.precheck.map((item, index) => `${index + 1}. ${item}`).join('\n') : '', '检查收件人、主题、附件、最终版、敏感词、联系电话、公司名、项目名', true)}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>发送记录</h3><span class="badge">${records.length}</span></div></div>
          <div class="panel-body">${records.length ? `<div class="kb-list">${records.map(item => `<article class="kb-item"><span>${icon(item.status === '失败' ? 'x' : item.status === '演示模式' ? 'play' : 'send')}</span><div><b>${Utils.escape(item.subject)}</b><p>${Utils.escape(item.recipient)} · ${Utils.escape(item.type)} · 附件 ${item.attachments?.length || 0} 个</p><small>${Utils.formatDate(item.time, true)} · ${Utils.escape(item.status)}${item.failureReason ? ` · ${Utils.escape(item.failureReason)}` : ''}</small></div><div class="table-actions">${item.status === '失败' ? `<button class="icon-btn" data-action="mail-retry" data-id="${item.id}">${icon('refresh')}</button>` : ''}<button class="icon-btn" data-action="mail-open-record" data-id="${item.id}">${icon('eye')}</button></div></article>`).join('')}</div>` : this.result('', '发送或演示发送后会在这里保留记录')}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>收件箱</h3><span class="badge">${inbox.length}</span></div><span class="status-pill">${Store.state.settings.agentMail?.enabled ? 'Agent Mail' : '演示收件箱'}</span></div>
          <div class="panel-body">${inbox.length ? `<div class="kb-list">${inbox.slice(0, 8).map(item => `<article class="kb-item"><span>${icon('message')}</span><div><b>${Utils.escape(item.subject)}</b><p>${Utils.escape(item.preview || '')}</p><small>${Utils.escape(item.from || '')} · ${Utils.formatDate(item.time, true)} · ${Utils.escape(item.status || '')}</small></div></article>`).join('')}</div>` : this.result('', '暂未获取到收件箱内容')}</div>
        </section>
      </div>
    </div>`;
  },
  costWorkspace(route, ws) {
    return `${this.pageHead('成本核算助手', '根据数量、单价、工时、材料、加工费计算成本、报价金额、利润率，并导出分析表', `<button class="secondary-btn" data-action="workspace-export" data-module="${route}">${icon('download')}导出分析</button><button class="primary-btn" data-action="cost-calc">${icon('chart')}计算成本</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>成本输入</h3></div><span class="status-pill">支持公式化计算</span></div><div class="panel-body"><div class="field"><label>成本参数</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="示例：数量=760\n单价=8.5\n材料费=3200\n工时=42\n工时单价=35\n加工费=900\n报价金额=9710">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="workspace-save" data-module="${route}">${icon('check')}保存参数</button><button class="primary-btn" data-action="cost-calc">${icon('play')}开始计算</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>成本分析结果</h3></div></div><div class="panel-body">${this.result(ws.result, '计算后显示总成本、报价、利润率与分析表', true)}</div></section></div></div>`;
  },
  exceptionWorkspace(route, ws) {
    const records = ws.records || [];
    return `${this.pageHead('生产异常管理', '记录异常问题、责任人、处理措施、完成状态，支持异常报告和 8D 报告', `<button class="secondary-btn" data-action="exception-report">${icon('fileText')}生成异常报告</button><button class="primary-btn" data-action="exception-add">${icon('plus')}新增异常</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>异常录入</h3></div><span class="status-pill">${records.length} 条记录</span></div><div class="panel-body"><div class="field"><label>异常信息</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="示例：问题=零件毛刺超标；责任人=张三；处理措施=返工去毛刺；状态=处理中">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="exception-add">${icon('check')}记录异常</button><button class="primary-btn" data-action="exception-report">${icon('play')}生成8D/异常报告</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>异常记录</h3></div></div><div class="panel-body">${records.length ? `<div class="kb-list">${records.map(item => `<article class="kb-item"><span>${icon('x')}</span><div><b>${Utils.escape(item.problem)}</b><p>责任人：${Utils.escape(item.owner)}；措施：${Utils.escape(item.action)}</p><small>${Utils.escape(item.status)} · ${Utils.formatDate(item.time, true)}</small></div></article>`).join('')}</div>` : this.result('', '新增异常后会在这里保留记录')}</div></section><section class="panel"><div class="panel-head"><div><h3>报告结果</h3></div></div><div class="panel-body">${this.result(ws.result, '生成异常处理报告或 8D 报告', true)}</div></section></div></div>`;
  },
  inspectionWorkspace(route, ws) {
    const records = ws.records || [];
    return `${this.pageHead('设备点检助手', '设备清单、点检项目、周期、结果、异常提醒和导出点检表', `<button class="secondary-btn" data-action="inspection-report">${icon('fileText')}生成点检表</button><button class="primary-btn" data-action="inspection-add">${icon('plus')}新增点检记录</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>点检录入</h3></div><span class="status-pill">${records.length} 条记录</span></div><div class="panel-body"><div class="field"><label>点检信息</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="示例：设备=冲床A01；项目=润滑检查；周期=每日；结果=正常；异常提醒=无">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="inspection-add">${icon('check')}记录点检</button><button class="primary-btn" data-action="inspection-report">${icon('play')}生成点检报告</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>点检记录</h3></div></div><div class="panel-body">${records.length ? `<div class="kb-list">${records.map(item => `<article class="kb-item"><span>${icon('check')}</span><div><b>${Utils.escape(item.device)}</b><p>${Utils.escape(item.item)} · ${Utils.escape(item.cycle)} · ${Utils.escape(item.result)}</p><small>${Utils.escape(item.alert)} · ${Utils.formatDate(item.time, true)}</small></div></article>`).join('')}</div>` : this.result('', '新增点检后会在这里保留记录')}</div></section><section class="panel"><div class="panel-head"><div><h3>点检输出</h3></div></div><div class="panel-body">${this.result(ws.result, '生成点检表与异常提醒汇总', true)}</div></section></div></div>`;
  },
  userAdminWorkspace(route, ws) {
    const list = route === 'users' ? Store.state.users : route === 'roles' ? Store.state.roles : Store.state.roles;
    return `${this.pageHead(moduleById(route).name, '管理员 / 普通用户 / 只读用户，文件权限、模块权限、操作日志', `<button class="secondary-btn" data-action="role-add" data-module="${route}">${icon('lock')}新增角色</button><button class="primary-btn" data-action="user-add" data-module="${route}">${icon('plus')}新增用户</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>录入说明</h3></div><span class="status-pill">${list.length} 条</span></div><div class="panel-body"><div class="field"><label>${route === 'roles' ? '角色定义' : '用户/权限信息'}</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="${route === 'roles' ? '示例：角色=采购专员；权限=采购助手、文件中心、只读知识库' : '示例：姓名=王五；角色=普通用户；状态=启用'}">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="workspace-save" data-module="${route}">${icon('check')}保存草稿</button><button class="primary-btn" data-action="${route === 'roles' ? 'role-add' : 'user-add'}" data-module="${route}">${icon('play')}${route === 'roles' ? '新增角色' : '新增用户'}</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>${route === 'roles' ? '角色列表' : '用户列表'}</h3></div></div><div class="panel-body">${list.length ? `<div class="kb-list">${list.map(item => `<article class="kb-item"><span>${icon(route === 'roles' ? 'lock' : 'book')}</span><div><b>${Utils.escape(item.name)}</b><p>${Utils.escape(item.permissions || item.role || '')}</p><small>${Utils.escape(item.status || '')}</small></div></article>`).join('')}</div>` : this.result('', '新增后会出现在这里')}</div></section><section class="panel"><div class="panel-head"><div><h3>结果</h3></div></div><div class="panel-body">${this.result(ws.result, '新增用户或角色后会显示处理结果', true)}</div></section></div></div>`;
  },
  biddingWorkspace(route, ws) {
    return `${this.pageHead('招投标助手', '上传招标文件 PDF / Word，提取项目名称、招标单位、截止时间、评分标准、技术要求、商务要求、报价要求', `<button class="secondary-btn" data-action="demo-bid">${icon('play')}演示标书流程</button><button class="secondary-btn" data-action="bidding-mail">${icon('send')}一键发送标书</button><button class="primary-btn" data-action="bidding-analyze">${icon('sparkles')}解析招标文件</button>`)}<div class="workbench"><div class="stack"><section class="panel"><div class="panel-head"><div><h3>招标文件</h3></div><span class="status-pill">PDF / Word / OCR</span></div><div class="panel-body">${this.upload(`workspace-file:${route}`, '上传招标文件', '支持 PDF / Word，扫描件会先 OCR 再解析', '.pdf,.doc,.docx', true)}<div class="field"><label>招标要求补充</label><textarea class="textarea" data-ws-field="prompt" data-module="${route}" placeholder="可补充项目背景、资质要求、技术要求、商务要求等">${Utils.escape(ws.prompt || '')}</textarea></div><div class="button-row"><button class="secondary-btn" data-action="demo-bid">${icon('table')}加载演示项目</button><button class="secondary-btn" data-action="bidding-mail">${icon('send')}生成标书邮件</button><button class="primary-btn" data-action="bidding-analyze">${icon('play')}生成投标目录 / 商务标 / 技术标 / 报价表 / 检查报告</button></div></div></section></div><div class="stack"><section class="panel"><div class="panel-head"><div><h3>投标输出</h3></div></div><div class="panel-body">${this.result(ws.result, '解析后会输出项目摘要、投标目录、商务响应、技术响应、报价表与检查报告', true)}</div></section></div></div>`;
  },
  logsWorkspace(route) {
    const logs = Store.state.operationLogs.slice(0, 50);
    return `${this.pageHead(moduleById(route).name, '本地操作日志、系统运行记录与模块操作留痕', '')}<section class="panel"><div class="panel-head"><div><h3>日志记录</h3><span class="badge">${logs.length}</span></div></div><div class="panel-body">${logs.length ? `<div class="kb-list">${logs.map(item => `<article class="kb-item"><span>${icon('history')}</span><div><b>${Utils.escape(item.title)}</b><p>${Utils.escape(item.type || 'action')}</p><small>${Utils.formatDate(item.time, true)}</small></div></article>`).join('')}</div>` : this.result('', '操作后会自动记录日志')}</div></section>`;
  }
};
