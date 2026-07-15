(function initApqpWorkspace(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.APQPWorkspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApqpWorkspace() {
  const STATIC_NOTICE = '当前为静态演示模式，真实 APQP 保存、证据、风险、任务、审批和归档需连接本地或生产服务。';
  const HIGH_RISK_ACTIONS = new Set([
    'evidence-delete', 'risk-accept', 'risk-close', 'stage-submit', 'stage-approve', 'stage-reject',
    'project-close', 'project-owner', 'project-due-date', 'project-importance'
  ]);

  function validateProject(input = {}) {
    const errors = [];
    if (!String(input.project_name || '').trim()) errors.push('项目名称不能为空');
    if (!String(input.project_owner || '').trim()) errors.push('项目负责人不能为空');
    if (input.planned_start_date && input.planned_end_date && input.planned_end_date < input.planned_start_date) {
      errors.push('计划完成日期不能早于开始日期');
    }
    return errors;
  }

  function validateEvidenceDelete(reason = '') {
    return String(reason || '').trim() ? [] : ['删除证据必须填写原因'];
  }

  function assertWritable(isStatic) {
    if (isStatic) {
      const error = new Error(STATIC_NOTICE);
      error.code = 'APQP_STATIC_READ_ONLY';
      throw error;
    }
    return true;
  }

  function requiresConfirmation(action) {
    return HIGH_RISK_ACTIONS.has(String(action || ''));
  }

  function demoProject() {
    const stageNames = ['计划和确定项目', '产品设计与开发验证', '过程设计与开发验证', '产品和过程确认', '反馈、评定和纠正措施'];
    const progress = [75, 35, 10, 0, 0];
    const stages = stageNames.map((name, index) => ({
      id: `demo-stage-${index + 1}`,
      stage_no: index + 1,
      name,
      status: index === 0 ? 'blocked' : index === 1 ? 'in_progress' : 'not_started',
      progress: progress[index],
      approval_status: index === 0 ? 'pending' : 'not_required',
      blocker_reason: index === 0 ? '缺少交付物证据' : '',
      deliverables: [
        { id: `demo-d-${index + 1}-1`, name: index === 0 ? '客户需求' : `${name}交付物 A`, status: index === 0 ? 'completed' : 'not_started', owner: '质量工程师', due_date: '2026-09-30', required: 1, evidence_count: index === 0 ? 1 : 0, is_applicable: 1, not_applicable_reason: '' },
        { id: `demo-d-${index + 1}-2`, name: index === 0 ? '可行性评审' : `${name}交付物 B`, status: 'waiting_evidence', owner: '项目负责人', due_date: '2026-10-15', required: 1, evidence_count: 0, is_applicable: 1, not_applicable_reason: '' }
      ],
      risks: [],
      tasks: [],
      approvals: index === 0 ? [{ id: 'demo-approval-1', status: 'pending', requested_by: '质量工程师', reason: '' }] : []
    }));
    const assessment = {
      current_stage: 1,
      overall_progress: 24,
      stage_progress: stages.map(stage => ({ stage_id: stage.id, stage_no: stage.stage_no, progress: stage.progress, status: stage.status })),
      blockers: [{ stage: 1, reason: '缺少交付物证据' }, { stage: 1, reason: '高风险未关闭' }, { stage: 1, reason: '审批未完成' }],
      missing_deliverables: [{ stage: 1, reason: '缺少交付物证据' }],
      missing_evidence: [{ stage: 1, reason: '缺少交付物证据' }],
      incomplete_tasks: [{ stage: 1, reason: '存在未完成任务' }],
      open_high_risks: [{ stage: 1, reason: '高风险未关闭' }],
      pending_approvals: [{ stage: 1, reason: '审批未完成' }],
      next_actions: ['补充可行性评审证据', '关闭供应风险', '完成阶段审批'],
      can_close_project: false
    };
    return {
      id: 'demo-apqp-001',
      project_no: 'APQP-DEMO-001',
      project_name: '新能源汽车连接器开发（脱敏示例）',
      customer_or_source: '示例客户 A',
      product_description: '高压连接器系列示例项目',
      project_owner: '项目负责人',
      project_team: '质量、研发、生产、采购',
      project_type: '新产品开发',
      importance_level: 'high',
      current_stage: 1,
      planned_start_date: '2026-07-01',
      planned_end_date: '2026-12-31',
      status: 'in_progress',
      stages,
      assessment,
      deliverables: stages.flatMap(stage => stage.deliverables),
      evidence: [{ id: 'demo-e-1', deliverable_id: 'demo-d-1-1', file_name: '客户需求确认记录（示例）.pdf', storage_status: 'metadata_only', uploaded_by: '质量工程师', created_at: '2026-07-10T08:00:00.000Z' }],
      risks: [{ id: 'demo-r-1', title: '关键材料交期风险', risk_level: 'high', is_blocking: 1, status: 'handling', owner: '采购负责人', due_date: '2026-08-15', acceptance_reason: '', closure_evidence: '' }],
      tasks: [{ id: 'demo-t-1', stage_id: 'demo-stage-1', title: '补充可行性评审证据', owner: '项目负责人', priority: 'high', due_date: '2026-08-01', status: 'waiting_evidence', evidence_required: 1, overdue: true }],
      history: [
        { id: 'demo-h-1', action: '创建 APQP 项目', detail: '脱敏示例项目', actor: '示例管理员', created_at: '2026-07-01T08:00:00.000Z' },
        { id: 'demo-h-2', action: '新增风险', detail: '关键材料交期风险', actor: '示例用户', created_at: '2026-07-12T08:00:00.000Z' }
      ]
    };
  }

  return { STATIC_NOTICE, validateProject, validateEvidenceDelete, assertWritable, requiresConfirmation, demoProject };
});
