const CoordinatorAgent = require('../agents/coordinatorAgent');
const ExcelAgent = require('../agents/excelAgent');
const DataCheckAgent = require('../agents/dataCheckAgent');
const PlanningAgent = require('../agents/planningAgent');
const RiskAgent = require('../agents/riskAgent');
const ReportAgent = require('../agents/reportAgent');

function runWorkflow({ rows = [], orders = [], inventory = [] }) {
  const coordinator = new CoordinatorAgent().run({ rowCount: rows.length, orderCount: orders.length, inventoryCount: inventory.length });
  const excel = new ExcelAgent().run(rows);
  const dataCheck = new DataCheckAgent().run(rows);
  const planning = new PlanningAgent().run(orders);
  const risk = new RiskAgent().run({ orders, inventory });
  const report = new ReportAgent().run([coordinator, excel, dataCheck, planning, risk]);

  return {
    workflow: [coordinator, excel, dataCheck, planning, risk, report],
    confirmationRequired: true,
    rlFeedbackEnabled: true
  };
}

function text(value, fallback = '待补充') {
  const result = String(value || '').trim();
  return result || fallback;
}

function run8DWorkflow(input = {}) {
  const incident = input.incident || input;
  const containment = Array.isArray(incident.containmentActions) ? incident.containmentActions.filter(Boolean) : [];
  const causes = Array.isArray(incident.rootCauses) ? incident.rootCauses.filter(Boolean) : [];
  const corrective = Array.isArray(incident.correctiveActions) ? incident.correctiveActions.filter(Boolean) : [];
  const preventive = Array.isArray(incident.preventiveActions) ? incident.preventiveActions.filter(Boolean) : [];
  const evidence = Array.isArray(incident.evidence) ? incident.evidence.filter(Boolean) : [];
  const owner = text(incident.owner, '8D 负责人待指定');
  const problem = text(incident.problem || incident.description);
  const stages = [
    { code: 'D0', name: '准备与响应', status: problem === '待补充' ? 'blocked' : 'complete', output: `问题编号：${text(incident.caseId, '待分配')}；问题：${problem}` },
    { code: 'D1', name: '组建团队', status: owner.includes('待指定') ? 'blocked' : 'complete', output: `负责人：${owner}；团队：${text(incident.team, owner)}` },
    { code: 'D2', name: '描述问题', status: problem === '待补充' ? 'blocked' : 'complete', output: `发生地点：${text(incident.location)}；影响：${text(incident.impact)}` },
    { code: 'D3', name: '临时遏制措施', status: containment.length ? 'complete' : 'blocked', output: containment.length ? containment.join('；') : '需先定义并验证遏制措施' },
    { code: 'D4', name: '根本原因分析', status: causes.length ? 'complete' : 'blocked', output: causes.length ? causes.join('；') : '需完成 5Why / 鱼骨图等确定性证据分析' },
    { code: 'D5', name: '永久纠正措施', status: corrective.length ? 'complete' : 'blocked', output: corrective.length ? corrective.join('；') : '需定义可验证的纠正措施' },
    { code: 'D6', name: '实施与效果验证', status: corrective.length && evidence.length ? 'complete' : 'blocked', output: evidence.length ? `验证证据：${evidence.join('；')}` : '需补充实施记录和效果证据' },
    { code: 'D7', name: '防再发生', status: preventive.length ? 'complete' : 'blocked', output: preventive.length ? preventive.join('；') : '需更新流程、培训、控制计划或系统规则' },
    { code: 'D8', name: '结案与表彰', status: 'waiting_approval', output: '完成度满足后须由管理员确认结案；系统不会自动关闭 8D。' }
  ];
  const blocked = stages.filter(stage => stage.status === 'blocked').map(stage => stage.code);
  return {
    framework: '8D', owner, problem, stages, blocked,
    completionRate: Number((((stages.length - blocked.length - 1) / 8) * 100).toFixed(0)),
    canRequestClosure: blocked.length === 0,
    nextAction: blocked.length ? `补齐 ${blocked[0]} 所需的确定性业务证据` : '提交 D8 结案审批',
    auditSummary: `8D ${text(incident.caseId, '未编号')}：${blocked.length ? `待补齐 ${blocked.join('、')}` : '可申请结案审批'}`
  };
}

module.exports = {
  runWorkflow,
  run8DWorkflow
};
