const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

code = code.replace(/weeklySummary\.activeWorkers/g, "weeklySummaryStats.activeWorkers");
code = code.replace(/weeklySummary\.grandTotalHours/g, "weeklySummaryStats.grandTotalHours");
code = code.replace(/weeklySummary\.over42Count/g, "weeklySummaryStats.over42Count");

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
