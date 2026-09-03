const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');

code = code.replace(
  /console\.log\('Starting detection\.\.\.'\);\n\s*const detection = await faceapi\n\s*\.detectSingleFace\(imageElement, this\.tinyOptions\)\n\s*\.withFaceLandmarks\(\)\n\s*\.withFaceDescriptor\(\);\n\s*console\.log\('Detection finished:', detection\);/g,
  `let targetElement = imageElement;
      
      // If it's an Image that is not in the DOM, draw it to a canvas to ensure face-api handles it correctly
      if (imageElement instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width || imageElement.naturalWidth || 640;
        canvas.height = imageElement.height || imageElement.naturalHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
          targetElement = canvas;
        }
      }

      console.log('Starting detection...');
      const detection = await faceapi
        .detectSingleFace(targetElement, this.tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();
      console.log('Detection finished:', detection);`
);

fs.writeFileSync('src/lib/faceService.ts', code);
