import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, Calendar, History, Trash2, Users } from 'lucide-react';
import { AttendanceLog, User, ATTENDANCE_LABELS, AttendanceType } from '@/src/types';
import { format, parseISO, differenceInMinutes, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface AttendanceHistoryProps {
  logs: AttendanceLog[];
  users: User[];
  onUpdate: () => void;
}

export default function AttendanceHistory({ logs, users, onUpdate }: AttendanceHistoryProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    if (!selectedUser) return [];
    return logs.filter(log => {
      const logDate = parseISO(log.timestamp);
      const isMonthMatch = format(logDate, 'yyyy-MM') === selectedMonth;
      const isUserMatch = log.userId === selectedUser;
      return isMonthMatch && isUserMatch;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, selectedMonth, selectedUser]);

  const monthlyStats = useMemo(() => {
    const stats: Record<string, { totalMinutes: number; days: Set<string> }> = {};
    
    // Simple logic: total minutes between consecutive arrival-departure in a single day
    const userDailyLogs: Record<string, Record<string, AttendanceLog[]>> = {};

    logs.forEach(log => {
      const dateKey = format(parseISO(log.timestamp), 'yyyy-MM-dd');
      const isMonthMatch = format(parseISO(log.timestamp), 'yyyy-MM') === selectedMonth;
      if (!isMonthMatch) return;

      if (!userDailyLogs[log.userId]) userDailyLogs[log.userId] = {};
      if (!userDailyLogs[log.userId][dateKey]) userDailyLogs[log.userId][dateKey] = [];
      userDailyLogs[log.userId][dateKey].push(log);
    });

    Object.entries(userDailyLogs).forEach(([userId, days]) => {
      let totalMinutes = 0;
      const activeDays = new Set<string>();

      Object.entries(days).forEach(([dateKey, dayLogs]) => {
        activeDays.add(dateKey);
        const sortedLogs = dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        let lastArrival: Date | null = null;
        sortedLogs.forEach(log => {
          if (log.type === 'arrival' || log.type === 'break_end') {
            lastArrival = parseISO(log.timestamp);
          } else if ((log.type === 'departure' || log.type === 'break_start') && lastArrival) {
            totalMinutes += differenceInMinutes(parseISO(log.timestamp), lastArrival);
            lastArrival = null;
          }
        });
      });

      stats[userId] = { totalMinutes, days: activeDays };
    });

    return stats;
  }, [logs, selectedMonth]);

  const exportToExcel = () => {
    const data = filteredLogs.map(log => ({
      'ID Usuario': log.userId,
      'Nombre': log.userName,
      'Tipo de Marcaje': ATTENDANCE_LABELS[log.type],
      'Fecha': format(parseISO(log.timestamp), 'dd/MM/yyyy'),
      'Hora': format(parseISO(log.timestamp), 'HH:mm:ss'),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.writeFile(wb, `Asistencia_${selectedMonth}.xlsx`);
    toast.success('Exportación completada');
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // This is a simplified import for the UI
        // In a real app we'd map Excel headers to our types
        console.log('Imported data:', data);
        toast.info('La importación requiere mapeo de campos. Datos detectados en consola.');
      } catch (error) {
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white p-6 rounded-3xl border shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-neutral-400 tracking-wider">Período Mensual</label>
            <input 
              type="month" 
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2 min-w-[200px]">
            <label className="text-xs font-bold uppercase text-neutral-400 tracking-wider">Filtrar por Empleado</label>
            <Select value={selectedUser || ""} onValueChange={setSelectedUser}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Seleccionar empleado..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <label className={cn(buttonVariants({ variant: 'outline' }), "gap-2 rounded-xl border-neutral-200 cursor-pointer")}>
            <Upload size={16} />
            <span className="hidden sm:inline">Importar</span>
            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={importFromExcel} />
          </label>
          <Button onClick={exportToExcel} className={cn("gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-800")}>
            <Download size={16} />
            Exportar Excel
          </Button>
        </div>
      </div>

      {!selectedUser ? (
        <Card className="rounded-[2.5rem] border-dashed border-2 border-neutral-200 bg-neutral-50/50">
          <CardContent className="py-24 flex flex-col items-center justify-center gap-6">
            <div className="p-6 bg-white rounded-full shadow-lg text-neutral-300">
              <Users size={64} />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-neutral-900">Seleccione un Empleado</h3>
              <p className="text-neutral-500 max-w-sm mt-1">Debe seleccionar un trabajador del listado superior para visualizar su historial de asistencia y estadísticas.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(Object.entries(monthlyStats) as [string, { totalMinutes: number; days: Set<string> }][])
              .filter(([uid]) => uid === selectedUser)
              .map(([uid, stat]) => {
                const user = users.find(u => u.id === uid);
                if (!user) return null;
                return (
                  <Card key={uid} className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                    <CardHeader className="bg-neutral-50/50 pb-4">
                      <div className="flex items-center gap-3">
                        <img src={user.image} alt="" className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <CardTitle className="text-lg">{user.name}</CardTitle>
                          <CardDescription className="font-mono text-xs uppercase tracking-tight">ID: {user.id}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Horas Mes</p>
                        <p className="text-3xl font-bold tracking-tight text-neutral-900">{formatHours(stat.totalMinutes)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Días Activos</p>
                        <p className="text-lg font-semibold">{stat.days.size}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="border-b bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <History size={18} className="text-neutral-400" />
                <CardTitle>Historial Detallado</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/50">
                    <TableHead className="font-bold">Fecha</TableHead>
                    <TableHead className="font-bold">Hora</TableHead>
                    <TableHead className="font-bold">Tipo de Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-40 text-center text-neutral-400 italic">
                        No hay registros para este período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log, index) => (
                      <TableRow key={`${log.id}-${index}`}>
                        <TableCell className="font-medium">{format(parseISO(log.timestamp), 'PPP', { locale: es })}</TableCell>
                        <TableCell className="font-mono text-sm">{format(parseISO(log.timestamp), 'HH:mm:ss')}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={`
                              ${log.type === 'arrival' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
                              ${log.type === 'departure' ? 'bg-rose-50 text-rose-700 border-rose-100' : ''}
                              ${log.type === 'break_start' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
                              ${log.type === 'break_end' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
                              rounded-lg px-2 py-0.5 border
                            `}
                          >
                            {ATTENDANCE_LABELS[log.type]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
