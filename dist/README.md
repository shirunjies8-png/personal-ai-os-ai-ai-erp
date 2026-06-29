# Personal AI OS 企业人工智能操作系统

这是在现有 Personal AI OS 项目基础上的升级版，不推倒重做，保留了原有 UI、HTML、CSS、JavaScript 和模块结构，并把核心链路升级为：

- 前端：可部署到 GitHub Pages 的纯静态网页
- 后端：可部署到 Vercel 的 HTTPS API
- AI：统一通过后端 `POST /api/chat` 调用 DeepSeek OpenAI-compatible API
- 登录：GitHub Pages 可用的演示登录
- 本地开发：仍支持 `http://127.0.0.1:3000`

## 1. 普通用户怎么使用

前端网址部署后直接打开：

- [https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

默认演示账号：

- 邮箱：`admin@personal-ai-os.local`
- 密码：`123456`
- 企业名称：`Personal AI OS Demo Enterprise`
- 姓名：`企业管理员`
- 角色：`企业管理员`

特点：

- 登录状态保存在浏览器 `localStorage`
- 刷新页面不掉登录
- 支持退出登录
- 如果账号密码错误，会提示：
  - `账号或密码错误，请使用演示账号 admin@personal-ai-os.local / 123456`

## 2. 当前真运行能力

当前已接成真实可操作的模块：

- AI Chat：输入问题 → 调用后端 `/api/chat` → 显示真实回复 / loading / 错误
- AI 写作：日报、周报、月报、合同、产品介绍、邮件等
- AI SQL 助手：生成 SQL、解释 SQL、优化 SQL
- AI PDF / Word：提取文本后调用 AI 总结
- AI Excel：前端解析表格、预览、统计、再把摘要发给 AI
- 企业 AI 助手中心：用自然语言调度订单、库存、计划、邮件、知识
- Agentic RL 学习中心：任务拆解、逐步调用 AI、汇总结果、保存反馈
- AI 芯片助理：Verilog / RTL / Testbench / FPGA / ASIC / RISC-V 问答

说明：

- 前端不保存 `DEEPSEEK_API_KEY`
- 后端不可用时不会假装成功
- 会显示真实错误，例如：
  - `后端未配置 DEEPSEEK_API_KEY`
  - `AI 后端连接失败`
  - `模型返回为空`

## 3. 项目结构

```text
project/
├── api/                  # Vercel serverless API
├── agents/
├── assets/
├── backups/
├── config/
├── controllers/
├── core.js
├── app.js
├── ui.js
├── styles.css
├── config.js
├── database/
├── dist/
├── index.html
├── knowledge/
├── logs/
├── mail/
├── mcp/
├── middleware/
├── models/
├── ocr/
├── plugins/
├── public/
├── rag/
├── reports/
├── rl/
├── routes/
├── scripts/
├── server.js
├── services/
├── uploads/
├── utils/
├── vendor/
├── vercel.json
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

## 4. 本地开发运行（Mac / Windows / Linux）

### 4.1 前端静态测试

先构建：

```bash
npm install
npm run build
```

然后静态打开 `dist`：

```bash
python3 -m http.server 8080 -d dist
```

访问：

- [http://127.0.0.1:8080](http://127.0.0.1:8080)

### 4.2 本地全栈运行

```bash
npm install
npm run dev
```

访问：

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

本地默认管理员账号：

- 邮箱：`admin@personal-ai-os.local`
- 密码：`123456`

## 5. 手机用户怎么使用

适用于：

- iPhone Safari
- 安卓 Chrome
- iPad 浏览器

使用方式：

1. 直接打开 GitHub Pages 前端网址
2. 输入演示账号登录
3. 在设置里填写或确认后端 API 地址
4. 即可使用 AI Chat、AI 写作、AI SQL、邮件助手、Agentic RL 等模块

手机端已保留响应式布局：

- 按钮可点
- 输入框可编辑
- 文件上传可用
- AI 回复区可滚动

## 6. GitHub Pages 部署

前端是纯静态网页，部署到 GitHub Pages。

### 6.1 构建

```bash
npm install
npm run build
```

### 6.2 上传内容

把 `dist/` 目录中的文件部署到 GitHub Pages。

需要包含：

- `index.html`
- `config.js`
- `core.js`
- `app.js`
- `ui.js`
- `styles.css`
- `assets/`
- `vendor/`
- `404.html`

### 6.3 前端地址

建议地址：

- [https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/](https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/)

### 6.4 注意

部署前请修改 [config.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/config.js) 中的：

```js
window.PERSONAL_AI_OS_CONFIG = {
  API_BASE_URL: "https://你的-vercel-后端地址.vercel.app"
}
```

## 7. Vercel 后端部署

后端 API 部署到 Vercel。

当前已提供：

- [api/health.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/api/health.js)
- [api/chat.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/api/chat.js)
- [vercel.json](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/vercel.json)

### 7.1 创建 Vercel 项目

把当前仓库连接到 Vercel。

### 7.2 配置环境变量

在 Vercel 后台添加：

```bash
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

### 7.3 部署完成后

你会得到类似地址：

- `https://personal-ai-os-api.vercel.app`

### 7.4 测试接口

健康检查：

```bash
GET /api/health
```

返回：

```json
{ "ok": true, "service": "personal-ai-os-api" }
```

聊天接口：

```bash
POST /api/chat
```

请求：

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "module": "ai-chat"
}
```

返回：

```json
{
  "ok": true,
  "reply": "AI回复内容"
}
```

## 8. 更新前端后端地址

部署好 Vercel 后，把 [config.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/config.js) 中的 `API_BASE_URL` 改成真实地址，然后重新执行：

```bash
npm run build
```

再把新的 `dist/` 发布到 GitHub Pages。

## 9. 开发者提交流程

```bash
git add .
git commit -m "Upgrade Personal AI OS to real AI version"
git push
```

## 10. 错误处理策略

系统当前明确区分这几类错误：

- 后端未配置密钥：
  - `后端未配置 DEEPSEEK_API_KEY`
- 后端不可达：
  - `AI 后端连接失败`
- 模型异常：
  - `模型返回为空`
- 登录错误：
  - `账号或密码错误，请使用演示账号 admin@personal-ai-os.local / 123456`

不会静默失败，也不会伪造 AI 成功结果。

## 11. 已同步的重要文件

本次升级重点同步了这些文件：

- [index.html](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/index.html)
- [config.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/config.js)
- [app.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/app.js)
- [core.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/core.js)
- [ui.js](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/ui.js)
- [styles.css](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/styles.css)
- [public](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/public)
- [dist](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/dist)
- [api](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/api)
- [vercel.json](/Users/shirunjie/Documents/Codex/2026-06-27/personal-ai-os-ai-ai-erp/vercel.json)

## 12. 说明

这是“真运行版”的第一阶段升级：

- 不删原模块
- 不改原风格
- 不推倒重建
- 只把原来的静态演示页升级成可部署、可登录、可调 AI、可报错、可在全设备浏览器运行的版本
