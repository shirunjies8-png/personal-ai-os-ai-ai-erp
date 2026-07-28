# Industrial AI OS

> **A trusted AI Agent execution platform for enterprise workflows.**
>
> 面向企业真实业务流程的可信 AI Agent 执行平台：通过 Runtime Trace、Validator、Risk Control 和 Human Approval，让 AI 从生成答案走向安全执行任务。

## Trusted execution direction

本项目的重点不是聊天，而是可审计的业务执行：每次 Agent / Skill 运行保留 Run、Step、Attempt、Validator、Approval 与 Outcome Feedback。失败 Attempt 不会被后续成功覆盖；执行成功也不等同于业务验证成功。

设计参考包括吴恩达 Agentic AI 的 Planning、Tool Use、Reflection、Evaluation，以及 OpenWorker 的 Human Approval、Tool Integration、Local First 与 Model Agnostic。我们额外强调执行轨迹、Attempt 级审计、业务规则验证、数学约束、风险控制、人工审批和结果重新验证。

Phase B 当前只记录 Outcome Feedback，不会自动调整模型、规则或阈值；基于历史结果的 Confidence Calibration 属于后续阶段。

Industrial AI OS · v1.4 RFQ Demo

面向小工厂的 AI 办公演示系统，支持 RFQ 报价审批闭环、单据识别、成本报价、工作模板、错误监控和本地规则 AI 助手。

当前版本：`v1.4-rfq-demo`

当前版本名称：`Industrial AI OS · v1.4 RFQ Demo`

项目状态：RFQ 闭环可交互 / Resume Demo / MVP / 非正式生产系统

## 版本冻结说明

当前版本已冻结为适合简历、面试、作品集展示的 RFQ Demo 演示版。

当前定位：

面向小工厂的 AI 办公演示系统，支持 RFQ 报价审批闭环、单据识别、成本报价、工作模板、错误监控和本地规则 AI 助手。

当前状态：

- RFQ 闭环可交互
- Resume Demo / MVP
- GitHub Pages 公网静态演示
- 本地规则 / Mock AI
- 不调用收费 API
- 数据保存在当前浏览器 localStorage
- 非正式生产系统
- 适合作品集、面试和功能演示

推荐入口：

- [本地开发](http://127.0.0.1:3000)
- [GitHub Pages 演示](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

## 项目定位

Industrial AI OS 是面向制造业与企业办公的网页型 AI 工作台，不是静态展示页，也不是单一聊天机器人。当前 v1.4 RFQ Demo 更适合简历、面试、作品集和功能演示，重点展示 RFQ 客户需求、风险处理、审批、报价草稿和审计记录的本地闭环；真实 DeepSeek / OpenAI-compatible 模型接入保留为后续部署能力。

适用场景：

- 制造业生产计划、PMC、仓库、采购、销售、质量管理
- Excel、CSV、PDF、OCR、Word、PPT、SQL 业务处理
- AI Chat、Agent Runtime、Tool Center、Task Queue、Human Approval
- 面试演示、作品集展示、企业数字化原型验证

## 核心模块说明

1. AI Chat
   本地规则助手，用于引导用户进入 OCR、成本核算、Skill 模板、Error Center 等模块。

2. OCR
   单据识别与人工复核，支持统一 Provider、低置信度提示、诊断、明确降级和确认后转入报价/询价。

3. 成本核算助手
   适合小工厂报价场景，支持材料成本、加工成本、人工成本、利润、建议报价和风险提示。

4. Skill 模板
   沉淀制造业常用工作模板，支持分类筛选、搜索、查看详情、复制和使用模板预览。

5. Error Center / Bug Monitor
   支持错误聚合、active / ignored / resolved 三态生命周期、错误中心自检和健康统计。

## OCR 可扩展架构与复核流程

页面只调用统一 `OCRArchitecture.ProviderRegistry`，不直接绑定任何厂商。当前 Provider 状态：

- `current`：封装项目现有 Tesseract OCR 能力，引擎可用时返回真实本地识别结果。
- `mock`：稳定演示/测试 Provider，界面始终标注“演示数据（非真实识别）”。
- `local` / `cloud` / `vision`：仅为占位接口，显示“未配置/暂不可用”，本轮未接入付费 API。

新增 Provider 时，实现 `recognize()`、`healthCheck()`、`normalizeResult()` 和 `getCapabilities()`，再向 Registry 注册即可。Provider 结果必须转为统一结构，包含 requestId、原文、文字块、字段、置信度、警告/错误、耗时、降级与环境信息。旧 OCR 结果在读取时会迁移为新结构，不清空原有 localStorage。

业务流程为：上传/拍照 → Provider 原文识别 → 确定性格式与一致性检查 → 低置信度标记 → 人工修改留痕 → 人工批准 → 转入报价/询价或导出。未批准结果不能进入正式业务；AI 纠错仅为建议，不会自动覆盖字段。诊断复制会脱敏密钥/令牌字段，不包含客户结构化内容。

后续可通过同一接口接入本地 OCR、豆包/火山引擎、腾讯 OCR 或其他视觉服务；当前版本没有调用这些真实收费接口，也没有写入任何新密钥。

## 当前版本能力

真实闭环：

- Excel：上传 → 解析 → 检测 → 建议 → 确认 → 导出 → 记录
- OCR：上传 → 识别 → AI 校对/兜底 → 结构化 → 导出 → 记录
- PDF：上传 → 读取/扫描件提示 → 总结/提取 → 导出 → 记录
- AI Chat：连续对话、挂载文件、长回复完整显示、本地规则演示入口
- Agent Runtime：任务、状态、审批、监控、历史
- 数据管理：历史、导出、清空、查看

已实现：

- RFQ 报价审批闭环：客户需求 → 缺失项校验 → 风险处理 → 审批 → 报价草稿 → 审计记录
- AI Gateway 与真实模型接入位保留；当前 GitHub Pages 演示默认使用本地规则 / Mock
- AI Chat 长回复显示、流式输出、Markdown 渲染
- OCR、PDF、Excel、CSV、PPT、Word、SQL 等办公入口
- Agent Runtime V1 骨架、Tool Center V1、Task Queue、Human Approval
- Monitor、AI History、Memory、Health Check、Self Test
- 自动 Bug 巡检、自动修复已知问题、浏览器回归验证

诚实标注：

- 当前 GitHub Pages 为公网静态演示，不连接后端，不调用收费 API
- 当前 AI 输出以本地规则 / Mock 为主
- 本地或服务器部署后可继续接入 DeepSeek / OpenAI-compatible API
- LangGraph / LlamaIndex / MCP 完整协议 / GraphRAG / 企业 Connector 仍是 V2
- 当前不是完整企业级生产平台
- 当前为 RFQ Demo / Resume Demo / MVP，适合作品集、面试、功能演示使用

## 推荐演示路线

1. 打开 [AI Chat](http://127.0.0.1:3000/#/chat)，点击“做成本报价”
2. 跳转 [成本核算助手](http://127.0.0.1:3000/#/cost)，点击“一键填充示例”
3. 查看建议报价、单件报价和风险提示
4. 打开 [Skill 模板](http://127.0.0.1:3000/#/skills)，搜索“CNC”
5. 打开 [Error Center / Bug Monitor](http://127.0.0.1:3000/#/monitoring)，运行错误中心自检

## AI Mode

| 模式 | 说明 |
| --- | --- |
| GitHub Pages | 公网静态演示，使用本地规则 / Mock，不请求后端 |
| Local Demo | 本地浏览器 localStorage 保存数据，使用本地规则 / Mock |
| Server Mode | 后续可部署后端并接入 DeepSeek / OpenAI-compatible API |

当前 v1.4 RFQ Demo 不在前端写入 API Key，不调用收费 API。真实 AI 接入属于后续服务器部署能力。

## 技术栈

- 前端：HTML、CSS、原生 JavaScript、响应式布局
- 后端：Node.js、Express、REST API
- 数据：SQLite、localStorage、IndexedDB
- AI：本地规则 / Mock；AI Gateway 与 DeepSeek OpenAI-compatible 接入位保留
- 文件处理：SheetJS、ExcelJS、PDF.js、pdf-lib、Mammoth、Tesseract.js
- 安全：JWT、bcrypt、Helmet、CORS、输入校验、日志脱敏
- 部署：GitHub Pages、Render、Vercel、Docker、VPS

## 简历可用描述

项目名称：
Industrial AI OS · Manufacturing AI Office Demo

项目描述：
基于 HTML / CSS / JavaScript 构建的制造业 AI 办公演示系统，面向小工厂和加工企业，提供 RFQ 报价审批闭环、本地规则 AI 助手、单据 OCR 结构化识别、制造业成本核算、工厂工作模板和错误监控中心。项目当前为 v1.4 RFQ Demo，所有数据保存在当前浏览器 localStorage，适合作品集、面试和功能演示，不是正式生产系统。

## 安装与启动

要求：Node.js 18+

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:3000
```

如果本地项目当前使用的是现有启动命令，也可以继续按现有方式运行。

## 验证命令

```bash
npm run check
npm run build
npm run bug:scan
npm run verify
```

`npm run verify` 会自动执行：

1. `node --check`
2. `npm run build`
3. `npm run bug:scan`
4. 浏览器回归验证（若本机有 Chrome）

## DeepSeek 配置

后端环境变量参考 `.env.example`：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

核心接口：

- `GET /api/health`
- `GET /api/self-test`
- `POST /api/ai/chat`（需认证；服务端网关）

## 目录结构

- `app.js` / `core.js` / `ui.js`：前后端核心逻辑
- `routes/`：API 路由
- `controllers/`：业务控制器
- `services/`：AI Gateway、Agent Runtime、Tool Center、Memory
- `models/`：SQLite 数据模型
- `scripts/`：构建、自检、回归和巡检脚本
- `public/`：静态前端输出
- `dist/`：发布产物

## 发布方式

### GitHub Pages

- 用于前端静态展示与演示
- 适合面试、汇报、作品集
- 不适合真实企业机密数据
- 当前展示地址：
  [https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

### Render / VPS / 云服务器

- 用于后端 Express 与真实 DeepSeek
- DeepSeek Key 只放在服务端环境变量
- 前端通过公网 HTTPS 地址访问后端

### GitHub Pages + Render 双部署

- 前端：GitHub Pages
- 后端：Render / 云服务器
- API 地址：由前端配置自动读取

## 文档

- [演示顺序](DEMO.md)
- [面试演示指南](docs/DEMO_GUIDE.md)
- [简历项目描述](docs/RESUME_PROJECT.md)
- [路线图](docs/ROADMAP.md)
- [部署说明](DEPLOY.md)
- [企业内网部署安全指南](docs/DEPLOYMENT_SECURITY.md)
- [安全策略](SECURITY.md)

## 安全与数据边界

- `.env.local` 不应提交 Git
- API Key 不进入前端、日志、导出和历史
- 上传文件默认本地处理，远程 AI 前必须确认
- 不要把企业机密、客户隐私、财务数据或未脱敏文件上传到公共演示版
- 关键业务建议人工确认后再执行
