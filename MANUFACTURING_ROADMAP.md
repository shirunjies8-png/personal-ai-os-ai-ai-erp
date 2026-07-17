# AI 办公系统制造业务闭环路线图

> 文档状态：阶段 1 已完成设计，业务实现尚未开始
> 基线提交：`e5f7e485b76e8f814146641a828a1cb182526e18`
> 设计日期：2026-07-17
> 适用项目：`AI 办公系统`

## 1. 本阶段范围

阶段 1 只完成现状盘点、数据模型、迁移策略、API、页面、状态机、编号和兼容方案设计。本阶段不创建客户、RFQ、图纸、BOM、工艺、报价、生产、质量、采购或设备业务表，不新增这些模块的控制器、路由或页面，也不修改现有业务数据。

后续阶段必须逐阶段实施和验收。任何尚未实施的能力必须显示“建设中”“规划中”或“尚未接入”，不能把本文档中的设计写成已上线能力。

## 2. 阶段 0 基线结论

阶段 0 的业务链路结论为“通过，OCR E2E 环境问题待处理”：

- GitHub Pages 可通过公网 HTTPS API 访问阿里云后端。
- `/api/health`、SQLite CRUD、企业隔离、刷新恢复、CORS、手机端和前端控制台检查已经通过。
- 公网 `3100` 端口没有开放，Node 服务仍只监听 `127.0.0.1:3100`。
- OCR 业务代码未发现确定性功能错误；自动化浏览器环境中的 Tesseract 初始化超过 60 秒，记录为 `ENV-OCR-E2E-001`。
- OCR E2E 测试仍保留且仍属于完整验证门禁，不因阶段 0 验收而删除、跳过或改写为通过。

## 3. 现有能力盘点

### 3.1 已有真实后端和 SQLite 实体

| 领域 | 当前表或接口 | 当前事实 | 后续处理 |
| --- | --- | --- | --- |
| 企业和账号 | `enterprises`、`users`、`/api/auth`、`/api/enterprise` | 已按企业身份登录，JWT 中的用户映射到 `enterprise_id` | 继续作为所有制造业务的租户根 |
| 企业工作区状态 | `app_states`、`/api/state` | 企业级 JSON 可持久化询盘、报价、OCR 复核、任务和错误状态 | 仅作旧数据来源和故障降级，不作为新增制造实体的长期主存储 |
| 销售订单基础 | `orders`、`/api/orders` | 有企业隔离的基础 CRUD，字段较少 | 阶段 7 兼容扩展，不另建重复的基础订单服务 |
| 库存基础 | `inventory`、`/api/inventory` | 有企业隔离的库存快照 CRUD | 阶段 8 扩展物料和库存流水，保留现有快照接口 |
| 审计摘要 | `logs`、`logService`、`/api/logs` | 有企业、用户、类型、标题、脱敏详情和时间 | 增量扩展实体、前后值、请求和审批关联字段，不新建第二套日志服务 |
| Agent 与审批 | `agent_tasks`、`agent_task_logs`、`agent_approvals` | 已有任务、执行日志、人工审批和恢复基础 | 扩展现有 `approvalService` 和表兼容业务实体审批 |
| APQP | 8 张 APQP 表、`/api/apqp` | 已有企业隔离、确定性进度、证据、风险、任务、审批和历史 | 作为阶段推进、风险阻断和证据审计的实现参考，不复制服务 |
| AI 用量 | `ai_usage_records`、`ai_cache_entries` | 已有成本、预算、缓存和错误统计 | 阶段 10 才允许用于制造 AI；阶段 2–9 不依赖 DeepSeek |

### 3.2 可复用但尚未归一化的能力

| 能力 | 当前载体 | 可复用部分 | 当前限制 |
| --- | --- | --- | --- |
| 询盘管理 | `app_states.ocrInquiries`、现有询盘页面 | 列表、编辑、删除、搜索、加载/空/错误态、OCR 转询盘 | 不是独立 RFQ 表，正式风险、跟进和审批尚未归一化 |
| RFQ 报价评审 | `workspaces.quotation`、`rfq-*` 脚本 | 缺失项检查、风险处理、审批交互、草稿和审计展示 | 主要为工作区 JSON；本地审批历史不能当作正式服务端审批 |
| OCR 人工复核 | `ocrData` schemaVersion 2 | Provider 状态、人工修改、批准/驳回门禁、来源和警告 | OCR 结果仍主要随企业工作区保存；文件元数据和真实对象存储需分开 |
| 成本核算 | 成本助手前端确定性计算 | 成本项目、损耗、利润、风险提示和人工确认原则 | 尚无受版本控制的服务端成本单、报价单和审批实体 |
| 生产计划 | `workspaces.productionplan` | CSV 解析、计划和风险展示 | 尚无生产任务、工序报工、设备或物料占用的正式表 |
| BOM、工艺、CRM、设备、质量 | 现有菜单和通用页面 | 导航、响应式样式、表单和导出壳层 | 大部分仍是示例/通用工作区，不是可声明为生产可用的闭环 |
| 错误中心、任务中心、系统状态 | 本地状态 + 部分服务端日志/任务 | 统一状态、错误聚合、恢复、诊断脱敏、健康检查 | 制造实体发生的错误和任务需在后续阶段写入统一服务端记录 |

### 3.3 缺失的归一化制造实体

以下能力尚未形成独立、可查询、可关联、可审计的服务端数据模型：

- 客户、联系人、项目。
- RFQ、需求项、附件元数据、风险、跟进记录和正式评审。
- 图纸主档、版本、参数集、校验结果、审核和导出记录。
- BOM、BOM 版本、物料行、工艺路线、工艺版本和工序。
- 确定性成本单、成本明细、报价单、报价版本和报价审批。
- 订单明细、生产任务、工序执行、报工、质量检验、不合格、返工、复检和交付归档。
- 物料主档、库存流水、采购申请、采购订单、供应商和历史价格。
- 设备主档、保养、故障、维修、备件和停机记录。
- 通用编号序列、幂等旧数据导入记录、业务实体级审计前后值。

## 4. 必须复用的安全和运行底座

后续阶段不得另建同类底层服务，统一复用并增量扩展：

- `middleware/auth.js`：身份认证，企业 ID 只从验证后的用户取得，禁止相信请求体中的企业 ID。
- `permissionService`：从当前角色等级扩展到模块动作权限；控制器不能只靠前端隐藏按钮。
- `securityPolicyService`：能力开关、高风险动作和统一确认；不得绕过策略直接写库。
- `approvalService`：所有图纸、BOM、工艺、报价、订单、采购和质检放行审批的唯一服务入口。
- `taskRecoveryService`：可恢复任务的失败分类、重试上限和人工接管。
- `costControlService`：仅用于 AI 调用成本和预算；业务报价金额由确定性业务计算器负责。
- `logService`、统一错误处理和脱敏工具：审计、拒绝、策略阻断和异常必须写入脱敏记录。
- `agentRuntimeService`、`toolRegistry` 和 AI Gateway：只在后续授权阶段提供建议或草稿，不能改正式状态。
- `/api/health`、`/api/self-test`、`npm run check`、单元测试、构建和 `verify`：继续作为全局门禁。

## 5. 数据库约定

### 5.1 命名和公共字段

- 表名、列名、索引和外键使用英文 `snake_case`。
- 内部主键使用 UUID 文本，不把业务编号当主键。
- 新增制造实体统一使用 `enterprise_id`；现有 APQP 的 `tenant_id` 暂不破坏，服务边界统一解释为企业租户。
- 重要主表至少包含：
  - `id`
  - `enterprise_id`
  - `status`
  - `version`
  - `created_by`
  - `updated_by`
  - `created_at`
  - `updated_at`
  - `deleted_at`
  - `deleted_by`
- 版本表必须包含 `revision_no`、`revision_status`、`effective_at` 和来源主表 ID。
- 金额以最小精度的十进制定点值保存。SQLite 中保存整数分或规范化十进制文本，不使用浮点比较决定审批或报价。
- 数量、工时、损耗率和公差由确定性校验器归一化；百分比始终限制在 `0–100`。
- JSON 只用于不可预知的快照或扩展元数据，客户、状态、金额、版本和外键不得只埋在 JSON 中。

### 5.2 软删除和并发

- 客户、RFQ、图纸、BOM、工艺、报价、订单、生产、质量、采购和设备使用软删除。
- 删除请求必须包含原因，并写入删除人、删除时间、旧值、审批或确认记录。
- 已被下游实体引用、已批准或已发布的数据不得普通删除，只能作废或归档。
- 更新必须携带当前 `version`，SQL 使用 `WHERE id = ? AND enterprise_id = ? AND version = ?`，成功后 `version = version + 1`；受影响行数为 0 时返回 `VERSION_CONFLICT`。
- 所有主从写入、编号领取、状态推进和审计记录必须位于同一个 SQLite 事务中。

### 5.3 外键和索引

- 所有主表建立 `(enterprise_id, business_no)` 唯一索引。
- 子表除父 ID 外也保留 `enterprise_id`，查询必须同时带租户条件，防止只凭 UUID 跨企业读取。
- 常用索引：`(enterprise_id, status, updated_at)`、`(enterprise_id, owner_id, due_date)`、来源外键和版本外键。
- 附件仅保存元数据、校验和与存储状态；没有真实文件存储时必须显示 `metadata_only`，不能伪装文件已上传。

## 6. 迁移体系设计

### 6.1 迁移账本

后续实现第一个迁移前，先新增 `schema_migrations`：

| 字段 | 约束和用途 |
| --- | --- |
| `version` | 主键，例如 `20260717_001` |
| `name` | 迁移名称 |
| `checksum` | 迁移脚本 SHA-256，防止脚本被静默改写 |
| `started_at` / `finished_at` | 执行时间 |
| `status` | `running`、`applied`、`failed`、`rolled_back` |
| `error_summary` | 脱敏错误摘要 |
| `app_commit` | 运行迁移的 Git 提交 |

迁移器要求：

1. 启动前读取账本，校验已应用脚本 checksum。
2. 对 SQLite 文件先执行一致性检查和受控备份；备份不进入 Git。
3. 每个迁移在事务中执行；SQLite 需要重建表时使用“新表 → 校验行数/外键 → 原表改名 → 新表改名”的受控步骤。
4. 失败时回滚事务，服务保持旧版本可运行；不得删除用户原数据库来绕过失败。
5. 生产迁移只允许单实例持锁执行，完成后再次运行 `foreign_key_check` 和关键计数校验。
6. `database/init.js` 只负责引导迁移器和兼容种子，不继续堆叠不可追踪的任意 `ALTER TABLE`。

### 6.2 计划迁移批次

| 批次 | 对应阶段 | 计划内容 | 是否在阶段 1 执行 |
| --- | --- | --- | --- |
| M001 | 基础 | `schema_migrations`、`document_sequences`、`legacy_migration_records` | 否，仅设计 |
| M002 | 基础 | 给 `logs` 增加实体、前后值、请求、审批、客户端和动作结果字段；扩展现有 `logService` | 否，仅设计 |
| M003 | 基础 | 将现有 `agent_approvals` 兼容升级为可关联业务实体的统一审批记录，保留全部旧行 | 否，仅设计 |
| M010 | 阶段 2 | 客户、联系人、项目、RFQ、需求、风险、跟进和通用附件元数据 | 否 |
| M020 | 阶段 3 | 图纸主档、版本、审核、导出记录 | 否 |
| M030 | 阶段 4 | CAD 参数集、校验结果和生成文件元数据 | 否 |
| M040 | 阶段 5 | BOM、BOM 版本、BOM 行、工艺、工艺版本和工序 | 否 |
| M050 | 阶段 6 | 成本单、成本明细、报价、报价版本 | 否 |
| M060 | 阶段 7 | 订单扩展、订单行、生产任务、工序执行、质检、不合格、返工和交付归档 | 否 |
| M070 | 阶段 8 | 物料、库存流水、采购、供应商和价格历史 | 否 |
| M080 | 阶段 9 | 设备、保养、故障、维修、备件和停机 | 否 |

### 6.3 基础辅助表设计

`document_sequences`：

- `id`、`enterprise_id`、`document_type`、`period_key`、`current_value`、`padding`、`updated_at`。
- 唯一约束：`(enterprise_id, document_type, period_key)`。
- 领取编号使用 `BEGIN IMMEDIATE`，同一事务内递增并创建业务实体，禁止用 `COUNT(*) + 1` 或 `Date.now()` 生成正式编号。

`legacy_migration_records`：

- `id`、`enterprise_id`、`source_area`、`source_record_id`、`source_hash`、`target_type`、`target_id`、`status`、`error_summary`、`migrated_at`、`created_at`。
- 唯一约束：`(enterprise_id, source_area, source_record_id, source_hash)`。
- 用于幂等导入、失败追踪和回滚定位，不保存密钥或完整敏感原文。

通用附件元数据 `entity_attachments`：

- `id`、`enterprise_id`、`entity_type`、`entity_id`、`file_name`、`file_type`、`file_size`、`checksum`、`storage_status`、`storage_key`、`uploaded_by`、`created_at`、`deleted_at`、`deleted_by`、`delete_reason`。
- `storage_status` 仅允许 `metadata_only`、`stored`、`missing`、`quarantined`、`deleted`。
- 阶段 2 没有真实文件存储时只能写 `metadata_only`，页面必须如实提示。

## 7. 目标数据模型和关系

### 7.1 阶段 2：客户与 RFQ

- `customers`：客户编号、名称、来源、等级、负责人、联系状态和公共字段。
- `customer_contacts`：客户、姓名、职务、电话/邮件脱敏策略、是否主联系人。
- `projects`：项目编号、客户、名称、描述、负责人、计划日期和状态。
- `rfqs`：RFQ 编号、客户、项目、产品、数量、单位、材料、工艺、公差、表面处理、包装、预算、交期、负责人、缺失摘要、风险摘要和状态。
- `rfq_requirements`：分类、字段键、期望值、单位、是否必填、来源、确认状态。
- `rfq_risks`：类型、严重度、概率、影响、系统计算等级、是否阻断、负责人、处置、接受理由和关闭证据。
- `rfq_followups`：跟进方式、内容、下次跟进时间、负责人和结果。
- 关系：客户 `1:N` 联系人/项目/RFQ；项目 `1:N` RFQ；RFQ `1:N` 需求/风险/跟进/附件。

### 7.2 阶段 3–4：图纸与参数化 CAD

- `drawings`：图号、客户、项目、RFQ、零件名称、当前批准版本和生命周期状态。
- `drawing_versions`：版本号、材料、尺寸、公差、表面处理、参数快照、文件元数据、变更说明和状态。
- `drawing_reviews`：版本、评审人、决定、意见、时间和审批记录 ID。
- `drawing_exports`：版本、格式、checksum、生成器版本、导出人和时间。
- `cad_parameter_sets`：零件类型、结构化参数、单位制和来源。
- `cad_validation_results`：规则键、级别、结果、确定性消息和检查器版本。
- 关系：图纸 `1:N` 版本；版本 `1:N` 校验/评审/导出；RFQ 可关联多个图纸。

### 7.3 阶段 5：BOM 与工艺

- `boms`、`bom_versions`、`bom_items`：BOM 主档、版本状态以及材料编码、规格、单件用量、生产数量、损耗率、总需求、供应商参考和来源。
- `routings`、`routing_versions`、`routing_operations`：工艺主档、版本以及顺序、设备类型、准备工时、单件工时、单价、外协、质量要求和检验要求。
- 图纸版本是 BOM/工艺版本的明确来源。图纸换版不会静默覆盖已批准 BOM 或工艺，必须创建新版本并重新评审。

### 7.4 阶段 6：成本和报价

- `cost_sheets`、`cost_items`：关联 RFQ、图纸版本、BOM 版本、工艺版本；保存确定性输入、规则版本、币种、税率、合计和人工确认状态。
- 成本行类型固定枚举：材料、损耗、下料、加工、设备、刀具耗材、热处理、表面处理、外协、检验、包装、运输、税费、管理、风险预留和利润。
- `quotations`、`quotation_versions`：报价编号、客户、RFQ、成本单、单价、总价、最低可接受价、有效期、交期、条款、审批和客户决定。
- AI 生成的说明只能进入 `suggestion_draft`，人工确认后才复制到正式说明字段；AI 不能写金额。

### 7.5 阶段 7：订单、生产、质量和交付

- 保留并兼容扩展 `orders`，新增项目、报价、负责人、条款、版本、软删除和审计字段；新增 `order_lines`，避免把多产品订单压在单行。
- `production_jobs`、`production_operations`：生产任务号、订单行、图纸/BOM/工艺版本、计划/完成数量、日期、当前工序、设备、负责人和状态。
- `quality_inspections`、`quality_results`：检验单、类型、关联订单/任务/图纸版本、检验项、标准、公差、实测值、工具、判定、人和时间。
- `nonconformances`、`rework_records`：不合格、原因、处置、返工、复检和关闭证据。
- `delivery_archives`：交付批次、订单、数量、包装、运输、签收、报告和归档校验和。

### 7.6 阶段 8–9：库存采购、供应商和设备

- `materials`、`inventory_transactions`：物料主档和不可变库存流水；现有 `inventory` 继续作为企业库存快照，并逐步增加 `material_id`。
- `suppliers`、`supplier_materials`、`supplier_price_history`：供应商、可供物料、历史价格、交期和质量记录。
- `purchase_requests`、`purchase_request_items`、`purchase_orders`、`purchase_order_items`：缺料、申请、审批、下单和到货。
- `equipment_assets`、`maintenance_plans`、`equipment_failures`、`equipment_repairs`、`spare_parts`、`equipment_downtime`：设备主档和维修闭环。
- 当前前端默认设备示例不自动迁移为企业真实设备，必须由用户确认或导入。

## 8. 统一编号规则

| 类型 | `document_type` | 格式 | 周期 |
| --- | --- | --- | --- |
| 客户 | `customer` | `CUS-YYYY-000001` | 年 |
| 项目 | `project` | `PRJ-YYYY-000001` | 年 |
| RFQ | `rfq` | `RFQ-YYYYMM-000001` | 月 |
| 图纸 | `drawing` | `DWG-YYYY-000001` | 年；版本另存 `A`、`B`、`C` |
| BOM | `bom` | `BOM-YYYY-000001` | 年；版本独立递增 |
| 报价 | `quotation` | `QUO-YYYYMM-000001` | 月 |
| 销售订单 | `sales_order` | `SO-YYYYMM-000001` | 月 |
| 生产任务 | `production_job` | `MO-YYYYMM-000001` | 月 |
| 采购单 | `purchase_order` | `PO-YYYYMM-000001` | 月 |
| 检验单 | `inspection` | `INS-YYYYMM-000001` | 月 |

规则：

- 编号在企业内唯一，跨企业允许相同显示编号。
- 正式编号只在服务端事务中生成；前端可显示“保存后生成”，不能预占或伪造成功。
- 复制实体会创建新编号；恢复旧版本不创建新主编号，只产生新版本记录。
- 已使用编号不回收。失败事务回滚时序列一并回滚；已提交后删除也不复用。
- 外部客户图号可以另存 `customer_drawing_no`，不能覆盖系统图号唯一键。

## 9. API 设计

### 9.1 通用约定

- 新制造接口统一位于 `/api/manufacturing/v1`；现有 `/api/orders`、`/api/inventory` 和 `/api/apqp` 保持兼容。
- 全部写接口和敏感读接口使用 `authRequired`。
- `enterprise_id` 从 `req.user.enterprise_id` 注入，若请求体带企业字段则拒绝。
- 列表统一支持 `page`、`pageSize`、`q`、`status`、`ownerId`、`updatedAfter`，排序字段使用服务端允许列表。
- 正常响应延续 `{ ok, data, message }`，列表增加 `meta: { page, pageSize, total }`。
- 错误响应返回稳定 `code` 和脱敏 `message`，不返回堆栈、SQL、服务器路径或密钥。
- 更新提交 `version`；重复创建和转换使用 `Idempotency-Key`。
- 所有金额、进度、缺失项、风险等级、状态推进和能否审批由服务端确定性函数返回。

### 9.2 阶段 2 API

```text
GET    /api/manufacturing/v1/customers
POST   /api/manufacturing/v1/customers
GET    /api/manufacturing/v1/customers/:id
PATCH  /api/manufacturing/v1/customers/:id
DELETE /api/manufacturing/v1/customers/:id

GET    /api/manufacturing/v1/projects
POST   /api/manufacturing/v1/projects
GET    /api/manufacturing/v1/projects/:id
PATCH  /api/manufacturing/v1/projects/:id
DELETE /api/manufacturing/v1/projects/:id

GET    /api/manufacturing/v1/rfqs
POST   /api/manufacturing/v1/rfqs
GET    /api/manufacturing/v1/rfqs/:id
PATCH  /api/manufacturing/v1/rfqs/:id
DELETE /api/manufacturing/v1/rfqs/:id
POST   /api/manufacturing/v1/rfqs/:id/submit-review
POST   /api/manufacturing/v1/rfqs/:id/request-information
POST   /api/manufacturing/v1/rfqs/:id/approve-for-quotation
POST   /api/manufacturing/v1/rfqs/:id/risks
PATCH  /api/manufacturing/v1/rfqs/:id/risks/:riskId
POST   /api/manufacturing/v1/rfqs/:id/followups
GET    /api/manufacturing/v1/rfqs/:id/history
```

### 9.3 后续阶段 API 资源

- 图纸：`/drawings`、`/drawings/:id/versions`、`/validate`、`/submit-review`、`/approve`、`/reject`、`/restore`、`/exports`。
- BOM：`/boms`、`/boms/:id/versions`、`/items`、`/calculate-requirements`、`/submit-review`、`/approve`。
- 工艺：`/routings`、`/versions`、`/operations`、`/calculate-hours`、`/submit-review`、`/approve`。
- 成本报价：`/cost-sheets`、`/calculate`、`/quotations`、`/versions`、`/submit-approval`、`/approve`、`/reject`、`/mark-sent`、`/customer-decision`。
- 订单生产：`/orders`、`/production-jobs`、`/operations/:id/start|report|complete`。
- 质量交付：`/inspections`、`/results`、`/nonconformances`、`/rework`、`/release`、`/deliveries`。
- 库存采购：`/materials`、`/inventory-transactions`、`/purchase-requests`、`/purchase-orders`、`/suppliers`。
- 设备：`/equipment`、`/maintenance`、`/failures`、`/repairs`、`/downtime`。

每个动作接口先调用领域服务的统一评估函数，再调用权限、安全策略、审批和审计底座；控制器只做输入映射和响应，不复制业务规则。

## 10. 权限与高风险动作

现有角色等级继续有效，并逐步增加动作键。每个领域至少包含：

- `*.view`、`*.create`、`*.edit`、`*.delete`、`*.export`、`*.history.view`。
- 流程动作：`rfq.review`、`drawing.approve`、`bom.approve`、`routing.approve`、`quotation.approve`、`order.confirm`、`production.release`、`purchase.approve`、`inspection.release`。

必须二次确认或人工审批：

- 风险接受、正式删除、覆盖附件、负责人/截止日期/重要等级变更。
- RFQ 可报价评审、图纸批准、BOM/工艺批准、报价批准、订单确认。
- 生产下发、采购批准、质检放行、敏感导出和正式客户回复。

权限拒绝和安全策略阻断也必须写审计。审批人必须属于同一企业并具备对应动作权限；不得只根据前端按钮状态决定。

## 11. 确定性状态机

所有状态转换使用服务端允许列表和前置条件，不接受任意状态字符串。

### 11.1 客户和项目

- 客户：`draft → active → inactive → archived`。
- 项目：`draft → active → on_hold → completed → closed`。
- 被 RFQ、报价或订单引用的客户/项目不能物理删除。

### 11.2 RFQ

```text
draft → waiting_review → information_required → ready_for_quotation
      → quotation_in_progress → quoted → negotiating → won / lost / expired
```

- 必填需求缺失时只能进入 `information_required`。
- 阻断风险未关闭或未获人工接受时不能进入 `ready_for_quotation`。
- `won` 必须关联人工确认的报价版本；AI 不能推进任何正式状态。

### 11.3 图纸

```text
draft → validating → waiting_approval → rejected → draft
                               └→ approved → production_ready → obsolete
```

- 参数校验失败不能提交审核。
- `production_ready` 必须基于已批准版本；恢复旧版本会创建新修订，不能改写历史。

### 11.4 BOM 和工艺

```text
draft → checking → waiting_approval → rejected → draft
                              └→ approved → released → obsolete
```

- 数量、损耗、工时和费用由确定性计算器生成。
- 来源图纸版本变化后，已发布 BOM/工艺显示“来源已变更”，不会自动覆盖或继续有效。

### 11.5 报价

```text
draft → calculated → waiting_approval → rejected → draft
                                 └→ approved → sent → accepted / declined / expired
```

- 未关联确定性成本快照或低于最低可接受价时不能普通批准。
- 低价例外必须由授权审批人给出理由。
- AI 只能生成说明草稿，不能写最终金额、交期或审批结论。

### 11.6 订单、生产和质量

- 订单：`draft → waiting_confirmation → confirmed → in_production → partially_delivered → delivered → closed`，另有受控 `cancelled`。
- 生产任务：`draft → released → in_progress → paused → completed → closed`，另有受控 `cancelled`。
- 检验：`draft → in_progress → waiting_disposition → passed / failed → rework → reinspected → released → closed`。
- 未批准图纸/BOM/工艺不能下发生产；未通过检验不能放行交付。

## 12. 页面和导航设计

沿用现有单页应用、样式、加载/空/错误状态和手机端布局，不重建前端。阶段实施后逐步整理为：

1. `客户与 RFQ`：客户列表/详情、项目列表/详情、RFQ 列表/详情、需求、风险、跟进、附件和历史。
2. `图纸与 AI CAD`：图纸主档、版本对比、参数检查、审核、导出和关联来源。
3. `BOM 与工艺`：BOM/工艺版本、物料/工序行、确定性计算、审批和历史。
4. `报价中心`：成本明细、报价版本、审批、客户决定和审计。
5. `订单与生产`：订单、生产任务、工序进度、异常和责任人。
6. `库存与采购`：物料、库存流水、缺料、采购申请/订单、供应商。
7. `质量检验`：首件/过程/完工检验、不合格、返工、复检和报告。
8. `设备管理`：设备、保养、故障、维修、备件和停机。

页面统一要求：

- 列表来自后端，支持分页、搜索和筛选；不在前端伪造总数和进度。
- 详情返回服务端 `assessment`，显示阻断项、允许动作、版本冲突和下一步。
- 写操作显示加载状态，成功只以 API 成功响应为准；错误显示脱敏后的具体原因。
- 后端离线时可查看本地缓存和保存“待同步草稿”，必须醒目标注未写入 SQLite。
- GitHub Pages 可展示脱敏示例，但正式保存、审批、下发和放行必须连接后端。
- 390×844 下表格使用卡片或横向容器，底部操作区不遮挡内容。
- 未到对应阶段的入口只显示“建设中”和计划阶段，不能放假数据冒充上线。

## 13. 旧数据兼容和回滚

### 13.1 兼容原则

- 不删除或覆盖 `app_states`、现有 `orders`、`inventory`、OCR schemaVersion 2、APQP 或日志数据。
- 新表上线前对生产 SQLite 做受控备份和一致性检查；数据库、备份和日志不提交 Git。
- 导入器按企业逐条处理，保存来源 ID、hash 和目标 ID；重复运行不会重复创建。
- 旧工作区中的“approved”只作为历史展示信息，不自动变成正式服务端审批。
- 迁移失败保留原数据，写入脱敏错误摘要；单条失败不清空整个企业状态。

### 13.2 旧数据映射

| 旧来源 | 新目标 | 转换规则 |
| --- | --- | --- |
| `app_states.ocrInquiries` | `rfqs`、`rfq_requirements` | 来源标记 `legacy_ocr_inquiry`；缺失字段保持缺失；绝不自动进入可报价或已批准 |
| `workspaces.quotation.rfqSavedDrafts` | `quotations` 草稿/版本 | 只迁移草稿文本、来源和时间；本地审批历史仅作备注 |
| `ocrData` schemaVersion 2 | 继续保留，后续按引用关联 RFQ/附件 | 原文、字段来源、复核状态和修改历史不丢失；未批准数据不能转正式字段 |
| `orders` | 兼容扩展后的 `orders` + `order_lines` | 旧单行产品生成一条订单行；原订单号保留并加企业唯一校验 |
| `inventory` | 现有快照 + 后续物料关联 | 不根据当前数量反推历史流水；迁移起点建立“期初余额”并需人工确认 |
| 前端默认设备示例 | 不自动迁移 | 只有用户确认的企业设备才写入 `equipment_assets` |

### 13.3 切换策略

1. 新表和只读 API 上线，运行幂等导入预检并输出数量、重复、缺失和错误报告。
2. 管理员确认后执行企业级导入；旧 `app_states` 保持只读备份。
3. 模块功能旗标切换到归一化 API；同一实体不长期双写 JSON 和新表，避免漂移。
4. 后端离线时浏览器只创建带 `client_mutation_id` 的待同步草稿；恢复后由用户确认同步，服务端幂等处理。
5. 出现问题可关闭模块旗标恢复旧页面读取，已写入新表的数据保留，不反向覆盖旧 JSON。
6. 数据数量、hash、企业隔离、外键和审计验证通过后，才允许把旧区域标为归档；不物理删除。

## 14. 分阶段实施和验收

| 阶段 | 实施内容 | 关键验收 |
| --- | --- | --- |
| 2 | 客户、项目、RFQ | CRUD、搜索、刷新/跨窗口恢复、缺失和风险阻断、正式审批、企业隔离、旧询盘导入 |
| 3 | 图纸主档和版本 | 图号唯一、版本追踪、附件元数据、审核、恢复旧版本、RFQ/报价关联 |
| 4 | 三类二维参数化 CAD | 确定性校验、SVG/DXF/PDF、DXF 可重读、未审核不得可生产 |
| 5 | BOM 与工艺 | 版本、损耗/工时/费用计算、来源追踪、审批、审计 |
| 6 | 成本报价 | 全成本项、定点金额、规则版本、报价版本、人工审批、AI 不写金额 |
| 7 | 订单生产质量交付 | 报价转订单、任务工序、检验、不合格/返工/复检、放行和归档 |
| 8 | 库存采购供应商 | 不可变流水、缺料、采购审批、到货、价格历史和企业隔离 |
| 9 | 设备维修 | 设备、保养、故障、维修、备件、停机和工序关联 |
| 10 | AI 增强 | 确定性业务稳定后才启用；仍受权限、审批、成本和人工确认约束 |

每个阶段必须单独完成测试、普通提交、正常推送、Pages 部署和公网验证；未获得用户下一次“继续”确认不得提前开发下一阶段。

## 15. 阶段 1 完成标准

- [x] 核对本地代码、路由、页面状态、迁移方式和真实服务器 SQLite 表结构。
- [x] 区分真实后端能力、可复用能力和缺失能力。
- [x] 设计可追踪、可回滚、不可删除用户数据的迁移体系。
- [x] 设计制造实体、关系、公共字段、索引、软删除和并发规则。
- [x] 设计统一编号、API、页面、权限、高风险动作和状态机。
- [x] 设计 `app_states`、订单、库存、OCR 和设备示例的兼容迁移方案。
- [x] 记录 `ENV-OCR-E2E-001`，保留原 OCR E2E 门禁。
- [ ] 阶段 2 客户与 RFQ 实现（必须等待用户后续确认）。

## 16. 已知问题：ENV-OCR-E2E-001

- 现象：自动化浏览器 OCR 流程在生成测试图片并启动识别后，Tesseract 在 60 秒轮询窗口内持续显示 `initializing tesseract`，既未返回文字也未进入明确不可用状态。
- 影响：该问题曾导致 `npm run verify` 的 OCR E2E 项失败；2026-07-17 阶段 1 完整验证重跑通过，但根因尚未修复，因此仍按可间歇复现的环境问题跟踪。它不影响已验证的公网 HTTPS API、SQLite CRUD、企业隔离、CORS、普通页面和手机端链路。
- 约束：不跳过该测试、不把 mock 当真实 OCR、不降低其他门禁、不通过关闭浏览器或系统安全保护强行运行。
- 后续计划：独立核对 worker/core/语言包静态资源路径和网络耗时，增加初始化阶段诊断与明确超时状态，执行冷缓存/热缓存及浏览器矩阵测试；达到“真实结果或明确不可用/降级状态在 SLA 内出现”后再关闭问题。
- 详细复现和测试口径记录在 `TEST_REPORT.md`。
