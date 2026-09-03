const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');
code = code.replace(
  "const MODEL_URL = '/models';",
  "const MODEL_URL = typeof window !== 'undefined' ? window.location.origin + '/models' : '/models';"
);
fs.writeFileSync('src/lib/faceService.ts', code);
