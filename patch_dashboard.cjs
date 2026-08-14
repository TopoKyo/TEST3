const fs = require('fs');
let dash = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

dash = dash.replace(
  "{ \n      id: 'obligations', \n      label: 'Cumplimiento Diario', \n      description: 'Fiscalización de tareas por cargo',\n      icon: CheckSquare, \n      color: 'bg-teal-500', \n      textColor: 'text-teal-500' \n    },",
  "{ \n      id: 'obligations', \n      label: 'Cumplimiento Diario', \n      description: 'Fiscalización de tareas por cargo',\n      icon: CheckSquare, \n      color: 'bg-teal-500', \n      textColor: 'text-teal-500' \n    },\n    { \n      id: 'briefing', \n      label: 'Charla Diaria', \n      description: 'Registro de charla de seguridad',\n      icon: ClipboardList, \n      color: 'bg-indigo-500', \n      textColor: 'text-indigo-500' \n    },"
);

fs.writeFileSync('src/components/Dashboard.tsx', dash);
