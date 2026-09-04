const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

if (!code.includes("import ExcelJS from 'exceljs';")) {
  code = code.replace("import * as XLSX from 'xlsx';", "import * as XLSX from 'xlsx';\nimport ExcelJS from 'exceljs';\nimport { saveAs } from 'file-saver';");
  fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
}
