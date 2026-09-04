const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');
code = code.replace(/user\.role/g, "(user as any)?.role");
code = code.replace(/user\?\.role/g, "(user as any)?.role");
fs.writeFileSync('src/components/AttendanceHistory.tsx', code);

let faceCode = fs.readFileSync('src/lib/faceService.ts', 'utf-8');
faceCode = faceCode.replace(/} else if \(imageElement instanceof HTMLCanvasElement\) \{[\s\S]*?width = imageElement\.width;[\s\S]*?height = imageElement\.height;[\s\S]*?\}/g, "");
fs.writeFileSync('src/lib/faceService.ts', faceCode);
