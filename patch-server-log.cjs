const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  'app.use(express.json({ limit: \'50mb\' }));',
  'app.use(express.json({ limit: \'50mb\' }));\n  app.use(\'/models\', (req, res, next) => { console.log(\'Requested model:\', req.url); next(); });\n  app.use(\'/models\', express.static(path.join(process.cwd(), \'public/models\')));'
);
fs.writeFileSync('server.ts', code);
