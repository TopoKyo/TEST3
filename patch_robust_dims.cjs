const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');

const regex = /const width = [\s\S]*?if \(!width \|\| !height \|\| width === 0 \|\| height === 0\) \{\s*return .*?;\s*\}/g;

code = code.replace(regex, (match) => {
  return `let width = 0;
    let height = 0;
    
    if (imageElement instanceof HTMLVideoElement) {
      width = imageElement.videoWidth;
      height = imageElement.videoHeight;
    } else if (imageElement instanceof HTMLImageElement) {
      width = imageElement.naturalWidth || imageElement.width;
      height = imageElement.naturalHeight || imageElement.height;
    } else if (imageElement instanceof HTMLCanvasElement) {
      width = imageElement.width;
      height = imageElement.height;
    }

    if (!width || !height || width === 0 || height === 0) {
      ${match.includes('return []') ? 'return [];' : 'return undefined;'}
    }`;
});

fs.writeFileSync('src/lib/faceService.ts', code);
