const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  /const img = new Image\(\);\s*img.src = formData.image;\s*await new Promise.*/,
  `const img = new Image();\n      const loadPromise = new Promise((resolve, reject) => {\n        img.onload = resolve;\n        img.onerror = reject;\n      });\n      img.src = formData.image;\n      await loadPromise;`
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
