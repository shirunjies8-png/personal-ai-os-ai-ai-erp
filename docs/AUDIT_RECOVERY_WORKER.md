# Audit Recovery Worker V2.1 边界

当前实现是持久化 Recovery Runtime，不是常驻后台服务，也不是已部署的外部系统自动恢复。

## Capability Boundary

当前支持：

- Recovery Run Persistence
- Attempt History
- Idempotency
- Situation Check
- No Progress Detection
- Circuit Breaker
- Watchdog
- Manual Retry
- Execution / Verification Separation

当前不支持：

- 强制终止任意同步 Handler
- 自动修复所有未知业务状态
- 自动理解所有失败原因
- 替代人工高风险判断
- 已部署生产级常驻恢复服务

## Terminology Guide

| 禁止用语 | 统一表述 |
| --- | --- |
| 自动修复系统 | 受控自动恢复尝试 |
| 已修复 | 经 Verification 确认的恢复结果 |
| 系统已处理 | Recovery Runtime 已完成一次可验证尝试 |
| 完全自主恢复 | 受治理恢复流程 |

## 状态与停止

`RETRY_SCHEDULED → CLAIMED → RUNNING` 由同一状态机约束：Claim 只选择已到达 `next_retry_at` 的记录，SQLite 条件更新原子写入 Claim Token；随后才允许转入 `RUNNING`。`UNKNOWN` 永不自动重试。`NO_PROGRESS` 进入 `DEAD`，因为相同输入、错误和 Situation 连续出现时继续自动执行没有新的安全依据。

`DEAD` 不代表业务事实永久失败，而是该 Recovery Run 的自动恢复预算已结束。管理员必须提供原因并创建新的 Recovery Run；旧 Attempt 和事件不会被修改。由于“暂时未获得新信息”与“永久不可恢复”不能被系统完全自动区分，管理员应仅在有新证据、依赖恢复或业务条件变化时重试。

## Budget Guard 真实性

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| `max_attempts` | 已实现并测试 | 到达次数后 `DEAD`。 |
| `max_total_elapsed_time` | 已实现并测试 | 以 `recovery_deadline_at` 拒绝执行。 |
| `max_recovery_window` | 已实现并测试 | 创建任务时持久化恢复窗口。 |
| `max_tasks_per_scan` | 已实现并测试 | 受控 `/scan` 每次仅运行一个任务。 |
| `max_tasks_per_worker_cycle` | 已实现并测试 | `runOnce()` 固定最多 Claim 一个任务。 |
| `max_single_execution_time` | 未实现 | 同步 Handler 尚无可中断超时封装；Lease 只防止卡死任务长期占有。 |
| `max_verification_time` | 未实现 | 当前同步 Verifier 无独立可中断超时。 |

## 运行方式

当前需要受认证的管理员 API 调用或宿主调度器调用 `runOnce()`。未配置常驻 Worker、生产 cron 或外部系统全自动恢复。首个受控 Handler 仅安全重放已有 `audit_retry_queue` 中上下文完整的 `runtime_finish` 记录；缺少安全重放上下文的记录进入 `UNKNOWN`。

## Execution Timeout Limitation

当前 Handler / Verifier 为同步执行。Runtime 可以检测异常状态、回收 Lease，并防止重复 Claim；但不能强制停止已经运行中的同步代码。

未来如需更强隔离，应另行设计 Timeout Isolation Layer，例如 Worker Process、Sandbox、Abort Signal 或 External Queue。本轮不实现这些机制。

## 测试边界

专项测试验证的是 Recovery Runtime 的状态机、幂等、租户隔离和治理行为。测试不证明所有真实外部系统已经恢复、所有业务失败可以自动解决，或生产环境已经部署。
