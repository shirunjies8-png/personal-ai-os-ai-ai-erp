class ExcelAgent {
  run(rows = []) {
    return {
      name: 'Excel Agent',
      status: 'done',
      rows: rows.length,
      summary: `已解析 Excel，共 ${rows.length} 行。`
    };
  }
}

module.exports = ExcelAgent;
