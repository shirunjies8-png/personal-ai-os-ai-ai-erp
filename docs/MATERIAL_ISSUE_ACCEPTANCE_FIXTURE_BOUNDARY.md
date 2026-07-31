# Material Issue Acceptance Fixture Boundary

## 1. Current Dependency Audit

| 对象 | 当前来源 | 实际字段 | 证据位置 | 是否存在 | 是否需要 Fixture |
| --- | --- | --- | --- | --- | --- |
| User | SQLite `users`，JWT 解码后再按 id 查询 | `id`, `enterprise_id`, `email`, `password_hash`, `name`, `role`, `status` | `database/init.js`; `models/userModel.js`; `middleware/auth.js` | YES | YES：申请人、审批人各一条。 |
| Role | `users.role` | `role` | `models/userModel.js`; `services/permissionService.js` | YES | YES：申请人为可操作角色，审批人为 admin 角色。 |
| Enterprise | SQLite `enterprises`，由 user 的 `enterprise_id` 关联 | `id`, `name` 等 | `database/init.js`; `middleware/auth.js` | YES | YES：单一隔离测试企业。 |
| Inventory | SQLite `inventory` | `id`, `enterprise_id`, `product_code`, `product_name`, `stock_quantity`, `safety_stock`, `location`, `version` | `database/init.js`; `repositories/inventoryRepository.js` | YES | YES：正常、库存不足、安全库存三个余额条件。 |
| Material | 当前没有 Material Master；库存直接使用产品字段 | `inventory.product_code`, `inventory.product_name` | `database/init.js`; `repositories/inventoryRepository.js` | NO（主数据） | NO：Fixture 不创建 Material Master。 |
| Approval | `agent_approvals` 与 `runtime_approvals`，由 Approval Service 写入 | `enterprise_id`, `user_id`, `status`, `approved_by`; runtime 的 `run_id`, `human_override`, `override_context` | `services/approvalService.js`; `services/transactionSafetyService.js`; `database/init.js` | YES | 由真实 prepare 自动产生，不直接伪造。 |
| Transaction | 真实业务表与 Runtime trace | `business_transactions`, `stock_transactions`, `material_requisitions`, `runtime_runs`, `runtime_attempts` | `database/init.js`; `services/transactionSafetyService.js` | YES | 由真实 API/UI 产生，不直接插入。 |

## 2. Role / Auth Boundary

- **Requester**：`users.id` / `users.enterprise_id` / `users.role`；通过 `POST /api/auth/login` 取得真实 JWT，再由 `middleware/auth.js` 的 `authRequired()` 验证 JWT 并重新读取用户。
- **Approver**：同一 `enterprise_id` 下的另一条 `users` 记录；`transactionSafetyService.decide()` 明确拒绝 `actor.userId === requisition.requested_by`。
- **审批权限**：`approvalService.decide()` 调用 `permissionService.authorizeApproval()`；该方法以 `securityPolicyService.requireRole(context.role, 'admin')` 判断，不依赖固定 ID 或测试 token。
- **结论**：申请人与审批人必须是不同用户；测试登录必须走真实 JWT 登录流程，不能注入测试 token。

## 3. Minimal Fixture Design

| Fixture | 最小字段/初始值 | 来源 | 用途 |
| --- | --- | --- | --- |
| Test Enterprise | `enterprises.id`, `name` | 隔离 SQLite seed | 所有验收记录的租户边界。 |
| Requester User | `users.id`, 同企业 `enterprise_id`, 启用状态，operator 可用 `role` | 隔离 SQLite seed | 通过真实登录创建申请。 |
| Approver User | 独立 `users.id`，同企业，admin `role` | 隔离 SQLite seed | 通过真实登录进行审批/拒绝。 |
| Normal Inventory | 真实 `inventory` 字段；余额高于申请后安全库存 | 隔离 SQLite seed | Scenario A。 |
| Insufficient Inventory | 真实 `inventory` 字段；`stock_quantity < quantity` | 隔离 SQLite seed | Scenario C。 |
| Safety-stock Inventory | 真实 `inventory` 字段；扣减后非负但低于 `safety_stock` | 隔离 SQLite seed | 审批/覆盖边界。 |

不创建 Material Master、Employee Master、Warehouse Master 或 Production Order；`product_code`/`product_name` 保持为现有 inventory 模型字段。

## 4. Database Isolation Decision

**Decision: A — 支持环境变量注入独立 SQLite。**

`config/env.js` 的 `dbPath` 来自 `process.env.DB_PATH`，默认才回退到 `database/personal-ai-os.sqlite3`；`database/client.js` 使用该路径创建 `better-sqlite3` 连接，并启用 WAL 和 foreign keys。因此未来验收必须在**应用启动前**设置一个临时 `DB_PATH`，绝不使用普通开发数据库。

## 5. Fixture Lifecycle

```text
Create isolated SQLite database
→ initialize existing schema/migrations and seed test enterprise/users/inventory
→ start application with DB_PATH
→ login requester / approver through JWT API and browser
→ future browser acceptance
→ collect same-operation UI/API/SQLite evidence
→ stop managed application/browser
→ remove entire temporary database directory
```

- 清理单位优先为**整库临时目录重建**，而不是按 `enterprise_id` 删除业务记录。
- `finally` 必须在 Scenario 失败后继续执行 cleanup。
- 清理验证：应用/Chrome 已停止，测试 DB 文件与 WAL/SHM 文件所在临时目录不存在；不触及开发数据库。

## 6. Runner Integration Boundary

本轮不执行 A–E。未来 Fixture 注入必须发生在**应用启动前**，由现有 `npm run verify` → `scripts/verify.mjs` → `scripts/run-e2e.mjs` 的同一运行器路径传递 `DB_PATH`、测试账号与库存 fixture 标识。

不得新增生产 API、测试 token 或权限绕过。`run-e2e.mjs` 只在该隔离进程已启动后使用真实页面/API；SQLite 读取只用于同一隔离库的 Evidence 收集。

## 7. Forbidden Scope

- 不修改 Material Issue、库存扣减、审批状态机、Recovery Runtime、生产 API、业务 schema 或 UI。
- 不新增业务字段、业务表、Agent、Skill、Material Master 或任何测试后门。
- 业务问题只能记录 Issue，不能在 Fixture Sprint 中修复。
