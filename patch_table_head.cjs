const fs = require('fs');
let code = fs.readFileSync('src/components/DailyLog.tsx', 'utf-8');

const headTarget = `{isEditing && <TableHead className="w-[50px]"></TableHead>}`;
const headReplacement = `{isEditing && <TableHead className="w-[120px]"></TableHead>}`;

code = code.split(headTarget).join(headReplacement);
fs.writeFileSync('src/components/DailyLog.tsx', code);
