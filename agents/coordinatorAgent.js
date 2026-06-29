class CoordinatorAgent {
  run(context) {
    return {
      name: 'Coordinator Agent',
      status: 'done',
      summary: '已接收 Excel/订单上下文，开始拆分执行链路。',
      context
    };
  }
}

module.exports = CoordinatorAgent;
