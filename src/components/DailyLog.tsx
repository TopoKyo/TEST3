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
  Pencil,
  FileBarChart,
  Camera,
  Image as ImageIcon,
  X,
  Upload,
  RefreshCw
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import ConsolidatedReportDialog from './ConsolidatedReportDialog';

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!cameraOpen) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  }, [cameraOpen]);

  const startCamera = async (mode: 'user' | 'environment') => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("No se pudo acceder a la cámara. Revisa los permisos.");
      setCameraOpen(false);
    }
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera(facingMode);
    }
  }, [cameraOpen, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = () => {
    if (videoRef.current && activeActivityId) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      updateItem('activities', activeActivityId, 'image', dataUrl);
      setCameraOpen(false);
    }
  };

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
        operator: '',
        tower: '',
        side: '-',
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
        date: currentLog.date,
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

  const handleActivityImage = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updateItem('activities', id, 'image', reader.result as string);
    };
    reader.readAsDataURL(file);
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
      // Adjusted size (40x20) and positioning (15, 12)
      doc.addImage(logoData, 'PNG', 15, 12, 40, 20);
    } catch (e) {
      console.warn('Logo could not be loaded for PDF', e);
    }

    // Header - Adjusted vertical alignment
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('BITÁCORA DIARIA DE OBRA', 110, 24, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Informe N°: ${currentLog.reportNumber} | Fecha: ${currentLog.date} (${currentLog.dayOfWeek})`, 110, 31, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 42, 195, 42);

    // General Info Table - Pushed down slightly (48)
    autoTable(doc, {
      startY: 48,
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
      head: [['ÍTEM', 'ACTIVIDAD', 'OPERARIO', 'TORRE', 'LADO', 'ESTADO', 'FOTO']],
      body: currentLog.activities.map(a => [a.item, a.description, a.operator || '-', a.tower || '-', a.side || '-', a.status.toUpperCase(), '']),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25 },
        3: { cellWidth: 15 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 30 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index < currentLog.activities.length) {
          const activity = currentLog.activities[data.row.index];
          if (activity && activity.image) {
            data.row.height = 25; 
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const activity = currentLog.activities[data.row.index];
          if (activity && activity.image) {
            try {
              const x = data.cell.x + 2;
              const y = data.cell.y + 2;
              const w = data.cell.width - 4;
              const h = data.cell.height - 4;
              doc.addImage(activity.image, 'JPEG', x, y, w, h);
            } catch (e) {
              console.error('Error drawing image in PDF table', e);
            }
          }
        }
      }
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

    // Problems and Deviations
    const problemBody = currentLog.problems.length > 0 
      ? currentLog.problems.map(p => [p.date, p.description, p.impact, p.correctiveAction])
      : [['-', 'Sin incidencias registradas', '-', '-']];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [
        [{ content: 'PROBLEMAS Y DESVIACIONES', colSpan: 4, styles: { halign: 'center', fillColor: [153, 27, 27] } }],
        ['FECHA', 'DESCRIPCIÓN DEL PROBLEMA', 'IMPACTO', 'ACCIÓN TOMADA']
      ],
      body: problemBody,
      theme: 'grid',
      headStyles: { fillColor: [180, 180, 180], textColor: [20, 20, 20], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25 },
        3: { cellWidth: 50 },
      }
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
              <ConsolidatedReportDialog workLogs={logs} trigger={
                <Button variant="outline" className="rounded-xl border-primary text-primary hover:bg-primary/5">
                  <FileBarChart className="mr-2 h-4 w-4" /> Informe Consolidado
                </Button>
              } />
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
                        <TableHead>Operario</TableHead>
                        <TableHead className="w-[100px]">Torre</TableHead>
                        <TableHead className="w-[80px]">Lado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[80px]">Foto</TableHead>
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
                            <select 
                               disabled={!isEditing}
                               value={a.operator || ''}
                               onChange={e => updateItem('activities', a.id, 'operator', e.target.value)}
                               className="h-8 w-full rounded-lg border-neutral-200 text-xs px-2 focus:ring-1 focus:ring-primary outline-none bg-white"
                              >
                               <option value="">Seleccionar...</option>
                               {users.map(u => (
                                 <option key={u.id} value={u.name}>{u.name}</option>
                               ))}
                             </select>
                          </TableCell>
                          <TableCell>
                            <Input value={a.tower || ''} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'tower', e.target.value)} className="h-8 rounded-lg text-sm" placeholder="Ej: A1" />
                          </TableCell>
                          <TableCell>
                            <select 
                               disabled={!isEditing}
                               value={a.side || '-'}
                               onChange={e => updateItem('activities', a.id, 'side', e.target.value)}
                               className="h-8 w-full rounded-lg border-neutral-200 text-xs px-2 focus:ring-1 focus:ring-primary outline-none bg-white"
                              >
                               <option value="-">-</option>
                               <option value="A">Lado A</option>
                               <option value="B">Lado B</option>
                             </select>
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
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {a.image ? (
                                <div className="relative group/img">
                                  <img 
                                    src={a.image} 
                                    alt="Activity" 
                                    className="h-10 w-10 rounded-xl object-cover cursor-pointer hover:opacity-80 border border-neutral-200 shadow-sm"
                                    onClick={() => window.open(a.image, '_blank')}
                                  />
                                  {isEditing && (
                                    <button 
                                      className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-sm"
                                      onClick={() => updateItem('activities', a.id, 'image', null)}
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                isEditing && (
                                  <div className="flex items-center gap-1">
                                    <div className="relative group/upload">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleActivityImage(a.id, file);
                                        }}
                                        title="Subir Archivo"
                                      />
                                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-neutral-400 bg-white border-neutral-100 hover:border-primary/30 hover:text-primary transition-all">
                                        <Upload size={16} />
                                      </Button>
                                    </div>
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      className="h-9 w-9 rounded-xl text-neutral-400 bg-white border-neutral-100 hover:border-primary/30 hover:text-primary transition-all"
                                      onClick={() => {
                                        setActiveActivityId(a.id);
                                        setCameraOpen(true);
                                      }}
                                      title="Tomar Foto"
                                    >
                                      <Camera size={16} />
                                    </Button>
                                  </div>
                                )
                              )}
                              {!isEditing && !a.image && <span className="text-xs text-neutral-300 italic">Sin foto</span>}
                            </div>
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
                               <div className="flex items-center gap-2">
                                 <Badge variant="outline">Item {p.number}</Badge>
                                 <Input 
                                   type="date" 
                                   value={p.date} 
                                   disabled={!isEditing} 
                                   onChange={e => updateItem('problems', p.id, 'date', e.target.value)} 
                                   className="h-7 w-32 rounded-lg text-[10px] py-0 px-2" 
                                 />
                               </div>
                               {isEditing && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => removeItem('problems', p.id)}><Trash2 size={12} /></Button>}
                             </div>
                             <Input placeholder="Descripción del problema" value={p.description} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'description', e.target.value)} className="h-9 rounded-xl text-sm" />
                             <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-neutral-400">Impacto</Label>
                                  <select 
                                    className="w-full h-9 rounded-xl text-xs border border-neutral-200 px-2 bg-white disabled:bg-neutral-50"
                                    value={p.impact}
                                    disabled={!isEditing}
                                    onChange={e => updateItem('problems', p.id, 'impact', e.target.value)}
                                  >
                                    <option value="Bajo">Bajo</option>
                                    <option value="Medio">Medio</option>
                                    <option value="Alto">Alto</option>
                                    <option value="Crítico">Crítico</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-neutral-400">Acción Tomada</Label>
                                  <Input placeholder="Acción correctiva" value={p.correctiveAction} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'correctiveAction', e.target.value)} className="h-9 rounded-xl text-xs" />
                                </div>
                             </div>
                             <Input placeholder="Responsable" value={p.responsible} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'responsible', e.target.value)} className="h-9 rounded-xl text-xs" />
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

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Camera className="text-primary" />
              Capturar Evidencia
            </DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden mx-4 rounded-2xl group">
            {stream ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className={cn(
                    "w-full h-full object-cover",
                    facingMode === 'user' && "-scale-x-100"
                  )}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-4 right-4 rounded-full bg-black/40 border-white/20 text-white hover:bg-black/60 backdrop-blur-md"
                  onClick={toggleCamera}
                  title="Cambiar Cámara"
                >
                  <RefreshCw size={18} className={cn("transition-transform duration-500", facingMode === 'user' && "rotate-180")} />
                </Button>
                <div className="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-2xl"></div>
              </>
            ) : (
              <div className="text-white flex flex-col items-center gap-4">
                <div className="p-4 bg-primary/20 rounded-full animate-pulse">
                  <RefreshCw size={32} className="animate-spin text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Iniciando cámara...</p>
                  <p className="text-xs text-neutral-500 mt-1">Usando cámara {facingMode === 'environment' ? 'trasera' : 'frontal'}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-3 p-6 mt-0">
            <Button 
              variant="ghost" 
              className="rounded-2xl flex-1 h-12 text-neutral-500 font-medium" 
              onClick={() => setCameraOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded-2xl flex-1 h-12 text-lg font-bold bg-neutral-900 shadow-xl shadow-neutral-200" 
              onClick={capturePhoto} 
              disabled={!stream}
            >
              Tomar Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
