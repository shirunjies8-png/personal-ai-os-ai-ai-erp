class DataCheckAgent {
  run(rows = []) {
    const emptyRows = rows.filter(row => !row.some(cell => String(cell || '').trim())).length;
    return {
      name: 'Data Check Agent',
      status: 'done',
      issues: emptyRows ? [`发现空行 ${emptyRows} 条`] : [],
      summary: emptyRows ? `检测到空数据 ${emptyRows} 条。` : '未发现明显空数据问题。'
    };
  }
}

module.exports = DataCheckAgent;
