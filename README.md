# Industrial AI OS

面向制造业与企业办公场景的可运行 AI 操作系统。项目以生产计划、Excel 数据处理和文档智能为核心，通过统一 AI Gateway 连接真实模型，同时保留 Mock 模式，便于离线演示、面试展示和渐进式开发。

当前版本：`v1.0 Resume Demo Version`

项目状态：Demo 可演示版
推荐演示入口：[GitHub Pages](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

数据处理模式：

- `Local Only`：默认本地演示，数据只保存在当前浏览器
- `Hybrid`：本地数据 + 可选远程 AI
- `Remote AI`：仅在配置后端时启用，输入会发往第三方 AI 接口

安全提示：

- 演示项目请勿上传企业机密文件
- 请勿填写企业生产 API Key
- API Key 仅保存在当前浏览器 `localStorage`
- 清除浏览器缓存会导致本地数据丢失
- GitHub Pages 静态演示不适合存放真实企业数据

## 项目定位

Industrial AI OS 不是单一聊天机器人或静态展示页，而是一套浏览器内可操作的工业 AI 工作台。系统保留传统企业软件的菜单、工作区、文件处理和数据管理能力，并通过 AI Gateway 为生产计划、Excel、PDF、OCR、PPT、SQL、Agent 等模块提供智能分析。

适用场景：

- 制造业生产计划、PMC、仓库、采购、销售和质量管理
- Excel 发货单、订单、库存和业务数据分析
- Word、PDF、OCR、PPT 等企业文档处理
- AI 应用开发、工业数字化、MES/ERP 作品展示
- 求职面试、项目演示和后续企业化原型验证

## 核心功能

- 工业驾驶舱：订单、生产计划、风险、设备台账、Agent 和系统状态指标
- AI 生产计划助手：粘贴订单或导入 CSV，结合设备台账分析交期、负载、物料风险并生成日报
- Excel 助手：读取 Excel/CSV、识别产品明细、统计数量金额、查重分类和业务分析
- PDF 助手：上传 PDF、读取文字层、AI 总结、问答、拆分、合并和转 Word
- OCR 助手：图片上传、浏览器本地 OCR、结构化字段恢复、TXT/Word/Excel 导出
- PPT 助手：输入主题、行业、页数和用途，通过 AI Gateway 生成逐页大纲
- Word 与 AI 写作：总结、润色、改写、纠错、格式化和文档导出
- SQL 助手：支持 MySQL、SQL Server、Oracle、SQLite、PostgreSQL 的生成、解释和优化
- AI Chat、AI Agent、Agentic RL：自然语言入口、任务拆解、执行记录和反馈学习
- 文件中心、知识库、邮件助手、系统状态中心和系统验收中心
- 设备台账：内置 CNC 加工中心、数控车床、锯床、铣床、锻压机、轧辊机、淬火炉、时效炉
- 数据脱敏：手机号、邮箱、身份证、客户名称、金额和地址简单脱敏
- AI 调用历史与成本统计：查看最近调用、Mock/真实 API 比例、Token 统计和估算费用

## AI Mode

系统支持以下运行模式：

| 模式 | 用途 | 说明 |
| --- | --- | --- |
| Mock | 离线演示 | 无 API Key 也能演示主要流程，结果会明确标记 Mock/演示兜底 |
| API | 真实 AI | 前端通过 HTTPS 调用后端 `/api/chat`，密钥不进入前端 |
| Hybrid | 混合运行 | 优先调用 AI Gateway，异常时按模块提供可识别的兜底结果 |
| Local Model | 预留 | 为后续本地模型和私有化部署保留配置入口 |

真实 AI 推荐使用 DeepSeek OpenAI-compatible API。所有业务模块应通过 AI Gateway 调用模型，不在前端硬编码 API Key。

## 技术栈

- 前端：HTML5、CSS3、原生 JavaScript、响应式布局
- 后端：Node.js、Express、REST API
- 数据：SQLite、localStorage、IndexedDB
- AI：统一 AI Gateway、DeepSeek OpenAI-compatible API、Mock fallback
- 文件处理：SheetJS、ExcelJS、PDF.js、pdf-lib、Mammoth、Tesseract.js
- 安全：JWT、bcrypt、Helmet、CORS、输入校验
- 构建与部署：Node.js 构建脚本、GitHub Pages、Vercel、Docker

## 演示账号

```text
邮箱：admin@personal-ai-os.local
密码：123456
企业：Personal AI OS Demo Enterprise
姓名：企业管理员
角色：企业管理员
```

演示登录状态保存在浏览器 localStorage，刷新页面不会自动退出。

## 模块列表

- 智能办公：AI聊天、Word助手、Excel助手、PDF助手、OCR识别、AI写作、邮件助手、翻译助手、PPT助手、模板中心等
- 企业办公：订单中心、生产计划助手、设备台账、库存中心、采购、销售、质量、ERP、MES、SQL、BOM 等
- 数据管理：文件中心、知识库、图片助手、数据分析、数据校验、版本管理、备份恢复等
- AI 自动化：AI Agent、Agentic RL、工作流、自动报表、日程待办、工作日志等
- 企业协作：项目、任务、会议、CRM、供应商、审批、权限和操作日志等
- 系统中心：AI 状态、系统验收、模型/API 管理、设置、日志、用户角色和系统更新

部分扩展模块保留入口并显示路线图状态；当前演示重点是生产计划、Excel、PDF、OCR、PPT、AI Gateway 和验收闭环。

## 本地构建

要求：Node.js 18+。

```bash
npm install
npm run build
```

构建完成后生成 `dist/`，可用于 GitHub Pages、Vercel 静态前端、Render 静态资源或其他静态托管。

如果你只是做本地开发调试，也可以运行：

```bash
npm start
```

浏览器访问：

```text
http://127.0.0.1:3000
```

开发模式与生产模式共享同一后端入口，前端只需要配置公网 API 地址即可。

## 构建静态版本

```bash
npm install
npm run build
```

构建完成后生成 `dist/`，其中包含可部署的 `index.html`、JavaScript、CSS、资源和 vendor 依赖。

可选静态检查：

```bash
node --check app.js
node --check core.js
node --check ui.js
```

## 配置真实 AI

后端环境变量参考 `.env.example`：

```env
DEEPSEEK_API_KEY=你的DeepSeekKey
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

前端 `config.js` 配置后端地址：

```js
window.PERSONAL_AI_OS_CONFIG = {
  API_BASE_URL: "https://your-api.vercel.app"
};
```

核心接口：

- `GET /api/health`：服务健康检查
- `POST /api/chat`：统一 AI 对话入口

## 部署

### GitHub Pages

1. 执行 `npm run build`。
2. 将 `dist/` 内容发布到 GitHub Pages。
3. 通过仓库内的 GitHub Actions 自动发布到 Pages（见 `.github/workflows/deploy-pages.yml`）。
4. `config.js` 会自动在 GitHub Pages 场景下采用远程后端地址；如需切换，可在浏览器本地存储或前端配置中覆盖。
4. 页面使用 Hash 路由，刷新不会进入不存在的服务器路径。
5. 该方式适合演示，不建议存放真实企业数据。

### Vercel

1. 将仓库连接到 Vercel。
2. 添加 `DEEPSEEK_API_KEY` 和 `DEEPSEEK_BASE_URL`。
3. 部署后测试 `/api/health`。
4. 将 Vercel 地址写入前端 `config.js` 后重新构建前端。

### Render / Railway / 云服务器

1. 以 Node.js 服务方式部署仓库。
2. 设置环境变量：
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL`
   - `DEEPSEEK_MODEL`
   - `PORT`
   - `HOST=0.0.0.0`
3. 启动命令使用 `npm start`。
4. 部署成功后，前端通过公网 HTTPS 地址访问，AI 请求统一打到后端 `/api/chat`。
5. 如果前后端分离，前端 `config.js` 中的 `API_BASE_URL` 必须填写公网后端地址。

### GitHub Pages + Render 双部署

- 前端：GitHub Pages 托管 `dist/`
- 后端：Render 托管 Express 服务
- DeepSeek Key：只放在 Render 环境变量中
- 前端 API 地址：由 `config.js` 自动根据环境选择，GitHub Pages 下默认使用 Render 后端地址
- 如需临时切换后端，可在浏览器本地缓存里保存新的 `personal_ai_os_api_base_url`

## 项目文档

- [面试演示指南](docs/DEMO_GUIDE.md)
- [简历项目描述](docs/RESUME_PROJECT.md)
- [后续路线图](docs/ROADMAP.md)

## 数据与安全说明

- 不要上传企业涉密文件或真实敏感数据到公共演示环境。
- API Key 只应保存在服务端环境变量中，前端只做本地演示保存。
- GitHub Pages 演示版主要使用浏览器本地数据；跨设备实时同步需要正式后端账号和数据库部署。
- GitHub Pages 仅适用于演示，不适合上传真实企业数据；默认使用 localStorage 保存本地工作区。
- API Key 仅保存在当前浏览器，不会自动上传后端。
- AI 输出默认作为建议，生产计划、合同、报价等关键数据需要人工确认。
- 远程 AI 启用时，页面会提示不要输入企业机密、客户隐私、财务数据或未脱敏文件内容。
- 用户可在设置页一键清空本地工作区数据。

## 安全与部署文件

- [安全策略](SECURITY.md)
- [企业内网部署安全指南](docs/DEPLOYMENT_SECURITY.md)
- [部署说明](DEPLOY.md)
