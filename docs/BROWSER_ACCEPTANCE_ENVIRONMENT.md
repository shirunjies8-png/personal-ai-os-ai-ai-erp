# Browser Acceptance Environment — Evidence Audit

本文件只描述浏览器验收环境，不验证 Material Issue 业务结果。每项结论均标为 **Confirmed Fact** 或 **Hypothesis**；未满足 Ready 标准时，浏览器业务场景必须标记为 `BLOCKED`，不得以页面代码或自动化旁证替代。

## Application Start

### Confirmed Fact

| 项目 | 证据 |
| --- | --- |
| 统一验证入口 | `package.json` 的 `verify` 脚本执行 `node scripts/verify.mjs`。 |
| 应用启动入口 | `scripts/verify.mjs` 使用当前 Node 运行时 `spawn(nodeExecutable, ['server.js'])` 启动 `server.js`。 |
| 应用监听方式 | `server.js` 调用 `app.listen(env.port, env.host)`；`config/env.js` 默认 `HOST=0.0.0.0`、`PORT=3000`。 |
| 浏览器入口 | `scripts/verify.mjs` 启动 Chrome，初始地址为 `http://127.0.0.1:3000`，远程调试端口为 `9222`。 |
| E2E 基准地址 | `scripts/run-e2e.mjs` 固定使用 `http://127.0.0.1:3000` 与 Chrome `9222`。 |

### Important Port Fact

`server.js` 启动日志打印 `env.appUrl`，而不是实际传入 `app.listen()` 的 `env.port`/`env.host`。`APP_URL` 默认值也是 `http://127.0.0.1:3000`。因此，当临时命令只覆盖 `PORT` 而没有同步覆盖 `APP_URL` 时，日志中的 URL **不能证明**服务实际监听了该 URL；必须以目标 `/api/health` 的成功响应作为证据。

## Process Lifecycle

### Confirmed Fact

`scripts/verify.mjs` 是当前唯一同时拥有应用与 Chrome 生命周期的仓库脚本：

1. 启动 `server.js` 和 Chrome（均为独立进程组）。
2. 等待 `http://127.0.0.1:3000/api/health`、`/api/self-test` 与 Chrome CDP `http://127.0.0.1:9222/json/version`。
3. 在上述检查通过后调用 `scripts/run-e2e.mjs`。
4. 无论成功或失败，均在 `finally` 中向两个进程组发送 `SIGTERM`。

`scripts/run-e2e.mjs` 本身不启动应用或 Chrome；它假定二者已由宿主提供。

### Failure Evidence

来自 [MATERIAL_ISSUE_BROWSER_ACCEPTANCE.md](MATERIAL_ISSUE_BROWSER_ACCEPTANCE.md) 的已记录事实：

- 时间：`2026-07-31T12:37:10+0800`。
- 尝试：为浏览器验收准备隔离临时 SQLite，启动临时 Node 服务，再使用 Playwright CLI 打开 `http://127.0.0.1:3107`。
- 结果：启动命令结束后，后续 HTTP 连接无法访问该临时服务；Playwright 未生成可用于验收的页面快照。
- 影响：不能在同一次浏览器会话中同时得到 UI、API 和 SQLite 证据，已记录的 Material Issue A–D 场景为 `BLOCKED`。

### Confirmed Root Boundary

该失败的可确认根因是：临时浏览器验收没有复用仓库已有、统一管理服务和 Chrome 生命周期的 `scripts/verify.mjs`；同时，临时端口的启动日志可能受 `APP_URL` 默认值误导。因而“服务持续可访问的实际监听地址”没有在浏览器启动前通过同一生命周期中的健康检查得到证明。

### Hypothesis — Not a Conclusion

执行宿主可能会在单次命令结束后回收后台子进程，导致临时 Node 服务不再可用；现有证据不足以把该宿主行为归因为唯一根因。后续只能在由单一运行器持有的服务/浏览器会话中重复验证，不能将“环境不稳定”当作结论。

## Network Contract

| 项目 | 当前事实 | 验收要求 |
| --- | --- | --- |
| 应用监听 | `HOST`/`PORT` 控制；默认 `0.0.0.0:3000` | 固定一个运行周期内不变的端口。 |
| 浏览器地址 | 现有 verify/E2E 为 `http://127.0.0.1:3000` | 浏览器打开的地址必须与成功 health 地址一致。 |
| 健康检查 | `GET /api/health`，证据：`routes/index.js` | HTTP 成功且 JSON 中 `ok: true`。 |
| 自检 | `GET /api/self-test`，证据：`routes/index.js` | verify 中必须返回 `ok: true`。 |
| Chrome 调试 | `http://127.0.0.1:9222/json/version` | 必须在 UI 自动化前可访问。 |

## Ready Detection

### Confirmed Fact

`scripts/verify.mjs` 以每 500ms 轮询、最长 30 秒的 HTTP 成功响应作为服务和 Chrome CDP 的 Ready 判断；对 `/api/health` 与 `/api/self-test` 还会读取 JSON 并要求 `ok` 为真。它不是固定 sleep 判定。

`scripts/run-e2e.mjs` 在每个页面操作前以网络可达性等待服务，但不负责启动服务；因此不得将它单独作为 Browser Acceptance 的生命周期管理器。

## Environment Ready Criteria

一个 Browser Acceptance Environment 只有同时满足以下条件才可标记 `READY`：

1. 应用在固定端口持续运行，且运行器拥有停止责任。
2. 同一 base URL 的 `/api/health` 成功且 `ok: true`。
3. Playwright/浏览器可以打开登录页或应用入口，并建立页面会话。
4. 以上流程连续 2–3 次成功。
5. 整个过程不依赖人工临时启动、手工切换端口或手工修复会话。

任一项不满足即为 `BLOCKED`；不得开始或标记业务浏览器验收成功。

## Browser Acceptance Data Boundary

未来浏览器验收必须使用独立测试数据库、测试用户和测试企业，并只在运行器显式传入这些非生产测试配置时运行。业务验证应在测试完成后由运行器清理其自有进程；本轮不创建测试数据库、不创建测试账号、不写入业务数据。

## Relationship to `npm run verify`

当前 `npm run verify` 已包含：语法检查、静态构建、只读 bug scan，以及由 `scripts/verify.mjs` 统一持有的 Chrome/E2E 生命周期。Browser Acceptance 不应新建第二套重复的服务启动、健康检查和进程清理机制。

后续需要浏览器业务验收时，应在既有 `scripts/verify.mjs` / `scripts/run-e2e.mjs` 这条路径中，以可配置的 base URL 和隔离测试数据边界扩展；新增辅助代码如确有必要，只能负责启动应用、等待 Ready、清理自有进程和提供 base URL，不能包含库存断言、领料断言或写入业务数据。

## Current Decision

**Environment status: BLOCKED.**

原因不是笼统的“环境不稳定”，而是上述 Ready Criteria 尚无连续 2–3 次、由统一生命周期管理的浏览器可访问证据。现有 `npm run verify` 的脚本结构可以作为后续唯一的稳定化路径；本轮仅记录边界，不修改该脚本，也不把未完成的 Material Issue 浏览器场景改标为通过。
