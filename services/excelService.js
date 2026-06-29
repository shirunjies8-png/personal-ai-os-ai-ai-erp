const XLSX = require('xlsx');

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { cellDates: true, raw: false });
  const firstSheet = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' });
  return {
    firstSheet,
    rows
  };
}

module.exports = {
  parseWorkbook
};
