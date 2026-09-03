const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');

code = code.replace(
  /const detection = await faceapi\n\s*\.detectSingleFace\(imageElement, this\.tinyOptions\)\n\s*\.withFaceLandmarks\(\)\n\s*\.withFaceDescriptor\(\);/g,
  `console.log('Starting detection...');
      const detection = await faceapi
        .detectSingleFace(imageElement, this.tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();
      console.log('Detection finished:', detection);`
);

fs.writeFileSync('src/lib/faceService.ts', code);
