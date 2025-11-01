const fs = require("fs");
const XLSX = require("xlsx");

function parseExcel(filePath) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) return resolve([]);
      const workbook = XLSX.readFile(filePath);
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { parseExcel };
