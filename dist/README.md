# Industrial AI OS

Industrial AI OS · Manufacturing AI Office Demo

面向小工厂的 AI 办公演示系统，支持单据识别、成本报价、工作模板、错误监控和本地规则 AI 助手。

当前版本：`v1.3-practical`

当前版本名称：`Industrial AI OS · Resume Demo Version`

项目状态：Resume Demo / 本地演示版 / Mock AI

## 版本冻结说明

当前版本已冻结为适合简历、面试、作品集展示的稳定演示版。

当前定位：

面向小工厂的 AI 办公演示系统，支持单据识别、成本报价、工作模板、错误监控和本地规则 AI 助手。

当前状态：

- 本地演示版
- Mock AI
- 未接入真实 AI
- 不调用收费 API
- 数据保存在浏览器 localStorage
- 适合作品集、面试和功能演示

推荐入口：

- [本地开发](http://127.0.0.1:3000)
- [GitHub Pages 演示](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

## 项目定位

Industrial AI OS 是面向制造业与企业办公的网页型 AI 工作台，不是静态展示页，也不是单一聊天机器人。当前版本更适合简历、面试、作品集和功能演示，保留了常见的菜单、工作区、文件处理、任务队列、审批与监控能力，并通过统一 AI Gateway 预留真实 DeepSeek / OpenAI-compatible 模型接入位。

适用场景：

- 制造业生产计划、PMC、仓库、采购、销售、质量管理
- Excel、CSV、PDF、OCR、Word、PPT、SQL 业务处理
- AI Chat、Agent Runtime、Tool Center、Task Queue、Human Approval
- 面试演示、作品集展示、企业数字化原型验证

## 核心模块说明

1. AI Chat
   本地规则助手，用于引导用户进入 OCR、成本核算、Skill 模板、Error Center 等模块。

2. OCR
   单据识别演示，支持结构化字段表和原始 OCR 拆行结果。

3. 成本核算助手
   适合小工厂报价场景，支持材料成本、加工成本、人工成本、利润、建议报价和风险提示。

4. Skill 模板
   沉淀制造业常用工作模板，支持分类筛选、搜索、查看详情、复制和使用模板预览。

5. Error Center / Bug Monitor
   支持错误聚合、active / ignored / resolved 三态生命周期、错误中心自检和健康统计。

## 当前版本能力

真实闭环：

- Excel：上传 → 解析 → 检测 → 建议 → 确认 → 导出 → 记录
- OCR：上传 → 识别 → AI 校对/兜底 → 结构化 → 导出 → 记录
- PDF：上传 → 读取/扫描件提示 → 总结/提取 → 导出 → 记录
- AI Chat：连续对话、挂载文件、长回复完整显示、本地规则演示入口
- Agent Runtime：任务、状态、审批、监控、历史
- 数据管理：历史、导出、清空、查看

已实现：

- AI Gateway、DeepSeek 真调用、Hybrid / Mock 明确兜底
- AI Chat 长回复显示、流式输出、Markdown 渲染
- OCR、PDF、Excel、CSV、PPT、Word、SQL 等办公入口
- Agent Runtime V1 骨架、Tool Center V1、Task Queue、Human Approval
- Monitor、AI History、Memory、Health Check、Self Test
- 自动 Bug 巡检、自动修复已知问题、浏览器回归验证

诚实标注：

- DeepSeek 真实调用可用
- Mock 只作为明确兜底
- LangGraph / LlamaIndex / MCP 完整协议 / GraphRAG / 企业 Connector 仍是 V2
- 当前不是完整企业级生产平台
- 当前为本地演示版 / Mock AI，适合作品集、面试、功能演示使用

## 推荐演示路线

1. 打开 [AI Chat](http://127.0.0.1:3000/#/chat)，点击“做成本报价”
2. 跳转 [成本核算助手](http://127.0.0.1:3000/#/cost)，点击“一键填充示例”
3. 查看建议报价、单件报价和风险提示
4. 打开 [Skill 模板](http://127.0.0.1:3000/#/skills)，搜索“CNC”
5. 打开 [Error Center / Bug Monitor](http://127.0.0.1:3000/#/monitoring)，运行错误中心自检

## AI Mode

| 模式 | 说明 |
| --- | --- |
| Local Only | 本地处理与 Mock 兜底，不主动调用远程 AI |
| Hybrid | 优先真实 AI，失败时按模块明确降级 |
| Remote AI | 强制使用远程 AI，失败时显示真实错误 |
| Mock | 无 API Key 时的演示兜底 |

真实 AI 推荐使用 DeepSeek OpenAI-compatible API。所有业务模块统一通过 AI Gateway 调用，不在前端硬编码 API Key。

## 技术栈

- 前端：HTML、CSS、原生 JavaScript、响应式布局
- 后端：Node.js、Express、REST API
- 数据：SQLite、localStorage、IndexedDB
- AI：AI Gateway、DeepSeek OpenAI-compatible API、Mock fallback
- 文件处理：SheetJS、ExcelJS、PDF.js、pdf-lib、Mammoth、Tesseract.js
- 安全：JWT、bcrypt、Helmet、CORS、输入校验、日志脱敏
- 部署：GitHub Pages、Render、Vercel、Docker、VPS

## 简历可用描述

项目名称：
Industrial AI OS · Manufacturing AI Office Demo

项目描述：
基于 HTML / CSS / JavaScript 构建的制造业 AI 办公演示系统，面向小工厂和加工企业，提供本地规则 AI 助手、单据 OCR 结构化识别、制造业成本核算、工厂工作模板和错误监控中心。项目当前为 Mock AI 演示版，所有数据保存在浏览器 localStorage，适合作品集、面试和功能演示。

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
DEEPSEEK_API_KEY=你的DeepSeekKey
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

核心接口：

- `GET /api/health`
- `GET /api/self-test`
- `POST /api/chat`

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
