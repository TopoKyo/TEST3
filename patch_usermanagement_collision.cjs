const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  "import { Plus, Pencil, Trash2, Camera, UserPlus, RefreshCw, Users, User } from 'lucide-react';",
  "import { Plus, Pencil, Trash2, Camera, UserPlus, RefreshCw, Users, User as UserIcon } from 'lucide-react';"
);

code = code.replace(
  "<User size={20} />",
  "<UserIcon size={20} />"
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
