const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');

code = code.replace(
  /const detection = await faceapi\n\s*\.detectSingleFace\(imageElement, this\.tinyOptions\)\n\s*\.withFaceLandmarks\(\)\n\s*\.withFaceDescriptor\(\);/g,
  `let targetElement = imageElement;
      
      // If it's an Image that is not in the DOM, draw it to a canvas to ensure face-api handles it correctly
      if (imageElement instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.width || imageElement.naturalWidth;
        canvas.height = imageElement.height || imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
          targetElement = canvas;
        }
      }

      const detection = await faceapi
        .detectSingleFace(targetElement, this.tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();`
);

fs.writeFileSync('src/lib/faceService.ts', code);
