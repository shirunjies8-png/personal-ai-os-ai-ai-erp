# 项目目标

在不伪造业务成功或测试证据的前提下，交付可验证的 AI 办公系统 / RealityOS；当前正式切换为 `FRAMEWORK_FIRST`，先完成 RealityOS 完整框架治理，再进入产品能力验证计划。

# 当前状态

- 基线：`main` @ `18491ebbb8c9078b5e8898cc2983a1a88e66604c`；Jev Effect Classification Provider Adapter 已作为独立架构提交；正式 W1 Kernel Commit 保持 `93f160176585c86bff15a77402729cee4dc5001b`，未 Push 或 Deploy。
- 工作区为混合未提交状态；仓库证据优先于本文档，`anime-pocket-agent/` 保持未触碰。
- FRAMEWORK_FIRST 已冻结；当前开发顺序为 W0 Architecture Governance → W1 Kernel Completion → W2 Platform Completion → W3 Evolution + Domain → Framework Freeze → Product Capability Validation Program。
- RealityOS Architecture Governance Baseline W0 已在本地建立并提交：21 Module Registry、Canonical Vocabulary、Source-of-Truth Map、Dependency Graph、CURRENT Status Matrix、Current Minimum Closed Loop、Target W1 Kernel Loop 与 Product Validation Backlog 均已定义并通过 validator；Commit `67f88378cedd31d21db6942115cdd296a98f7836`，Push/Deploy 均未执行。
- W1 Reference Kernel = COMPLETE；corrective safety gates = COMPLETE；已提交 `93f160176585c86bff15a77402729cee4dc5001b`，原有 12 项及新增六组反例、授权撤销/绑定变更回归通过；提交前再次通过 W0/W1、check/unit 与 staged diff 检查。Production Integration = NOT COMPLETE；仍为 REFERENCE_ONLY，未持久化集成、未接入产品路径，W2 Implementation = NOT_STARTED。
- W1 Exit Review = PASS（REFERENCE_KERNEL_VERIFIED）；W2 规划准入 = PASS / READY。`docs/architecture/realityos-w2-entry-plan.md` 已作为独立架构基线提交；W0/W1 validator 与 diff 检查通过；真实 Effect 接入门禁尚未满足。
- W2.0 Contract & Compatibility Baseline final audit = PASS；已完成唯一 Envelope、版本/持久化/崩溃/幂等/UNKNOWN/Resume 重授权及 adapter 合约设计，12 项为 DESIGN INVARIANTS；Commit `b81e052051aa608b60181b19ef5311a8647d5491`。首个纯合约切片已提交：Commit `8bc8b8ce81faf803386e3d096a8ab3f27b59302a`；范围仅为 canonical durable-extension 校验、纯 Resume Decision 与 adapter interface 合约。W2.1 execution durability foundation 已提交：Commit `02424922f3bbfc6c42892b0fe36d981b1620cf05`；Evidence durability = NOT_COMPLETE；Recovery durability = NOT_COMPLETE；Product Migration = NOT_STARTED；TypeSafe/Jev = RESERVED / NOT_INTEGRATED。
- W2.2 Evidence / Verification / Recovery Durability Entry Review 已完成：Evidence Runtime owner = `13-evidence-runtime`，Verification Runtime owner = `14-verification-runtime`，Recovery Runtime owner = `15-recovery-runtime`；现有 `runtime_*`、`audit_recovery_*`、`realityos_kernel_*` 为复用候选和局部实现，不等于统一 durability 闭环；首个 W2.2 slice 等待人工批准。
- W2.2.1 owner-backed Evidence / Verification / Recovery durable linkage 已完成并提交：Commit `92c31640fe223e6fd2b5a04fa4fcc58b2a0b9ed0`；Recovery retry execution = NOT_COMPLETE；Enterprise Identity/Organization = NOT_COMPLETE；Human Control durability/runtime = NOT_COMPLETE；TypeSafe/Jev = NEXT_CANDIDATE / NOT_INTEGRATED；Production Ready = NO；Enterprise Pilot Ready = NO。
- TypeSafe/Jev Provider Integration Entry Review 已完成：Jev 仅定位为 Probabilistic Semantic Classifier / Structured Inference Provider，最小后续切片为 Effect Classification Provider Adapter；Jev = NOT_INTEGRATED；Product Migration = NO；W2.3 = NOT_STARTED；Production Ready = NO；Enterprise Pilot Ready = NO。
- Jev Effect Classification Provider Adapter 已完成并提交：Commit `18491ebbb8c9078b5e8898cc2983a1a88e66604c`；provider-neutral boundary、Jev-compatible adapter、canonical Effect mapping、schema/probability/provenance validation、Evidence receipt、Verification case、restart evidence reload 与 fail-safe negative cases 均通过；REAL_JEV_PROVIDER_RUNTIME_INTEGRATED = NO；External network = NOT_USED；Product Migration = NO；W2.3 = NOT_STARTED；Production Ready = NO；Enterprise Pilot Ready = NO。
- Post-Jev Mainline Decision Review 已完成：决策为 RETURN_TO_W2_3；真实 Jev runtime 保持 RESERVED / NOT_CURRENT_HARD_DEPENDENCY。W2.3 Enterprise Identity / Organization / Delegation / Authority Entry Review 已完成；首个建议切片为 Durable Enterprise Identity + Represented Principal + Delegation Binding，等待人工批准；W2.3 implementation = NOT_STARTED。
- Production-visible Runtime Surface first slice 已完成并提交：Commit `f157ff4cb842311674c39d0da59fd849236867c6`；Control Plane = READ_ONLY；Mock/Fake data = NONE；FIRST_REAL_GOVERNED_PRODUCT_PATH = NOT_YET_INTEGRATED；W2.3 implementation = NOT_STARTED；Production Ready = NO；Enterprise Pilot Ready = NO。
- First Real Governed Read-only Product Path Entry Review 已完成：推荐首条路径为首页 Dashboard 业务状态读取 `GET /api/dashboard` → `dashboardService.getDashboard`；Effect = OBSERVATION；使用当前 JWT `req.user` 作为 Authenticated Actor Context；不伪造 represented principal；等待人工批准 implementation。
- First Real Governed Product Path 已完成并提交：Commit `91c005b29ad64c414136a191bc17e4ca96239070`；`GET /api/dashboard` 保持原路径并接入 RealityOS Kernel durable run、attempt、transition、Evidence receipt 与 Verification case；Dashboard 业务 owner 仍为 `dashboardService.getDashboard`；Reality Readback = VERIFIED；Control Plane Visibility = VERIFIED；Effect = OBSERVATION；Business Mutation = NO；Jev runtime = NOT_INTEGRATED；W2.3 implementation = NOT_STARTED；Production Ready = NO；Enterprise Pilot Ready = NO。
- First Governed Product Path Deployment / Public Visibility Review 已完成；当前公开地址 `https://shirunjies8-png.github.io/personal-ai-os-ai-ai-erp/` 为 GitHub Pages 静态前端，默认 `STATIC_DEMO_ONLY` 且 `API_BASE_URL` 为空；Render 后端配置存在但未证明已部署或与 Pages 连接；PUBLIC_RUNTIME_PERSISTENCE_CLASS = UNKNOWN_PUBLIC_BACKEND_NOT_PROVEN；Control Plane 公开可见性因仅有 authenticated enterprise-scoped、缺少 admin/audit RBAC 而 `AUTHORIZATION_BLOCKED`；Public Visibility Ready = NO；Production Ready = NO；Enterprise Pilot Ready = NO。
- 当前真实商业落地优先级已切换为 `VALVE_TENDER_QUOTATION_DRAWING`（阀门招投标 + 智能报价 + 参数化小样图），定位为 RealityOS First Industry / Enterprise Vertical Application；Public Deployment Hardening = PAUSED / PRESERVED；W2.3 implementation = NOT_STARTED。Entry Review 文档已创建并完成首轮 Source Package Reality Audit：`江苏招标文件(1).zip` 已复制为 `docs/source/valve/江苏招标文件(1).zip`，SHA-256 `96c8295c021fcedb8bb39c7cf082bd1bb34757e6d8c084e4917e4916a2181780`；真实业务文件 7 个（DOC 3、DOCX 2、DWG 2），无 PDF/XLS/XLSX；FIRST_REFERENCE_PROJECT = `连云港石化产业基地拓展区(板桥片区)蒸汽管道工程阀门采购`；FIRST_IMPLEMENTATION_SLICE = `Valve Tender Structured Extraction`；阀门系统未实现，云部署未开始，Production Ready = NO。
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
- W1 Kernel 只是跨 Owner 的编排与 enforcement point；不成为第二套 Identity、Authority、Execution、Effect、Evidence、Verification 或 Recovery Source of Truth。
- W2 正式名称仍为 W0 的 Platform Completion；Integration & Durability 仅为优先主线，不遗漏 Organization、Knowledge/Context、Model、Workflow、Human Control、Audit。规划准入不等于真实 Effect 接入批准。
- W2.0 只扩展既有 canonical Kernel envelope；持久化不得改变 W1 语义。历史授权仅作不可变 Evidence，恢复写操作必须重新授权；工作租约不代替 Authority Lease，UNKNOWN 不自动重放；合约测试不等于持久化 Reality Proof。
- 执行失败只有在独立 Reality 读回证明 `NOT_OCCURRED`、显式 `retry_safe`、有效 Recovery Evidence、Recovery 决策为 `RETRY`、attempt budget 未耗尽且重新通过 Authority/Lease/Capability/Preflight 时才允许重试；执行前再次核验授权时效及绑定，未确认 Effect 不自动重放。
- 任何提交必须从混合工作区中按清单精确隔离；不得全量暂存，也不得把 `anime-pocket-agent/` 纳入操作范围。
- 产品 OCR 成功状态必须保留 engine raw、normalized、structured 与 UI readback 的可追溯证据；不以页面打开或 HTTP 200 替代终态验证。
- RealityOS Core v1 只能承载已由 OCR 证明过的通用合约；Effect Governance、Resume Authority、Human Control Runtime、Improvement MetaRSI、Model Supply-Chain、Writing Capability Pack 均保留为未实现。

# 待办

- NOW：Valve Tender / Quotation / Sample Drawing Source Package Reality Audit = COMPLETE；真实资料确认包含截止阀、止回阀、球阀、蝶阀、闸阀、疏水阀、旋转补偿器相关内容；DWG_STRUCTURED_EXTRACTION = NOT_YET_VERIFIED；Legacy DOC = CONVERSION_REQUIRED_FOR_STRUCTURED_TABLES；不得声明阀门平台完成、云部署完成或生产就绪。
- NEXT：审批 `Valve Tender Structured Extraction Slice`，以 `江苏招标文件/2.阀门/竞争性谈判文件-连云港石化产业基地拓展区板桥片区蒸汽管道工程阀门采购.docx` 为 first implementation input，输出 TenderProject、TenderDocument、ValveRequirementItem、TenderRule、QuoteRule、TechnicalRequirement、StandardRequirement、CertificateRequirement、ResolutionRule、Evidence/Provenance refs、Conflict candidates 与 Human Review flags。
- RESERVED：W2 Platform Completion、W3 Evolution + Domain、Framework Freeze、Product Capability Validation Program。
- RESERVED：OCR、PDF、Word、Excel、PPT、Email、Translation、Writing、Knowledge Product、Contract、Tender、Quote、Procurement、Sales、Production、Shipping、Warehouse、Quality、ERP、MES、Equipment、Data Analysis、GEO、WorkBuddy、Agent Economy、Robot、Physical AI、Effect Reality Closure Demo 均后移到 Product Validation Backlog。
- RESERVED：在 OCR 变更正式集成后，使用用户明确提供的原始乱码文件执行同输入产品 Reality Proof；未获得该输入不得关闭真实用户 OCR 乱码问题。

# 风险

- 混合工作区使误暂存风险较高；任何 mixed file 均需逐 hunk 审核。
- W1 六项已确认缺口已有自动反例回归保护；当前 adapter 是可信参考边界，不能将 shape/binding 检查解释为生产身份认证、持久化证明或对抗恶意 adapter 的隔离。
- W1 reference Evidence Runtime 为内存实现；持久化 Evidence、Runtime Run/Attempt 和 Audit Recovery Worker 的统一 adapter 接入尚未完成。
- W2 真实 Effect hard gates 未满足：持久化 envelope/evidence/recovery、幂等与 crash reconciliation、生产身份绑定、Authority Lease 撤销及 Resume Re-authorization、Human Control 必须先验证。W2.0 已定义 Effect/Reality 协议初始化边界，但尚无运行时实现，不能靠注册表静态校验推断无运行时死锁。
- W2.1 已验证真实 SQLite round-trip、进程级重载、CAS 并发保护、write-before-effect 与 UNKNOWN 保留；W2.2.1 已验证并提交 owner-backed durable linkage，但尚未完成 production schema migration lifecycle、产品迁移、Enterprise Identity/Organization、Human Control durability 或运维能力，不能声明生产就绪或企业试点就绪。
- Target/Current 混淆风险高；`TARGET_W1_KERNEL_LOOP` 不等于当前已实现闭环。
- 概念重复风险仍存在；后续新增 GEO、Payment、Knowledge、WorkBuddy、Self-Improvement 等内容必须先映射到唯一 Owner。
- RapidOCR runtime 已恢复，但依赖位于用户本机缓存；其他机器或生产环境仍需按 lock 重建同等私有 runtime。
- 通用 OCR 质量尚未全面验证；原用户乱码问题仍须在受治理 rollout 后使用新的用户输入完成 Reality Proof。
- 当前 OCR 证明是本地受控运行结果，不构成生产部署、长期运维或真实用户乱码修复的证据。
- public GitHub Pages 仍不包含本地 Python RapidOCR runtime，无法独立代表完整产品 OCR 运行环境。
- Browser proof 在非提升沙箱下曾因 server 后台生命周期受限而阻塞；提升权限确认同一 server `/api/health` 正常 200。最新 clean-room Browser proof 已通过，但 Chrome 仍输出 macOS display / Crashpad 环境警告，需继续记录为环境噪声而非产品失败。
- Effect Governance v1 当前为 `CONTRACT_ONLY` 验证级别，不代表真实外部 mutation 或生产 Effect Closure 已完成。
- Jev/TypeSafe 仍未集成；未来接入必须保持模型输出只是 Evidence，不能替代 Authority、Effect Runtime、Security/Data Egress Policy、Verification 或 Human Control。
- 当前 Jev adapter 只验证 reference integration，不包含真实 Jev runtime、外部网络、依赖安装或产品路径接入。
- W2.3 真实缺口仍在：当前 JWT/users/enterprises 提供 PARTIAL 身份与企业边界，W2 合约提供 represented principal / lease / reauthorization 的 reference tests，但 durable canonical delegation、revocation、expiry、authority binding 与 enterprise identity records 尚未实现。
- Production-visible Runtime Surface 当前已有第一条真实产品路径 `GET /api/dashboard` governed observation commit；这只代表第一条 read-only path，不代表整个 Product Migration Complete、生产就绪或企业试点就绪。
- 当前公开 GitHub Pages 默认不会连接 governed backend；Render 仅为候选部署配置，尚未有公开 `/api/health`、登录、Dashboard、Control Plane、restart/redeploy persistence 读回证据。不得把本地 SQLite restart PASS 或仓库配置解释为 Public Durability VERIFIED。
- Control Plane API 当前要求 JWT 并按 `enterprise_id` 过滤，但尚无 admin/audit RBAC；公开部署前必须明确普通企业用户是否允许查看 Kernel Runs、Evidence、Verification、Recovery 审计轨迹。
- 数据库初始化当前会创建/更新默认企业和默认管理员；生产部署必须确认 `JWT_SECRET` 与 `DEFAULT_ADMIN_PASSWORD` 由安全环境变量提供，不能使用默认值。
- 阀门行业资料包已定位并完成首轮 Source Package Reality Audit，但 DWG 仅完成 metadata 级识别，尚不能结构化解析尺寸；Legacy DOC 虽可由 `textutil` 转为文本，但生产级表格/行/单元格 provenance 仍需正式 conversion/parser；任何报价、产品匹配、图纸尺寸和最终技术响应仍需 Human Review 与后续实现验证。

# 下一步

审批 `Valve Tender Structured Extraction Slice`，以真实 DOCX 采购文件为 first implementation input，先实现 source-backed TenderProject / TenderDocument / ValveRequirementItem / TenderRule / QuoteRule / TechnicalRequirement / Evidence-Provenance / Conflict / Human Review flags 抽取闭环。
