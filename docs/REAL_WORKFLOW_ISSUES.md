# 真实可运行与可复用整改 Issue Register

> 基线：`56291eb5c6041adc6996528426765476541fbf90`。
> 本表中的 `VERIFIED` 只能由真实浏览器或真实服务端操作证据取得；源码或单元测试本身不足以改变该状态。
> `anime-pocket-agent/` 不属于本整改范围。

## 状态定义

- `OPEN`：已发现，尚未完成修复或真实验证。
- `BLOCKED`：依赖缺失的样本、环境或安全后端能力。
- `FIXED_NOT_VERIFIED`：已做最小代码修复，尚无真实操作证据。
- `VERIFIED`：真实操作已成功复现并重新验证。
- `DEFERRED`：明确不在本 Sprint 范围内，不得以文案替代能力。

## Issue 清单

| ID | 问题与复现步骤 | 初始根因/证据 | 修改文件 | 修复与验证计划 | Evidence | 状态 |
|---|---|---|---|---|---|---|
| ISSUE-01 | 中文发货单上传后出现乱码、错字与表格丢失。 | 已定位真实基准样本；Tesseract 当前 Provider 与中文语言包存在，但尚未得到本轮 OCR 输出。 | — | 用同一真实样本记录 Provider、requestId、耗时、原文和关键字段 Before/After。 | 基准图已定位 | OPEN |
| ISSUE-02 | 同图中客户、单号、日期、产品、数量等字段缺失或错误。 | `OCRService.structure()` 为规则提取；真实样本已定位，尚未完成回归基线。 | — | 真实图 → 原文 → 字段 → 置信度 → 人工修正 → 批准 → 重开 → 导出。 | 基准图已定位 | OPEN |
| ISSUE-03 | OCR AI 纠错显示 `deepseek-not-configured`。 | 有服务端 AI Gateway 与前端降级路径；真实安全模型可用性未验收。 | — | 仅在服务端密钥已安全配置时进行一次无敏感调用，否则建立 `must_split_subtask=ocr_ai_gateway`。 | 待补充 | OPEN |
| ISSUE-04 | 同一图短时间出现多个 OCR 任务。 | `ocrRun()` 与 retry 共用入口；尚未验证 loading/disabled 和事件绑定。 | — | 浏览器双击、回车、重渲染、重试分别记录 requestId 数量。 | 待补充 | OPEN |
| ISSUE-05 | 普通按钮点击后页面跳到顶部。 | `rerender()` 已采用 `preserveScroll`；跨模块浏览器操作未验。 | `app.js`（既有修复） | OCR/Excel/Word/PDF/成本的保存、导出、AI 按钮逐项验证。 | 待补充 | FIXED_NOT_VERIFIED |
| ISSUE-06 | 失败或重复点击后错误累计、重复创建。 | 制造 API 已有 Idempotency-Key；真实 HTTP 重试返回同一记录。 | — | 页面失败→重试→成功与表单内容保留验证。 | HTTP 幂等验收通过；成本负数失败后输入保留，修正重试成功且 Session 数量未增加 | VERIFIED |
| ISSUE-07 | Bug Monitor 可错误关闭尚未验证的问题。 | 状态/监控代码存在，尚未验证 UI 状态转换约束。 | — | 检查 Open→Investigating→Fixed→Verified 的真实状态机。 | 待补充 | OPEN |
| ISSUE-08 | OCR 失败自动显示看似正确的结果。 | 自动失败已返回 `partial_success`、空字段、人工确认提示；显式 Mock 保留标签。 | `ocr-provider.js`（既有修复） | 真实 Provider 失败时浏览器确认无假字段、无假成功。 | Provider 单测通过 | FIXED_NOT_VERIFIED |
| ISSUE-09 | 成本数据需要大量人工输入。 | 成本模块是本地确定性计算；现已增加从当前真实 RFQ 仅带入已有字段。 | `app.js`、`ui.js`、`core.js` | 分别验收独立成本 Session 和 RFQ 真实字段带入；无数据不生成。 | 浏览器从 RFQ-202607-000001 带入客户、产品、数量、单位、材料；材料单价保持空白，sourceTrace 保留 RFQ id/no | VERIFIED |
| ISSUE-10 | ERP 没有真实业务闭环。 | Connector 默认未配置，无订单/采购/库存/生产/财务关系。 | — | 保持 DEMO_ONLY。 | 未配置 Connector | DEFERRED |
| ISSUE-11 | MES 没有生产任务、工序和报工链路。 | 仅演示入口/设备数据。 | — | 保持 DEMO_ONLY；`must_split_subtask=mes_real_execution`。 | 未发现执行模型 | DEFERRED |
| ISSUE-12 | BOM 没有产品、物料、版本和成本/库存关系。 | 仅演示入口。 | — | 保持 DEMO_ONLY。 | 未发现 BOM 数据模型 | DEFERRED |
| ISSUE-13 | 工艺助手没有正式工艺数据与人工确认入库。 | 仅建议/模板入口。 | — | 保持 DEMO_ONLY。 | 未发现正式模型 | DEFERRED |
| ISSUE-14 | SQL 辅助工具可能被误解为可执行数据库操作。 | 无安全 SQL 执行层；现有功能为文本辅助。 | — | 页面与测试保持“生成/解释/格式化，不执行任意 SQL”。 | 无执行连接层 | VERIFIED |
| ISSUE-15 | AI 按钮不能区分真实模型、确定性、Mock、未配置。 | 多处 `mockFallback` 和网关调用并存。 | — | 全量扫描按钮并在 UI 显式展示四类状态。 | 待补充 | OPEN |
| ISSUE-16 | Provider 不可用时可能白屏、乱码或假结果。 | `APIClient` 有网络错误提示；OCR 有错误对象。 | — | 断网/未配置模型的浏览器回归，确认本地确定性能力仍可用。 | 待补充 | OPEN |
| ISSUE-17 | 全系统中文编码与渲染未完成真实回归。 | UTF-8 资源和中文文案存在；未覆盖导出、OCR、数据库回显。 | — | UI、Toast、日志、TXT/Word/Excel/PDF、OCR、SQLite 回显测试。 | 待补充 | OPEN |
| ISSUE-18 | 客户→联系人→项目→RFQ 浏览器主链路无证据。 | SQLite/API/tenant/幂等已通过真实 HTTP 验收。 | `app.js`（稳定性修复） | 真实浏览器创建、刷新、打开、修改、再刷新。 | Playwright 创建 CUS-2026-000002 → 联系人 → PRJ-2026-000002 → RFQ-202607-000002；关联校验为 true；数量 88→99，刷新后仍为 99，历史 2 条 | VERIFIED |
| ISSUE-19 | 成本浏览器保存与重新打开未验收。 | 已增加统一可复用 Session、重开、复制和来源追踪。 | `app.js`、`ui.js`、`core.js` | 输入→计算→保存→离开→重开→历史验证。 | Playwright 390×844：示例计算得总成本 10037.00、建议报价 12546.25；刷新后输入和同一结果仍存在，会话列表可重开 | VERIFIED |
| ISSUE-20 | 390×844 仅有布局或历史证据，缺完整真实操作。 | 响应式样式与旧报告存在。 | — | 首页、客户、项目、RFQ、OCR、Excel、成本、错误恢复、刷新逐项记录。 | Playwright：home/OCR/Excel/Word/PDF/cost/客户/项目/RFQ 均为 scrollWidth=390、viewport=390；成本保存恢复、客户主链路与错误恢复已实际操作 | VERIFIED |
| ISSUE-21 | Bug Monitor 浮层遮挡并拦截核心业务按钮。 | Playwright 点击“为该客户创建项目”超时，明确显示 `.bug-detail` 拦截 pointer events。 | `app.js`、`scripts/workspace-focus-test.mjs` | 浮层只保留紧凑计数和错误中心入口；业务详情统一到错误中心。 | 构建同步后同一按钮真实点击成功并进入项目页；390×844 三个核心页面无横向溢出 | VERIFIED |

## 不可降低的门禁

- `ENV-OCR-E2E-001` 保持 `open / environment`，不得删除、skip 或用 Mock 替代真实 OCR E2E。
- OCR 未人工批准，不得进入正式 RFQ、报价或其他正式业务。
- AI 不得覆盖人工确认的 OCR 字段。
- tenant 隔离、父子关系完整性和服务端幂等继续生效。
- `已保存` 必须说明保存位置；localStorage 只能称“已保存到本机浏览器”。

## OCR 基准图与 Session 差距（2026-07-26）

- 已定位用户指定的本机真实中文基准图（仓库文档不记录本机绝对路径）。图像内容为中文发货单，包含公司名称、发货单号、日期、客户、地址、联系人、电话、5 行产品明细、数量、单价、金额和合计。
- 2026-07-26 本机临时 Chrome 已将该图上传至 OCR 页面；服务日志确认页面加载并请求 `worker-wrapper.js`、`worker.min.js` 和 `tesseract-core-simd-lstm.wasm.js`。本次会话未取得可采集的最终 OCR 状态、原文或字段，不能据此声称 OCR 成功；ISSUE-01/02 与 `ENV-OCR-E2E-001` 继续保持开放/阻塞，后续需把浏览器基线采集稳定化后再记录 Before/After。
- 当前实现保留 `ocrData.results`、`ocrData.reviews` 兼容数据，同时已经增加独立、可重开的 `document_session_id` 与 `document_templates`。
- 人工确认字段已优先写入对应文档 Session；全局 `personal-ai-os-ocr-confirmed-fields` 仅保留旧数据兼容。重新识别会保存候选复核与历史结果，不自动覆盖已批准人工值。
- 2026-07-26 已开始最小增量：`ocrData.schemaVersion=3` 新增 `documentSessions`、`documentTemplates` 和 `activeDocumentSessionId`；旧 `results/reviews` 会兼容迁移为 Session，新图片加载、识别结果、复核和批准会回写对应 Session。页面已提供“新建任务”和 Session“继续”入口。原图仅保留元数据，刷新后不得伪装为可恢复的二进制文件。重新识别遇到已批准复核时会保存冲突提示并保留人工值；用户可明确选择“保留人工值”或“采用新 OCR 值并重新复核”。尚待真实浏览器验收，状态为 `FIXED_NOT_VERIFIED`。
- OCR Session、模板写入、冲突保护已经达到 `FIXED_NOT_VERIFIED`；真实 Tesseract 基准仍受 `ENV-OCR-E2E-001` 阻塞，不能升级为 `VERIFIED`。

## 可复用会话整改（2026-07-26）

- Excel、Word、PDF、成本核算使用统一 `reusableSessions` 数据边界，最多保留每类 20 个会话，支持继续、复制和新建。
- Excel 保存结构化行、统计和处理结果；Word 保存标题、正文和来源；PDF 保存提取文本、结果和文件元数据；成本保存人工输入、确定性计算结果与来源追踪。
- 浏览器 `File`、Workbook 和 PDF 二进制不写入 localStorage。刷新后仍可查看历史结构化结果；重新解析必须由用户重新选择原文件，页面不得伪装二进制已恢复。
- 成本核算保持 `REAL（人工录入确定性计算工具）`。从 RFQ 导入只复制真实存在的产品、客户、数量、单位和材料字段；价格、工时、费率不生成、不猜测。
- `scripts/reusable-session-test.mjs` 已覆盖会话边界、元数据保存、RFQ 来源追踪和真实性文案。
- Playwright 实际证据：Excel 加载“发货单示例.xlsx”后生成会话，刷新后会话、表格和结果仍存在；成本核算在 390×844 计算后刷新，输入与确定性结果保持一致。
- Word：输入中文标题和两段正文后自动生成 Session；刷新后正文保留；点击复制后 Session 数量由 1 增至 2，副本内容一致。
- PDF：加载应用内真实生成的 PDF 文件后提取 251 字文字层；刷新后 Session、文件元数据和提取文字保留，`binaryFiles=0`，没有伪装二进制已经持久化。
- 成本 RFQ：从已打开的真实 RFQ 导入客户、产品、数量、单位、材料和来源追踪；材料单价、工时与费率保持空白。负数输入显示明确错误且保留输入，修正后重试成功，未重复创建 Session。

## 客户主链路浏览器证据（2026-07-26）

- 创建客户 `CUS-2026-000002`，新增主联系人，并从客户详情创建项目 `PRJ-2026-000002`。
- 从项目详情创建 RFQ `RFQ-202607-000002`；客户、项目和 RFQ 的 id 关系由浏览器读取后验证一致。
- 首次保存数量 88，随后修改为 99 并更新备注；刷新后数量仍为 99、备注保持、历史记录为 2 条。
- 首次点击“为该客户创建项目”发现 Bug Monitor 详情浮层拦截 pointer events。最小修复后浮层仅显示计数和“查看”入口，详细错误统一进入 Stability Center；同一按钮重新点击成功。
- 390×844 下客户、项目、RFQ 页面均为 `scrollWidth=390`、`viewport=390`，无横向溢出；控制台为 0 errors / 0 warnings。
