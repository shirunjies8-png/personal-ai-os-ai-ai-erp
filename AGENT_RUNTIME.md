# Agent Runtime V1

## 当前定位

Industrial AI OS 已从 AI 办公 MVP 升级为具备 Enterprise Agent Runtime V1 骨架的可运行系统。

当前实现不是完整企业级生产 Agent 平台，仍属于：

- 可运行
- 可测试
- 可扩展
- 明确标注预留项

## 已完成

- Agent 任务创建
- Agent 任务执行
- Agent 任务状态流转
- Agent 执行日志
- Agent 调用 Tool Center
- Agent 汇总结果
- Agent 失败中文返回
- Human Approval 断点
- 本地 SQLite 任务持久化
- Monitor 统计
- Memory V1（session/task/user preference/tool result）

## 状态流转

- `pending`
- `running`
- `waiting_human`
- `success`
- `failed`
- `timeout`
- `cancelled`

## 任务执行链路

1. 创建任务
2. 生成计划
3. 调用匹配工具
4. 如为高风险动作则进入 `waiting_human`
5. 用户批准后继续
6. 进入 AI 汇总
7. 写入任务日志与 Memory
8. 输出最终结果

## 已验证能力

- 普通 CSV 分析任务可自动完成并进入 `success`
- 高风险导出任务会进入 `waiting_human`
- 审批通过后可继续执行并完成 AI 汇总
- 用户可取消任务
- 用户可重试任务
- 监控可统计任务总量、成功数、失败数、等待审批数、工具调用数

## 当前页面入口

- `AI Agent`
- `任务中心`
- `Tool Center`
- `Human Approval`
- `系统监控`

## 风险边界

- 高风险动作不会自动继续执行
- 没有来源时会标注“未引用来源”
- 不确定时会标注“无法确认”
- 不保存 API Key
- 不保存敏感文件全文
- 单进程本地执行，不承诺断电恢复或分布式调度

## 预留项

- Redis / 队列化异步执行
- 多进程恢复
- 标准 MCP Server 接入
- 完整 RAG / GraphRAG 生产能力
- 真实企业 Connector 编排
