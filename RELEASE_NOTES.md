# Release Notes

版本：`v1.3-practical`

发布时间：2026-07-03

## 本次定位

- 从 `v1.2-agent-runtime-verify` 收口到 `v1.3 实用版`
- 不再强调 PPT 式介绍页，主打真实可操作功能
- 重点保持 AI Chat、OCR、PDF、Excel、生产计划、任务中心的可用性和稳定性

## 调整

- 首页与项目介绍页文案收口为“实用版 / 可实际操作”
- 版本号升级为 `1.3.0`
- README、发布说明与项目状态统一到 v1.3 口径

## 保持不变

- AI Gateway 真实调用与 Mock 兜底策略
- OCR / PDF / Excel / Task Center / Human Approval / Monitor 的现有流程
- 自动 Bug 巡检、自动修复已知问题、回归验证机制

## 已知限制

- 真实 OCR 仍取决于本地/浏览器环境可用性，必要时会明确回退到 Mock 兜底。
- 企业 Connector、MCP、GraphRAG、多 Agent 编排仍保持预留。

---

版本：`v1.2-agent-runtime-verify`

发布时间：2026-07-03

## 新增

- 自动 Bug 巡检：`scripts/bug-scan.mjs`
- 自动修复已知问题：`scripts/auto-fix-known-issues.mjs`
- 浏览器回归验证：`scripts/run-e2e.mjs`
- 一键发布校验：`scripts/verify.mjs`
- 健康检查：`/api/health`
- 自检接口：`/api/self-test`

## 修复

- AI Chat 长回复显示不完整、滚动裁切和旧文案误导问题
- OCR 远程 AI 状态与 AI Gateway 同步问题
- OCR 识别结果误报真实成功的问题
- Agent Runtime 中文状态断言与回归脚本适配问题
- Bug scan 误报问题收口

## 优化

- README 重新整理为交付版结构
- `npm run verify` 变成可直接执行的一键验证流程
- 文档与发布说明更清楚地区分：
  - 已实现
  - 部分实现
  - 预留能力
  - 风险说明

## 验证

- `node --check`：通过
- `npm run build`：通过
- `npm run bug:scan -- --check-only`：通过
- `npm run verify`：通过
- 浏览器自动回归：通过

## 已知问题

- 真实 OCR 在不同浏览器和系统环境下仍可能回退到 Mock 兜底。
- 企业 Connector、MCP 完整协议、GraphRAG、多 Agent 编排仍属于后续版本。

## 风险

- 公共演示版不适合承载真实企业密钥与敏感文件。
- 关键业务建议人工确认后再执行。

## 下一步

- 进入 `v1.3` 时再补企业 Connector、MCP、GraphRAG 和更完整的 Agent 编排。
