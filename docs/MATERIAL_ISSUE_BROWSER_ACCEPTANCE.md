# Material Issue Browser Acceptance Reality Check

判定规则：只有同一 Scenario 同时具备 UI Evidence、API Evidence 和 Database Evidence，才可标记为 `VERIFIED`。自动化 API 或页面测试只能作为旁证，**自动化验证 != 人类浏览器验证**。

## Test Identity Boundary

本次仅为隔离浏览器验收尝试准备了临时 SQLite：

| 角色 | 账号来源 | JWT 角色 | `enterprise_id` | 浏览器登录结果 |
| --- | --- | --- | --- | --- |
| 申请用户 | 临时数据库 `users` 记录 `applicant.browser@example.test` | `企业管理员` | `browser-enterprise` | BLOCKED：浏览器未取得页面会话。 |
| 审批用户 | 临时数据库 `users` 记录 `approver.browser@example.test` | `企业管理员` | `browser-enterprise` | BLOCKED：浏览器未取得页面会话。 |

代码证据：`middleware/auth.js` 的 `authRequired()` 从 JWT 注入 `req.user`；`controllers/transactionSafetyController.js` 将 `req.user.id`、`req.user.role`、`req.user.enterprise_id` 传入领料服务；`transactionSafetyService.decide()` 拒绝申请人审批自己的申请。

## Scenario A — 正常领料

### User Action

申请用户登录 → 库存中心选择库存 → 输入业务操作号和数量 → 发起预检查；非申请人管理员批准；申请用户执行受控扣减。

### Expected UI State

审批卡显示 WAITING_APPROVAL 后显示 APPROVED，执行后显示 COMMITTED；库存列表显示数量减少、版本增加。

### UI Evidence

无。见本文件的 Environment Blocked 记录。

### API Evidence

旁证：`scripts/material-issue-api-test.mjs` 已验证受认证创建、非申请人审批、执行和 `COMMITTED` 响应；不作为浏览器验收替代。

### Database Evidence

无本次浏览器操作产生的记录。现有 API 测试旁证验证 `inventory.stock_quantity`、`inventory.version`、`stock_transactions`、`material_requisitions` 和 `business_transactions`。

### Verification Status

BLOCKED

## Scenario B — 审批拒绝

### User Action

申请用户发起预检查 → 非申请人管理员选择拒绝并填写原因。

### Expected UI State

申请显示 REJECTED；执行按钮不可用；库存列表不变。

### UI Evidence

无。见 Environment Blocked。

### API Evidence

旁证：`transactionSafetyService.decide()` 将拒绝同步写入 `transaction_preparations`、`material_requisitions` 和业务操作状态。

### Database Evidence

无本次浏览器操作产生的记录；未将代码阅读或自动化旁证认定为浏览器事实。

### Verification Status

BLOCKED

## Scenario C — 库存不足

### User Action

申请用户输入大于 `inventory.stock_quantity` 的领料数量并发起预检查/执行。

### Expected UI State

审批卡显示库存不足阻断；不得显示执行成功；库存不变。

### UI Evidence

无。见 Environment Blocked。

### API Evidence

旁证：`repositories/inventoryRepository.js` 的 `conditionalDeduct()` 强制 `stock_quantity - quantity >= 0`；`scripts/transaction-safety-test.mjs` 覆盖库存不足业务规则。

### Database Evidence

无本次浏览器操作产生的记录。

### Verification Status

BLOCKED

## Scenario D — 并发冲突

### User Action

申请用户完成 Preparation；审批等待期间由另一受控操作改变同一库存版本；再批准并执行原申请。

### Expected UI State

页面显示 `CONCURRENCY_ABORT` 或等价真实错误；库存不得发生第二次扣减。

### UI Evidence

无。见 Environment Blocked。

### API Evidence

旁证：`conditionalDeduct()` 以 `version=@expectedVersion` 保护更新；`scripts/transaction-safety-test.mjs` 验证版本冲突结果为 `CONCURRENCY_ABORT`。

### Database Evidence

无本次浏览器操作产生的记录。

### Verification Status

BLOCKED

## Scenario E — UNKNOWN

### User Action

需要可重复制造“外部执行结果无法确认”的真实条件后，在 UI 中查看 UNKNOWN 状态和人工处理边界。

### Expected UI State

不得自动重试或显示成功；应进入人工/独立查询路径。

### UI Evidence

无。

### API Evidence

当前 Material Issue 代码声明 `UNKNOWN` 事务状态，但本轮未找到可稳定、无副作用地从浏览器构造该状态的现有操作入口。

### Database Evidence

无可重复的本次浏览器写入。

### Verification Status

NOT VERIFIED

## Environment Blocked

- 时间：`2026-07-31T12:37:10+0800`
- 尝试方式：在隔离临时 SQLite 中准备两个同企业管理员与一条库存记录；启动本地 Node 服务；使用 Playwright CLI 打开 `http://127.0.0.1:3107`。
- 原因：当前执行环境在启动命令结束后未保持临时 Node 服务可访问；后续 HTTP 连接失败，Playwright 未产生可用于验收的页面快照。
- 影响：无法同时获得真人 UI、同次 API 请求和同次 SQLite 状态，故 A–D 不能标记 VERIFIED。

## Issue List

1. **ENV-MATERIAL-ISSUE-BROWSER-001**：本执行环境无法保持隔离本地服务供后续 Playwright 会话使用；需要可持续的浏览器/服务会话后，才能完成双角色真人浏览器验收。
2. **UNKNOWN scenario not reproducible**：当前没有已证实的无副作用浏览器入口可稳定制造 Material Issue UNKNOWN；本轮不新增故障注入或业务逻辑。

## Status Summary

| 状态 | 数量 |
| --- | ---: |
| VERIFIED | 0 |
| NOT VERIFIED | 1 |
| BLOCKED | 4 |
