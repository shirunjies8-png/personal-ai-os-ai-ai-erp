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

module.exports = {
  runWorkflow
};
