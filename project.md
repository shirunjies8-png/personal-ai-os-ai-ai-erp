# 项目目标

在不伪造业务成功或测试证据的前提下，交付可验证的 AI 办公系统 / RealityOS；当前正式切换为 `FRAMEWORK_FIRST`，先完成 RealityOS 完整框架治理，再进入产品能力验证计划。

# 当前状态

- 基线：`main` @ `51fe38706e81bc14bcddc0c65d2fe0fa070a5683`；Effect Governance Contract v1 Verified Commit 已创建，尚未 Push 或 Deploy。
- 工作区为混合未提交状态；仓库证据优先于本文档，`anime-pocket-agent/` 保持未触碰。
- FRAMEWORK_FIRST 已冻结；当前开发顺序为 W0 Architecture Governance → W1 Kernel Completion → W2 Platform Completion → W3 Evolution + Domain → Framework Freeze → Product Capability Validation Program。
- RealityOS Architecture Governance Baseline W0 已在本地建立：21 Module Registry、Canonical Vocabulary、Source-of-Truth Map、Dependency Graph、CURRENT Status Matrix、Current Minimum Closed Loop、Target W1 Kernel Loop 与 Product Validation Backlog 均已定义并通过 validator；Commit/Push/Deploy 均未执行。
- RapidOCR 本地产品路径已在隔离 clean-room 中通过定向产品证明：同一保密输入、关键锚点、证据链、浏览器 UI 回读及清理均已验证。
- OCR 变更集已冻结为 Git baseline：commit `ad8a5e534394960c05546d634980d3ccb1159e84`，内容等价于 approved staged patch SHA-256 `7a0984a5f711a0d5c3a7b543b53ef457db777e958c96487f6344e753cec728da`。
- 已按 `tools/ocr-benchmark/rapidocr311.lock` 恢复持久化私有 RapidOCR Python 3.11 runtime：RapidOCR `3.9.2`、ONNX Runtime `1.29.0`、det/cls/rec 均使用 `CPUExecutionProvider`。
- 最新 staged snapshot 已重新通过同一保密输入的 `npm run test:ocr:rapid` 与 `npm run verify -- --rapidocr-product-proof`；结果仍保持 `LOCAL_ONLY`、外部上传 `0`、staged patch SHA-256 未变化。真实用户 OCR 乱码问题仍未关闭。
- RapidOCR Local / On-Prem Deployment Design complete；Deployment Acceptance Contract complete；Implementation not started；Push/Deploy not performed。
- RealityOS Core Consolidation v1 已完成并创建 Verified Commit：`ea6cd9e63e89c397a62763c18befd3260b848099`；新增通用 Core 合约，并将 OCR/RapidOCR 迁移到 Capability Registry、Dependency Contract、Readiness、Preflight、Provider Router、Data Policy、Execution Provenance、Expected/Actual 与 Capability Health；Push/Deploy 均未执行。
- Core v1 clean-room 验证已通过：`npm run check`、`npm run test:unit`、`npm run build`、`node scripts/realityos-core-test.mjs`、`node scripts/ocr-provider-test.mjs`、`npm run test:ocr:rapid` 均在只 overlay Core v1 changeset 的 `/tmp` snapshot 中通过。
- 最新 Browser Core product proof 已通过：浏览器加载 `realityos-core.js`，OCR UI 通过 RapidOCR 本地 API 进入 `rapidocr-local`，`/readiness` 与 `/recognize` 返回 200，input SHA-256 匹配，87 regions，关键锚点命中，`partial_success` 被保留，cleanup 释放 3212/9323；Commit/Push/Deploy 均未执行。
- Effect Governance Contract v1 已创建 Verified Commit：`51fe38706e81bc14bcddc0c65d2fe0fa070a5683`；验证等级为 `CONTRACT_ONLY`，Core regression 与 OCR regression 均已通过；生产 Effect Reality Closure 尚未实现，Push/Deploy 均未执行。

# 关键决策

- OCR 路径采用 `LOCAL_ONLY`：保密文档不外发到云 OCR 或外部 AI。
- `ARCHITECTURE EXISTS ≠ PRODUCT CAPABILITY EXISTS`：只有现实运行证据才能标记能力完成。
- `FRAMEWORK_FIRST = TRUE`：具体产品能力验证全部后移到 Product Validation Backlog，已验证 baseline 保留但不打断框架主线。
- RealityOS 固定为 21 个一级模块；新概念必须归入现有 Owner，不创建平行 Core、Runtime 或第二套架构。
- Evidence Runtime 是 Provenance / Lineage 的唯一 Source of Truth；Authority、Human Control、Execution、Reality、Evidence、Audit 必须分离。
- 任何提交必须从混合工作区中按清单精确隔离；不得全量暂存，也不得把 `anime-pocket-agent/` 纳入操作范围。
- 产品 OCR 成功状态必须保留 engine raw、normalized、structured 与 UI readback 的可追溯证据；不以页面打开或 HTTP 200 替代终态验证。
- RealityOS Core v1 只能承载已由 OCR 证明过的通用合约；Effect Governance、Resume Authority、Human Control Runtime、Improvement MetaRSI、Model Supply-Chain、Writing Capability Pack 均保留为未实现。

# 待办

- NOW：精确隔离并审核 RealityOS Architecture Governance Baseline W0 changeset；确认 21 Module Registry、Canonical Vocabulary、Source-of-Truth Map、Dependency Graph、CURRENT Status Matrix、Current Minimum Closed Loop、Product Validation Backlog 与 project.md 无历史污染后，创建独立 W0 Governance commit；Push=NO，Deploy=NO。完成后进入 W1 Kernel Completion，不返回 OCR 等具体产品验证。
- RESERVED：W1 Kernel Completion、W2 Platform Completion、W3 Evolution + Domain、Framework Freeze、Product Capability Validation Program。
- RESERVED：OCR、PDF、Word、Excel、PPT、Email、Translation、Writing、Knowledge Product、Contract、Tender、Quote、Procurement、Sales、Production、Shipping、Warehouse、Quality、ERP、MES、Equipment、Data Analysis、GEO、WorkBuddy、Agent Economy、Robot、Physical AI、Effect Reality Closure Demo 均后移到 Product Validation Backlog。
- RESERVED：在 OCR 变更正式集成后，使用用户明确提供的原始乱码文件执行同输入产品 Reality Proof；未获得该输入不得关闭真实用户 OCR 乱码问题。

# 风险

- 混合工作区使误暂存风险较高；任何 mixed file 均需逐 hunk 审核。
- RealityOS 完整框架规模大，当前 W0 是架构治理基线，不代表 W1/W2/W3 已实现。
- Target/Current 混淆风险高；`TARGET_W1_KERNEL_LOOP` 不等于当前已实现闭环。
- 概念重复风险仍存在；后续新增 GEO、Payment、Knowledge、WorkBuddy、Self-Improvement 等内容必须先映射到唯一 Owner。
- RapidOCR runtime 已恢复，但依赖位于用户本机缓存；其他机器或生产环境仍需按 lock 重建同等私有 runtime。
- 通用 OCR 质量尚未全面验证；原用户乱码问题仍须在受治理 rollout 后使用新的用户输入完成 Reality Proof。
- 当前 OCR 证明是本地受控运行结果，不构成生产部署、长期运维或真实用户乱码修复的证据。
- public GitHub Pages 仍不包含本地 Python RapidOCR runtime，无法独立代表完整产品 OCR 运行环境。
- Browser proof 在非提升沙箱下曾因 server 后台生命周期受限而阻塞；提升权限确认同一 server `/api/health` 正常 200。最新 clean-room Browser proof 已通过，但 Chrome 仍输出 macOS display / Crashpad 环境警告，需继续记录为环境噪声而非产品失败。
- Effect Governance v1 当前为 `CONTRACT_ONLY` 验证级别，不代表真实外部 mutation 或生产 Effect Closure 已完成。

# 下一步

精确隔离并审核 RealityOS Architecture Governance Baseline W0 changeset；确认 21 Module Registry、Canonical Vocabulary、Source-of-Truth Map、Dependency Graph、CURRENT Status Matrix、Current Minimum Closed Loop、Product Validation Backlog 与 project.md 无历史污染后，创建独立 W0 Governance commit；Push=NO，Deploy=NO。完成后进入 W1 Kernel Completion，不返回 OCR 等具体产品验证。
