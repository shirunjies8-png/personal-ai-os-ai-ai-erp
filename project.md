# 项目目标

在不伪造业务成功或测试证据的前提下，交付可验证的 AI 办公系统；当前聚焦本地、私有的 RapidOCR 产品路径及其受控发布准备。

# 当前状态

- 基线：`main` @ `ad8a5e534394960c05546d634980d3ccb1159e84`；Verified OCR Commit 已创建，尚未 Push 或 Deploy。
- 工作区为混合未提交状态；仓库证据优先于本文档，`anime-pocket-agent/` 保持未触碰。
- RapidOCR 本地产品路径已在隔离 clean-room 中通过定向产品证明：同一保密输入、关键锚点、证据链、浏览器 UI 回读及清理均已验证。
- OCR 变更集已冻结为 Git baseline：commit `ad8a5e534394960c05546d634980d3ccb1159e84`，内容等价于 approved staged patch SHA-256 `7a0984a5f711a0d5c3a7b543b53ef457db777e958c96487f6344e753cec728da`。
- 已按 `tools/ocr-benchmark/rapidocr311.lock` 恢复持久化私有 RapidOCR Python 3.11 runtime：RapidOCR `3.9.2`、ONNX Runtime `1.29.0`、det/cls/rec 均使用 `CPUExecutionProvider`。
- 最新 staged snapshot 已重新通过同一保密输入的 `npm run test:ocr:rapid` 与 `npm run verify -- --rapidocr-product-proof`；结果仍保持 `LOCAL_ONLY`、外部上传 `0`、staged patch SHA-256 未变化。真实用户 OCR 乱码问题仍未关闭。
- RapidOCR Local / On-Prem Deployment Design complete；Deployment Acceptance Contract complete；Implementation not started；Push/Deploy not performed。

# 关键决策

- OCR 路径采用 `LOCAL_ONLY`：保密文档不外发到云 OCR 或外部 AI。
- `ARCHITECTURE EXISTS ≠ PRODUCT CAPABILITY EXISTS`：只有现实运行证据才能标记能力完成。
- 任何提交必须从混合工作区中按清单精确隔离；不得全量暂存，也不得把 `anime-pocket-agent/` 纳入操作范围。
- 产品 OCR 成功状态必须保留 engine raw、normalized、structured 与 UI readback 的可追溯证据；不以页面打开或 HTTP 200 替代终态验证。

# 待办

- NOW：基于已批准 Local / On-Prem Deployment Contract，进行 RealityOS Core Consolidation v1：把 OCR 已验证的 Capability Registry、Dependency Contract、Readiness、Provider Router、Data Placement、Execution Provenance 与 Capability Health 抽象为通用 Core；不部署、不 Push。
- NEXT：Core Consolidation 设计获批准后，再进入受控实现；未授权前保持本地。
- RESERVED：在 OCR 变更正式集成后，使用用户明确提供的原始乱码文件执行同输入产品 Reality Proof；未获得该输入不得关闭真实用户 OCR 乱码问题。

# 风险

- 混合工作区使误暂存风险较高；任何 mixed file 均需逐 hunk 审核。
- RapidOCR runtime 已恢复，但依赖位于用户本机缓存；其他机器或生产环境仍需按 lock 重建同等私有 runtime。
- 通用 OCR 质量尚未全面验证；原用户乱码问题仍须在受治理 rollout 后使用新的用户输入完成 Reality Proof。
- 当前 OCR 证明是本地受控运行结果，不构成生产部署、长期运维或真实用户乱码修复的证据。
- public GitHub Pages 仍不包含本地 Python RapidOCR runtime，无法独立代表完整产品 OCR 运行环境。

# 下一步

基于已批准 Local / On-Prem Deployment Contract，进行 RealityOS Core Consolidation v1：把 OCR 已验证的 Capability Registry、Dependency Contract、Readiness、Provider Router、Data Placement、Execution Provenance 与 Capability Health 抽象为通用 Core；不部署、不 Push。
