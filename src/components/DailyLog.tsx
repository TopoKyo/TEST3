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
  TrendingUp,
  Camera,
  Image as ImageIcon,
  X,
  Upload,
  RefreshCw,
  Check,
  ChevronsUpDown,
  Briefcase,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  WorkLog, 
  User, 
  PersonnelEntry, 
  ActivityEntry, 
  ProblemEntry, 
  PlanEntry, 
  SafetyChecklist,
  SafetyTicket,
  EppInspection,
  EppAuditedPerson,
  AttendanceLog
} from '@/src/types';
import { compressImage } from '../lib/imageUtils';
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

const OperatorMultiSelect = ({ 
  selected, 
  onSelect, 
  users, 
  disabled 
}: { 
  selected: string[], 
  onSelect: (names: string[]) => void, 
  users: User[], 
  disabled: boolean 
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-8 w-full justify-between rounded-lg border-neutral-200 text-xs px-2 bg-white font-normal hover:bg-neutral-50"
          >
            <span className="truncate">
              {selected.length > 0 
                ? `${selected.length} seleccionados`
                : "Seleccionar..."}
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar operario..." className="h-8" />
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.name}
                  onSelect={() => {
                    const isSelected = selected.includes(user.name);
                    const newValue = isSelected
                      ? selected.filter((name) => name !== user.name)
                      : [...selected, user.name];
                    onSelect(newValue);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      selected.includes(user.name) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {user.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

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
    incidents: '',
    tickets: [],
    eppInspections: []
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
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null);
  const [activeSafetyTicketId, setActiveSafetyTicketId] = useState<string | null>(null);
  const [activeEppInspectionId, setActiveEppInspectionId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [viewMode, setViewMode] = useState<'daily' | 'history'>('daily');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const uniqueProjects = React.useMemo(() => {
    const projs = new Set<string>();
    logs.forEach(log => {
      if (log.project && log.project.trim() !== '') projs.add(log.project.trim());
    });
    return Array.from(projs).sort();
  }, [logs]);

  const uniqueClients = React.useMemo(() => {
    const clients = new Set<string>();
    logs.forEach(log => {
      if (log.client && log.client.trim() !== '') clients.add(log.client.trim());
    });
    return Array.from(clients).sort();
  }, [logs]);

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

  const capturePhoto = async () => {
    if (videoRef.current && (activeActivityId || activeProblemId || activeSafetyTicketId || activeEppInspectionId)) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      try {
        const compressed = await compressImage(dataUrl, 800, 0.6);
        if (activeActivityId) updateItem('activities', activeActivityId, 'image', compressed);
        else if (activeProblemId) updateItem('problems', activeProblemId, 'image', compressed);
        else if (activeSafetyTicketId) updateSafetyTicket(activeSafetyTicketId, 'image', compressed);
        else if (activeEppInspectionId) updateEppInspection(activeEppInspectionId, 'image', compressed);
      } catch (e) {
        if (activeActivityId) updateItem('activities', activeActivityId, 'image', dataUrl);
        else if (activeProblemId) updateItem('problems', activeProblemId, 'image', dataUrl);
        else if (activeSafetyTicketId) updateSafetyTicket(activeSafetyTicketId, 'image', dataUrl);
        else if (activeEppInspectionId) updateEppInspection(activeEppInspectionId, 'image', dataUrl);
      }
      
      setCameraOpen(false);
      setActiveActivityId(null);
      setActiveProblemId(null);
      setActiveSafetyTicketId(null);
      setActiveEppInspectionId(null);
    }
  };

  const addSafetyTicket = () => {
    if (!currentLog) return;
    const currentTickets = currentLog.safety?.tickets || [];
    const newTicket: SafetyTicket = {
      id: Math.random().toString(36).substr(2, 6),
      number: currentTickets.length + 1,
      type: 'hallazgo',
      title: '',
      description: '',
      severity: 'Media',
      responsible: '',
      status: 'Abierto',
      actionRequired: '',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        tickets: [...currentTickets, newTicket]
      }
    });
  };

  const updateSafetyTicket = (id: string, field: string, value: any) => {
    if (!currentLog) return;
    const currentTickets = currentLog.safety?.tickets || [];
    const updated = currentTickets.map(t => t.id === id ? { ...t, [field]: value } : t);
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        tickets: updated
      }
    });
  };

  const removeSafetyTicket = (id: string) => {
    if (!currentLog) return;
    const currentTickets = currentLog.safety?.tickets || [];
    const filtered = currentTickets.filter(t => t.id !== id);
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        tickets: filtered
      }
    });
  };

  const handleSafetyTicketImage = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64, 800, 0.6);
        updateSafetyTicket(id, 'image', compressed);
      } catch (e) {
        updateSafetyTicket(id, 'image', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // EPP Inspection / Fiscalización Helper Functions
  const addEppInspection = () => {
    if (!currentLog) return;
    const currentInspections = currentLog.safety?.eppInspections || [];
    const newInspection: EppInspection = {
      id: Math.random().toString(36).substr(2, 6),
      number: currentInspections.length + 1,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sector: 'Piso 1 / Área General',
      inspector: 'Prevencionista SSO',
      auditedPeople: [
        {
          id: Math.random().toString(36).substr(2, 5),
          name: '',
          company: '',
          status: 'cumple',
          details: 'Uso correcto de casco, chaleco, calzado y gafas'
        }
      ],
      summaryNote: '',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        eppInspections: [...currentInspections, newInspection]
      }
    });
  };

  const updateEppInspection = (id: string, field: string, value: any) => {
    if (!currentLog) return;
    const currentInspections = currentLog.safety?.eppInspections || [];
    const updated = currentInspections.map(insp => insp.id === id ? { ...insp, [field]: value } : insp);
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        eppInspections: updated
      }
    });
  };

  const removeEppInspection = (id: string) => {
    if (!currentLog) return;
    const currentInspections = currentLog.safety?.eppInspections || [];
    const filtered = currentInspections.filter(insp => insp.id !== id);
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        eppInspections: filtered
      }
    });
  };

  const addPersonToEppInspection = (inspectionId: string) => {
    if (!currentLog) return;
    const currentInspections = currentLog.safety?.eppInspections || [];
    const updated = currentInspections.map(insp => {
      if (insp.id === inspectionId) {
        return {
          ...insp,
          auditedPeople: [
            ...insp.auditedPeople,
            {
              id: Math.random().toString(36).substr(2, 5),
              name: '',
              company: '',
              status: 'cumple' as const,
              details: ''
            }
          ]
        };
      }
      return insp;
    });
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        eppInspections: updated
      }
    });
  };

  const updateAuditedPerson = (inspectionId: string, personId: string, field: string, value: any) => {
    if (!currentLog) return;
    const currentInspections = currentLog.safety?.eppInspections || [];
    const updated = currentInspections.map(insp => {
      if (insp.id === inspectionId) {
        const updatedPeople = insp.auditedPeople.map(p => p.id === personId ? { ...p, [field]: value } : p);
        return { ...insp, auditedPeople: updatedPeople };
      }
      return insp;
    });
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        eppInspections: updated
      }
    });
  };

  const removeAuditedPerson = (inspectionId: string, personId: string) => {
    if (!currentLog) return;
    const currentInspections = currentLog.safety?.eppInspections || [];
    const updated = currentInspections.map(insp => {
      if (insp.id === inspectionId) {
        return { ...insp, auditedPeople: insp.auditedPeople.filter(p => p.id !== personId) };
      }
      return insp;
    });
    setCurrentLog({
      ...currentLog,
      safety: {
        ...currentLog.safety,
        eppInspections: updated
      }
    });
  };

  const handleEppInspectionImage = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64, 800, 0.6);
        updateEppInspection(id, 'image', compressed);
      } catch (e) {
        updateEppInspection(id, 'image', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    const dailyLogs = logs.filter(l => l.date === currentDate);
    if (dailyLogs.length > 0) {
      if (!currentLog || currentLog.date !== currentDate || !dailyLogs.find(l => l.id === currentLog.id)) {
        setCurrentLog(dailyLogs[0]);
        setIsEditing(false);
      }
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
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const prevLog = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1] : null;

    const transferredActivities: ActivityEntry[] = [];
    if (prevLog && prevLog.nextDayPlan && prevLog.nextDayPlan.length > 0) {
      prevLog.nextDayPlan.forEach((plan, idx) => {
        transferredActivities.push({
          id: Math.random().toString(36).substr(2, 5),
          item: idx + 1,
          description: plan.activity,
          operator: plan.responsible,
          tower: plan.tower || '',
          side: plan.side || '-',
          status: 'en proceso',
          period: 'morning'
        });
      });
    }

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
      activities: transferredActivities,
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

  const handleCancel = () => {
    if (!currentLog) return;
    const existingLog = logs.find(l => l.id === currentLog.id);
    if (!existingLog) {
      const dailyLogs = logs.filter(l => l.date === currentDate);
      if (dailyLogs.length > 0) {
        setCurrentLog(dailyLogs[0]);
      } else {
        setCurrentLog(null);
      }
    } else {
      setCurrentLog(existingLog);
    }
    setIsEditing(false);
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

  const addItem = (section: 'activities' | 'personnel' | 'problems' | 'nextDayPlan', period?: 'morning' | 'afternoon') => {
    if (!currentLog) return;
    const items = [...currentLog[section]];
    
    if (section === 'activities') {
      const sectionActivities = (items as ActivityEntry[]).filter(a => a.period === period);
      (items as ActivityEntry[]).push({
        id: Math.random().toString(36).substr(2, 5),
        item: sectionActivities.length + 1,
        description: '',
        operators: [],
        tower: '',
        side: '-',
        status: 'en proceso',
        period: period || 'morning'
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
        responsible: '',
        tower: '',
        side: '-'
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
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64, 800, 0.6);
        updateItem('activities', id, 'image', compressed);
      } catch (e) {
        updateItem('activities', id, 'image', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProblemImage = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const compressed = await compressImage(base64, 800, 0.6);
        updateItem('problems', id, 'image', compressed);
      } catch (e) {
        updateItem('problems', id, 'image', base64);
      }
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
      const logoUrl = `${window.location.origin}/logo.png`;
      const logoData = await getBase64ImageFromURL(logoUrl);
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

    // Activities Morning
    const morningActivities = currentLog.activities.filter(a => a.period === 'morning' || !a.period);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [[{ content: 'ACTIVIDADES INICIO JORNADA', colSpan: 7, styles: { halign: 'center', fillColor: [40, 40, 40] } }], ['ÍTEM', 'ACTIVIDAD', 'OPERARIOS', 'TORRE', 'LADO', 'ESTADO', 'FOTO']],
      body: morningActivities.map(a => [a.item, a.description, a.operators?.join(', ') || a.operator || '-', a.tower || '-', a.side || '-', a.status.toUpperCase(), '']),
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
        if (data.section === 'body' && data.row.index < morningActivities.length) {
          const activity = morningActivities[data.row.index];
          if (activity && activity.image) {
            data.row.height = 25; 
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const activity = morningActivities[data.row.index];
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

    // Activities Afternoon
    const afternoonActivities = currentLog.activities.filter(a => a.period === 'afternoon');
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [[{ content: 'ACTIVIDADES TARDE', colSpan: 7, styles: { halign: 'center', fillColor: [40, 40, 40] } }], ['ÍTEM', 'ACTIVIDAD', 'OPERARIOS', 'TORRE', 'LADO', 'ESTADO', 'FOTO']],
      body: afternoonActivities.map(a => [a.item, a.description, a.operators?.join(', ') || a.operator || '-', a.tower || '-', a.side || '-', a.status.toUpperCase(), '']),
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
        if (data.section === 'body' && data.row.index < afternoonActivities.length) {
          const activity = afternoonActivities[data.row.index];
          if (activity && activity.image) {
            data.row.height = 25; 
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const activity = afternoonActivities[data.row.index];
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
      head: [['CHECKLIST SEGURIDAD Y SSO', 'ESTADO']],
      body: [
        ['Charla 5 min:', currentLog.safety.morningTalk ? 'SÍ' : 'NO'],
        ['EPP Completo:', currentLog.safety.eppUsage ? 'SÍ' : 'NO'],
        ['Revisión Asistencia:', currentLog.safety.attendanceReview ? 'SÍ' : 'NO'],
        ['Incidentes:', currentLog.safety.incidents || 'Ninguno'],
        ['Observaciones Grales:', currentLog.safety.observations || '-']
      ],
      theme: 'grid'
    });

    if (currentLog.safety.tickets && currentLog.safety.tickets.length > 0) {
      const ticketBody = currentLog.safety.tickets.map(t => [
        `#${t.number}`,
        (t.type || 'hallazgo').toUpperCase(),
        `${t.title ? t.title + ': ' : ''}${t.description || '-'}`,
        t.severity || 'Media',
        t.status || 'Abierto',
        t.responsible || '-',
        t.actionRequired || '-'
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        head: [
          [{ content: 'TICKETS Y REGISTROS DE SEGURIDAD (SSO)', colSpan: 7, styles: { halign: 'center', fillColor: [217, 119, 6] } }],
          ['N°', 'TIPO', 'ASUNTO / HALLAZGO', 'SEVERIDAD', 'ESTADO', 'RESPONSABLE', 'ACCIÓN CORRECTIVA']
        ],
        body: ticketBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' }
      });
    }

    if (currentLog.safety.eppInspections && currentLog.safety.eppInspections.length > 0) {
      const inspectionBody = currentLog.safety.eppInspections.map(insp => {
        const peopleListStr = (insp.auditedPeople || []).map(p => {
          const statusText = p.status === 'cumple' ? '🟢 CUMPLE EPP' : p.status === 'no_cumple' ? '🔴 NO CUMPLE' : '🟡 PARCIAL';
          const detailsStr = p.details ? ` (${p.details})` : '';
          return `• ${p.name || 'Trabajador'}${p.company ? ' [' + p.company + ']' : ''}: ${statusText}${detailsStr}`;
        }).join('\n');

        const headerStr = `#${insp.number}\nHora: ${insp.time || '-'}\nLugar: ${insp.sector || '-'}\nInsp: ${insp.inspector || '-'}`;
        const obsStr = insp.summaryNote || '-';

        return [headerStr, peopleListStr || 'Sin personas registradas', obsStr, ''];
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        head: [
          [{ content: 'FISCALIZACIÓN DE USO DE EPP EN TERRENO', colSpan: 4, styles: { halign: 'center', fillColor: [16, 185, 129] } }],
          ['FISCALIZACIÓN', 'PERSONAS FISCALIZADAS Y ESTADO DE EPP', 'OBSERVACIONES', 'FOTO EVIDENCIA']
        ],
        body: inspectionBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 75 },
          2: { cellWidth: 45 },
          3: { cellWidth: 35 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && currentLog.safety.eppInspections && data.row.index < currentLog.safety.eppInspections.length) {
            const insp = currentLog.safety.eppInspections[data.row.index];
            if (insp && insp.image) {
              data.row.height = 25; 
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            if (currentLog.safety.eppInspections && data.row.index < currentLog.safety.eppInspections.length) {
              const insp = currentLog.safety.eppInspections[data.row.index];
              if (insp && insp.image) {
                try {
                  const x = data.cell.x + 2;
                  const y = data.cell.y + 2;
                  const w = data.cell.width - 4;
                  const h = data.cell.height - 4;
                  doc.addImage(insp.image, 'JPEG', x, y, w, h);
                } catch (e) {
                  console.error('Error drawing image in PDF table for EPP inspection', e);
                }
              }
            }
          }
        }
      });
    }

    // Problems and Deviations
    const problemBody = currentLog.problems.length > 0 
      ? currentLog.problems.map(p => [p.date, p.description, p.impact, p.correctiveAction, ''])
      : [['-', 'Sin incidencias registradas', '-', '-', '']];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [
        [{ content: 'PROBLEMAS Y DESVIACIONES', colSpan: 5, styles: { halign: 'center', fillColor: [153, 27, 27] } }],
        ['FECHA', 'DESCRIPCIÓN DEL PROBLEMA', 'IMPACTO', 'ACCIÓN TOMADA', 'FOTO']
      ],
      body: problemBody,
      theme: 'grid',
      headStyles: { fillColor: [180, 180, 180], textColor: [20, 20, 20], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20 },
        3: { cellWidth: 40 },
        4: { cellWidth: 30 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index < currentLog.problems.length) {
          const problem = currentLog.problems[data.row.index];
          if (problem && problem.image) {
            data.row.height = 25; 
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const problem = currentLog.problems[data.row.index];
          if (problem && problem.image) {
            try {
              const x = data.cell.x + 2;
              const y = data.cell.y + 2;
              const w = data.cell.width - 4;
              const h = data.cell.height - 4;
              doc.addImage(problem.image, 'JPEG', x, y, w, h);
            } catch (e) {
              console.error('Error drawing image in PDF table', e);
            }
          }
        }
      }
    });
    
    doc.save(`Bitacora_${currentLog.date}.pdf`);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 gap-4">
      <RefreshCw className="h-10 w-10 text-primary animate-spin" />
      <p className="font-bold text-neutral-400">Cargando bitácoras...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900">Bitácora de Obra</h2>
          <p className="text-neutral-500 mt-1">Gestión de informes diarios, personal y trazabilidad de avance.</p>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-2xl w-fit">
          <Button 
            variant={viewMode === 'daily' ? 'default' : 'ghost'} 
            className="rounded-xl px-6" 
            onClick={() => setViewMode('daily')}
          >
            Diario
          </Button>
          <Button 
            variant={viewMode === 'history' ? 'default' : 'ghost'} 
            className="rounded-xl px-6" 
            onClick={() => setViewMode('history')}
          >
            Historial ({logs.length})
          </Button>
        </div>

        {viewMode === 'daily' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-neutral-100 w-fit">
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
            
            {(() => {
              const dailyLogs = logs.filter(l => l.date === currentDate);
              if (dailyLogs.length > 0) {
                return (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {dailyLogs.map((log) => (
                      <Button
                        key={log.id}
                        variant={currentLog?.id === log.id ? 'default' : 'outline'}
                        className="rounded-xl bg-white"
                        onClick={() => {
                          setCurrentLog(log);
                          setIsEditing(false);
                        }}
                      >
                        <Briefcase className="mr-2 h-4 w-4" />
                        {log.project || `Informe #${log.reportNumber}`}
                      </Button>
                    ))}
                    {!isEditing && (
                      <Button variant="outline" className="rounded-xl border-dashed bg-white" onClick={handleCreateNew}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo en esta fecha
                      </Button>
                    )}
                    {isEditing && !dailyLogs.find(l => l.id === currentLog?.id) && (
                       <Button variant="default" className="rounded-xl">
                         <Briefcase className="mr-2 h-4 w-4" />
                         Nuevo Reporte
                       </Button>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {viewMode === 'history' ? (
        <div className="space-y-12">
          {logs.length === 0 ? (
            <div className="py-24 text-center">
              <div className="p-6 bg-neutral-100 rounded-full w-fit mx-auto text-neutral-300 mb-4">
                <History size={48} />
              </div>
              <p className="text-neutral-500 font-medium">No se encontraron reportes previos.</p>
              <Button variant="link" onClick={() => setViewMode('daily')} className="mt-2 text-primary font-bold">
                Crear el primer reporte
              </Button>
            </div>
          ) : (
            (() => {
              const groupedLogs = logs.reduce((acc, log) => {
                const proj = log.project?.trim() || 'Sin proyecto asignado';
                if (!acc[proj]) acc[proj] = [];
                acc[proj].push(log);
                return acc;
              }, {} as Record<string, WorkLog[]>);

              return Object.entries(groupedLogs).sort().map(([project, projectLogs]: [string, WorkLog[]]) => (
                <div key={project} className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-neutral-100 pb-3">
                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
                      <Briefcase size={20} />
                    </div>
                    <h2 className="text-2xl font-black text-neutral-800 tracking-tight">{project}</h2>
                    <Badge variant="secondary" className="ml-2 font-mono text-xs rounded-lg bg-neutral-100">{projectLogs.length} reportes</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                      {projectLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ y: -5 }}
                          className="cursor-pointer"
                          onClick={() => {
                            setCurrentDate(log.date);
                            setViewMode('daily');
                          }}
                        >
                          <Card className="rounded-[2rem] border-none shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white h-full border-t-4 border-t-primary">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-start mb-4">
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1">
                                  Informe #{log.reportNumber}
                                </Badge>
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                  {format(parseISO(log.date), 'dd/MM/yyyy')}
                                </span>
                              </div>
                              <h3 className="text-xl font-bold text-neutral-900 mb-2 truncate">{log.project}</h3>
                              <p className="text-sm text-neutral-500 mb-6 line-clamp-1">{log.workAddress}</p>
                              
                              <div className="flex items-center justify-between py-3 border-t border-neutral-50">
                                <div className="flex items-center gap-2">
                                  <Users size={14} className="text-neutral-400" />
                                  <span className="text-xs font-bold text-neutral-600">{log.personnel.length} Pers.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <TrendingUp size={14} className="text-emerald-500" />
                                  <span className="text-xs font-bold text-emerald-600">{log.advancePercentage}% Avance</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      ) : (
        <>
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
                  <Button variant="ghost" className="rounded-xl" onClick={handleCancel}>Cancelar</Button>
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
                    <Input 
                      value={currentLog?.project || ''} 
                      disabled={!isEditing} 
                      onChange={e => setCurrentLog(l => l ? {...l, project: e.target.value} : null)} 
                      className="rounded-xl" 
                      list="project-list"
                    />
                    <datalist id="project-list">
                      {uniqueProjects.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Input 
                      value={currentLog?.client || ''} 
                      disabled={!isEditing} 
                      onChange={e => setCurrentLog(l => l ? {...l, client: e.target.value} : null)} 
                      className="rounded-xl" 
                      list="client-list"
                    />
                    <datalist id="client-list">
                      {uniqueClients.map(c => <option key={c} value={c} />)}
                    </datalist>
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

              {/* Section 4: Actividades Realizadas - Mañana */}
              <LogSection title="Actividad Realizada Inicio Jornada" icon={<History />} isEditing={isEditing} onAdd={() => addItem('activities', 'morning')}>
                <div className="overflow-x-auto">
                   <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Item</TableHead>
                        <TableHead>Descripción de Actividad</TableHead>
                        <TableHead className="w-[180px]">Operarios</TableHead>
                        <TableHead className="w-[100px]">Torre</TableHead>
                        <TableHead className="w-[80px]">Lado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[80px]">Foto</TableHead>
                        {isEditing && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLog?.activities.filter(a => a.period === 'morning' || !a.period).map((a, idx) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell>
                            <Input value={a.description || ''} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'description', e.target.value)} className="h-8 rounded-lg text-sm" />
                          </TableCell>
                          <TableCell>
                            <OperatorMultiSelect 
                              selected={a.operators || []}
                              users={users}
                              disabled={!isEditing}
                              onSelect={(newOps) => updateItem('activities', a.id, 'operators', newOps)}
                            />
                            {(!isEditing && (a.operators || []).length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(a.operators || []).map((op, i) => (
                                  <Badge key={i} variant="secondary" className="text-[9px] px-1 h-3.5">{op}</Badge>
                                ))}
                              </div>
                            )}
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

              {/* Section 5: Actividades Realizadas - Tarde */}
              <LogSection title="Actividad Realizada Tarde" icon={<History />} isEditing={isEditing} onAdd={() => addItem('activities', 'afternoon')}>
                <div className="overflow-x-auto">
                   <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Item</TableHead>
                        <TableHead>Descripción de Actividad</TableHead>
                        <TableHead className="w-[180px]">Operarios</TableHead>
                        <TableHead className="w-[100px]">Torre</TableHead>
                        <TableHead className="w-[80px]">Lado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[80px]">Foto</TableHead>
                        {isEditing && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLog?.activities.filter(a => a.period === 'afternoon').map((a, idx) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell>
                            <Input value={a.description || ''} disabled={!isEditing} onChange={e => updateItem('activities', a.id, 'description', e.target.value)} className="h-8 rounded-lg text-sm" />
                          </TableCell>
                          <TableCell>
                            <OperatorMultiSelect 
                              selected={a.operators || []}
                              users={users}
                              disabled={!isEditing}
                              onSelect={(newOps) => updateItem('activities', a.id, 'operators', newOps)}
                            />
                            {(!isEditing && (a.operators || []).length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(a.operators || []).map((op, i) => (
                                  <Badge key={i} variant="secondary" className="text-[9px] px-1 h-3.5">{op}</Badge>
                                ))}
                              </div>
                            )}
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
                             <div className="flex gap-2 items-center">
                               <Input placeholder="Responsable" value={p.responsible} disabled={!isEditing} onChange={e => updateItem('problems', p.id, 'responsible', e.target.value)} className="h-9 rounded-xl text-xs flex-1" />
                               {p.image ? (
                                <div className="relative h-9 w-9 shrink-0 rounded-xl overflow-hidden group/img">
                                  <img src={p.image} className="w-full h-full object-cover cursor-pointer" onClick={() => { if(!isEditing) { const w = window.open(); if(w) { w.document.write(`<img src="${p.image}" style="max-width:100%;"/>`); }}}} alt="" />
                                  {isEditing && (
                                    <Button size="icon" variant="destructive" className="absolute inset-0 w-full h-full opacity-0 group-hover/img:opacity-100 transition-opacity" onClick={() => updateItem('problems', p.id, 'image', undefined)}>
                                      <X size={14} />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                isEditing && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div className="relative group/upload">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleProblemImage(p.id, file);
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
                                        setActiveProblemId(p.id);
                                        setCameraOpen(true);
                                      }}
                                    >
                                      <Camera size={16} />
                                    </Button>
                                  </div>
                                )
                              )}
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                    </div>
                 </LogSection>

                 <LogSection title="Plan Trabajo Mañana" icon={<Calendar />} isEditing={isEditing} onAdd={() => addItem('nextDayPlan')}>
                    <div className="space-y-4">
                       {currentLog?.nextDayPlan.map(p => (
                         <div key={p.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-neutral-50/50 p-2 rounded-xl border border-neutral-100">
                            <span className="text-xs font-bold text-neutral-400 shrink-0 w-6">#{p.number}</span>
                            <Input placeholder="Actividad o frente de trabajo..." value={p.activity} disabled={!isEditing} onChange={e => updateItem('nextDayPlan', p.id, 'activity', e.target.value)} className="h-10 rounded-xl flex-1 bg-white" />
                            <Input placeholder="Torre" value={p.tower || ''} disabled={!isEditing} onChange={e => updateItem('nextDayPlan', p.id, 'tower', e.target.value)} className="h-10 rounded-xl w-24 shrink-0 bg-white" />
                            <select 
                              disabled={!isEditing}
                              value={p.side || '-'}
                              onChange={e => updateItem('nextDayPlan', p.id, 'side', e.target.value)}
                              className="h-10 w-24 shrink-0 rounded-xl border border-neutral-200 text-xs px-2 focus:ring-1 focus:ring-primary outline-none bg-white font-medium"
                             >
                              <option value="-">N/A</option>
                              <option value="A">Lado A</option>
                              <option value="B">Lado B</option>
                            </select>
                            {isEditing && <Button variant="ghost" size="icon" className="text-rose-500 shrink-0 h-10 w-10 hover:bg-rose-50 rounded-xl" onClick={() => removeItem('nextDayPlan', p.id)}><Trash2 size={16} /></Button>}
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
                  <div className="space-y-6">
                     <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm">
                        <Label className="font-bold text-xs text-neutral-500 uppercase tracking-wider mb-1">Checklist de Cumplimiento Diario</Label>
                        <CheckItem label="Charla 5 min" checked={currentLog?.safety.morningTalk ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, morningTalk: v}} : null)} />
                        <CheckItem label="EPP Completo" checked={currentLog?.safety.eppUsage ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, eppUsage: v}} : null)} />
                        <CheckItem label="Revisión Asistencia" checked={currentLog?.safety.attendanceReview ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, attendanceReview: v}} : null)} />
                        <CheckItem label="Coord. Segura" checked={currentLog?.safety.taskCoordination ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, taskCoordination: v}} : null)} />
                        <CheckItem label="Orden y Limpieza" checked={currentLog?.safety.orderAndCleanliness ?? false} disabled={!isEditing} onChange={v => setCurrentLog(l => l ? {...l, safety: {...l.safety, orderAndCleanliness: v}} : null)} />
                     </div>

                     <div className="space-y-3">
                        <div className="space-y-1">
                           <Label className="text-xs font-bold text-neutral-700">Resumen de Incidentes del día</Label>
                           <Input value={currentLog?.safety.incidents || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, safety: {...l.safety, incidents: e.target.value}} : null)} className="rounded-xl h-10" placeholder="Ej: Sin accidentes. 1 aviso preventivo en piso 3..." />
                        </div>
                        <div className="space-y-1">
                           <Label className="text-xs font-bold text-neutral-700">Observación General SSO</Label>
                           <Input value={currentLog?.safety.observations || ''} disabled={!isEditing} onChange={e => setCurrentLog(l => l ? {...l, safety: {...l.safety, observations: e.target.value}} : null)} className="rounded-xl h-10" placeholder="Ej: Buen nivel de compromiso con uso de EPP..." />
                        </div>
                     </div>

                     <Separator />

                     {/* Dynamic Safety Tickets Section */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                           <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                                 <AlertCircle className="text-amber-600 h-4 w-4" />
                                 Tickets y Registros SSO
                              </h4>
                              <Badge className="bg-amber-100 text-amber-900 border-none font-bold text-[10px]">
                                 {currentLog?.safety.tickets?.length || 0} tickets
                              </Badge>
                           </div>
                           {isEditing && (
                              <Button 
                                type="button"
                                size="sm" 
                                className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white h-8 gap-1 shadow-sm"
                                onClick={addSafetyTicket}
                              >
                                 <Plus size={14} /> Añadir Ticket SSO
                              </Button>
                           )}
                        </div>

                        {(!currentLog?.safety.tickets || currentLog.safety.tickets.length === 0) ? (
                           <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-center space-y-2">
                              <p className="text-xs text-amber-900 font-medium">
                                 No hay tickets SSO específicos ingresados.
                              </p>
                              {isEditing && (
                                 <Button 
                                   type="button" 
                                   variant="outline" 
                                   size="sm" 
                                   className="rounded-xl border-amber-300 text-amber-900 bg-white hover:bg-amber-100 text-xs font-bold"
                                   onClick={addSafetyTicket}
                                 >
                                    <Plus size={14} className="mr-1" /> Registrar Ticket / Hallazgo SSO
                                 </Button>
                              )}
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {currentLog.safety.tickets.map((t, idx) => (
                                 <Card key={t.id} className="rounded-2xl border-amber-200/80 shadow-sm bg-white overflow-hidden">
                                    <CardContent className="p-4 space-y-3">
                                       <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 -mx-4 -mt-4 p-3 border-b border-amber-100">
                                          <div className="flex items-center gap-2">
                                             <Badge className="bg-amber-600 text-white font-mono text-[10px] font-bold">
                                                Ticket #{t.number || idx + 1}
                                             </Badge>
                                             {t.createdAt && (
                                                <span className="text-[10px] text-amber-900 font-medium">{t.createdAt}</span>
                                             )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                             {isEditing ? (
                                                <select 
                                                  value={t.type || 'hallazgo'}
                                                  onChange={e => updateSafetyTicket(t.id, 'type', e.target.value)}
                                                  className="h-7 text-xs rounded-lg border border-amber-300 bg-white font-bold px-2 text-amber-950"
                                                >
                                                   <option value="hallazgo">Hallazgo</option>
                                                   <option value="observacion">Observación</option>
                                                   <option value="incidente">Incidente / Cuasi-Accidente</option>
                                                   <option value="condicion_insegura">Condición Insegura</option>
                                                   <option value="epp_faltante">EPP Faltante</option>
                                                   <option value="felicitacion">Felicitación SSO</option>
                                                </select>
                                             ) : (
                                                <Badge variant="outline" className="text-xs font-bold capitalize bg-white text-amber-900 border-amber-300">
                                                   {t.type?.replace('_', ' ') || 'hallazgo'}
                                                </Badge>
                                             )}

                                             {isEditing ? (
                                                <select 
                                                  value={t.severity || 'Media'}
                                                  onChange={e => updateSafetyTicket(t.id, 'severity', e.target.value)}
                                                  className="h-7 text-xs rounded-lg border border-neutral-300 bg-white font-bold px-2"
                                                >
                                                   <option value="Baja">Baja</option>
                                                   <option value="Media">Media</option>
                                                   <option value="Alta">Alta</option>
                                                   <option value="Crítica">Crítica</option>
                                                </select>
                                             ) : (
                                                <Badge className={cn(
                                                   "text-[10px] font-bold border-none",
                                                   t.severity === 'Crítica' ? "bg-rose-600 text-white" :
                                                   t.severity === 'Alta' ? "bg-orange-500 text-white" :
                                                   t.severity === 'Media' ? "bg-amber-500 text-white" :
                                                   "bg-emerald-600 text-white"
                                                )}>
                                                   Sev: {t.severity || 'Media'}
                                                </Badge>
                                             )}

                                             {isEditing && (
                                                <Button 
                                                  type="button"
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded-lg"
                                                  onClick={() => removeSafetyTicket(t.id)}
                                                >
                                                   <Trash2 size={14} />
                                                </Button>
                                             )}
                                          </div>
                                       </div>

                                       <div className="space-y-2">
                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Asunto / Título del Ticket</Label>
                                             <Input 
                                               placeholder="Ej: Falta de línea de vida en andamio torre A"
                                               value={t.title || ''}
                                               disabled={!isEditing}
                                               onChange={e => updateSafetyTicket(t.id, 'title', e.target.value)}
                                               className="h-9 rounded-xl font-semibold text-xs"
                                             />
                                          </div>
                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Detalle / Observación</Label>
                                             <Input 
                                               placeholder="Descripción detallada de la situación observada..."
                                               value={t.description || ''}
                                               disabled={!isEditing}
                                               onChange={e => updateSafetyTicket(t.id, 'description', e.target.value)}
                                               className="h-9 rounded-xl text-xs"
                                             />
                                          </div>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Estado del Ticket</Label>
                                             {isEditing ? (
                                                <select 
                                                  value={t.status || 'Abierto'}
                                                  onChange={e => updateSafetyTicket(t.id, 'status', e.target.value)}
                                                  className="w-full h-9 rounded-xl text-xs border border-neutral-200 px-2 bg-white font-bold"
                                                >
                                                   <option value="Abierto">🔴 Abierto (Pendiente)</option>
                                                   <option value="En Proceso">🟡 En Proceso de Solución</option>
                                                   <option value="Corregido">🟢 Corregido en Terreno</option>
                                                   <option value="Cerrado">⚪ Cerrado / Archivado</option>
                                                </select>
                                             ) : (
                                                <Badge variant="outline" className={cn(
                                                   "h-8 px-3 font-bold text-xs flex items-center justify-start border-none",
                                                   t.status === 'Corregido' || t.status === 'Cerrado' ? "bg-emerald-100 text-emerald-800" :
                                                   t.status === 'En Proceso' ? "bg-amber-100 text-amber-900" :
                                                   "bg-rose-100 text-rose-900"
                                                )}>
                                                   {t.status || 'Abierto'}
                                                </Badge>
                                             )}
                                          </div>

                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Responsable / Trabajador / Empresa</Label>
                                             <Input 
                                               placeholder="Ej: Contratista Estructuras / Juan Pérez"
                                               value={t.responsible || ''}
                                               disabled={!isEditing}
                                               onChange={e => updateSafetyTicket(t.id, 'responsible', e.target.value)}
                                               className="h-9 rounded-xl text-xs"
                                             />
                                          </div>
                                       </div>

                                       <div className="space-y-1">
                                          <Label className="text-[11px] font-bold text-neutral-600">Acción Correctiva Exigida / Implementada</Label>
                                          <Input 
                                            placeholder="Ej: Se detuvo el trabajo y se instaló línea de vida..."
                                            value={t.actionRequired || ''}
                                            disabled={!isEditing}
                                            onChange={e => updateSafetyTicket(t.id, 'actionRequired', e.target.value)}
                                            className="h-9 rounded-xl text-xs"
                                          />
                                       </div>

                                       {/* Evidence Image */}
                                       <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                                          <Label className="text-[11px] font-bold text-neutral-500">Foto de Evidencia SSO</Label>
                                          {t.image ? (
                                             <div className="relative h-12 w-12 rounded-xl overflow-hidden group/img border border-neutral-200">
                                                <img src={t.image} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(t.image, '_blank')} alt="" />
                                                {isEditing && (
                                                   <Button type="button" size="icon" variant="destructive" className="absolute inset-0 w-full h-full opacity-0 group-hover/img:opacity-100 transition-opacity" onClick={() => updateSafetyTicket(t.id, 'image', undefined)}>
                                                      <X size={14} />
                                                   </Button>
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
                                                           if (file) handleSafetyTicketImage(t.id, file);
                                                        }}
                                                      />
                                                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs text-neutral-600 bg-white border-neutral-200 gap-1">
                                                         <Upload size={13} /> Subir
                                                      </Button>
                                                   </div>
                                                   <Button 
                                                     type="button"
                                                     variant="outline" 
                                                     size="sm" 
                                                     className="h-8 rounded-xl text-xs text-neutral-600 bg-white border-neutral-200 gap-1"
                                                     onClick={() => {
                                                        setActiveSafetyTicketId(t.id);
                                                        setCameraOpen(true);
                                                     }}
                                                   >
                                                      <Camera size={13} /> Foto
                                                   </Button>
                                                </div>
                                             )
                                          )}
                                       </div>
                                    </CardContent>
                                 </Card>
                              ))}
                           </div>
                        )}
                     </div>

                     <Separator />

                     {/* Dynamic EPP Inspection / Fiscalización Section */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                           <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                                 <ShieldCheck className="text-emerald-600 h-4 w-4" />
                                 Fiscalización de Uso de EPP en Terreno
                              </h4>
                              <Badge className="bg-emerald-100 text-emerald-900 border-none font-bold text-[10px]">
                                 {currentLog?.safety.eppInspections?.length || 0} fiscalizaciones
                              </Badge>
                           </div>
                           {isEditing && (
                              <Button 
                                type="button"
                                size="sm" 
                                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-8 gap-1 shadow-sm"
                                onClick={addEppInspection}
                              >
                                 <Plus size={14} /> Nueva Fiscalización EPP
                              </Button>
                           )}
                        </div>

                        {(!currentLog?.safety.eppInspections || currentLog.safety.eppInspections.length === 0) ? (
                           <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 text-center space-y-2">
                              <p className="text-xs text-emerald-950 font-medium">
                                 No hay fiscalizaciones de EPP registradas para este día.
                              </p>
                              {isEditing && (
                                 <Button 
                                   type="button" 
                                   variant="outline" 
                                   size="sm" 
                                   className="rounded-xl border-emerald-300 text-emerald-900 bg-white hover:bg-emerald-100 text-xs font-bold"
                                   onClick={addEppInspection}
                                 >
                                    <Plus size={14} className="mr-1" /> Registrar Fiscalización de EPP en Terreno
                                 </Button>
                              )}
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {currentLog.safety.eppInspections.map((insp, idx) => (
                                 <Card key={insp.id} className="rounded-2xl border-emerald-200/80 shadow-sm bg-white overflow-hidden">
                                    <CardContent className="p-4 space-y-4">
                                       {/* Header of Inspection Card */}
                                       <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/80 -mx-4 -mt-4 p-3 border-b border-emerald-100">
                                          <div className="flex items-center gap-2">
                                             <Badge className="bg-emerald-700 text-white font-mono text-[10px] font-bold">
                                                Fiscalización #{insp.number || idx + 1}
                                             </Badge>
                                             {insp.createdAt && (
                                                <span className="text-[10px] text-emerald-900 font-medium">{insp.createdAt}</span>
                                             )}
                                          </div>
                                          {isEditing && (
                                             <Button 
                                               type="button"
                                               variant="ghost" 
                                               size="icon" 
                                               className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded-lg"
                                               onClick={() => removeEppInspection(insp.id)}
                                               title="Eliminar Fiscalización"
                                             >
                                                <Trash2 size={14} />
                                             </Button>
                                          )}
                                       </div>

                                       {/* Basic Info: Hora, Sector/Lugar, Fiscalizador/Inspector */}
                                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Hora</Label>
                                             <Input 
                                               placeholder="Ej: 10:30"
                                               value={insp.time || ''}
                                               disabled={!isEditing}
                                               onChange={e => updateEppInspection(insp.id, 'time', e.target.value)}
                                               className="h-8 rounded-xl text-xs font-semibold"
                                             />
                                          </div>
                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Sector / Área de Obra</Label>
                                             <Input 
                                               placeholder="Ej: Torre A - Piso 4"
                                               value={insp.sector || ''}
                                               disabled={!isEditing}
                                               onChange={e => updateEppInspection(insp.id, 'sector', e.target.value)}
                                               className="h-8 rounded-xl text-xs"
                                             />
                                          </div>
                                          <div className="space-y-1">
                                             <Label className="text-[11px] font-bold text-neutral-600">Fiscalizador SSO / Inspector</Label>
                                             <Input 
                                               placeholder="Ej: Prevencionista de Riesgos"
                                               value={insp.inspector || ''}
                                               disabled={!isEditing}
                                               onChange={e => updateEppInspection(insp.id, 'inspector', e.target.value)}
                                               className="h-8 rounded-xl text-xs"
                                             />
                                          </div>
                                       </div>

                                       {/* AUDITED PEOPLE TABLE / LIST */}
                                       <div className="space-y-2 pt-2 border-t border-neutral-100">
                                          <div className="flex items-center justify-between">
                                             <Label className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                                                <UserCheck size={14} className="text-emerald-600" />
                                                Personas Fiscalizadas ({insp.auditedPeople.length})
                                             </Label>
                                             {isEditing && (
                                                <Button 
                                                  type="button" 
                                                  variant="ghost" 
                                                  size="sm" 
                                                  className="h-7 text-xs font-bold text-emerald-800 hover:bg-emerald-50 rounded-lg gap-1"
                                                  onClick={() => addPersonToEppInspection(insp.id)}
                                                >
                                                   <Plus size={13} /> Añadir Persona
                                                </Button>
                                             )}
                                          </div>

                                          <div className="space-y-2">
                                             {insp.auditedPeople.map((p, pIdx) => (
                                                <div key={p.id || pIdx} className="p-3 bg-neutral-50/80 rounded-xl border border-neutral-200/80 space-y-2">
                                                   <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                                      {/* Name / Worker selection */}
                                                      <div className="sm:col-span-5 space-y-1">
                                                         <Label className="text-[10px] text-neutral-500 font-bold">Trabajador Fiscalizado</Label>
                                                         {isEditing ? (
                                                            <div className="space-y-1">
                                                               <select 
                                                                 className="w-full h-8 rounded-lg text-xs border border-neutral-200 bg-white font-medium px-2"
                                                                 value={p.name}
                                                                 onChange={e => {
                                                                    const val = e.target.value;
                                                                    updateAuditedPerson(insp.id, p.id, 'name', val);
                                                                 }}
                                                               >
                                                                  <option value="">-- Seleccionar trabajador --</option>
                                                                  {users.map(u => (
                                                                     <option key={u.id} value={u.name}>{u.name}</option>
                                                                  ))}
                                                               </select>
                                                               {!users.some(u => u.name === p.name) && (
                                                                  <Input 
                                                                    placeholder="Escribir nombre si no está en lista..."
                                                                    value={p.name}
                                                                    onChange={e => updateAuditedPerson(insp.id, p.id, 'name', e.target.value)}
                                                                    className="h-7 rounded-lg text-xs bg-white"
                                                                  />
                                                               )}
                                                            </div>
                                                         ) : (
                                                            <p className="text-xs font-bold text-neutral-900">{p.name || 'Sin nombre'}</p>
                                                         )}
                                                      </div>

                                                      {/* Empresa / Contratista */}
                                                      <div className="sm:col-span-3 space-y-1">
                                                         <Label className="text-[10px] text-neutral-500 font-bold">Empresa / Contratista</Label>
                                                         <Input 
                                                           placeholder="Ej: Subcontrato"
                                                           value={p.company || ''}
                                                           disabled={!isEditing}
                                                           onChange={e => updateAuditedPerson(insp.id, p.id, 'company', e.target.value)}
                                                           className="h-8 rounded-lg text-xs bg-white"
                                                         />
                                                      </div>

                                                      {/* EPP Compliance Status */}
                                                      <div className="sm:col-span-3 space-y-1">
                                                         <Label className="text-[10px] text-neutral-500 font-bold">¿Usa EPP?</Label>
                                                         {isEditing ? (
                                                            <select 
                                                              value={p.status || 'cumple'}
                                                              onChange={e => updateAuditedPerson(insp.id, p.id, 'status', e.target.value)}
                                                              className={cn(
                                                                 "w-full h-8 rounded-lg text-xs border font-bold px-2",
                                                                 p.status === 'cumple' ? "border-emerald-300 bg-emerald-50 text-emerald-900" :
                                                                 p.status === 'no_cumple' ? "border-rose-300 bg-rose-50 text-rose-900" :
                                                                 "border-amber-300 bg-amber-50 text-amber-900"
                                                              )}
                                                            >
                                                               <option value="cumple">🟢 Cumple (EPP Completo)</option>
                                                               <option value="no_cumple">🔴 No Cumple (Sin EPP)</option>
                                                               <option value="parcial">🟡 Parcial (EPP Incompleto)</option>
                                                            </select>
                                                         ) : (
                                                            <Badge className={cn(
                                                               "text-[10px] font-bold border-none h-7 flex items-center justify-center",
                                                               p.status === 'cumple' ? "bg-emerald-100 text-emerald-800" :
                                                               p.status === 'no_cumple' ? "bg-rose-100 text-rose-900" :
                                                               "bg-amber-100 text-amber-900"
                                                            )}>
                                                               {p.status === 'cumple' ? '🟢 EPP Completo' : p.status === 'no_cumple' ? '🔴 No usa EPP' : '🟡 EPP Parcial'}
                                                            </Badge>
                                                         )}
                                                      </div>

                                                      {/* Delete person */}
                                                      {isEditing && (
                                                         <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                                                            <Button 
                                                              type="button" 
                                                              variant="ghost" 
                                                              size="icon" 
                                                              className="h-7 w-7 text-rose-500 hover:bg-rose-100 rounded-lg"
                                                              onClick={() => removeAuditedPerson(insp.id, p.id)}
                                                              title="Quitar persona"
                                                            >
                                                               <Trash2 size={13} />
                                                            </Button>
                                                         </div>
                                                      )}
                                                   </div>

                                                   {/* Person specific observation / missing EPP note */}
                                                   <div className="space-y-1 pt-1">
                                                      <Input 
                                                        placeholder="Detalle o EPP faltante (ej: Uso correcto / Falta arnés de seguridad o barbiquejo)..."
                                                        value={p.details || ''}
                                                        disabled={!isEditing}
                                                        onChange={e => updateAuditedPerson(insp.id, p.id, 'details', e.target.value)}
                                                        className="h-7 rounded-lg text-[11px] bg-white border-neutral-200"
                                                      />
                                                   </div>
                                                </div>
                                             ))}
                                          </div>
                                       </div>

                                       {/* General Observations for this Fiscalización */}
                                       <div className="space-y-1">
                                          <Label className="text-[11px] font-bold text-neutral-600">Observaciones Generales de la Fiscalización</Label>
                                          <Input 
                                            placeholder="Ej: Se realizó llamado de atención y corrección en terreno..."
                                            value={insp.summaryNote || ''}
                                            disabled={!isEditing}
                                            onChange={e => updateEppInspection(insp.id, 'summaryNote', e.target.value)}
                                            className="h-8 rounded-xl text-xs"
                                          />
                                       </div>

                                       {/* Photo / Evidence Image for EPP Fiscalización */}
                                       <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                                          <Label className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
                                             <Camera size={13} className="text-emerald-600" />
                                             Foto de Evidencia de Fiscalización
                                          </Label>
                                          {insp.image ? (
                                             <div className="relative h-14 w-14 rounded-xl overflow-hidden group/img border border-emerald-300 shadow-sm">
                                                <img src={insp.image} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(insp.image, '_blank')} alt="Evidencia EPP" />
                                                {isEditing && (
                                                   <Button type="button" size="icon" variant="destructive" className="absolute inset-0 w-full h-full opacity-0 group-hover/img:opacity-100 transition-opacity" onClick={() => updateEppInspection(insp.id, 'image', undefined)}>
                                                      <X size={14} />
                                                   </Button>
                                                )}
                                             </div>
                                          ) : (
                                             isEditing && (
                                                <div className="flex items-center gap-1.5">
                                                   <div className="relative group/upload">
                                                      <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        onChange={(e) => {
                                                           const file = e.target.files?.[0];
                                                           if (file) handleEppInspectionImage(insp.id, file);
                                                        }}
                                                      />
                                                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs text-neutral-700 bg-white border-neutral-200 gap-1">
                                                         <Upload size={13} /> Subir
                                                      </Button>
                                                   </div>
                                                   <Button 
                                                     type="button"
                                                     variant="outline" 
                                                     size="sm" 
                                                     className="h-8 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 gap-1"
                                                     onClick={() => {
                                                        setActiveEppInspectionId(insp.id);
                                                        setCameraOpen(true);
                                                     }}
                                                   >
                                                      <Camera size={13} /> Sacar Foto
                                                   </Button>
                                                </div>
                                             )
                                          )}
                                       </div>
                                    </CardContent>
                                 </Card>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               </LogSection>
            </div>
          </div>
        </div>
      )}
    </>
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
