const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  "import { format } from 'date-fns';",
  "import { format, startOfWeek, addDays } from 'date-fns';"
);

code = code.replace(
  "import {\n  Camera,",
  "import {\n  Camera,\n  CheckCircle2,\n  XCircle,"
);

const newLogic = `
  const lastMovements = movements.slice(0, 5);
  const sortedWorkLogs = [...workLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastWorkLog = sortedWorkLogs[0];

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));
  const weeklyStatus = weekDays.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isCompleted = workLogs.some(log => log.date.startsWith(dateStr));
    return { day, isCompleted, dateStr };
  });
`;

code = code.replace(
  /  const lastMovements = movements\.slice\(0, 5\);\n  const lastWorkLog = workLogs\.sort\(\(a, b\) => new Date\(b\.date\)\.getTime\(\) - new Date\(a\.date\)\.getTime\(\)\)\[0\];/,
  newLogic
);

// update the grid
code = code.replace(
  '<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">',
  '<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">'
);

const newCard = `
        {/* Weekly Bitacoras */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                <Calendar size={20} />
              </div>
              <CardTitle className="text-xl font-black tracking-tight">Semana Actual</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="space-y-4">
              {weeklyStatus.map(({ day, isCompleted, dateStr }) => (
                <div key={dateStr} className={cn("flex items-center justify-between p-4 rounded-2xl", isCompleted ? "bg-emerald-50" : "bg-neutral-50")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white", isCompleted ? "bg-emerald-500" : "bg-neutral-300")}>
                      {isCompleted ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-neutral-900 leading-none capitalize">
                        {format(day, 'EEEE', { locale: es })}
                      </p>
                      <p className={cn("text-xs mt-1 font-bold", isCompleted ? "text-emerald-600" : "text-neutral-400")}>
                        {isCompleted ? 'Realizada' : 'No realizada'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
`;

code = code.replace(
  '        {/* Last Movements */}',
  newCard + '\\n        {/* Last Movements */}'
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Patched Dashboard.tsx successfully');
