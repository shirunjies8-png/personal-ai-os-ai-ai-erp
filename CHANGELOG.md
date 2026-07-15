## 2026-07-08 — OCR 乱码后的结构化字段保护

### Added

- OCR 质量判断：good / medium / poor
- OCR 字段过滤与乱码保护，避免乱码原文直接进入关键业务字段
- OCR 可编辑字段表
- OCR 人工确认后保存，并写入 `personal-ai-os-ocr-confirmed-fields`
- 原始 OCR 与人工确认字段分开导出

### Changed

- OCR 页面结构从“原文 + 拆表”升级为“可信字段表 + 原始拆行结果”
- 加载示例时可直接展示演示字段，不再依赖低质量 OCR 原文

### Notes

- 当前仍为本地演示版 / Mock AI，未接真实 AI
- 本轮未修改成本核算助手、AI Chat、Skill 模板、Error Center / Bug Monitor 与真实 AI 接入

## 2026-07-08 — Resume Demo 最终收口

### Added

- 版本冻结说明，明确当前版本名称为 `Industrial AI OS · Resume Demo Version`
- 面向简历、面试、作品集展示的版本定位说明
- 核心模块说明：AI Chat、OCR、成本核算助手、Skill 模板、Error Center / Bug Monitor
- 推荐演示路线，便于演示时按步骤串联
- 简历可用项目描述与 GitHub Pages 展示链接

### Notes

- 当前版本保持本地演示版 / Mock AI / 未接入真实 AI 的诚实口径
- 所有数据仍以浏览器 localStorage 保存为主
- 本轮未修改 AI Chat、OCR、成本核算助手、Skill 模板、Error Center / Bug Monitor 的核心业务逻辑

## 2026-07-07 — 成本核算助手收口

### Changed

- `ui.js`
  - 将成本核算助手改造成结构化报价页面，增加产品信息、材料信息、加工/人工/其他成本、利润设置和结果卡片。
  - 新增“一键填充示例”“清空数据”“导出报价单”按钮。
- `app.js`
  - 新增本地成本核算引擎，支持材料成本、加工成本、人工成本、其他成本、总成本、建议利润、建议报价、单件报价、最低可接受报价和风险提示。
  - 新增成本示例填充、清空、打印导出逻辑。
  - 成本输入继续保存在本地工作区，刷新后可回显。

### Verified

- `node --check app.js core.js ui.js server.js`
- `node --check skills.js`
- `node --check step5-final-polish.js`
- `npm run build`
- 浏览器验证示例填充 / 清空 / 打印导出链路可用，计算结果正确

### Notes

- 本轮未修改 STEP 5、Error Center / Bug Monitor、AI Chat、OCR、Skill 模板和真实 AI 接入。
- 当前成本核算助手为本地纯前端计算演示版，面向制造业快速报价场景。

## 2026-07-07 — Skill 模板 / 工厂场景模板

### Changed

- `skills.js`
  - 扩展为制造业常用工作模板库，新增 21 个本地模板。
  - 模板字段统一包含：模板名称、使用场景、适合岗位、输入字段、输出格式、示例内容、使用建议。
  - 保留浏览器兼容导出方式，继续支持 `window.AISkills` 与 `module.exports`。
- `ui.js`
  - 新增 `#/skills` 技能模板页。
  - 支持分类筛选、搜索、查看模板详情、一键复制和模板预览。
  - 首页新增 Skill 模板入口卡片。
- `app.js`
  - 新增 Skill 模板页的本地状态保存，包括最近使用、最近复制、当前分类、搜索关键词和预览内容。
  - 新增模板复制、使用、筛选和重置动作。

### Verified

- `node --check app.js core.js ui.js server.js`
- `node --check skills.js`
- `node --check step5-final-polish.js`
- `npm run build`
- 浏览器验证 `#/skills` 可用，筛选 / 搜索 / 复制 / 预览链路正常

### Notes

- 本轮未修改 STEP 5、Error Center / Bug Monitor、OCR、AI Chat、成本核算助手和真实 AI 接入。
- 当前 Skill 模板模块为本地模板演示版，后续可再接真实 AI。

## 2026-07-07 — STEP 5 最终验收（Error Center / Bug Monitor）

### 增强

- 监控页新增“运行错误中心自检”按钮。
- 自检可模拟并验证：
  - 错误聚合
  - 查看详情
  - 忽略
  - 恢复
  - 确认修复
  - 健康统计
  - 新增 JS 错误检测
- 自检结果以页面卡片展示，不混入真实错误列表。

### 验证

- `node --check app.js core.js ui.js server.js`：通过
- `node --check skills.js`：通过
- `node --check step5-final-polish.js`：通过
- `npm run build`：通过

### 说明

- 本轮未修改 AI Chat、OCR、成本核算助手、Skill 模板、真实 AI 接入
- 本轮仅用于 STEP 5 最终验收收口

## 2026-07-07 — STEP 5 Error Center / Bug Monitor 收口

### 修复

- 将错误生命周期收口为 `active / ignored / resolved` 三态。
- 同类错误继续按 signature 聚合，不再重复刷屏。
- Bug Monitor 现在支持：
  - 查看详情
  - 忽略
  - 确认修复
  - 恢复忽略项
- 系统监控健康状态仅统计 active 错误；ignored / resolved 不再计入当前异常。
- Error Center 增加错误总数 / Active / Ignored / Resolved 汇总。

### 验证

- `node --check app.js core.js ui.js server.js`：通过
- `node --check skills.js`：通过
- `node --check step5-final-polish.js`：通过
- `npm run build`：通过

### 说明

- 本轮未修改 AI Chat、OCR、成本核算助手、Skill 模板、真实 AI 接入逻辑
- 本轮仅收口 Error Center / Bug Monitor 的展示与生命周期

## 2026-07-07 — OCR 结构化字段提取收口

### 修复

- OCR 结构化结果从“拆行乱码”升级为“字段识别表 + 原始拆行结果”双块展示。
- 优先从 AI 修复结果提取固定业务字段；若 AI 修复结果为空，则回退原始 OCR 文本。
- 支持字段：
  - 单据类型、企业名称、单据编号、客户名称、产品名称、产品编码、材料、规格型号、数量、单位、交货日期、电话、地址、网址、备注、可信度、缺失字段
- 缺失字段统一显示 `待补充`，不编造数量、材料、客户等关键信息。

### 验证

- 浏览器实测 OCR 页面可显示字段识别表
- `识别字段表` 与 `原始 OCR 拆行结果` 已分区展示
- `node --check app.js core.js ui.js server.js`：通过
- `node --check skills.js`：通过
- `node --check step5-final-polish.js`：通过
- `npm run build`：通过

### 说明

- 本轮仅修 OCR 结构化字段提取
- 未修改 STEP 5、Error Center / Bug Monitor、AI Chat、成本核算助手、Skill 模板、真实 AI 接入和 OCR 引擎 CSP

## 2026-07-07 — OCR AI 修复结果为空修复

### 修复

- 修复 OCR 页面“AI 自动纠错”在原文存在时仍显示 `0` 的问题。
- 纠错结果改为优先读取 `GlobalSystemState.ocrResult.text`，并在必要时回收本地 OCR 原文作为安全兜底，避免空结果。
- Mock 纠错结果改为基于原文的保守修复，不再返回空字符串。
- 导出 AI 修复 TXT / Word / Excel 继续使用修复后的内容。

### 验证

- 浏览器实测：OCR 原文存在时，AI 修复结果字数显示为非 0，且内容可见。
- `node --check app.js core.js ui.js server.js`：通过
- `node --check skills.js`：通过
- `node --check step5-final-polish.js`：通过
- `npm run build`：通过

### 说明

- 本轮仅修 OCR 自动纠错链路。
- 未修改 STEP 5、Error Center / Bug Monitor、AI Chat、成本核算助手、Skill 模板和真实 AI 接入。

## 2026-07-03 — AI Chat 底部裁切与 Bug 监测收口

### 修复

- 修复 AI Chat 页面底部 composer 在窄视口/手机端被底部导航与浮层遮挡的问题。
- 增加 chat 消息区的动态底部预留与二次滚动收口，避免长回复最后几行被盖住。
- Bug 监测浮层在 Chat 页面自动隐藏，避免拦截发送按钮。

### 验证

- `node --check app.js core.js ui.js`：通过
- `npm run build`：通过
- 浏览器实测：Chat 页面连续长回复可完整显示，输入框不再只露半截。

### 说明

- 本轮未新增业务模块。
- 本轮未修改 `.env.local`。
- 本轮未打印或提交完整 API Key。

# CHANGELOG

# CHANGELOG

## 2026-07-04 — Sprint 2：AI Chat Production Ready

### 修复

- 修正 AI Chat 的真实调用模式判断：
  - 本地 / 真实后端模式下默认走 DeepSeek
  - 仅 GitHub Pages 展示模式走 Mock
- 修复 AI Chat 误入演示模式的根因：
  - `demoMode` 之前默认过宽，导致本地云端模式也被后端当成展示模式
  - 现已收紧为仅 GitHub Pages / 本地展示模式触发
- 保留并验证：
  - 连续多轮对话
  - 历史保存
  - 新建聊天 / 清空聊天 / 历史搜索
  - 文件挂载反馈
  - 输入框继续可用

### 验证

- 浏览器实测三轮连续对话通过
- 浏览器实测文件挂载反馈通过
- `AIService.complete('你好', { module: 'ai-chat' })` 返回真实 DeepSeek 回复
- `node --check app.js core.js ui.js`：通过
- `npm run build`：通过

### 说明

- 本轮仅收口 AI Chat，不改其它模块。
- 本轮未修改 `.env.local`。
- 本轮未打印或提交完整 API Key。

## 2026-07-04 — 成本核算助手 Production Ready 收口

### 修复

- 成本核算助手补齐真实异常测试与错误提示：
  - 空值
  - 负数
  - 小数
  - 非法字符
- 结果区新增完整计算过程：
  - 材料 → 工时 → 加工 → 总成本 → 报价 → 利润 → 利润率
- 结果区新增 `计算时间`，用于后续性能监控
- 负数输入不再静默继续计算，直接提示输入异常
- 成本核算助手状态在有效输入下显示 `✅ Production Ready`
- 负数或异常输入会写入 Bug Monitor，便于后续追踪

### 验证

- 浏览器实测示例值输出：
  - 总成本：`1800.00`
  - 利润：`3200.00`
  - 利润率：`64.00%`
- 异常输入不会出现 `NaN / undefined / null / Infinity`
- `node --check app.js core.js ui.js`：通过
- `npm run build`：通过

### 说明

- 本轮只修成本核算助手，不改其它模块。
- 本轮未修改 `.env.local`，未打印或提交完整 API Key。

## 2026-07-04 — 成本核算助手实时计算与保存收口

### 修复

- 成本核算助手切换为输入实时计算：
  - `数量`
  - `材料费`
  - `工时成本`
  - `加工费`
  - `报价金额`
- 修复结果读取问题，避免出现“未提供 / 0 / NaN”。
- 保存参数后刷新仍可恢复当前输入。

### 验证

- 浏览器实测输入示例值后自动得出：
  - 总成本：1800.00
  - 利润：3200.00
  - 利润率：64.00%
- `node --check app.js core.js ui.js`：通过
- `npm run build`：通过

### 说明

- 本轮只修成本核算助手，不改其它模块。
- 本轮未修改 `.env.local`，未打印或提交完整 API Key。

## 2026-07-03 — AI Chat 页面底部裁切修复

### 修复

- 统一修正聊天页高度链条：
  - `app-shell`
  - `main-area`
  - `workspace`
  - `page-enter`
  - `chat-layout`
- 页面改用 `100dvh` 作为视口基准，避免移动端 `100vh` 导致的底部裁切。
- 聊天输入区继续保持 `sticky`，但消息区会按输入框真实高度 + 安全余量预留底部空间。
- `#chatMessages` 保持真正的滚动容器，不再被父级撑成整页高度。

### 验证

- 浏览器里滚动到底部后，最后一条长回复完整可见。
- 最后一句“需要我针对某项业务场景展开，或直接处理一个具体文件/问题？”可完整显示，不再被输入框遮挡。
- 浏览器定位确认：
  - `#chatMessages` 为实际滚动容器
  - `.chat-composer` 为实际输入区
  - 实际样式来源为 `/styles.css`
- `npm run build` 通过。

### 说明

- 本轮只修 AI Chat 底部裁切，不改其它模块。
- 本轮未修改 `.env.local`，未打印或提交完整 API Key。

## 2026-07-03 — v1.3 Practical 闭环说明收口

### 收口说明

- 项目定位统一为 `Industrial AI OS v1.3 Practical`
- 明确真实闭环：
  - Excel：上传 → 解析 → 检测 → 建议 → 确认 → 导出 → 记录
  - OCR：上传 → 识别 → AI 校对/兜底 → 结构化 → 导出 → 记录
  - PDF：上传 → 读取/扫描件提示 → 总结/提取 → 导出 → 记录
  - AI Chat：连续对话、挂载文件、长回复完整显示
  - Agent Runtime：任务、状态、审批、监控、历史
  - 数据管理：历史、导出、清空、查看
- 诚实标注真实能力边界：
  - DeepSeek 真实调用可用
  - Mock 只作为明确兜底
  - LangGraph / LlamaIndex / MCP 完整协议 / GraphRAG / 企业 Connector 仍为 V2
  - 当前不是完整企业级生产平台

## 2026-07-03 — v1.3 实用版收口

### 调整

- 项目主视觉与首页文案收口为 `v1.3 实用版`，强调“能点击、能输入、能上传、能处理、能导出结果”
- `package.json` 版本升级为 `1.3.0`
- `README.md`、`RELEASE_NOTES.md` 的版本叙述统一到 `v1.3-practical`

### 保持

- 不改 `.env.local`
- 不新增无关业务模块
- 保持 AI Chat、OCR、PDF、Excel、生产计划、任务中心等已有可操作能力
- 保持 DeepSeek 真实调用、AI Gateway、Agent Runtime、Tool Center、Task Queue、Human Approval、Monitor

## 2026-07-03 — 最终闭环：质量助手与回归收口

### 新增

- 统一质量检测与修复层 `services/aiQualityCheckService.js`
- 质量 API：
  - `POST /api/quality/check`
  - `POST /api/quality/fix`
  - `POST /api/quality/export`
- 质量助手页面接入检测、建议、前后对比与报告导出

### 修复

- 质量检测不再静默误用 Mock 作为真实成功
- 高风险修复明确进入人工确认边界
- 回归脚本链路重新跑通，`npm run verify` 通过
- 最终收口阶段继续保持 AI Chat 长回复、OCR 状态、Tool Center、Task Queue、Human Approval、Monitor 等稳定能力

### 说明

- 仍保留 V2 预留项：LangGraph、LlamaIndex、MCP 完整协议、GraphRAG、企业 Connector、分布式队列、灰度发布、幻觉检测、企业 SSO、生产级权限中心
- 继续不修改 `.env.local`，不输出完整 API Key，不把未完成能力写成已完成

## 2026-07-02 — AI Gateway / Streaming / Tool Calling / Logging / Status Center 增强

### 新增

- 统一 AI Gateway `services/aiGateway.js`
- 轻量工具注册中心 `services/toolRegistry.js`
- 根目录日志导出 `logger.js`

### 修复

- AI 请求统一收口到网关层，避免各模块分散直连模型
- DeepSeek/OpenAI-compatible/Qwen provider 统一返回结构与失败兜底
- 聊天页支持流式生成体验与自动降级
- AI 调用历史增加 requestId、token、状态码、耗时、原始错误字段
- 状态中心增加 Gateway、Streaming、Mock fallback、Demo Mode、Build Time、Commit 等运行指标

### 兼容性

- 保留现有 Express + 原生前端架构
- 不改 `.env.local`
- 不暴露完整 API Key
- 现有 OCR / PDF / Excel / 登录 / 设置 / 历史 / 状态中心继续可用

### 验证

- `node --check` 通过
- `npm run build` 通过
- 浏览器真实 DeepSeek 调用通过
- 长回复完整显示通过
- 状态中心与 AI 历史页字段更新通过

## 2026-07-01 — 全功能自测与稳定性修复

### 修复

- 修复浏览器在本地 Gateway 配置下错误调用 `/v1/chat/completions`、导致“模型返回为空”的问题。
- AI 调用统一优先经过 `/api/chat`，使用服务端环境配置时不发送浏览器 API Key。
- 扩展 DeepSeek OpenAI-compatible 响应解析字段并增加脱敏结构日志。
- AI 聊天增加重复提交锁、空输入提示、生成中状态和自动恢复。
- AI 聊天增加安全 Markdown 列表、标题、行内代码和代码块显示。
- 文件入口增加空文件与 20MB 大小检查。
- Excel 上传 API 增加扩展名白名单、损坏文件中文提示。
- 全局服务端错误提示中文化。
- 日志增加 API Key、Authorization、密码、Token、Secret、Cookie 与 `sk-` 字符串脱敏。
- 修复未配置 Mail Agent 却显示连接成功的问题。
- AI Gateway 设置允许使用服务端环境密钥，不再强制浏览器填写 Key。

### 修改文件

- `services/aiService.js`
- `api/chat.js`
- `controllers/chatController.js`
- `core.js`
- `app.js`
- `styles.css`
- `routes/excelRoutes.js`
- `controllers/excelController.js`
- `middleware/errorHandler.js`
- `utils/logger.js`
- `mail/mailAgent.js`
- `controllers/mailController.js`
- `TEST_REPORT.md`
- `CHANGELOG.md`
- 构建同步文件：`public/*`、`dist/*`

### 兼容性影响

- 保留现有 Express + 原生前端架构与全部菜单。
- 保留 Local/Hybrid/API 模式和显式 Mock 兜底。
- 未修改 `.env.local`，未提交本地密钥。
- Mail Agent 未配置时状态由错误的“连接可用”改为真实的“未配置”。
- Excel 后端上传现在只接受 XLSX、XLS、CSV、TSV；其他格式会得到明确中文提示。

## 2026-07-01 — 企业办公模块真实验收修复

### 修复

- AI Gateway 设置保存后立即刷新页面，修复“当前数据处理模式”提示不更新的问题。
- 通用工作区在运行、保存、复制、导出前统一同步当前 DOM 输入值，修复翻译/PPT 等模块读取旧草稿的问题。
- 浏览器实测确认翻译助手已能真实调用 DeepSeek 生成英文商务邮件。
- 浏览器实测确认 PPT 助手已能真实调用 DeepSeek 生成逐页大纲。
- 修正 SQL 助手代码块提取正则，减少 SQL 结果区混入说明文本的概率。

### 仍需继续回归

- 部分通用办公页仍显示“建设中”文案，但后台已具备真实 AI 能力，后续需要统一 UI 提示。

### 修改文件

- `app.js`
- `TEST_REPORT.md`
- `CHANGELOG.md`
- 构建同步文件：`public/*`、`dist/*`

## 2026-07-01 — Word / SQL 定点收口

### 修复

- 增强 Word 助手 Markdown 清理规则，确保浏览器最终正文不再保留 `**`、反引号和引用符号。
- 新增 SQL 结果拆分函数，将 SQL 代码块与说明文字分离，结果区仅保留 SQL 本体。

### 回归结果

- Word 助手：浏览器实际读取文本框值，已确认 `hasMarkdown = false`。
- SQL 助手：浏览器实际读取结果框值，已确认 `hasExplanationInOutput = false`。

### 修改文件

- `app.js`
- `TEST_REPORT.md`
- `CHANGELOG.md`

## 2026-07-01 — 第二阶段记录中心与聊天展示修复

### 修复

- 新增任务中心、下载中心，并把 PDF / OCR / Excel 的处理、导出流程接入本地任务与下载记录。
- 补齐文件管理中心的页面入口与真实空状态。
- 补齐 AI 调用历史页面入口并保持真实历史记录可见。
- 修复 AI 聊天长回复被高度、`overflow`、`max-height` 截断的问题，确保正文、列表、代码块完整显示。

### 修改文件

- `core.js`
- `app.js`
- `ui.js`
- `styles.css`
- `TEST_REPORT.md`
- `CHANGELOG.md`
- 构建同步文件：`public/*`、`dist/*`

### 影响范围

- 不改变现有 AI Gateway、登录、Excel、PDF、OCR、Word、SQL、Agent、Mail、设置和系统验收流程。
- 仅增加记录中心联动与聊天展示样式，提升浏览器验收可见性。

## 2026-07-01 — 聊天容器裁切修复

### 修复

- 进一步修复 AI 聊天消息最后一段被容器底部裁切的问题。
- 为聊天主容器、消息区和消息正文补充 `min-height:0`、`max-height:none`、`overflow:visible` 与底部留白。
- 移动端聊天输入区增加 safe-area 兼容，减少最后一条消息被 composer 压住的风险。

### 验证

- 浏览器再次发送“你能帮我解决什么问题？”后，最后一句完整可见。
- 未影响历史聊天、本地保存、新建聊天、清空聊天、文件挂载功能。

### 修改文件

- `styles.css`
- `TEST_REPORT.md`
- `CHANGELOG.md`
- 构建同步文件：`public/*`、`dist/*`

## 2026-07-01 — PDF / OCR / Excel 第一阶段收尾

### 修复

- 修复 OCR 示例图点击“开始识别”后无反应的问题。
- 修复 OCR 演示兜底分支读取空错误对象时再次抛出 `TypeError` 的问题。
- 补完并重新验证 PDF 助手浏览器主流程：示例加载、文字读取、AI 总结、AI 翻译、PDF 问答、导出结果。
- 补完并重新验证 OCR 助手浏览器主流程：示例加载、开始识别、结构化结果、AI 总结、AI 翻译、OCR 问答、导出 TXT。
- 补完并重新验证 Excel 助手浏览器主流程：加载验收示例、自动统计、AI 业务分析、导出 Excel。

### 回归结果

- PDF 助手：浏览器实测通过，`What is the quantity?` 问答返回 `760`，导出反馈正常。
- OCR 助手：浏览器实测通过；本地 OCR 引擎不可用时会进入明确演示兜底，不再卡死或英文报错。
- Excel 助手：浏览器实测通过；统计结果为 `产品明细 5 行 / 总数量 760 / 总金额 9710.00`，AI 分析返回真实业务建议。
- `node --check ...` 与 `npm run build`：通过。

## 2026-07-01 — 公网版稳定性修复（OCR / PDF / 历史 / 状态）

### 修复

- 统一 OCR 状态机为 `未开始 / 处理中 / 真实 OCR 成功 / Mock OCR 成功 / 失败`，并在开始识别时先刷新 UI 再进入处理，避免用户看到长时间 `尚未开始 / 0%`。
- 为 PDF 助手新增 `转入 OCR 识别` 按钮，并在 PDF 智能提取链路中加入 OCR 失败兜底，保证扫描件不会卡死在“未发现文字层”。
- 扩展 AI 调用历史字段，记录 `promptTokens`、`completionTokens`、`httpStatus` 和 `rawError`，便于公网排障。
- 扩展系统状态中心与监控页，补充 Render、Build Time、Commit Hash、Version 以及 OCR / PDF / Excel、AI Provider、当前模型和 API 状态。

### 验证

- Chrome 远程调试验证 OCR 示例图：按钮可点击，最终显示 `Mock OCR 成功`，原文完整显示。
- PDF 文字层验证通过，保留总结、翻译、问答与导出链路。
- `node --check app.js core.js ui.js services/aiService.js controllers/chatController.js api/chat.js` 通过。
- `npm run build` 通过。

### 修改文件

- `app.js`
- `core.js`
- `ui.js`
- `TEST_REPORT.md`
- `CHANGELOG.md`
- 构建同步文件：`public/*`、`dist/*`

### 修改文件

- `app.js`
- `TEST_REPORT.md`
- `CHANGELOG.md`
- 构建同步文件：`public/*`、`dist/*`

## 2026-07-02 — Enterprise Agent Runtime V1

### 新增

- 新增 SQLite 任务与记忆表：
  - `agent_tasks`
  - `agent_task_logs`
  - `agent_approvals`
  - `memory_entries`
- 新增模型：
  - `models/agentTaskModel.js`
  - `models/agentTaskLogModel.js`
  - `models/agentApprovalModel.js`
  - `models/memoryModel.js`
- 新增服务：
  - `services/agentRuntimeService.js`
  - `services/memoryService.js`
  - `services/mcpAdapter.js`
- 新增文档：
  - `AGENT_RUNTIME.md`
  - `TOOL_CENTER.md`
  - `rag/README.md`
  - `graphrag/README.md`

### 增强

- Tool Center 升级为 8 个真实工具统一注册与执行。
- 工具执行统一支持：参数校验、权限校验、超时、重试、熔断、统一返回结构。
- Agent Runtime 支持：创建任务、执行任务、取消、重试、审批、日志、监控统计、Memory 写入。
- 前端增强：`Tool Center` 页面、`Human Approval` 页面、`任务中心` Runtime 任务联动、`系统监控` Runtime 监控联动。

### 修复

- 修复高风险任务审批后再次进入 `waiting_human` 的流程 bug。
- 修复测试命中 3000 端口旧服务导致的误回归问题。
- 修复 `aiGateway` 中工具调用结果未 await 的问题，确保工具结果能进入 AI 汇总上下文。

### 验证

- `POST /api/chat` 真实 DeepSeek：通过
- `CSV Tool` 执行与参数错误：通过
- `Task Queue` 状态流转：通过
- `Human Approval`：通过
- `Cancel / Retry`：通过
- `Monitor / Memory`：通过

### 影响范围

- 保留现有 Express + 原生前端结构。
- 不修改 `.env.local`。
- 不打印完整 API Key。
- 不宣称已完成完整企业级生产 Agent 平台，仅标注为 Agent Runtime V1 骨架。

## 2026-07-02 — Release Candidate 收口验收

### 验证

- 浏览器中 AI 聊天已确认可正常显示长回复，且已能切到真实 DeepSeek 回复。
- 浏览器中 OCR 页面可打开、示例可加载、`开始识别` 按钮可点击。
- 当前浏览器 OCR 样本仍走 Mock 兜底，这一状态已在测试报告中明确标注为“部分通过”，未冒充真实 OCR 已完成。
- `Tool Center`、`Task Queue`、`Human Approval`、`Monitor` 页面入口保持可用。

### 说明

- 本轮没有新增业务模块。
- 本轮没有修改 `.env.local`。
- 本轮没有打印或提交完整 API Key。
- 当前版本定位保持为 `Industrial AI OS —— 具备 Enterprise Agent Runtime V1 骨架的可运行系统。`

## 2026-07-02 — OCR 收口修正

### 修复

- OCR 识别状态不再误报为“Mock OCR 成功”，改为区分：
  - `真实 OCR 成功`
  - `当前环境无法运行真实 OCR，已使用 Mock 兜底。`
- OCR 页面新增引擎状态提示，明确显示真实 OCR 是否已准备就绪、加载中或已降级。
- OCR 初始化失败时保留中文原因，便于在日志和状态中心排查，不再误导为真实成功。

### 验证

- `node --check`：通过
- `npm run build`：通过

### 说明

- 本轮仅修复 OCR 真实引擎收口与状态展示问题。
- 未将 Mock 结果包装成真实 OCR。
- 若浏览器环境无法稳定运行 Tesseract.js，界面会明确提示并保持 Mock 兜底，避免误导。

# 2026-07-03 — AI Chat 底部遮挡修复

### 修复

- 聊天消息区底部空间改为按输入框实际高度动态预留，避免固定输入框遮挡最后几行回复。
- 聊天主区域与消息列表补齐 `min-height: 0`，确保滚动容器在 flex / grid 布局下仍可正确滚动到真正底部。
- 消息渲染完成后与 Markdown 转换后都会再次执行滚动到底部，减少长回复被裁切的概率。

### 验证

- 本地浏览器真实测试通过，长回复最后一句完整可见。
- Chrome 扩展浏览器真实测试通过，长回复最后一句完整可见。
- `npm run verify` 通过。

### 说明

- 本轮未新增业务功能。
- 本轮未修改 `.env.local`。
- 本轮未打印或提交完整 API Key。

## 2026-07-02 — 全项目 Bug 自动检测 + 自动修复机制

### 新增

- `scripts/bug-scan.mjs`
- `scripts/auto-fix-known-issues.mjs`
- `scripts/run-e2e.mjs`
- `/api/health`
- `/api/self-test`

### 修复

- AI Chat 相关“模型返回为空”旧文案收口为“模型响应为空”，减少页面误导。
- OCR 页面远程 AI 状态同步为全局 AI Gateway 状态，避免旧状态残留。
- OCR 任务记录区分真实 OCR、Mock 兜底和 AI 修复链路。
- `bug-scan` 改为更聚焦用户可见问题，减少误报。

### 验证

- `node --check`：通过
- `npm run build`：通过
- `npm run bug:scan -- --check-only`：通过

### 说明

- 本轮没有新增业务模块。
- 本轮没有修改 `.env.local`。
- 本轮没有打印或提交完整 API Key。
- 浏览器自动回归脚本已补齐，但完整 UI 回归仍建议在稳定测试环境补跑。

## 2026-07-02 — 自动 Bug 巡检与浏览器回归补充

### 新增 / 调整

- `scripts/bug-scan.mjs`
- `scripts/auto-fix-known-issues.mjs`
- `scripts/run-e2e.mjs`
- `bug:scan` / `bug:fix` / `verify` 脚本链路

### 修复

- AI Chat 长回复显示不完整的回归检查改为真实可重复的浏览器断言。
- OCR 页面远程 AI 状态和任务状态提示收口，避免误导用户。
- Agent Runtime 回归检查改为中文状态词，和页面真实文案一致。

### 验证

- `npm run check`：通过
- `npm run build`：通过
- `npm run bug:scan -- --check-only`：通过
- 浏览器自动回归：通过

### 说明

- 项目已增加自动 Bug 巡检、自动修复已知问题、回归测试和错误边界能力，但不能保证未来永远无 Bug。

## 2026-07-04 — Sprint 3 系统监控真实健康检查

### Changed

- `app.js`
  - `runSystemCheck()` 改为真实健康检查，不再只读静态状态。
  - GitHub Pages / 本地 / 真实后端分别输出展示模式、未配置、在线、真实错误等状态。
  - 健康检查结果写入 `runtimeMonitor.healthChecks`、`lastSelfCheckAt`、`lastSelfCheckSource` 和 `lastSelfCheckSummary`。
  - `confirmBugAlert()` 写入 `repairRecords`，供“最近修复”读取。
  - `updateApiState()` 在 GitHub Pages 上显示展示模式。
- `core.js`
  - 新增 `repairRecords` 及运行时自检状态字段，并补齐加载归一化。
- `ui.js`
  - 系统监控页改为读取真实健康检查结果、错误中心和修复记录。
  - 系统验收中心改为展示一键自检的真实检查报告。
  - AI 状态中心的 API 状态文案补齐展示模式提示。
- `core.js` / `app.js`
  - AI Gateway 状态源统一到 `GlobalSystemState.aiGateway`。
  - 一键自检通过真实 `/api/health` 与 `/api/chat` 探测写回状态，不再由 UI 推断。

## 2026-07-04 — OCR → AI 数据流修复

### Changed

- `core.js`
  - 新增 `GlobalSystemState.ocrResult` 默认结构。
  - 新增 `emit()` / `on()` 轻量事件接口，供 OCR 完成态广播使用。
- `app.js`
  - OCR 完成后写入 `GlobalSystemState.ocrResult` 并触发 `ocr:completed`。
  - OCR AI 总结 / 翻译 / 问答 / 纠错优先从 `GlobalSystemState.ocrResult.text` 读取内容。
  - OCR 人工确认保存会同步回写全局 OCR 状态。
- `app.js`
  - 全局事件绑定新增 `ocr:completed`，保证 OCR 状态与 UI 同步。

### Verified

- `node --check app.js core.js ui.js`
- `npm run build`
- 本地浏览器 OCR 示例回归

### Notes

- OCR 的状态流已统一，但真实 OCR 引擎是否可用仍受环境影响；Mock 兜底不会伪装成真实成功。

## 2026-07-04 — Runtime System Fix

### Changed

- `core.js`
  - 新增 `createRuntimeFallback()`。
  - 在核心脚本最早阶段初始化 `window.runtime` 与全局 `runtime` 别名。
- `app.js`
  - 进一步在启动阶段兜底初始化 `window.runtime`，避免运行时未定义。
- `index.html`
  - 提前加载 `runtime-init.js`，确保 CSP 允许且运行最早初始化。
- `scripts/sync-public.mjs`
  - 将 `runtime-init.js` 纳入同步清单，保证 `public/` 与 `dist/` 同步。

### Verified

- `node --check app.js core.js ui.js`
- `npm run build`
- 本地浏览器验证 `window.runtime` 存在
- OCR / AI Chat 页面仍可正常打开

### Notes

- 本轮仅修复 runtime 初始化与同步，不改其它业务模块。

### Verified

- `node --check app.js core.js ui.js`
- `npm run build`
- 本地浏览器实测系统监控页
- GitHub Pages 展示模式核对

### Notes

- 本轮只修系统监控，没有新增业务模块。
- `.env.local` 未改动，API Key 未打印、未提交。
- PDF Worker 当前仍是待单独排查的真实异常，不再被误标为绿色。

## 2026-07-04 — STEP 2 GlobalSystemState 收口修复

### Changed

- `app.js`
  - 新增 `syncGlobalSystemState()` 统一同步 `ocrResult`、`aiResult`、`systemHealth`、`errorLog`、`runtime`。
  - OCR 完成、AI 修复、图片 OCR 完成后统一写入全局状态。
  - 系统错误记录同步写入 `GlobalSystemState.errorLog`。
- `core.js`
  - `AIService.complete()` 成功/失败结果写入 `Store.state.aiResult`，并保持全局状态同步。
- `ui.js`
  - 系统监控 / 系统验收页面改为读取 `GlobalSystemState.systemHealth`，不再自行推断状态。
- `server.js`
  - 放宽 CSP 中的 `img-src` 与 `worker-src`，允许 OCR 预览图与 worker 资源使用 `blob:`。

### Verified

- `node --check app.js core.js ui.js`
- `npm run build`
- 本地浏览器验证 OCR → AI 数据流与系统监控状态读取

### Notes

- 本轮只做 GlobalSystemState 收口，不新增业务模块。

## 2026-07-04 — STEP 3 Event 收口修复

### Changed

- `app.js`
  - 初始化统一 `window.EventBus`。
  - OCR / AI / Error 流程统一发事件，Monitor 支持自动刷新。
- `core.js`
  - `emit` / `on` 兼容事件总线，避免模块间直接强耦合调用。
- `server.js`
  - 前端静态资源允许 `blob:` 图片与 worker，降低 OCR 过程 CSP 阻断噪声。

### Verified

- `node --check app.js core.js ui.js server.js`
- `npm run build`
- 浏览器中 `window.EventBus` 存在，且 `ocr:completed / ai:completed / error:created` 已注册

### Notes

- 本轮只修统一事件流，不新增业务模块。

## 2026-07-05 — STEP 4 AI Gateway 收口修复

### Changed

- `core.js`
  - `AIService.complete()` 统一作为 AI 入口，AI 成功 / 降级 / 失败结果统一写入 `Store.state.aiResult` 并触发 `ai:completed`。
  - `AIService.setStatus()` 同步写入 `Store.state.aiGateway`，与 `GlobalSystemState.aiGateway` 保持一致。
- `app.js`
  - OCR 成功、AI 完成与错误记录继续通过统一事件与全局状态联动。
  - `recordAiError()` / `recordSystemError()` 统一写入错误中心与 Bug Monitor。

### Verified

- `node --check app.js core.js ui.js server.js`
- `npm run build`
- 浏览器实测 AI Chat / OCR AI 总结均通过同一 AI Gateway 入口返回

### Notes

- GitHub Pages 自动进入展示模式，避免错误请求真实后端。
- 本地 / 后端模式继续走真实 DeepSeek。
# 2026-07-06

- 新增 Skill 模板化系统，统一企业介绍、产品介绍、报价说明、客户询盘回复、OCR 总结、错误总结的固定输出模板
- Skill 结果记录补充 `skillId`、`skillName`、`input`、`output`
- 首页增加 Skill 模板入口卡片，支持一键生成企业介绍
- AI History 增加 Skill 相关展示字段
- 本轮未修改 STEP 5、Error Center 聚合逻辑和真实 AI 接入
# 2026-07-08 — AI Chat 体验收口

- 将 AI Chat 收口为本地规则演示模式，明确显示 Mock AI 状态。
- 新增 8 个快捷提示词：识别发货单、做成本报价、生成客户回复、查看错误中心、找生产日报模板、生成 CNC 招聘文案、分析质量异常、生成设备维修记录。
- 新增本地意图识别与模块推荐：
  - OCR 单据识别 `#/ocr`
  - 成本核算助手 `#/cost`
  - Skill 模板 `#/skills`
  - Error Center `#/monitoring`
  - 生产计划助手 `#/productionplan`
  - 工作日志 `#/worklog`
- 新增“模块推荐卡片”与可点击跳转入口。
- 新增“一键填充演示对话”，支持三轮本地演示会话与 localStorage 保存。
- 聊天消息支持更贴近制造业场景的本地演示回复，不接真实 AI。
# 2026-07-08 — Resume Demo 最终收口

- 首页定位改为 `Industrial AI OS · Manufacturing AI Office Demo`，一句话说明补齐为面向小工厂的 AI 办公演示系统。
- 首页增加 `推荐演示路线`，用于从 AI Chat → 成本核算助手 → Skill 模板 → Error Center / Bug Monitor 的现场演示路径。
- 统一页面口径为 `本地演示版 / Mock AI`，避免误导为真实 AI 已接入。
- 入口与文案更适合作品集、简历投递和面试展示。
## 2026-07-08

- 修复 OCR 页面在 Mock / 本地演示模式下，AI 自动纠错、AI 总结、AI 翻译、OCR 问答和 AI 还原表格反复写入 active error 的问题。
- 增加 OCR AI Mock 兜底分支：未连接真实 AI 后端或未启用远程 AI 时，直接返回可读的本地演示结果。
- OCR Mock 结果不再进入 Error Center / Bug Monitor 的 active 告警链路。
- 保持 OCR 结构化字段表、人工确认保存、本地演示版说明不变。

## 2026-07-13 — RFQ 报价审批闭环

- 新增 `rfq-store.js`、`rfq-validation.js`、`rfq-risk.js`，用于 RFQ 示例数据、缺失项校验、报价阻断与风险生命周期管理。
- 新增 `#/quotation` 报价助手闭环：
  - 客户需求 RFQ 录入。
  - 必填项缺失阻断报价。
  - 严重 / 阻断风险未处理时阻断报价。
  - 风险新增、处理、缓解、接受、关闭和历史查看。
  - 发起审批、审批通过、驳回、退回补充。
  - 报价草稿生成、保存、复制和打印。
  - 最终发送前保留人工确认。
  - 审批与风险处理写入审计记录。
- 增加四组脱敏 RFQ 示例：完整订单、缺少材料订单、交期风险订单、严重质量风险订单。
- `scripts/run-e2e.mjs` 增加 RFQ 自动浏览器回归，覆盖缺失项阻断、严重风险阻断、风险处理解除阻断、审批原因校验、审批通过生成草稿和审计记录。
- `package.json` 的 `check` 脚本纳入 RFQ 新增 JS 文件。
- 同步 `public/` 与 `dist/` 构建产物。
- 当前 RFQ 能力为本地演示 / MVP 增强闭环，不代表正式生产级 ERP/MES/CRM 报价系统。

## 2026-07-13 — RFQ 最终发布验收

- 增强 `scripts/run-e2e.mjs` 的 RFQ 浏览器验收：
  - 信息完整订单生成报价草稿。
  - 缺少材料订单阻断报价。
  - 严重质量风险未处理时阻断报价。
  - 审批驳回和退回补充必须填写原因。
  - 报价草稿保存、复制、打印进入审计记录。
  - 最终发送保留人工确认并写入审计记录。
  - 页面刷新后 RFQ 数据可恢复。
  - 手机尺寸下无明显按钮遮挡和横向溢出。
  - RFQ 页面无新增红色 JavaScript Error。
- `npm run verify` 已通过，包含 node check、build、bug scan 与浏览器 E2E。

## 2026-07-13 — v1.4 RFQ Demo 发布元数据收尾

- 统一当前版本口径为 `v1.4 RFQ Demo`。
- 统一项目状态为 `RFQ 闭环可交互 / Resume Demo / MVP / 非正式生产系统`。
- GitHub Pages 模式统一描述为公网静态演示。
- 数据模式统一描述为当前浏览器 `localStorage`。
- AI 模式统一描述为本地规则 / Mock；真实模型接入归入后续服务器部署能力。
- 首页、关于系统、README、TEST_REPORT 当前版本说明已同步。
- `.gitignore` 补充 SQLite 运行时文件规则：
  - `database/*.sqlite3-shm`
  - `database/*.sqlite3-wal`
  - `database/*.sqlite3-journal`
- 本轮未修改 RFQ 风险、审批、报价和审计核心业务逻辑。
## 2026-07-15 — OCR 多 Provider、人工复核与错误诊断

### Added

- 新增统一 OCR Provider Registry，封装现有 OCR，预留本地、云端、视觉模型和稳定演示 Provider。
- 新增统一 OCR 结果/字段模型、明确降级状态、超时、空结果、乱码和数字/日期/金额一致性检查。
- 新增原图、原文、结构化字段三栏人工复核，支持草稿、批准、驳回、修改留痕、置信度/高风险文字标签。
- 只有人工批准的字段才能转入报价和询价草稿，空字段不自动编造。
- OCR 运行接入任务记录、错误中心 signature 聚合、系统状态统计和脱敏诊断复制。
- 新增 OCR Provider/复核/降级/兼容与页面门禁专项测试。

### Compatibility and boundaries

- 原有 OCR TXT / Word / Excel 导出、AI 总结/翻译/问答保留。
- 新本地数据使用 schemaVersion 2 增量迁移，旧 `ocrResult` 自动归一化，不删除旧数据。
- 本轮未接入任何新收费 API，`local` / `cloud` / `vision` 仍为明确的未配置占位。
