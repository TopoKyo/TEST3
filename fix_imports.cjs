const fs = require('fs');
let code = fs.readFileSync('src/components/DailyLog.tsx', 'utf-8');

code = code.replace("import { ArrowUp, ArrowDown, Card", "import { Card");
code = code.replace("import { \n  FileText,", "import { \n  ArrowUp,\n  ArrowDown,\n  FileText,");

fs.writeFileSync('src/components/DailyLog.tsx', code);
