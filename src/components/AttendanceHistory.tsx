import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, Calendar, History, Trash2, Users, Plus, Pencil, DollarSign, Copy, Coins, Briefcase } from 'lucide-react';
import { AttendanceLog, User, ATTENDANCE_LABELS, AttendanceType } from '@/src/types';
import { firestoreService } from '@/src/lib/firestoreService';
import { format, parseISO, differenceInMinutes, startOfMonth, endOfMonth, isWithinInterval, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AttendanceHistoryProps {
  logs: AttendanceLog[];
  users: User[];
  onUpdate: () => void;
}

export default function AttendanceHistory({ logs, users, onUpdate }: AttendanceHistoryProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Tasas de pago por usuario, persistidas localmente
  const [userRates, setUserRates] = useState<Record<string, { hourlyRate: number; workdayHours: number }>>(() => {
    try {
      const saved = localStorage.getItem('user_attendance_rates');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleUpdateRate = (userId: string, hourlyRate: number, workdayHours: number) => {
    setUserRates(prev => {
      const updated = {
        ...prev,
        [userId]: { hourlyRate, workdayHours }
      };
      localStorage.setItem('user_attendance_rates', JSON.stringify(updated));
      return updated;
    });
  };

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [manualLog, setManualLog] = useState<{
    userId: string;
    type: AttendanceType;
    date: string;
    time: string;
  }>({
    userId: '',
    type: 'arrival',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm')
  });

  const handleOpenManualEntry = () => {
    setEditingLog(null);
    setManualLog({
      userId: selectedUser || '',
      type: 'arrival',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm')
    });
    setIsManualEntryOpen(true);
  };

  const handleEditLog = (log: AttendanceLog) => {
    const dt = parseISO(log.timestamp);
    setEditingLog(log);
    setManualLog({
      userId: log.userId,
      type: log.type,
      date: format(dt, 'yyyy-MM-dd'),
      time: format(dt, 'HH:mm')
    });
    setIsManualEntryOpen(true);
  };

  const saveManualLog = async () => {
    if (!manualLog.userId || !manualLog.date || !manualLog.time) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    const user = users.find(u => u.id === manualLog.userId);
    if (!user) return;

    try {
      const [y, m, d] = manualLog.date.split('-').map(Number);
      const [hh, mm] = manualLog.time.split(':').map(Number);
      const timestamp = new Date(y, m - 1, d, hh, mm).toISOString();

      const logData: AttendanceLog = {
        id: editingLog ? editingLog.id : Math.random().toString(36).substr(2, 9),
        userId: user.id,
        userName: user.name,
        type: manualLog.type,
        timestamp
      };

      if (editingLog) {
        await firestoreService.update('attendance', editingLog.id, logData);
        toast.success('Registro actualizado');
      } else {
        await firestoreService.add('attendance', logData);
        toast.success('Registro manual guardado');
      }
      
      setIsManualEntryOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving manual log:', error);
      toast.error('Error al guardar el registro');
    }
  };

  const deleteLog = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    try {
      await firestoreService.delete('attendance', id);
      toast.success('Registro eliminado');
      onUpdate();
    } catch (error) {
      toast.error('Error al eliminar registro');
    }
  };

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
        
        let dayMinutes = 0;
        let lastArrival: Date | null = null;
        let hasLogsPast2PM = false;

        sortedLogs.forEach(log => {
          const logDate = parseISO(log.timestamp);
          // Si el marcaje está después de las 2:00 PM (14:00)
          if (logDate.getHours() >= 14) {
            hasLogsPast2PM = true;
          }

          if (log.type === 'arrival' || log.type === 'break_end') {
            lastArrival = logDate;
          } else if ((log.type === 'departure' || log.type === 'break_start') && lastArrival) {
            dayMinutes += differenceInMinutes(logDate, lastArrival);
            lastArrival = null;
          }
        });

        // Descontar una hora (60 minutos) si hay marcajes después de las 2:00 PM
        if (hasLogsPast2PM) {
          dayMinutes = Math.max(0, dayMinutes - 60);
        }

        totalMinutes += dayMinutes;
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
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        toast.loading('Importando registros...');
        let importedCount = 0;

        for (const row of data) {
          // Expected columns: 'ID Usuario', 'Fecha', 'Hora', 'Tipo de Marcaje'
          const userId = row['ID Usuario'] || row['userId'];
          const dateStr = row['Fecha'];
          const timeStr = row['Hora'];
          const typeLabel = row['Tipo de Marcaje'] || row['type'];

          if (!userId || !dateStr || !timeStr || !typeLabel) continue;

          // Find user name
          const user = users.find(u => u.id === String(userId));
          if (!user) continue;

          // Find type constant from label
          const type = (Object.keys(ATTENDANCE_LABELS) as AttendanceType[]).find(
            key => ATTENDANCE_LABELS[key].toLowerCase() === String(typeLabel).toLowerCase()
          );

          if (!type) continue;

          // Parse timestamp
          // dateStr is likely dd/mm/yyyy
          // timeStr is likely hh:mm:ss
          const [d, m, y] = String(dateStr).split('/');
          const [hh, mm, ss] = String(timeStr).split(':');
          const timestamp = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).toISOString();

          const newLog: AttendanceLog = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user.id,
            userName: user.name,
            type,
            timestamp
          };

          await firestoreService.add('attendance', newLog);
          importedCount++;
        }

        toast.dismiss();
        if (importedCount > 0) {
          toast.success(`${importedCount} registros importados correctamente`);
          onUpdate();
        } else {
          toast.error('No se pudieron importar registros. Verifique el formato.');
        }
      } catch (error) {
        toast.dismiss();
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
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
          <Button 
            onClick={handleOpenManualEntry}
            className="rounded-xl border-neutral-200 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Carga Manual</span>
          </Button>
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
          {(() => {
            const selectedUserObj = users.find(u => u.id === selectedUser);
            if (!selectedUserObj) return null;

            const activeStat = monthlyStats[selectedUser] || { totalMinutes: 0, days: new Set<string>() };
            const rateInfo = userRates[selectedUser] || { hourlyRate: 0, workdayHours: 8 };
            const totalHoursDecimal = activeStat.totalMinutes / 60;
            const calculatedDailySalary = rateInfo.hourlyRate * rateInfo.workdayHours;
            const totalPaymentEstimated = totalHoursDecimal * rateInfo.hourlyRate;
            const avgHoursPerDay = activeStat.days.size > 0 ? (totalHoursDecimal / activeStat.days.size).toFixed(1) : '0';

            const handleCopySalaryReport = (userName: string, id: string, totalHours: number, hourlyRate: number, totalToPay: number, workdayHoursValue: number) => {
              const text = `
📄 *REPORTE DE LIQUIDACIÓN Y PAGO*
📅 *Período:* ${selectedMonth}
👤 *Colaborador:* ${userName} (ID: ${id})
-----------------------------------------
⏱️ *Horas Registradas:* ${totalHours.toFixed(2)} horas
💵 *Precio de la Hora:* $${hourlyRate.toFixed(2)}
⏰ *Jornada:* ${workdayHoursValue} horas/día
☀️ *Precio del Día (Jornada):* $${(hourlyRate * workdayHoursValue).toFixed(2)}
-----------------------------------------
💰 *TOTAL ESTIMADO A PAGAR:* $${totalToPay.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              `.trim();

              navigator.clipboard.writeText(text);
              toast.success("Detalle de liquidación copiado al portapapeles.");
            };

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CARD 1: RESUMEN DE ASISTENCIA */}
                <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                  <CardHeader className="bg-neutral-50/50 pb-4">
                    <div className="flex items-center gap-3">
                      {selectedUserObj.image ? (
                        <img src={selectedUserObj.image} alt="" className="w-10 h-10 rounded-full object-cover border border-neutral-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-400 font-bold uppercase">
                          {selectedUserObj.name[0]}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-sm font-bold text-neutral-800">{selectedUserObj.name}</CardTitle>
                        <CardDescription className="font-mono text-[10px] uppercase tracking-tight">ID: {selectedUserObj.id}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-end border-b border-neutral-100 pb-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Horas Mes</p>
                        <p className="text-2xl font-bold tracking-tight text-neutral-900">{formatHours(activeStat.totalMinutes)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Días Activos</p>
                        <p className="text-lg font-semibold text-neutral-800">{activeStat.days.size}</p>
                      </div>
                    </div>

                    <div className="flex justify-between text-neutral-500 text-xs">
                      <span className="flex items-center gap-1"><Briefcase size={12} className="text-neutral-400" /> Promedio diario:</span>
                      <span className="font-bold font-mono text-neutral-700">{avgHoursPerDay} hrs/día</span>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 2: CALCULADORA DE TARIFAS */}
                <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                  <CardHeader className="bg-neutral-50/50 pb-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-800">Cálculo de Tarifas</CardTitle>
                      <CardDescription className="text-[10px] tracking-normal mt-0.5">Establecer ingresos para horas y jornadas</CardDescription>
                    </div>
                    <Coins size={18} className="text-neutral-500" />
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">Precio Hora ($)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={rateInfo.hourlyRate || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateRate(selectedUser, val, rateInfo.workdayHours || 8);
                            }}
                            className="pl-6 h-8 rounded-xl text-xs font-semibold text-neutral-800 bg-neutral-50/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">Horas Jornada</label>
                        <Input 
                          type="number"
                          min="1"
                          max="24"
                          placeholder="8"
                          value={rateInfo.workdayHours || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 8;
                            handleUpdateRate(selectedUser, rateInfo.hourlyRate, val);
                          }}
                          className="h-8 rounded-xl text-xs font-semibold text-neutral-800 bg-neutral-50/50"
                        />
                      </div>
                    </div>

                    <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Precio del Día</h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Basado en jornada laboral</p>
                      </div>
                      <p className="text-base font-extrabold text-neutral-800">
                        ${calculatedDailySalary.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 3: LIQUIDACIÓN DE PAGO */}
                <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                  <CardHeader className="bg-neutral-50/50 pb-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-800">Liquidación de Pago</CardTitle>
                      <CardDescription className="text-[10px] tracking-normal mt-0.5">Monto total y sumario para cobro</CardDescription>
                    </div>
                    <DollarSign size={18} className="text-emerald-600" />
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-neutral-500">
                        <span>Horas mensuales:</span>
                        <span className="font-mono font-bold text-neutral-800">{totalHoursDecimal.toFixed(2)}h</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-neutral-500">
                        <span>Precio de hora:</span>
                        <span className="font-mono font-bold text-neutral-800">${rateInfo.hourlyRate.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/50">
                      <div>
                        <h4 className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest leading-none">Monto Total</h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Esquema Pago Mensual</p>
                      </div>
                      <p className="text-lg font-black text-indigo-700">
                        ${totalPaymentEstimated.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <Button 
                      onClick={() => handleCopySalaryReport(
                        selectedUserObj.name, 
                        selectedUserObj.id, 
                        totalHoursDecimal, 
                        rateInfo.hourlyRate, 
                        totalPaymentEstimated, 
                        rateInfo.workdayHours || 8
                      )}
                      variant="outline" 
                      className="w-full text-[10px] font-semibold h-8 rounded-xl border-neutral-200 text-neutral-600 gap-1.5 flex items-center justify-center cursor-pointer hover:bg-neutral-50"
                    >
                      <Copy size={12} />
                      Copiar Liquidación
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

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
                    <TableHead className="font-bold text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-neutral-400 italic">
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-neutral-400 hover:text-primary rounded-lg"
                              onClick={() => handleEditLog(log)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-neutral-400 hover:text-rose-600 rounded-lg"
                              onClick={() => deleteLog(log.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
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

      <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLog ? 'Editar Registro' : 'Carga de Asistencia Manual'}</DialogTitle>
            <DialogDescription>
              Ingrese los detalles de asistencia para el trabajador seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trabajador</Label>
              <Select 
                value={manualLog.userId} 
                onValueChange={(val) => setManualLog(prev => ({ ...prev, userId: val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar trabajador..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <Select 
                value={manualLog.type} 
                onValueChange={(val) => setManualLog(prev => ({ ...prev, type: val as AttendanceType }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tipo de marcaje..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATTENDANCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input 
                  type="date" 
                  className="rounded-xl" 
                  value={manualLog.date}
                  onChange={e => setManualLog(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input 
                  type="time" 
                  className="rounded-xl" 
                  value={manualLog.time}
                  onChange={e => setManualLog(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsManualEntryOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-xl bg-neutral-900 font-bold" onClick={saveManualLog}>
              {editingLog ? 'Actualizar' : 'Guardar Registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
