class PlanningAgent {
  run(orders = []) {
    const sorted = [...orders].sort((a, b) => String(a.delivery_date || '').localeCompare(String(b.delivery_date || '')));
    return {
      name: 'Planning Agent',
      status: 'done',
      summary: `已生成 ${sorted.length} 条计划建议，默认按交期优先。`,
      plans: sorted.slice(0, 20)
    };
  }
}

module.exports = PlanningAgent;
