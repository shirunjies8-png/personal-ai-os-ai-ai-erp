# Browser Acceptance Runtime Changelog

## Scope

本变更只稳定 `npm run verify` 的应用与浏览器生命周期；不改变 Material Issue、库存、数据库 schema、业务 API 或 UI。

## Before

`scripts/verify.mjs` 会在同一时刻启动 `server.js` 与 Chrome，随后等待 health 与 Chrome CDP，并调用 `scripts/run-e2e.mjs`。两个进程均为 detached 进程组，最终尝试向进程组发送 `SIGTERM`。

已存在的缺口：

- Chrome 可在应用 health 之前启动；
- `3000` 或 `9222` 已被旧进程占用时，Ready 检查可能连接非本轮进程；
- Chrome 使用固定 profile 目录，可能遗留会话或锁；
- 清理后没有检查端口是否释放；
- 环境专用的入口访问没有独立于业务 E2E 的同脚本模式。

首次修复验证还记录到：入口导航已成功，但日志转发函数把 child process 参数命名为 `process`，错误地向 child 的只读 stdout 管道回写，触发 `EPIPE`。该错误属于验证器输出转发，不代表应用 health 或页面导航失败；运行器现在向父验证进程的 stdout/stderr 转发，并显式将输出管道关闭条件与业务失败分离。

## After

`npm run verify` 仍是唯一入口：

```text
verify.mjs
  → port preflight
  → start managed server
  → /api/health + /api/self-test
  → start managed Chrome with temporary profile
  → Chrome CDP ready
  → run-e2e.mjs
  → PID cleanup + port-release evidence
```

`scripts/run-e2e.mjs --environment-only` 是同一 E2E 脚本的无业务写入入口检查：只导航至应用入口并验证页面完成加载。它不创建用户、不执行领料、不更改库存；由 `verify.mjs --environment-only` 连续执行两个完整生命周期以验证 Ready 标准。此前 detached 进程在本宿主中曾在启动日志后以 `code=0` 退出、health 随即不可达；运行器现改为父进程直接持有的子进程，避免将该宿主行为误判为业务错误。

## Process Management

- 应用：`child_process.spawn(process.execPath, ['server.js'])`，`stdio: pipe`，由 verify 父进程直接持有。
- Chrome：`child_process.spawn(chromePath, [...])`，`stdio: pipe`，由 verify 父进程直接持有，每轮使用独占临时 profile。
- 收尾：无论成功或失败，`finally` 向已知子进程 PID 发送 `SIGTERM`，等待退出，并以非绑定式 TCP 连接探测 `3000` 与 `9222` 是否释放。此方式避免受限宿主拒绝测试进程临时绑定端口（`EPERM`）时产生误判。
- 失败：输出 `BROWSER_ENVIRONMENT_EVIDENCE`，包括阶段、PID、父 PID、退出状态、最近 stdout/stderr、端口和 base URL；不将环境失败伪装为业务失败。

## Ready Contract

一轮成功必须完成：启动应用 → health/self-test → 启动 Chrome → CDP → 打开应用入口 → 关闭浏览器 → 清理应用 → 两端口释放。`--environment-only` 模式必须连续两轮成功才输出 `READY`；否则为 `BLOCKED`。

## Runtime Evidence

首次排查中，直接启动命令曾在输出启动日志后以 exit code `0` 结束，且 health 不可达；最初的 detached 生命周期与日志转发缺陷使该现象不能作为浏览器验收证据。它被保留为历史失败记录，而不是“宿主无法监听端口”的结论。

修复后，受 `verify.mjs` 管理的实际证据为：

- 标准 `npm run verify`：`/api/health`、`/api/self-test`、Chrome CDP、既有 E2E 与清理均成功。
- `npm run verify -- --environment-only`：连续两轮均完成服务启动、health/self-test、Chrome CDP、应用入口导航、显式清理；每轮的 `3000` 与 `9222` 均确认不可再连接。
- Chrome 输出仍包含 Crashpad/updater 警告，但两种验证命令均以 exit code `0` 成功，未观察到它影响 CDP 或入口导航。

结论：当前 Browser Acceptance Environment 为 `READY`，仅表示运行时前提已满足；不表示任何 Material Issue 浏览器业务 Scenario 已完成验证。可重复命令：`npm run verify -- --environment-only`。

## Compatibility

默认 `npm run verify` 仍执行完整既有 E2E。环境模式仅由 `npm run verify -- --environment-only` 使用，不构成第二个 Browser Runner。
