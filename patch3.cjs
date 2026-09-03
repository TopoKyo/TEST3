const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  /\} catch \(error\) \{\n\s*toast\.error\('Error al guardar usuario'\);\n\s*\}/g,
  `} catch (error) {
      console.error(error);
      toast.error('Error al guardar: ' + (error.message || error));
    }`
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
