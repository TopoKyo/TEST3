const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');
code = code.replace(
  'const width = (imageElement as HTMLVideoElement).videoWidth || imageElement.width || (imageElement as HTMLElement).clientWidth;',
  'const width = (imageElement as HTMLVideoElement).videoWidth || imageElement.width || (imageElement as HTMLImageElement).naturalWidth || (imageElement as HTMLElement).clientWidth;'
);
code = code.replace(
  'const height = (imageElement as HTMLVideoElement).videoHeight || imageElement.height || (imageElement as HTMLElement).clientHeight;',
  'const height = (imageElement as HTMLVideoElement).videoHeight || imageElement.height || (imageElement as HTMLImageElement).naturalHeight || (imageElement as HTMLElement).clientHeight;'
);
fs.writeFileSync('src/lib/faceService.ts', code);
