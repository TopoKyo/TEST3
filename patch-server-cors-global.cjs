const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Remove the specific /models CORS and static we just added
code = code.replace(
  /app\.use\('\/models', \(req, res, next\) => \{[\s\S]*?next\(\);\s*\}\);\n\s*app\.use\('\/models', express\.static\(path\.join\(process\.cwd\(\), 'public\/models'\)\)\);/g,
  ''
);

// Add global CORS header middleware before everything
code = code.replace(
  'app.use(express.json({ limit: \'50mb\' }));',
  `app.use(express.json({ limit: '50mb' }));
  
  // Global CORS headers to prevent iframe fetch issues
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });`
);

fs.writeFileSync('server.ts', code);
