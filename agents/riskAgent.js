class RiskAgent {
  run({ orders = [], inventory = [] }) {
    const delayed = orders.filter(item => item.delivery_date && new Date(item.delivery_date) < new Date() && item.status !== '已完成').length;
    const lowStock = inventory.filter(item => Number(item.stock_quantity) <= Number(item.safety_stock)).length;
    return {
      name: 'Risk Agent',
      status: 'done',
      summary: `延期风险 ${delayed} 条，库存风险 ${lowStock} 条。`,
      risks: {
        delayed,
        lowStock
      }
    };
  }
}

module.exports = RiskAgent;
