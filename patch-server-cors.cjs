const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  /app\.use\('\/models', \(req, res, next\) => \{ console\.log\('Requested model:', req\.url\); next\(\); \}\);/g,
  `app.use('/models', (req, res, next) => { 
    console.log('Requested model:', req.url); 
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next(); 
  });`
);
fs.writeFileSync('server.ts', code);
