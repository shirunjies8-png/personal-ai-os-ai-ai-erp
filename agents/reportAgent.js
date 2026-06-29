class ReportAgent {
  run(results = []) {
    return {
      name: 'Report Agent',
      status: 'done',
      summary: '已汇总 Agent 执行结果，等待人工确认。',
      report: results.map(item => `${item.name}: ${item.summary}`).join('\n')
    };
  }
}

module.exports = ReportAgent;
