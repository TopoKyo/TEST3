const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');
code = code.replace(
  /let targetElement = imageElement;/g,
  'let targetElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement = imageElement;'
);
fs.writeFileSync('src/lib/faceService.ts', code);
