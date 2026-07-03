# CHANGELOG

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
