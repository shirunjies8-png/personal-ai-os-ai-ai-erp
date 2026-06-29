# Personal AI OS 企业办公 AI 工作系统

这是在原有前端界面基础上的渐进式升级版本：

- 保留原有 HTML / CSS / JavaScript / UI 风格
- 保留原有模块与交互方式
- 新增 Node.js + Express + SQLite 后端
- 新增用户系统、JWT、RBAC、企业隔离、Agent 工作流、RL 反馈、Mail Agent 骨架
- 保持模块化目录，方便后续继续扩展 ERP / MES / OA / CRM / 邮箱 / OCR / MCP

## 当前架构

```text
Browser
  └─ HTML + CSS + JavaScript
       └─ Node.js + Express
            └─ SQLite
                 └─ Agentic Workflow / RL Feedback / Mail Agent / AI Service
```

## 第一阶段 V1.0 已落地内容

### 1. 后端能力

- Express API 服务
- SQLite 数据库
- JWT 登录
- 密码加密
- 企业数据隔离
- RBAC 基础角色
- 操作日志
- Agent 工作流骨架
- RL 反馈学习骨架
- Mail Agent 骨架

### 2. 已有前端保留

- 首页
- AI聊天
- Excel助手
- Word助手
- PDF助手
- OCR识别
- AI写作
- 邮件助手
- 文件中心
- 知识库
- AI Agent
- 设置

### 3. 新增后端 API 模块

- `/api/auth`
- `/api/state`
- `/api/dashboard`
- `/api/enterprise`
- `/api/orders`
- `/api/inventory`
- `/api/excel`
- `/api/agents`
- `/api/mail`
- `/api/feedback`
- `/api/logs`

## 项目目录

```text
project/
├── public/
├── routes/
├── controllers/
├── middleware/
├── models/
├── services/
├── agents/
├── rl/
├── mail/
├── database/
├── utils/
├── config/
├── uploads/
├── logs/
├── backups/
├── assets/
├── vendor/
├── scripts/
├── README.md
├── package.json
├── server.js
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

## 本地运行

### 安装依赖

```bash
npm install
```

### 启动系统

```bash
npm start
```

启动后默认地址：

[http://127.0.0.1:3000](http://127.0.0.1:3000)

### 构建静态前端包

```bash
npm run build
```

构建产物输出到：

- `dist/`

## 默认管理员账号

首次启动会自动初始化数据库并创建默认管理员：

- 邮箱：`admin@personal-ai-os.local`
- 密码：`Admin123!`

建议上线前通过 `.env` 修改：

- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `JWT_SECRET`

## 环境变量

复制：

```bash
cp .env.example .env
```

重点配置：

- `PORT`
- `JWT_SECRET`
- `DB_PATH`
- `DEEPSEEK_API_KEY`
- `MAIL_AGENT_BASE_URL`
- `MAIL_AGENT_API_KEY`

## 数据说明

### 后端统一管理

以下结构化数据已切到后端统一管理：

- 用户
- 企业
- 订单
- 库存
- Agent 工作流结果
- RL 反馈
- 邮件记录
- 日志
- 应用状态

### 浏览器本地仍保留

为兼容现有前端与离线体验，浏览器端仍保留本地缓存：

- localStorage：前端缓存/草稿
- IndexedDB：前端文件二进制缓存

登录后会优先尝试同步结构化状态到后端。

## 部署

### 1. Render / Railway / VPS

启动命令：

```bash
npm install && npm start
```

### 2. Docker

```bash
docker build -t personal-ai-os .
docker run -p 3000:3000 personal-ai-os
```

或：

```bash
docker-compose up --build
```

### 3. PM2

```bash
pm2 start server.js --name personal-ai-os
```

### 4. Nginx 反向代理

仓库已附带：

- `nginx.conf`

### 5. 纯静态部署说明

当前仓库仍保留：

```bash
npm run build
```

可生成 `dist/` 静态前端包，用于前端静态发布。

但如果你要使用：

- 用户登录
- 后端数据库
- 企业隔离
- 多端实时同步
- Mail Agent
- Agentic Workflow

就必须部署 Node.js 服务端，不再只是上传静态文件。

## 当前已验证

- `npm install` 成功
- `npm start` 成功
- `GET /api/health` 成功
- `POST /api/auth/login` 成功
- 前端首页可通过 Express 提供
- `npm run build` 成功

## 下一步建议

下一阶段建议继续做：

1. 订单中心、库存中心前端页面真正接后端 CRUD
2. 首页仪表盘改为实时读取后端 dashboard
3. 前端登录/注册/企业信息流再做完整化
4. Excel 导入 -> 订单/库存入库流程打通
5. Agent Workflow 结果确认 -> RL 反馈闭环打通
6. Mail Agent 接腾讯 Agent Mail / QQ / 企业 QQ

## 说明

这是“渐进式升级版”，不是推倒重做版。

你现有的页面风格、模块结构、前端交互都保留了，后续可以继续在这个基础上迭代到企业级系统。
