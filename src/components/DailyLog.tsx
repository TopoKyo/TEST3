import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  Search, 
  CloudSun, 
  Users, 
  HardHat, 
  AlertCircle, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  Copy,
  Printer,
  History,
  Info,
  Pencil
} from 'lucide-react';
import { 
  WorkLog, 
  User, 
  PersonnelEntry, 
  ActivityEntry, 
  ProblemEntry, 
  PlanEntry, 
  SafetyChecklist,
  AttendanceLog
} from '@/src/types';
import { firestoreService } from '@/src/lib/firestoreService';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DailyLogProps {
  users: User[];
  attendanceLogs: AttendanceLog[];
}

const EMPTY_LOG: Omit<WorkLog, 'id' | 'date'> = {
  reportNumber: 0,
  project: '',
  client: '',
  residentHead: '',
  workAddress: '',
  dayOfWeek: '',
  processItem: '',
  advancePercentage: 0,
  advanceM2: 0,
  weather: {
    morningTemp: 20,
    afternoonTemp: 25,
    avgTemp: 22.5,
    rain: 'Ninguna',
    wind: 10,
    affectedWork: false
  },
  personnel: [],
  activities: [],
  safety: {
    morningTalk: false,
    eppUsage: false,
    attendanceReview: false,
    taskCoordination: false,
    reportCompleted: false,
    orderAndCleanliness: false,
    correctionsDone: false,
    observations: '',
    incidents: ''
  },
  problems: [],
  nextDayPlan: []
};

export default function DailyLog({ users, attendanceLogs }: DailyLogProps) {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentLog, setCurrentLog] = useState<WorkLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    const log = logs.find(l => l.date === currentDate);
    if (log) {
      setCurrentLog(log);
      setIsEditing(false);
    } else {
      setCurrentLog(null);
    }
  }, [currentDate, logs]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await firestoreService.getAll<WorkLog>('workLogs');
      setLogs(data);
    } catch (e) {
      toast.error('Error al cargar bitácoras');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const prevLog = logs.length > 0 ? logs[logs.length - 1] : null;
    const newLog: WorkLog = {
      ...EMPTY_LOG,
      id: Math.random().toString(36).substr(2, 9),
      date: currentDate,
      reportNumber: logs.length + 1,
      dayOfWeek: format(parseISO(currentDate), 'EEEE', { locale: es }),
      // Inherit static data from previous log if exists
      project: prevLog?.project || '',
      client: prevLog?.client || '',
      residentHead: prevLog?.residentHead || '',
      workAddress: prevLog?.workAddress || '',
    };
    
    // Auto-populate personnel from attendance logs of today
    const activeStaff = attendanceLogs
      .filter(al => al.timestamp.startsWith(currentDate))
      .filter((v, i, a) => a.findIndex(t => t.userId === v.userId) === i) // Unique users
      .map(al => ({
        id: Math.random().toString(36).substr(2, 5),
        name: al.userName,
        role: users.find(u => u.id === al.userId)?.id || '-', // Using ID for role is funny, let's just use placeholder
        arrivalTime: format(parseISO(al.timestamp), 'HH:mm'),
        departureTime: '-'
      }));
    
    newLog.personnel = activeStaff;
    setCurrentLog(newLog);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!currentLog) return;
    try {
      const existing = logs.some(l => l.id === currentLog.id);
      if (existing) {
        await firestoreService.update('workLogs', currentLog.id, currentLog);
      } else {
        await firestoreService.add('workLogs', currentLog);
      }

      toast.success('Bitácora guardada correctamente');
      fetchLogs();
      setIsEditing(false);
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const handleDuplicate = () => {
    if (logs.length === 0) {
      toast.info('No hay bitácoras previas para duplicar');
      return;
    }
    const last = logs[logs.length - 1];
    const newLog: WorkLog = {
      ...last,
      id: Math.random().toString(36).substr(2, 9),
      date: currentDate,
      reportNumber: logs.length + 1,
      dayOfWeek: format(parseISO(currentDate), 'EEEE', { locale: es }),
    };
    setCurrentLog(newLog);
    setIsEditing(true);
    toast.success('Datos del día anterior cargados');
  };

  const addItem = (section: 'activities' | 'personnel' | 'problems' | 'nextDayPlan') => {
    if (!currentLog) return;
    const items = [...currentLog[section]];
    
    if (section === 'activities') {
      (items as ActivityEntry[]).push({
        id: Math.random().toString(36).substr(2, 5),
        item: items.length + 1,
        description: '',
        unit: 'M2',
        planned: 0,
        executedToday: 0,
        accumulated: 0,
        status: 'en proceso'
      });
    } else if (section === 'personnel') {
      (items as PersonnelEntry[]).push({
        id: Math.random().toString(36).substr(2, 5),
        name: '',
        role: '',
        arrivalTime: '08:00',
        departureTime: '18:00'
      });
    } else if (section === 'problems') {
      (items as ProblemEntry[]).push({
        id: Math.random().toString(36).substr(2, 5),
        number: items.length + 1,
        description: '',
        impact: 'Medio',
        correctiveAction: '',
        responsible: ''
      });
    } else if (section === 'nextDayPlan') {
      (items as PlanEntry[]).push({
        id: Math.random().toString(36).substr(2, 5),
        number: items.length + 1,
        activity: '',
        responsible: ''
      });
    }

    setCurrentLog({ ...currentLog, [section]: items });
  };

  const removeItem = (section: string, id: string) => {
    if (!currentLog) return;
    const items = (currentLog as any)[section].filter((i: any) => i.id !== id);
    setCurrentLog({ ...currentLog, [section]: items });
  };

  const updateItem = (section: string, id: string, field: string, value: any) => {
    if (!currentLog) return;
    const items = (currentLog as any)[section].map((i: any) => 
      i.id === id ? { ...i, [field]: value } : i
    );
    setCurrentLog({ ...currentLog, [section]: items });
  };

  const getBase64ImageFromURL = (url: string) => {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      };
      img.onerror = (error) => {
        reject(error);
      };
      img.src = url;
    });
  };

  const exportPDF = async () => {
    if (!currentLog) return;
    const doc = new jsPDF();
    
    // Add Logo
    try {
      const logoData = await getBase64ImageFromURL('/logo.png');
      doc.addImage(logoData, 'PNG', 15, 10, 25, 25);
    } catch (e) {
      console.warn('Logo could not be loaded for PDF', e);
    }

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('BITÁCORA DIARIA DE OBRA', 110, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Informe N°: ${currentLog.reportNumber} | Fecha: ${currentLog.date} (${currentLog.dayOfWeek})`, 110, 29, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 38, 195, 38);

    // General Info Table
    autoTable(doc, {
      startY: 45,
      head: [['DATOS GENERALES DEL PROYECTO', '']],
      body: [
        ['Proyecto:', currentLog.project],
        ['Cliente:', currentLog.client],
        ['Jefe Residente:', currentLog.residentHead],
        ['Dirección:', currentLog.workAddress],
        ['Partida en proceso:', currentLog.processItem],
        ['Avance:', `${currentLog.advancePercentage}% (${currentLog.advanceM2} m2)`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] }
    });

    // Weather
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [['CONDICIONES CLIMÁTICAS', 'MAÑANA', 'TARDE', 'LLUVIA', 'VIENTO', 'AFECTÓ']],
      body: [[
        'Valores', 
        `${currentLog.weather.morningTemp}°C`, 
        `${currentLog.weather.afternoonTemp}°C`, 
        currentLog.weather.rain, 
        `${currentLog.weather.wind} km/h`,
        currentLog.weather.affectedWork ? 'SÍ' : 'NO'
      ]],
      theme: 'grid'
    });

    // Personnel
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [['PERSONAL EN OBRA', 'CARGO', 'LLEGADA', 'SALIDA']],
      body: currentLog.personnel.map(p => [p.name, p.role, p.arrivalTime, p.departureTime]),
      theme: 'striped'
    });

    // Activities
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [['ÍTEM', 'ACTIVIDAD', 'UNIDAD', 'PLANIFICADO', 'EJECUTADO', 'ACUMULADO', 'ESTADO']],
      body: currentLog.activities.map(a => [a.item, a.description, a.unit, a.planned, a.executedToday, a.accumulated, a.status.toUpperCase()]),
      theme: 'grid'
    });

    // Safety
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [['SEGURIDAD Y SSO', 'ESTADO']],
      body: [
        ['Charla 5 min:', currentLog.safety.morningTalk ? 'SÍ' : 'NO'],
        ['EPP Completo:', currentLog.safety.eppUsage ? 'SÍ' : 'NO'],
        ['Revisión Asistencia:', currentLog.safety.attendanceReview ? 'SÍ' : 'NO'],
        ['Incidentes:', currentLog.safety.incidents || 'Ninguno'],
        ['Observaciones Grales:', currentLog.safety.observations || '-']
      ],
      theme: 'grid'
    });

    doc.save(`Bitacora_${currentLog.date}.pdf`);
  };

  if (loading) return <div className="p-12 text-center">Cargando bitácoras...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900">Bitácora de Obra</h2>
          <p className="text-neutral-500 mt-1">Gestión de informes diarios, personal y trazabilidad de avance.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-neutral-100">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentDate(subDays(parseISO(currentDate), 1).toISOString().split('T')[0])}>
            <ChevronLeft size={20} />
          </Button>
          <div className="flex flex-col px-4 items-center min-w-[200px]">
             <span className="text-xs font-bold uppercase text-primary/70 tracking-widest leading-none">
               {format(parseISO(currentDate), 'EEEE', { locale: es })}
             </span>
             <span className="text-lg font-black text-neutral-900">
               {format(parseISO(currentDate), 'd \'de\' MMMM, yyyy', { locale: es })}
             </span>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setCurrentDate(addDays(parseISO(currentDate), 1).toISOString().split('T')[0])}>
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      {!currentLog && !isEditing ? (
        <Card className="rounded-[2.5rem] border-dashed border-2 border-neutral-200 bg-neutral-50/50">
          <CardContent className="py-24 flex flex-col items-center justify-center gap-6">
            <div className="p-6 bg-white rounded-full shadow-lg text-neutral-300">
              <FileText size={64} />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-neutral-900">Sin informe para hoy</h3>
              <p className="text-neutral-500 max-w-sm mt-1">Aún no se ha registrado información para esta fecha.</p>
            </div>
            <div className="flex gap-4">
              <Button size="lg" className="rounded-2xl px-10 h-14 text-lg font-bold shadow-xl shadow-primary/20" onClick={handleCreateNew}>
                Crear Nuevo Informe
              </Button>
              <Button variant="outline" size="lg" className="rounded-2xl px-10 h-14 text-lg font-bold border-neutral-200 bg-white" onClick={handleDuplicate}>
                <Copy className="mr-2 h-5 w-5" /> Duplicar Ayer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-12">
          {/* Action Bar */}
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm sticky top-4 z-10">
            <div className="flex items-center gap-4">
              {isEditing ? (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">MODO EDICIÓN</Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">MODO LECTURA</Badge>
              )}
              <span className="text-neutral-400">|</span>
              <span className="text-sm font-medium">Informe N° {currentLog?.reportNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={exportPDF}>
                <Printer className="mr-2 h-4 w-4" /> PDF
              </Button>
              {isEditing ? (
                <>
                  <Button variant="ghost" className="rounded-xl" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  <Button className="rounded-xl px-8 shadow-md" onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" /> Guardar Informe
                  </Button>
                </>
              ) : (
                <Button className="rounded-xl px-8" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar Datos
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Sections */}
            <div className="lg:col-span-2 space-y-10">
              {/* Section 1: Datos Generales */}
              <LogSection title="Información General" icon={<Info />} isEditing={isEditing}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Proyecto</Label>
                    <Input value={currentLog?.project || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, project: e.target.value} : null)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Input value={currentLog?.client || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, client: e.target.value} : null)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Jefe Residente</Label>
                    <Input value={currentLog?.residentHead || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, residentHead: e.target.value} : null)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección de Obra</Label>
                    <Input value={currentLog?.workAddress || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, workAddress: e.target.value} : null)} className="rounded-xl" />
                  </div>
                </div>
                <Separator className="my-6" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Partida Activa</Label>
                    <Input value={currentLog?.processItem || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, processItem: e.target.value} : null)} className="rounded-xl" placeholder="Ej: Fundaciones" />
                  </div>
                  <div className="space-y-1">
                    <Label>% Avance Hoy</Label>
                    <Input type="number" value={currentLog?.advancePercentage ?? 0} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, advancePercentage: Number(e.target.value)} : null)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label>M2 Avance Partida</Label>
                    <Input type="number" value={currentLog?.advanceM2 ?? 0} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, advanceM2: Number(e.target.value)} : null)} className="rounded-xl" />
                  </div>
                </div>
              </LogSection>

              {/* Section 4: Actividades Realizadas */}
              <LogSection title="Actividades Realizadas" icon={<History />} isEditing={isEditing} onAdd={() => addItem('activities')}>
                <div className="overflow-x-auto">
                   <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Item</TableHead>
                        <TableHead>Descripción de Actividad</TableHead>
                        <TableHead className="w-[80px]">U/M</TableHead>
                        <TableHead className="w-[100px] text-right">Plan.</TableHead>
                        <TableHead className="w-[100px] text-right">Hoy</TableHead>
                        <TableHead className="w-[100px] text-right">Acum.</TableHead>
                        <TableHead>Estado</TableHead>
                        {isEditing && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLog?.activities.map((a, idx) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell>
                            <Input value={a.description || ''} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'description', e.target.value)} className="h-8 rounded-lg text-sm" />
                          </TableCell>
                          <TableCell>
                            <Input value={a.unit || ''} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'unit', e.target.value)} className="h-8 rounded-lg text-sm" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={a.planned ?? 0} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'planned', Number(e.target.value))} className="h-8 rounded-lg text-sm text-right" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={a.executedToday ?? 0} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'executedToday', Number(e.target.value))} className="h-8 rounded-lg text-sm text-right font-bold text-primary" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={a.accumulated ?? 0} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'accumulated', Number(e.target.value))} className="h-8 rounded-lg text-sm text-right" />
                          </TableCell>
                          <TableCell>
                             <select 
                               disabled={!isEditing}
                               value={a.status || 'en proceso'}
                               onChange={e => updateItem('activities', a.id, 'status', e.target.value)}
                               className="h-8 rounded-lg border-neutral-200 text-xs px-2 focus:ring-1 focus:ring-primary outline-none"
                              >
                               <option value="pendiente">Pendiente</option>
                               <option value="en proceso">En proceso</option>
                               <option value="listo">Listo</option>
                             </select>
                          </TableCell>
                          {isEditing && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 rounded-lg" onClick={() => removeItem('activities', a.id)}>
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </LogSection>

              {/* Section 6 & 7: Problemas y Plan Mañana */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <LogSection title="Problemas y Desviaciones" icon={<AlertCircle />} isEditing={isEditing} onAdd={() => addItem('problems')}>
                    <div className="space-y-4">
                       {currentLog?.problems.map(p => (
                         <Card key={p.id} className="rounded-2xl border-neutral-100 shadow-none bg-neutral-50/50">
                           <CardContent className="p-4 space-y-3">
                             <div className="flex justify-between items-center">
                               <Badge variant="outline">Item {p.number}</Badge>
                               {isEditing && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => removeItem('problems', p.id)}><Trash2 size={12} /></Button>}
                             </div>
                             <Input placeholder="Descripción del problema" value={p.description} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'description', e.target.value)} className="h-9 rounded-xl text-sm" />
                             <div className="grid grid-cols-2 gap-2">
                                <Input placeholder="Acción correctiva" value={p.correctiveAction} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'correctiveAction', e.target.value)} className="h-9 rounded-xl text-xs" />
                                <Input placeholder="Responsable" value={p.responsible} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'responsible', e.target.value)} className="h-9 rounded-xl text-xs" />
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                    </div>
                 </LogSection>

                 <LogSection title="Plan Trabajo Mañana" icon={<Calendar />} isEditing={isEditing} onAdd={() => addItem('nextDayPlan')}>
                    <div className="space-y-4">
                       {currentLog?.nextDayPlan.map(p => (
                         <div key={p.id} className="flex gap-2 items-center">
                            <span className="text-xs font-bold text-neutral-300">#{p.number}</span>
                            <Input placeholder="Actividad..." value={p.activity} disabled={!isEditing} onChange={e => updateItem('nextDayPlan', p.id, 'activity', e.target.value)} className="h-10 rounded-xl" />
                            {isEditing && <Button variant="ghost" size="icon" className="text-rose-500 shrink-0" onClick={() => removeItem('nextDayPlan', p.id)}><Trash2 size={14} /></Button>}
                         </div>
                       ))}
                    </div>
                 </LogSection>
              </div>
            </div>

            {/* Sidebar Sections */}
            <div className="space-y-10">
               {/* Section 2: Clima */}
               <LogSection title="Clima y Condiciones" icon={<CloudSun />} isEditing={isEditing}>
                 <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                       <div className="space-y-1 text-center">
                         <Label className="text-[10px] uppercase text-neutral-400">Mañana</Label>
                         <Input type="number" value={currentLog?.weather.morningTemp ?? 0} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, weather: {...l.weather, morningTemp: Number(e.target.value)}} : null)} className="h-10 rounded-xl text-center font-bold" />
                       </div>
                       <div className="space-y-1 text-center">
                         <Label className="text-[10px] uppercase text-neutral-400">Tarde</Label>
                         <Input type="number" value={currentLog?.weather.afternoonTemp ?? 0} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, weather: {...l.weather, afternoonTemp: Number(e.target.value)}} : null)} className="h-10 rounded-xl text-center font-bold" />
                       </div>
                       <div className="space-y-1 text-center">
                         <Label className="text-[10px] uppercase text-neutral-400">Viento</Label>
                         <Input type="number" value={currentLog?.weather.wind ?? 0} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, weather: {...l.weather, wind: Number(e.target.value)}} : null)} className="h-10 rounded-xl text-center" />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label>Lluvia / Precipitación</Label>
                       <Input value={currentLog?.weather.rain || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, weather: {...l.weather, rain: e.target.value}} : null)} className="rounded-xl" placeholder="Ninguna" />
                    </div>
                    <div className="flex items-center space-x-2 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                      <Checkbox 
                        id="affected" 
                        checked={currentLog?.weather.affectedWork ?? false} 
                        disabled={!isEditing}
                        onCheckedChange={v => setCurrentLog(l => l ? {...l, weather: {...l.weather, affectedWork: !!v}} : null)}
                      />
                      <label htmlFor="affected" className="text-sm font-medium leading-none cursor-pointer">
                        ¿Afectó las labores del día?
                      </label>
                    </div>
                 </div>
               </LogSection>

               {/* Section 3: Personal */}
               <LogSection title="Personal en Obra" icon={<Users />} isEditing={isEditing} onAdd={() => addItem('personnel')}>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                     {currentLog?.personnel.map(p => (
                       <Card key={p.id} className="rounded-2xl border-neutral-100 shadow-none hover:bg-neutral-50 transition-colors">
                         <CardContent className="p-4 space-y-3">
                           <div className="flex justify-between gap-2">
                              <Input placeholder="Nombre" value={p.name || ''} disabled={!isEditing} onChange={e => updateItem('personnel', p.id, 'name', e.target.value)} className="h-9 border-none bg-neutral-100/50 rounded-xl font-bold shadow-none" />
                              {isEditing && <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400" onClick={() => removeItem('personnel', p.id)}><Trash2 size={12} /></Button>}
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-neutral-400">Cargo</Label>
                                <Input value={p.role || ''} disabled={!isEditing} onChange={e => updateItem('personnel', p.id, 'role', e.target.value)} className="h-8 rounded-lg text-xs" />
                              </div>
                              <div className="flex gap-1">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-neutral-400">Entrada</Label>
                                  <Input value={p.arrivalTime || ''} disabled={!isEditing} onChange={e => updateItem('personnel', p.id, 'arrivalTime', e.target.value)} className="h-8 rounded-lg text-xs px-1" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-neutral-400">Salida</Label>
                                  <Input value={p.departureTime || ''} disabled={!isEditing} onChange={e => updateItem('personnel', p.id, 'departureTime', e.target.value)} className="h-8 rounded-lg text-xs px-1" />
                                </div>
                              </div>
                           </div>
                         </CardContent>
                       </Card>
                     ))}
                  </div>
               </LogSection>

               {/* Section 5: Seguridad (SSO) */}
               <LogSection title="Seguridad y SSO" icon={<HardHat />} isEditing={isEditing}>
                  <div className="space-y-4">
                     <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm">
                        <CheckItem label="Charla 5 min" checked={currentLog?.safety.morningTalk ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, morningTalk: v}} : null)} />
                        <CheckItem label="EPP Completo" checked={currentLog?.safety.eppUsage ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, eppUsage: v}} : null)} />
                        <CheckItem label="Revisión Asistencia" checked={currentLog?.safety.attendanceReview ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, attendanceReview: v}} : null)} />
                        <CheckItem label="Coord. Segura" checked={currentLog?.safety.taskCoordination ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, taskCoordination: v}} : null)} />
                        <CheckItem label="Orden y Limpieza" checked={currentLog?.safety.orderAndCleanliness ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, orderAndCleanliness: v}} : null)} />
                     </div>
                     <div className="space-y-2">
                        <Label>Incidentes del día</Label>
                        <Input value={currentLog?.safety.incidents || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, safety: {...l.safety, incidents: e.target.value}} : null)} className="rounded-xl" placeholder="Ninguno..." />
                     </div>
                     <div className="space-y-2">
                        <Label>Observación SSO</Label>
                        <Input value={currentLog?.safety.observations || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, safety: {...l.safety, observations: e.target.value}} : null)} className="rounded-xl" placeholder="..." />
                     </div>
                  </div>
               </LogSection>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogSection({ 
  title, 
  icon, 
  children, 
  isEditing, 
  onAdd 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  isEditing?: boolean;
  onAdd?: () => void;
}) {
  return (
    <Card className="rounded-[2rem] border-neutral-200/50 shadow-sm overflow-hidden bg-white">
      <CardHeader className="border-b border-neutral-50 px-8 py-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-xl text-neutral-900">
                {icon}
              </div>
              {title}
            </div>
            {title === "Información General" && (
              <img src="/logo.png" alt="Logo" className="h-10 object-contain opacity-50" onError={(e) => e.currentTarget.style.display = 'none'} />
            )}
          </CardTitle>
          {isEditing && onAdd && (
            <Button size="sm" variant="secondary" className="rounded-xl h-8 px-4" onClick={onAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Añadir
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-8 py-8">
        {children}
      </CardContent>
    </Card>
  );
}

function CheckItem({ label, checked, onChange, disabled }: { label: string; checked?: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <Checkbox checked={checked ?? false} disabled={disabled} onCheckedChange={v => onChange(!!v)} className="rounded-md" />
    </div>
  );
}
