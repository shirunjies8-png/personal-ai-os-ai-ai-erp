# 部署说明

Industrial AI OS 现在采用双部署架构：

- 前端：GitHub Pages
- 后端：Render Express 服务

## 一、GitHub Pages 部署前端

1. 在仓库中运行构建：

```bash
npm install
npm run build
```

2. 将 `dist/` 发布到 GitHub Pages。
3. 仓库内已配置 GitHub Actions：`.github/workflows/deploy-pages.yml`。
4. 每次推送 `main` 分支后会自动构建并发布前端静态页面。
5. 前端 API 地址不要写死 `localhost`，而是通过 `config.js` 自动读取环境。

GitHub Pages 仅用于前端静态页面，不保存企业密钥。

## 二、Render 部署后端

1. 在 Render 新建 Web Service，连接当前仓库。
2. 推荐使用仓库内的 `render.yaml`。
3. 启动命令：

```bash
npm start
```

4. 健康检查路径：

```text
/api/health
```

5. 在 Render 环境变量中配置：

```env
DEEPSEEK_API_KEY=你的真实DeepSeekKey
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
HOST=0.0.0.0
PORT=3000
APP_URL=https://你的Render后端地址
```

6. 部署后后端会提供：

- `GET /api/health`
- `POST /api/chat`

## 三、前端如何连接 Render 后端

前端通过 `config.js` 自动选择 API 地址：

- 本地开发：默认使用当前站点地址
- GitHub Pages：默认使用 Render 后端地址
- Render 上托管前端：默认使用当前站点地址

如果要手动切换后端，可以在浏览器 localStorage 中设置：

```text
personal_ai_os_api_base_url
```

值示例：

```text
https://your-render-service.onrender.com
```

## 四、DeepSeek API Key 如何配置

DeepSeek Key 只放在 Render 环境变量里：

```env
DEEPSEEK_API_KEY=你的真实DeepSeekKey
```

不要写进前端代码、不要提交到 GitHub Pages、不要放进 `config.js`。

## 五、部署后检查

部署成功后，请先确认：

- 打开前端页面能看到首页
- `/api/health` 返回 `ok: true`
- 点击“测试 AI 连接”能请求 Render 后端
- DeepSeek 可返回真实结果
- 手机和电脑浏览器都能打开

## 六、可选云平台

如果你不用 Render，也可以把后端部署到：

- 云服务器
- Railway
- 其它支持 Node.js 的平台

但前端仍建议统一发布到 GitHub Pages，后端统一走公网 HTTPS 地址。

