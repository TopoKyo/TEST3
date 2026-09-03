const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  /const userDataToSave = \{/g,
  `const userDataToSave: any = {`
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
