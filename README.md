# Industrial AI OS

Industrial AI OS —— 具备 Enterprise Agent Runtime V1 骨架的可运行系统。

当前版本：`v1.2-agent-runtime-verify`

项目状态：稳定收口 / 可交付 / 可持续迭代

推荐入口：

- [本地开发](http://127.0.0.1:3000)
- [GitHub Pages 演示](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

## 项目定位

Industrial AI OS 是面向制造业与企业办公的网页型 AI 工作台，不是静态展示页，也不是单一聊天机器人。它保留企业软件常见的菜单、工作区、文件处理、任务队列、审批与监控能力，并通过统一 AI Gateway 连接真实 DeepSeek / OpenAI-compatible 模型。

适用场景：

- 制造业生产计划、PMC、仓库、采购、销售、质量管理
- Excel、CSV、PDF、OCR、Word、PPT、SQL 业务处理
- AI Chat、Agent Runtime、Tool Center、Task Queue、Human Approval
- 面试演示、作品集展示、企业数字化原型验证

## 当前版本能力

已实现：

- AI Gateway、DeepSeek 真调用、Hybrid / Mock 降级
- AI Chat 长回复显示、流式输出、Markdown 渲染
- OCR、PDF、Excel、CSV、PPT、Word、SQL 等办公入口
- Agent Runtime V1 骨架、Tool Center V1、Task Queue、Human Approval
- Monitor、AI History、Memory、Health Check、Self Test
- 自动 Bug 巡检、自动修复已知问题、浏览器回归验证

部分实现：

- 真实 OCR 引擎在不同浏览器/系统环境下可能回退到 Mock 兜底
- 企业 Connector、MCP 完整协议、GraphRAG、多 Agent 编排仍为预留项

预留能力：

- LangGraph、LlamaIndex、MCP 完整协议、GraphRAG
- 企业 Connector（ERP / MES / OA / CRM）
- 分布式消息队列、灰度发布、完整幻觉检测

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

## 安装与启动

要求：Node.js 18+

```bash
npm install
npm start
```

浏览器打开：

```text
http://127.0.0.1:3000
```

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
