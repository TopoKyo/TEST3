const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  /const capturePhoto = async \(\) => \{\n    if \(videoRef\.current && canvasRef\.current\) \{/g,
  `const capturePhoto = async () => {\n    if (videoRef.current && canvasRef.current) {\n      if (!videoRef.current.videoWidth) {\n        toast.error('La cámara aún no está lista, por favor espera un momento.');\n        return;\n      }`
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
