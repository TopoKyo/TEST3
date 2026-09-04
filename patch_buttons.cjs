const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

code = code.replace(
  '<div className="flex gap-2">\n              <Button onClick={exportToExcel} className={cn("gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-800")}>\n                <Download size={16} />\n                Exportar Excel\n              </Button>\n            </div>',
  `<div className="flex gap-2">
              <Button onClick={exportAllToExcel} className={cn("gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground")}>
                <FileDown size={16} />
                Descargar todas
              </Button>
              <Button onClick={exportToExcel} disabled={!selectedUser} className={cn("gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-800")}>
                <Download size={16} />
                Exportar Individual
              </Button>
            </div>`
);

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
