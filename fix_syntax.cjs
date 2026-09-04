const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

code = code.replace(/item\.\(user as any\)\?\.role/g, "(item.user as any)?.role");

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
