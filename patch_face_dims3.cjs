const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');
if (!code.includes('width = imageElement.videoWidth')) {
  console.log("Not applied!");
} else {
  console.log("Applied!");
}
