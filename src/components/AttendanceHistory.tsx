import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Download, Upload, FileSpreadsheet, Calendar, History, Trash2, Users, Plus, Pencil, 
  DollarSign, Copy, Coins, Briefcase, Clock, AlertTriangle, Gift, Percent, MinusCircle, 
  PlusCircle, ChevronLeft, ChevronRight, Search, AlertCircle, CheckCircle2, FileDown, ShieldAlert
} from 'lucide-react';
import { AttendanceLog, User, ATTENDANCE_LABELS, AttendanceType } from '@/src/types';
import { firestoreService } from '@/src/lib/firestoreService';
import { getOfficialStartTime, setOfficialStartTime, getDelayInfo, calculateDelayMinutes, calculateDayWorkedMinutes } from '@/src/lib/attendanceUtils';
import { 
  format, parseISO, differenceInMinutes, startOfMonth, endOfMonth, isWithinInterval, 
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, getISOWeek, isSameDay 
} from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AttendanceHistoryProps {
  logs: AttendanceLog[];
  users: User[];
  onUpdate: () => void;
}

export default function AttendanceHistory({ logs, users, onUpdate }: AttendanceHistoryProps) {
  // Pestaña activa: 'weekly' (Control Semanal 42h) o 'individual' (Detalle y Liquidación por Empleado)
  const [activeTab, setActiveTab] = useState<'weekly' | 'individual'>('weekly');
  
  // Controles de semana
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const [weekSearchTerm, setWeekSearchTerm] = useState('');
  const [weekFilter, setWeekFilter] = useState<'all' | 'over42' | 'normal'>('all');

  // Controles mensuales e individuales
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [officialStartTimeState, setOfficialStartTimeState] = useState(getOfficialStartTime());

  const handleStartTimeChange = (val: string) => {
    setOfficialStartTimeState(val);
    setOfficialStartTime(val);
    toast.success(`Horario oficial de entrada configurado a las ${val}`);
  };

  // Tasas de pago, bonos y descuentos por usuario, persistidas localmente
  const [userRates, setUserRates] = useState<Record<string, { 
    hourlyRate: number; 
    workdayHours: number;
    bonusType?: 'none' | 'daily_fixed' | 'fixed' | 'percent';
    bonusValue?: number;
    discountType?: 'none' | 'percent' | 'fixed';
    discountValue?: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem('user_attendance_rates');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleUpdateRate = (userId: string, updates: Partial<{
    hourlyRate: number;
    workdayHours: number;
    bonusType: 'none' | 'daily_fixed' | 'fixed' | 'percent';
    bonusValue: number;
    discountType: 'none' | 'percent' | 'fixed';
    discountValue: number;
  }>) => {
    setUserRates(prev => {
      const current = prev[userId] || { hourlyRate: 0, workdayHours: 8, bonusType: 'none', bonusValue: 0, discountType: 'none', discountValue: 0 };
      const updatedUser = { ...current, ...updates };
      const updated = {
        ...prev,
        [userId]: updatedUser
      };
      localStorage.setItem('user_attendance_rates', JSON.stringify(updated));
      return updated;
    });
  };

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<AttendanceLog | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [selectedDayBreakdown, setSelectedDayBreakdown] = useState<{ user: User; date: Date; dateStr: string } | null>(null);

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

  const handleOpenManualEntry = (defaultUserId?: string, defaultDate?: string) => {
    setEditingLog(null);
    setManualLog({
      userId: defaultUserId || selectedUser || '',
      type: 'arrival',
      date: defaultDate || format(new Date(), 'yyyy-MM-dd'),
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
        toast.success('Registro actualizado correctamente');
      } else {
        await firestoreService.add('attendance', logData);
        toast.success('Registro manual guardado correctamente');
      }
      
      setIsManualEntryOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving manual log:', error);
      toast.error('Error al guardar el registro');
    }
  };

  // Función para solicitar eliminación mediante diálogo modal
  const handleDeleteLogClick = (log: AttendanceLog) => {
    setLogToDelete(log);
  };

  // Ejecución real de la eliminación en Firestore
  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    setIsDeletingLog(true);
    try {
      await firestoreService.delete('attendance', logToDelete.id);
      toast.success('Registro de asistencia eliminado exitosamente');
      setLogToDelete(null);
      onUpdate();
    } catch (error) {
      console.error('Error deleting attendance log:', error);
      toast.error('Error al eliminar el registro de asistencia');
    } finally {
      setIsDeletingLog(false);
    }
  };

  // --- CÁLCULO DE DATOS SEMANALES (LÍMITE 42 HORAS) ---
  const weekStart = useMemo(() => startOfWeek(currentWeekDate, { weekStartsOn: 1 }), [currentWeekDate]);
  const weekEnd = useMemo(() => endOfWeek(currentWeekDate, { weekStartsOn: 1 }), [currentWeekDate]);
  const daysInWeek = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const weeklyUserData = useMemo(() => {
    return users.map(user => {
      let totalWeeklyMinutes = 0;
      const dailyMinutes: { date: Date; dateStr: string; dayName: string; minutes: number; hours: number }[] = [];

      daysInWeek.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayLogs = logs.filter(l => l.userId === user.id && format(parseISO(l.timestamp), 'yyyy-MM-dd') === dateStr);
        const minutes = calculateDayWorkedMinutes(dayLogs);
        
        totalWeeklyMinutes += minutes;
        dailyMinutes.push({
          date: day,
          dateStr,
          dayName: format(day, 'EEE', { locale: es }),
          minutes,
          hours: minutes / 60
        });
      });

      const totalWeeklyHours = totalWeeklyMinutes / 60;
      const isOver42 = totalWeeklyHours > 42;
      const excessHours = isOver42 ? totalWeeklyHours - 42 : 0;
      const activeDaysCount = dailyMinutes.filter(d => d.minutes > 0).length;

      return {
        user,
        dailyMinutes,
        totalWeeklyMinutes,
        totalWeeklyHours,
        isOver42,
        excessHours,
        activeDaysCount
      };
    });
  }, [users, logs, daysInWeek]);

  // Filtros de la tabla semanal
  const filteredWeeklyData = useMemo(() => {
    return weeklyUserData.filter(item => {
      const matchesSearch = item.user.name.toLowerCase().includes(weekSearchTerm.toLowerCase()) ||
                            item.user.id.toLowerCase().includes(weekSearchTerm.toLowerCase()) ||
                            (item.user.role && item.user.role.toLowerCase().includes(weekSearchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      if (weekFilter === 'over42') return item.isOver42;
      if (weekFilter === 'normal') return item.totalWeeklyHours > 0 && !item.isOver42;
      return true;
    }).sort((a, b) => b.totalWeeklyHours - a.totalWeeklyHours);
  }, [weeklyUserData, weekSearchTerm, weekFilter]);

  // Estadísticas globales de la semana
  const weeklySummaryStats = useMemo(() => {
    const totalWorkers = weeklyUserData.length;
    const activeWorkers = weeklyUserData.filter(u => u.totalWeeklyHours > 0).length;
    const over42Count = weeklyUserData.filter(u => u.isOver42).length;
    const normalCount = weeklyUserData.filter(u => u.totalWeeklyHours > 0 && !u.isOver42).length;
    const grandTotalHours = weeklyUserData.reduce((acc, u) => acc + u.totalWeeklyHours, 0);

    return {
      totalWorkers,
      activeWorkers,
      over42Count,
      normalCount,
      grandTotalHours
    };
  }, [weeklyUserData]);

  // Exportar Horas Semanales a Excel
  const exportWeeklyToExcel = () => {
    const weekLabel = `${format(weekStart, 'dd-MM-yyyy')}_al_${format(weekEnd, 'dd-MM-yyyy')}`;
    const data = filteredWeeklyData.map(item => {
      const row: Record<string, any> = {
        'ID / RUT': item.user.id,
        'Nombre': item.user.name,
        'Cargo': item.user.role || 'Operativo',
      };

      item.dailyMinutes.forEach(d => {
        const colName = `${format(d.date, 'EEEE dd/MM', { locale: es })}`;
        row[colName] = d.hours > 0 ? Number(d.hours.toFixed(2)) : 0;
      });

      row['Días Trabajados'] = item.activeDaysCount;
      row['Total Horas Semanales'] = Number(item.totalWeeklyHours.toFixed(2));
      row['Límite Legal (42h)'] = '42 hrs';
      row['Estado Jornada'] = item.isOver42 ? `SUPERA 42h (+${item.excessHours.toFixed(2)}h)` : (item.totalWeeklyHours > 0 ? 'Dentro de norma' : 'Sin horas');

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horas_Semanales');
    XLSX.writeFile(wb, `Horas_Semanales_${weekLabel}.xlsx`);
    toast.success('Reporte semanal exportado a Excel');
  };

  // --- CÁLCULO DE DATOS MENSUALES ---
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
    const stats: Record<string, { totalMinutes: number; days: Set<string>; totalDelayMinutes: number; lateCount: number }> = {};
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
      let totalDelayMinutes = 0;
      let lateCount = 0;
      const activeDays = new Set<string>();

      Object.entries(days).forEach(([dateKey, dayLogs]) => {
        activeDays.add(dateKey);
        const dayMins = calculateDayWorkedMinutes(dayLogs);

        dayLogs.forEach(log => {
          if (log.type === 'arrival') {
            const delay = calculateDelayMinutes(log.timestamp, officialStartTimeState);
            if (delay > 0) {
              totalDelayMinutes += delay;
              lateCount += 1;
            }
          }
        });

        totalMinutes += dayMins;
      });

      stats[userId] = { totalMinutes, days: activeDays, totalDelayMinutes, lateCount };
    });

    return stats;
  }, [logs, selectedMonth, officialStartTimeState]);

  // Desglose semanal del mes para el trabajador seleccionado
  const selectedUserMonthWeeks = useMemo(() => {
    if (!selectedUser) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const mStart = startOfMonth(new Date(y, m - 1, 1));
    const mEnd = endOfMonth(new Date(y, m - 1, 1));

    // Generar semanas que tocan este mes
    const weeks: { weekNumber: number; start: Date; end: Date; totalMinutes: number; totalHours: number; isOver42: boolean; daysCount: number }[] = [];
    let curr = startOfWeek(mStart, { weekStartsOn: 1 });

    while (curr <= mEnd) {
      const wStart = curr;
      const wEnd = endOfWeek(curr, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: wStart, end: wEnd });

      let wMinutes = 0;
      let activeDays = 0;

      weekDays.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const dLogs = logs.filter(l => l.userId === selectedUser && format(parseISO(l.timestamp), 'yyyy-MM-dd') === dStr);
        const mins = calculateDayWorkedMinutes(dLogs);
        if (mins > 0) {
          wMinutes += mins;
          activeDays++;
        }
      });

      const wHours = wMinutes / 60;
      weeks.push({
        weekNumber: getISOWeek(wStart),
        start: wStart,
        end: wEnd,
        totalMinutes: wMinutes,
        totalHours: wHours,
        isOver42: wHours > 42,
        daysCount: activeDays
      });

      curr = addWeeks(curr, 1);
    }

    return weeks;
  }, [selectedUser, selectedMonth, logs]);

  const exportToExcel = () => {
    const data = filteredLogs.map(log => {
      const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
      return {
        'ID Usuario': log.userId,
        'Nombre': log.userName,
        'Tipo de Marcaje': ATTENDANCE_LABELS[log.type],
        'Fecha': format(parseISO(log.timestamp), 'dd/MM/yyyy'),
        'Hora': format(parseISO(log.timestamp), 'HH:mm:ss'),
        'Estado Entrada': delayInfo ? delayInfo.label : '-',
        'Atraso (min)': delayInfo ? delayInfo.delayMinutes : 0
      };
    });

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
          const userId = row['ID Usuario'] || row['userId'];
          const dateStr = row['Fecha'];
          const timeStr = row['Hora'];
          const typeLabel = row['Tipo de Marcaje'] || row['type'];

          if (!userId || !dateStr || !timeStr || !typeLabel) continue;

          const user = users.find(u => u.id === String(userId));
          if (!user) continue;

          const type = (Object.keys(ATTENDANCE_LABELS) as AttendanceType[]).find(
            key => ATTENDANCE_LABELS[key].toLowerCase() === String(typeLabel).toLowerCase()
          );

          if (!type) continue;

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
      {/* NAVEGACIÓN PRINCIPAL DE PESTAÑAS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-2.5 rounded-3xl border shadow-sm">
        <div className="flex bg-neutral-100/80 p-1 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('weekly')}
            className={cn(
              "flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'weekly'
                ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/60"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <Clock size={16} className={weeklySummaryStats.over42Count > 0 ? "text-rose-600 animate-pulse" : "text-indigo-600"} />
            <span>Control Semanal de Horas (Límite 42h)</span>
            {weeklySummaryStats.over42Count > 0 && (
              <Badge className="bg-rose-600 text-white font-extrabold text-[10px] px-1.5 py-0 h-4">
                {weeklySummaryStats.over42Count}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={cn(
              "flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'individual'
                ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/60"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <Users size={16} className="text-neutral-600" />
            <span>Detalle y Liquidación por Trabajador</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button 
            onClick={handleOpenManualEntry}
            size="sm"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 text-xs"
          >
            <Plus size={14} />
            <span>Carga Manual</span>
          </Button>
          <label className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), "gap-1.5 rounded-xl border-neutral-200 cursor-pointer h-9 text-xs")}>
            <Upload size={14} />
            <span className="hidden sm:inline">Importar</span>
            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={importFromExcel} />
          </label>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: SECCIÓN DE HORAS SEMANALES POR TRABAJADOR (CONTROL 42 HORAS) */}
      {/* ========================================================================= */}
      {activeTab === 'weekly' && (
        <div className="space-y-6">
          {/* BARRA SUPERIOR DE CONTROL SEMANAL */}
          <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Selector de Semana */}
              <div className="flex items-center flex-wrap gap-2">
                <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-2xl p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-neutral-600 hover:bg-white"
                    onClick={() => setCurrentWeekDate(prev => subWeeks(prev, 1))}
                    title="Semana Anterior"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs font-bold rounded-xl text-neutral-800 hover:bg-white"
                    onClick={() => setCurrentWeekDate(new Date())}
                  >
                    Esta Semana
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-neutral-600 hover:bg-white"
                    onClick={() => setCurrentWeekDate(prev => addWeeks(prev, 1))}
                    title="Semana Siguiente"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>

                <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 px-4 py-2 rounded-2xl">
                  <Calendar size={16} className="text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-indigo-950 capitalize">
                    Semana {getISOWeek(weekStart)} • {format(weekStart, "d 'de' MMMM", { locale: es })} - {format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                </div>
              </div>

              {/* Acciones y Exportación */}
              <div className="flex items-center gap-2">
                <Button 
                  onClick={exportWeeklyToExcel}
                  className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white gap-2 text-xs h-10 px-4"
                >
                  <FileDown size={15} />
                  Exportar Planilla Semanal (Excel)
                </Button>
              </div>
            </div>

            {/* Búsqueda y Filtros de Estado */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-100">
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <Input
                  placeholder="Buscar trabajador por nombre o ID..."
                  value={weekSearchTerm}
                  onChange={e => setWeekSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl bg-neutral-50/50"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setWeekFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                    weekFilter === 'all'
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  Todos ({weeklySummaryStats.totalWorkers})
                </button>
                <button
                  type="button"
                  onClick={() => setWeekFilter('over42')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                    weekFilter === 'over42'
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  )}
                >
                  <AlertTriangle size={13} className={weekFilter === 'over42' ? "text-white" : "text-rose-600"} />
                  <span>Superan 42h ({weeklySummaryStats.over42Count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWeekFilter('normal')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                    weekFilter === 'normal'
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  )}
                >
                  Dentro de 42h ({weeklySummaryStats.normalCount})
                </button>
              </div>
            </div>
          </div>

          {/* TARJETAS RESUMEN DE LA SEMANA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tarjeta 1: Total Trabajadores con Asistencia */}
            <Card className="rounded-3xl border shadow-xs bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Trabajadores Activos</p>
                  <p className="text-2xl font-black text-neutral-900">{weeklySummaryStats.activeWorkers} <span className="text-xs font-medium text-neutral-400">/ {weeklySummaryStats.totalWorkers}</span></p>
                  <p className="text-[11px] text-neutral-500">Con marcaje en la semana</p>
                </div>
                <div className="p-3 bg-neutral-100 rounded-2xl text-neutral-700">
                  <Users size={24} />
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta 2: Total Horas de la Semana */}
            <Card className="rounded-3xl border shadow-xs bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Horas Totales Obra</p>
                  <p className="text-2xl font-black text-indigo-900">{weeklySummaryStats.grandTotalHours.toFixed(1)} <span className="text-xs font-medium text-indigo-600">hrs</span></p>
                  <p className="text-[11px] text-neutral-500">Suma total de colaboradores</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <Clock size={24} />
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta 3: Alerta de Sobrejornada (> 42 horas) */}
            <Card className={cn(
              "rounded-3xl border shadow-xs transition-all",
              weeklySummaryStats.over42Count > 0
                ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-200"
                : "bg-white border-neutral-200"
            )}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-none text-rose-700">
                    Sobrejornada (&gt; 42 hrs)
                  </p>
                  <p className={cn(
                    "text-2xl font-black font-mono",
                    weeklySummaryStats.over42Count > 0 ? "text-rose-600" : "text-neutral-800"
                  )}>
                    {weeklySummaryStats.over42Count} <span className="text-xs font-medium">{weeklySummaryStats.over42Count === 1 ? 'persona' : 'personas'}</span>
                  </p>
                  <p className="text-[11px] text-rose-800 font-medium">
                    {weeklySummaryStats.over42Count > 0 ? "⚠️ Superan límite legal semanal" : "✅ Ninguno excede 42 horas"}
                  </p>
                </div>
                <div className={cn(
                  "p-3 rounded-2xl",
                  weeklySummaryStats.over42Count > 0 ? "bg-rose-600 text-white shadow-sm" : "bg-neutral-100 text-neutral-400"
                )}>
                  <ShieldAlert size={24} />
                </div>
              </CardContent>
            </Card>

            {/* Tarjeta 4: Jornada Ordinaria */}
            <Card className="rounded-3xl border shadow-xs bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Jornada Conforme</p>
                  <p className="text-2xl font-black text-emerald-700">{weeklySummaryStats.normalCount} <span className="text-xs font-medium text-emerald-600">personas</span></p>
                  <p className="text-[11px] text-neutral-500">Dentro de 42h semanales</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TABLA PRINCIPAL DE HORAS TRABAJADAS POR TRABAJADOR */}
          <Card className="rounded-3xl border shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-neutral-50/50 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-indigo-600" />
                    <CardTitle className="text-base font-bold text-neutral-900">Horas Trabajadas en la Semana por Trabajador</CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Control legal de jornada laboral (Límite 42 horas semanales). Los registros que superen las 42 horas se resaltan automáticamente en <strong>rojo</strong>.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-800 bg-indigo-50/50 font-mono w-fit">
                  Límite: 42 hrs/sem
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-neutral-50/70">
                      <TableHead className="font-bold min-w-[200px]">Colaborador</TableHead>
                      {daysInWeek.map((day, idx) => (
                        <TableHead key={idx} className="font-bold text-center text-xs min-w-[65px]">
                          <span className="capitalize">{format(day, 'EEE', { locale: es })}</span>
                          <span className="block text-[10px] text-neutral-400 font-normal">{format(day, 'dd/MM')}</span>
                        </TableHead>
                      ))}
                      <TableHead className="font-bold text-center text-xs min-w-[70px]">Días</TableHead>
                      <TableHead className="font-extrabold text-center min-w-[150px] bg-neutral-100/70">
                        TOTAL SEMANAL
                      </TableHead>
                      <TableHead className="font-bold min-w-[160px]">Estado / Alerta</TableHead>
                      <TableHead className="font-bold text-right min-w-[110px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWeeklyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="h-44 text-center text-neutral-400 italic">
                          No se encontraron trabajadores con los filtros seleccionados para esta semana.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredWeeklyData.map(item => (
                        <TableRow 
                          key={item.user.id}
                          className={cn(
                            "transition-colors",
                            item.isOver42 ? "bg-rose-50/30 hover:bg-rose-50/60" : "hover:bg-neutral-50/60"
                          )}
                        >
                          {/* COLABORADOR */}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              {item.user.image ? (
                                <img src={item.user.image} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-200" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 text-xs font-bold uppercase">
                                  {item.user.name[0]}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-neutral-900 text-xs leading-tight">{item.user.name}</p>
                                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">ID: {item.user.id} {item.user.role ? `• ${item.user.role}` : ''}</p>
                              </div>
                            </div>
                          </TableCell>

                          {/* DÍAS LUN A DOM */}
                          {item.dailyMinutes.map((d, i) => (
                            <TableCell key={i} className="text-center font-mono text-xs p-1.5">
                              {d.hours > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDayBreakdown({
                                    user: item.user,
                                    date: d.date,
                                    dateStr: format(d.date, 'yyyy-MM-dd')
                                  })}
                                  title={`Ver y gestionar marcajes de ${format(d.date, 'EEEE d/MM', { locale: es })}`}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:scale-105 cursor-pointer shadow-2xs",
                                    d.hours >= 9.5 
                                      ? "bg-amber-100 text-amber-900 font-bold hover:bg-amber-200 border border-amber-300" 
                                      : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-200"
                                  )}
                                >
                                  {d.hours.toFixed(1)}h
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDayBreakdown({
                                    user: item.user,
                                    date: d.date,
                                    dateStr: format(d.date, 'yyyy-MM-dd')
                                  })}
                                  title={`Añadir o revisar marcajes de ${format(d.date, 'EEEE d/MM', { locale: es })}`}
                                  className="text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded px-1.5 py-0.5 transition-colors text-xs"
                                >
                                  -
                                </button>
                              )}
                            </TableCell>
                          ))}

                          {/* DÍAS TRABAJADOS */}
                          <TableCell className="text-center font-medium text-xs">
                            <Badge variant="outline" className="rounded-lg text-[11px]">
                              {item.activeDaysCount} {item.activeDaysCount === 1 ? 'día' : 'días'}
                            </Badge>
                          </TableCell>

                          {/* TOTAL HORAS SEMANALES: SI SUPERA 42 HORAS, EL NÚMERO SALE EN ROJO */}
                          <TableCell className="text-center bg-neutral-50/50 p-2">
                            {item.isOver42 ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-rose-600 font-extrabold text-base bg-rose-50 border border-rose-300 px-3 py-1 rounded-xl inline-flex items-center gap-1.5 shadow-xs font-mono">
                                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                                  {item.totalWeeklyHours.toFixed(1)} hrs
                                </span>
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full border border-rose-200">
                                  +{item.excessHours.toFixed(1)}h sobre 42h
                                </span>
                              </div>
                            ) : (
                              <span className={cn(
                                "font-bold text-sm px-3 py-1 rounded-xl inline-block font-mono",
                                item.totalWeeklyHours > 0 
                                  ? "text-neutral-900 bg-neutral-100 border border-neutral-200" 
                                  : "text-neutral-400 bg-neutral-50"
                              )}>
                                {item.totalWeeklyHours.toFixed(1)} hrs
                              </span>
                            )}
                          </TableCell>

                          {/* ESTADO / ALERTA */}
                          <TableCell>
                            {item.isOver42 ? (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold gap-1 rounded-lg text-[11px] py-1">
                                <AlertTriangle size={13} className="text-rose-600" />
                                <span>Supera 42h Semanales</span>
                              </Badge>
                            ) : item.totalWeeklyHours > 0 ? (
                              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 gap-1 rounded-lg text-[11px] py-1">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                <span>Jornada Normal (&le;42h)</span>
                              </Badge>
                            ) : (
                              <span className="text-neutral-400 text-xs italic">Sin horas registradas</span>
                            )}
                          </TableCell>

                          {/* ACCIONES */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-8 px-2.5 rounded-xl text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 border-indigo-200 gap-1 font-semibold"
                                onClick={() => setSelectedDayBreakdown({
                                  user: item.user,
                                  date: weekStart,
                                  dateStr: format(weekStart, 'yyyy-MM-dd')
                                })}
                                title="Ver y gestionar marcajes de la semana"
                              >
                                <History size={13} />
                                Marcajes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-8 px-2.5 rounded-xl text-neutral-700 hover:bg-neutral-100 border-neutral-200"
                                onClick={() => {
                                  setSelectedUser(item.user.id);
                                  setSelectedMonth(format(weekStart, 'yyyy-MM'));
                                  setActiveTab('individual');
                                }}
                              >
                                Ver Detalle
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: DETALLE INDIVIDUAL Y LIQUIDACIÓN POR TRABAJADOR */}
      {/* ========================================================================= */}
      {activeTab === 'individual' && (
        <div className="space-y-6">
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
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1">
                  <Clock size={12} className="text-amber-600" />
                  Hora Entrada Oficial
                </label>
                <input 
                  type="time" 
                  className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                  value={officialStartTimeState}
                  onChange={e => handleStartTimeChange(e.target.value)}
                />
              </div>
              <div className="space-y-2 min-w-[220px]">
                <label className="text-xs font-bold uppercase text-neutral-400 tracking-wider">Seleccionar Empleado</label>
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
                  <p className="text-neutral-500 max-w-sm mt-1">Debe seleccionar un trabajador del listado superior para visualizar su historial de asistencia, desglose semanal y liquidación.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {(() => {
                const selectedUserObj = users.find(u => u.id === selectedUser);
                if (!selectedUserObj) return null;

                const activeStat = monthlyStats[selectedUser] || { totalMinutes: 0, days: new Set<string>(), totalDelayMinutes: 0, lateCount: 0 };
                const rateInfo = userRates[selectedUser] || { 
                  hourlyRate: 0, 
                  workdayHours: 8,
                  bonusType: 'none',
                  bonusValue: 0,
                  discountType: 'none',
                  discountValue: 0
                };

                const totalHoursDecimal = activeStat.totalMinutes / 60;
                const calculatedDailySalary = rateInfo.hourlyRate * (rateInfo.workdayHours || 8);
                const basePayment = totalHoursDecimal * rateInfo.hourlyRate;
                const activeDaysCount = activeStat.days.size;
                const avgHoursPerDay = activeDaysCount > 0 ? (totalHoursDecimal / activeDaysCount).toFixed(1) : '0';

                // Cálculo de Bonos
                const bType = rateInfo.bonusType || 'none';
                const bValue = rateInfo.bonusValue || 0;
                let bonusAmount = 0;
                let bonusDetailText = 'Sin bonos';

                if (bType === 'daily_fixed') {
                  bonusAmount = bValue * activeDaysCount;
                  bonusDetailText = `${bValue.toLocaleString('es-MX')}/día × ${activeDaysCount} días trabajados`;
                } else if (bType === 'fixed') {
                  bonusAmount = bValue;
                  bonusDetailText = `Monto fijo de ${bValue.toLocaleString('es-MX')}`;
                } else if (bType === 'percent') {
                  bonusAmount = basePayment * (bValue / 100);
                  bonusDetailText = `${bValue}% del sueldo base`;
                }

                const subtotalWithBonus = basePayment + bonusAmount;

                // Cálculo de Descuentos / Cotizaciones
                const dType = rateInfo.discountType || 'none';
                const dValue = rateInfo.discountValue || 0;
                let discountAmount = 0;
                let discountDetailText = 'Sin descuentos';

                if (dType === 'percent') {
                  discountAmount = subtotalWithBonus * (dValue / 100);
                  discountDetailText = `Cotización ${dValue}% manual`;
                } else if (dType === 'fixed') {
                  discountAmount = dValue;
                  discountDetailText = `Descuento fijo de -${dValue.toLocaleString('es-MX')}`;
                }

                const netTotalPayment = Math.max(0, subtotalWithBonus - discountAmount);

                const handleCopySalaryReport = () => {
                  const text = `
📄 *REPORTE DE LIQUIDACIÓN Y PAGO DE SUELDO*
📅 *Período:* ${selectedMonth}
👤 *Colaborador:* ${selectedUserObj.name} (ID: ${selectedUserObj.id})
-----------------------------------------
⏱️ *Horas Registradas:* ${totalHoursDecimal.toFixed(2)} hrs (${activeDaysCount} días trabajados)
💵 *Precio de Hora:* ${rateInfo.hourlyRate.toFixed(2)} | Jornada: ${rateInfo.workdayHours || 8}h
☀️ *Sueldo Base Estimado:* ${basePayment.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
-----------------------------------------
➕ *Bonos Adicionales:* ${bonusAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bonusDetailText})
➖ *Descuentos / Cotizaciones:* -${discountAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${discountDetailText})
-----------------------------------------
💰 *TOTAL LÍQUIDO A PAGAR:* ${netTotalPayment.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  `.trim();

                  navigator.clipboard.writeText(text);
                  toast.success("Detalle de liquidación copiado al portapapeles.");
                };

                return (
                  <div className="space-y-6">
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
                              <p className="text-lg font-semibold text-neutral-800">{activeDaysCount}</p>
                            </div>
                          </div>

                          <div className="flex justify-between text-neutral-500 text-xs">
                            <span className="flex items-center gap-1"><Briefcase size={12} className="text-neutral-400" /> Promedio diario:</span>
                            <span className="font-bold font-mono text-neutral-700">{avgHoursPerDay} hrs/día</span>
                          </div>

                          <div className="flex justify-between items-center text-xs pt-2 border-t border-neutral-100">
                            <span className="flex items-center gap-1 text-neutral-500">
                              <Clock size={12} className="text-amber-500" /> Hora Entrada Oficial:
                            </span>
                            <span className="font-bold font-mono text-neutral-800">{officialStartTimeState} hrs</span>
                          </div>

                          <div className="flex justify-between items-center text-xs">
                            <span className="flex items-center gap-1 text-neutral-500">
                              <AlertTriangle size={12} className={activeStat.totalDelayMinutes > 0 ? "text-amber-600" : "text-emerald-500"} /> Atrasos Mes:
                            </span>
                            {activeStat.totalDelayMinutes > 0 ? (
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                                +{activeStat.totalDelayMinutes} min ({activeStat.lateCount} {activeStat.lateCount === 1 ? 'atraso' : 'atrasos'})
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                                Sin atrasos
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* CARD 2: CONFIGURACIÓN DE TARIFAS, BONOS Y COTIZACIONES */}
                      <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                        <CardHeader className="bg-neutral-50/50 pb-3 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-bold text-neutral-800">Tarifas, Bonos y Cotizaciones</CardTitle>
                            <CardDescription className="text-[10px] tracking-normal mt-0.5">Ajustes para la liquidación</CardDescription>
                          </div>
                          <Coins size={18} className="text-amber-600" />
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                          {/* Precio hora y jornada */}
                          <div className="grid grid-cols-2 gap-2">
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
                                    handleUpdateRate(selectedUser, { hourlyRate: val });
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
                                  handleUpdateRate(selectedUser, { workdayHours: val });
                                }}
                                className="h-8 rounded-xl text-xs font-semibold text-neutral-800 bg-neutral-50/50"
                              />
                            </div>
                          </div>

                          {/* Bonos */}
                          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                <Gift size={11} /> Bono Adicional
                              </label>
                              {bType === 'daily_fixed' && bValue > 0 && (
                                <span className="text-[10px] text-emerald-700 font-medium font-mono">
                                  ${(bValue * activeDaysCount).toLocaleString('es-MX')} ({activeDaysCount}d)
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Select 
                                value={bType} 
                                onValueChange={(val: 'none' | 'daily_fixed' | 'fixed' | 'percent') => {
                                  handleUpdateRate(selectedUser, { bonusType: val });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-xl bg-neutral-50/50">
                                  <SelectValue placeholder="Tipo de bono" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sin Bono</SelectItem>
                                  <SelectItem value="daily_fixed">Bono Diario ($/día)</SelectItem>
                                  <SelectItem value="fixed">Bono Fijo Total ($)</SelectItem>
                                  <SelectItem value="percent">Bono Porcentaje (%)</SelectItem>
                                </SelectContent>
                              </Select>

                              {bType !== 'none' ? (
                                <div className="relative">
                                  {bType === 'percent' ? (
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">%</span>
                                  ) : (
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                                  )}
                                  <Input 
                                    type="number"
                                    min="0"
                                    placeholder={bType === 'daily_fixed' ? "Ej: 2000" : "0"}
                                    value={bValue || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      handleUpdateRate(selectedUser, { bonusValue: val });
                                    }}
                                    className={`h-8 rounded-xl text-xs font-semibold text-neutral-800 bg-neutral-50/50 ${bType === 'percent' ? 'pr-6' : 'pl-6'}`}
                                  />
                                </div>
                              ) : (
                                <div className="h-8 flex items-center text-[10px] text-neutral-400 italic px-2">No aplica</div>
                              )}
                            </div>
                          </div>

                          {/* Descuentos / Cotizaciones */}
                          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-extrabold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                                <MinusCircle size={11} /> Descuento / Cotización
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Select 
                                value={dType} 
                                onValueChange={(val: 'none' | 'percent' | 'fixed') => {
                                  handleUpdateRate(selectedUser, { discountType: val });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-xl bg-neutral-50/50">
                                  <SelectValue placeholder="Tipo descuento" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sin Descuento</SelectItem>
                                  <SelectItem value="percent">Cotización (% Manual)</SelectItem>
                                  <SelectItem value="fixed">Descuento Fijo ($)</SelectItem>
                                </SelectContent>
                              </Select>

                              {dType !== 'none' ? (
                                <div className="relative">
                                  {dType === 'percent' ? (
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">%</span>
                                  ) : (
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                                  )}
                                  <Input 
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    placeholder={dType === 'percent' ? "Ej: 7" : "0"}
                                    value={dValue || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      handleUpdateRate(selectedUser, { discountValue: val });
                                    }}
                                    className={`h-8 rounded-xl text-xs font-semibold text-neutral-800 bg-neutral-50/50 ${dType === 'percent' ? 'pr-6' : 'pl-6'}`}
                                  />
                                </div>
                              ) : (
                                <div className="h-8 flex items-center text-[10px] text-neutral-400 italic px-2">No aplica</div>
                              )}
                            </div>

                            {dType === 'percent' && (
                              <div className="flex gap-1 pt-1">
                                <span className="text-[9px] text-neutral-400 font-medium">Cotizaciones rápidas:</span>
                                {[7, 10, 13, 17].map(pct => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => handleUpdateRate(selectedUser, { discountType: 'percent', discountValue: pct })}
                                    className={`text-[9px] px-1.5 py-0.5 rounded-md border font-mono transition-colors ${dValue === pct ? 'bg-rose-100 border-rose-300 text-rose-800 font-bold' : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}
                                  >
                                    {pct}%
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* CARD 3: LIQUIDACIÓN DE PAGO */}
                      <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                        <CardHeader className="bg-neutral-50/50 pb-3 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-bold text-neutral-800">Liquidación de Pago</CardTitle>
                            <CardDescription className="text-[10px] tracking-normal mt-0.5">Desglose final y monto líquido</CardDescription>
                          </div>
                          <DollarSign size={18} className="text-indigo-600" />
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-neutral-500">
                              <span>Horas trabajadas:</span>
                              <span className="font-mono font-bold text-neutral-800">{totalHoursDecimal.toFixed(2)} hrs</span>
                            </div>
                            <div className="flex justify-between text-neutral-500">
                              <span>Sueldo Base Estimado:</span>
                              <span className="font-mono font-bold text-neutral-800">${basePayment.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between text-emerald-600">
                              <span className="flex items-center gap-1"><PlusCircle size={11} /> Bonos ({bType === 'daily_fixed' ? `${activeDaysCount}d` : bType}):</span>
                              <span className="font-mono font-bold">+${bonusAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between text-rose-600">
                              <span className="flex items-center gap-1"><MinusCircle size={11} /> Descuentos / Cotiz.:</span>
                              <span className="font-mono font-bold">-${discountAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-3 border border-indigo-100">
                            <div>
                              <h4 className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest leading-none">TOTAL LÍQUIDO A PAGAR</h4>
                              <p className="text-[10px] text-neutral-500 mt-0.5">{selectedMonth} • {activeDaysCount} días</p>
                            </div>
                            <p className="text-xl font-black text-indigo-700 font-mono">
                              ${netTotalPayment.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          <Button 
                            onClick={handleCopySalaryReport}
                            variant="outline" 
                            className="w-full text-xs font-semibold h-9 rounded-xl border-neutral-200 text-neutral-700 gap-2 flex items-center justify-center cursor-pointer hover:bg-neutral-50 shadow-sm"
                          >
                            <Copy size={13} />
                            Copiar Liquidación Completa
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    {/* CARD: CONTROL SEMANAL DEL MES PARA ESTE TRABAJADOR (LÍMITE 42 HORAS) */}
                    <Card className="rounded-3xl border shadow-md overflow-hidden bg-white">
                      <CardHeader className="bg-neutral-50/50 border-b pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock size={18} className="text-indigo-600" />
                            <CardTitle className="text-sm font-bold text-neutral-900">Desglose Semanal del Mes (Control 42h)</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-800 bg-indigo-50/50 font-mono">
                            Límite: 42 hrs/sem
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-1">
                          Horas trabajadas por semana en el mes de {selectedMonth}. Si supera las 42 horas semanales, el número se resalta en <strong className="text-rose-600">rojo</strong>.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {selectedUserMonthWeeks.map((week, idx) => (
                            <div 
                              key={idx}
                              className={cn(
                                "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3",
                                week.isOver42 
                                  ? "bg-rose-50/60 border-rose-300 ring-1 ring-rose-200" 
                                  : "bg-neutral-50/50 border-neutral-200"
                              )}
                            >
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Semana {week.weekNumber}</span>
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono">
                                    {week.daysCount} {week.daysCount === 1 ? 'día' : 'días'}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-neutral-400">
                                  {format(week.start, 'dd/MM')} - {format(week.end, 'dd/MM')}
                                </p>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Horas Trabajadas</p>
                                <p className={cn(
                                  "text-xl font-black font-mono mt-0.5",
                                  week.isOver42 ? "text-rose-600 flex items-center gap-1" : "text-neutral-900"
                                )}>
                                  {week.isOver42 && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                                  {week.totalHours.toFixed(1)} hrs
                                </p>

                                {week.isOver42 ? (
                                  <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold mt-1.5 w-full justify-center">
                                    Excede 42h (+{(week.totalHours - 42).toFixed(1)}h)
                                  </Badge>
                                ) : week.totalHours > 0 ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] mt-1.5 w-full justify-center">
                                    Normal (&le;42h)
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-neutral-400 italic block mt-1">Sin horas</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* HISTORIAL DETALLADO DE MARCAJES */}
              <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                <CardHeader className="border-b bg-neutral-50/50">
                  <div className="flex items-center gap-2">
                    <History size={18} className="text-neutral-400" />
                    <CardTitle>Historial Detallado de Marcajes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-neutral-50/50">
                        <TableHead className="font-bold">Fecha</TableHead>
                        <TableHead className="font-bold">Hora</TableHead>
                        <TableHead className="font-bold">Tipo de Evento</TableHead>
                        <TableHead className="font-bold">Puntualidad / Atraso</TableHead>
                        <TableHead className="font-bold text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center text-neutral-400 italic">
                            No hay registros para este período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLogs.map((log, index) => {
                          const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
                          return (
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
                              <TableCell>
                                {log.type === 'arrival' && delayInfo ? (
                                  delayInfo.isLate ? (
                                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 gap-1 rounded-lg font-mono text-[11px]">
                                      <Clock size={12} className="text-amber-600" />
                                      +{delayInfo.delayMinutes} min atraso
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 gap-1 rounded-lg text-[11px]">
                                      A tiempo ({officialStartTimeState})
                                    </Badge>
                                  )
                                ) : (
                                  <span className="text-neutral-300 text-xs">-</span>
                                )}
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
                                    onClick={() => handleDeleteLogClick(log)}
                                    title="Eliminar este marcaje"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* DIÁLOGO DE CARGA/EDICIÓN MANUAL DE ASISTENCIA */}
      <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLog ? 'Editar Registro de Asistencia' : 'Carga de Asistencia Manual'}</DialogTitle>
            <DialogDescription>
              {editingLog 
                ? 'Modifique los datos del marcaje de asistencia seleccionado.' 
                : 'Ingrese los detalles de asistencia para el trabajador seleccionado.'}
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
            <Button className="rounded-xl bg-neutral-900 font-bold text-white" onClick={saveManualLog}>
              {editingLog ? 'Actualizar Registro' : 'Guardar Registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <Dialog open={!!logToDelete} onOpenChange={(open) => !open && !isDeletingLog && setLogToDelete(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <DialogTitle className="text-base">¿Eliminar registro de asistencia?</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Esta acción eliminará el marcaje de forma permanente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {logToDelete && (
            <div className="py-3 space-y-3">
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60">
                  <span className="text-neutral-500 font-medium">Trabajador:</span>
                  <span className="font-bold text-neutral-900">{logToDelete.userName}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60">
                  <span className="text-neutral-500 font-medium">Tipo de Evento:</span>
                  <Badge variant="secondary" className="rounded-lg font-semibold">
                    {ATTENDANCE_LABELS[logToDelete.type]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 font-medium">Fecha y Hora:</span>
                  <span className="font-mono font-bold text-neutral-800">
                    {format(parseISO(logToDelete.timestamp), "d 'de' MMMM, yyyy • HH:mm:ss", { locale: es })}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-900">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Al eliminar este registro, las <strong>horas semanales (42h)</strong> y <strong>totales mensuales</strong> de este trabajador se recalcularán automáticamente en tiempo real.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button 
              variant="outline" 
              className="rounded-xl text-xs" 
              onClick={() => setLogToDelete(null)}
              disabled={isDeletingLog}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-xs"
              onClick={handleConfirmDeleteLog}
              disabled={isDeletingLog}
            >
              {isDeletingLog ? (
                <>Eliminando...</>
              ) : (
                <>
                  <Trash2 size={13} />
                  Sí, Eliminar Registro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO MODAL: MARCAJES DEL DÍA (DESDE LA VISTA SEMANAL) */}
      <Dialog open={!!selectedDayBreakdown} onOpenChange={(open) => !open && setSelectedDayBreakdown(null)}>
        <DialogContent className="rounded-3xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedDayBreakdown && (() => {
            const currentDayLogs = logs
              .filter(l => l.userId === selectedDayBreakdown.user.id && format(parseISO(l.timestamp), 'yyyy-MM-dd') === selectedDayBreakdown.dateStr)
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            const dayWorkedMin = calculateDayWorkedMinutes(currentDayLogs);
            const dayWorkedHours = dayWorkedMin / 60;

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {selectedDayBreakdown.user.image ? (
                        <img src={selectedDayBreakdown.user.image} alt="" className="w-10 h-10 rounded-full object-cover border border-neutral-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-700 font-bold uppercase text-sm">
                          {selectedDayBreakdown.user.name[0]}
                        </div>
                      )}
                      <div>
                        <DialogTitle className="text-base">{selectedDayBreakdown.user.name}</DialogTitle>
                        <DialogDescription className="text-xs capitalize">
                          {format(selectedDayBreakdown.date, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                        </DialogDescription>
                      </div>
                    </div>

                    <Badge className="bg-neutral-900 text-white font-mono text-xs px-2.5 py-1 rounded-xl">
                      {dayWorkedHours.toFixed(1)} hrs trabajadas
                    </Badge>
                  </div>
                </DialogHeader>

                {/* SELECTOR RÁPIDO DE DÍAS DE LA SEMANA */}
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 bg-neutral-100/80 p-1.5 rounded-2xl border border-neutral-200/60">
                    {daysInWeek.map((day) => {
                      const dStr = format(day, 'yyyy-MM-dd');
                      const isSelected = dStr === selectedDayBreakdown.dateStr;
                      const hasLogs = logs.some(l => l.userId === selectedDayBreakdown.user.id && format(parseISO(l.timestamp), 'yyyy-MM-dd') === dStr);
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => setSelectedDayBreakdown({
                            user: selectedDayBreakdown.user,
                            date: day,
                            dateStr: dStr
                          })}
                          className={cn(
                            "flex-1 min-w-[50px] py-1.5 px-2 rounded-xl text-center transition-all text-xs font-semibold",
                            isSelected 
                              ? "bg-white text-neutral-900 shadow-xs border border-neutral-200" 
                              : "text-neutral-500 hover:text-neutral-800 hover:bg-white/60"
                          )}
                        >
                          <span className="block text-[10px] uppercase font-bold text-neutral-400">
                            {format(day, 'EEE', { locale: es })}
                          </span>
                          <span className="block text-xs font-mono font-bold mt-0.5">
                            {format(day, 'd')}
                          </span>
                          {hasLogs && (
                            <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* LISTADO DE MARCAJES DEL DÍA */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Marcajes Registrados ({currentDayLogs.length})
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-xl gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleOpenManualEntry(selectedDayBreakdown.user.id, selectedDayBreakdown.dateStr)}
                      >
                        <Plus size={13} />
                        Añadir Marcaje
                      </Button>
                    </div>

                    {currentDayLogs.length === 0 ? (
                      <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl p-6 text-center text-neutral-400 text-xs">
                        No hay registros de marcaje para este día.
                      </div>
                    ) : (
                      <div className="border rounded-2xl overflow-hidden divide-y divide-neutral-100 bg-white">
                        {currentDayLogs.map((log) => {
                          const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
                          return (
                            <div key={log.id} className="p-3 flex items-center justify-between gap-3 hover:bg-neutral-50/70 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-lg">
                                  {format(parseISO(log.timestamp), 'HH:mm:ss')}
                                </span>
                                <Badge 
                                  variant="secondary"
                                  className={cn(
                                    "rounded-lg text-xs font-medium",
                                    log.type === 'arrival' && 'bg-emerald-50 text-emerald-700 border-emerald-100',
                                    log.type === 'departure' && 'bg-rose-50 text-rose-700 border-rose-100',
                                    log.type === 'break_start' && 'bg-blue-50 text-blue-700 border-blue-100',
                                    log.type === 'break_end' && 'bg-amber-50 text-amber-700 border-amber-100'
                                  )}
                                >
                                  {ATTENDANCE_LABELS[log.type]}
                                </Badge>
                                {log.type === 'arrival' && delayInfo && (
                                  delayInfo.isLate ? (
                                    <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0 gap-1 rounded-md">
                                      <Clock size={10} /> +{delayInfo.delayMinutes}m atraso
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] text-emerald-600 font-semibold">A tiempo</span>
                                  )
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-neutral-400 hover:text-primary rounded-lg"
                                  onClick={() => handleEditLog(log)}
                                  title="Editar"
                                >
                                  <Pencil size={13} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-neutral-400 hover:text-rose-600 rounded-lg"
                                  onClick={() => handleDeleteLogClick(log)}
                                  title="Eliminar"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="sm:justify-end">
                  <Button variant="outline" className="rounded-xl text-xs" onClick={() => setSelectedDayBreakdown(null)}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
