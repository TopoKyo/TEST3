const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');

code = code.replace(
  /height = imageElement\.naturalHeight \|\| imageElement\.height;\n    \n    if \(\!width/g,
  "height = imageElement.naturalHeight || imageElement.height;\n    }\n    \n    if (!width"
);

fs.writeFileSync('src/lib/faceService.ts', code);
