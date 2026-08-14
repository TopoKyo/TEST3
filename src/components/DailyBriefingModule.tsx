import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { firestoreService } from '../lib/firestoreService';
import { toast } from 'sonner';
import { 
  Users, 
  History, 
  CalendarDays, 
  Save,
  CheckSquare,
  ShieldAlert,
  ClipboardList,
  ArrowRight,
  Plus,
  Trash2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EPP_TOOLS_LIST = [
  "Casco de seguridad", "Lentes de seguridad", "Calzado de seguridad", "Calzados dieléctricos", 
  "Guantes de soldadura", "Guantes de maniobra", "Barbiquejo (para casco)", "Arnés integral", 
  "Protectores auditivos", "Máscara de esmerilar", "Máscara de soldar", "Guantes de soldar", 
  "Pechera de soldar", "Chaleco/ buzo reflectante", "Mascarilla antipolvo", "Mascarilla vapores orgánicos", 
  "Escaleras", "Andamios", "Polipasto", "Esm. angular o amoladora", "Sierra circular", 
  "Carretilla", "Máq. soldar eléctrica", "Máq. de oxicorte", "Pala / picota", "Martillo / comba", 
  "Puntas / cinceles", "Taladro", "Llaves / destornilladores", "Extensiones eléctricas", 
  "Alicates / tenazas", "Multitester", "Barandas", "Conos de señalización", "Señalización / letreros", 
  "Cintas de peligro /malla de seguridad", "Biombos", "Cubiertas temporales", "Líneas de vida", 
  "Luminarias / lámparas o reflectores", "Otros"
];

const SAFETY_CHECKLIST_TEMPLATE = [
  {
    title: "Andamios",
    items: [
      "Se realizó inspección de los andamios(tapas, pasadizos, elevadores) que estén completos",
      "El terreno donde se colocó el andamio está nivelado o se han colocado calzas",
      "Según su altura, están asegurados y arriostrados a una estructura estable y fija",
      "Las plataformas o tablones están debidamente aseguradas",
      "Provisto de barandilla de seguridad y rodapié?",
      "Las ruedas del andamio cuentan con freno de protección",
      "El andamio se encuentra aislado de líneas eléctricas"
    ]
  },
  {
    title: "Escaleras",
    items: [
      "Cuentan con bases o zapatas las escaleras antideslizantes",
      "Esta apoyada en el piso y asegurada/amarrada en la parte superior e inferior",
      "Cuenta con limitador de curso",
      "Retirada de posibles contactos eléctricos"
    ]
  },
  {
    title: "Estructura con línea de vida vertical en cable de acero",
    items: [
      "Línea de vida templada/tensada, asegurada",
      "Diámetro de cable conforme al freno móvil",
      "Línea de vida vertical (Ruta de ascenso) libre de obstáculos",
      "Línea de vida sin signos de oxidación o alambres deshilachados",
      "Peldaños firmes y asegurados",
      "Equipamiento contra caídas suficiente para ascenso",
      "Análisis previos de puntos de anclaje para ascenso",
      "Lejos de líneas energizadas"
    ]
  },
  {
    title: "Instrucciones de trabajo",
    items: [
      "El personal sabe como realizar los trabajos de manera segura",
      "Se recalca al personal que siempre debe estar enganchado a un punto de anclaje que resista 5000 Lbs",
      "El trabajador cuenta con los EPPs necesarios para la actividad",
      "Se realiza Charla de inducción para trabajos en altura (andamios o cuerdas)",
      "Se realiza charla de inducción de protección y uso de elementos de seguridad",
      "Se realiza inspección del lugar de trabajo en reconocimiento de elementos que puedan ocasionar accidentes",
      "Se verifica que el plan de rescate en altura es viable",
      "Se realiza inducción para trabajos logísticos (si corresponde)",
      "Se realiza el Análisis Seguro de Trabajo (AST)",
      "Se realiza instrucción oportuna de los trabajos a realizar",
      "Se cuenta con el equipo para rescate en altura física",
      "Se realiza inducción para trabajos de alto riesgo (caliente, eléctricos o confinados)"
    ]
  }
];

export interface BriefingAttendee {
  id: string;
  name: string;
  rut: string;
  role: string;
  workCondition: string;
  hasExperience: 'Si' | 'No' | '';
  signed: boolean;
}

export interface SafetyCheckItem {
  question: string;
  answer: 'SI' | 'NO' | 'N/A' | '';
}

export interface SafetyChecklistSection {
  title: string;
  items: SafetyCheckItem[];
}

export interface DailyBriefingRecord {
  id: string;
  workplace: string;
  city: string;
  company: string;
  date: string;
  startTime: string;
  endTime: string;
  workDescription: string;
  topics: string;
  attendees: BriefingAttendee[];
  eppAndTools: string[];
  safetyChecklists: SafetyChecklistSection[];
  supervisorName: string;
  supervisorRut: string;
  supervisorSigned?: boolean;
  prevencionistaName?: string;
  prevencionistaRut?: string;
  prevencionistaSigned?: boolean;
  createdAt: string;
}

export default function DailyBriefingModule({ users }: { users: User[] }) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [records, setRecords] = useState<DailyBriefingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [workplace, setWorkplace] = useState('');
  const [city, setCity] = useState('');
  const [company, setCompany] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [topics, setTopics] = useState('');
  
  const [attendees, setAttendees] = useState<BriefingAttendee[]>([]);
  const [eppAndTools, setEppAndTools] = useState<string[]>([]);
  const [safetyChecklists, setSafetyChecklists] = useState<SafetyChecklistSection[]>(
    SAFETY_CHECKLIST_TEMPLATE.map(section => ({
      title: section.title,
      items: section.items.map(q => ({ question: q, answer: '' as const }))
    }))
  );
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorRut, setSupervisorRut] = useState('');
  const [supervisorSigned, setSupervisorSigned] = useState(false);
  const [prevencionistaName, setPrevencionistaName] = useState('');
  const [prevencionistaRut, setPrevencionistaRut] = useState('');
  const [prevencionistaSigned, setPrevencionistaSigned] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const data = await firestoreService.getAll<DailyBriefingRecord>('daily_briefings');
      setRecords(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error fetching briefings:', error);
      toast.error('Error al cargar el historial de charlas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAttendee = () => {
    setAttendees([...attendees, { 
      id: crypto.randomUUID(), 
      name: '', 
      rut: '', 
      role: '', 
      workCondition: '', 
      hasExperience: '', 
      signed: false 
    }]);
  };

  const updateAttendee = (id: string, field: keyof BriefingAttendee, value: any) => {
    setAttendees(attendees.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeAttendee = (id: string) => {
    setAttendees(attendees.filter(a => a.id !== id));
  };

  const toggleEppTool = (item: string) => {
    setEppAndTools(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const updateChecklistAnswer = (sectionIndex: number, itemIndex: number, answer: 'SI' | 'NO' | 'N/A') => {
    const newChecklists = [...safetyChecklists];
    newChecklists[sectionIndex].items[itemIndex].answer = answer;
    setSafetyChecklists(newChecklists);
  };

  const resetForm = () => {
    setWorkplace(''); setCity(''); setCompany(''); setStartTime(''); setEndTime('');
    setWorkDescription(''); setTopics(''); setAttendees([]); setEppAndTools([]);
    setSupervisorName(''); setSupervisorRut(''); setSupervisorSigned(false);
    setPrevencionistaName(''); setPrevencionistaRut(''); setPrevencionistaSigned(false);
    setSafetyChecklists(SAFETY_CHECKLIST_TEMPLATE.map(section => ({
      title: section.title,
      items: section.items.map(q => ({ question: q, answer: '' as const }))
    })));
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async () => {
    if (!workplace || !date || !workDescription || attendees.length === 0) {
      toast.error('Por favor complete los campos obligatorios (Lugar, Fecha, Descripción y al menos 1 asistente).');
      return;
    }

    setIsSubmitting(true);

    const newRecord: DailyBriefingRecord = {
      id: crypto.randomUUID(),
      workplace, city, company, date, startTime, endTime, workDescription, topics,
      attendees, eppAndTools, safetyChecklists, 
      supervisorName, supervisorRut, supervisorSigned,
      prevencionistaName, prevencionistaRut, prevencionistaSigned,
      createdAt: new Date().toISOString()
    };

    try {
      const added = await firestoreService.add('daily_briefings', newRecord as DailyBriefingRecord & { id: string });
      setRecords([added, ...records]);
      resetForm();
      toast.success('Charla Diaria registrada exitosamente');
      setActiveTab('history');
    } catch (error) {
      console.error('Error saving briefing:', error);
      toast.error('Error al guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-neutral-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <ClipboardList className="text-indigo-600" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Registro de Charla Diaria</h1>
              <p className="text-neutral-500">TÍTULO VI, DECRETO Nº 40, LEY Nº 16.744</p>
            </div>
          </div>
          <div className="flex bg-white rounded-lg p-1 border border-neutral-200 shadow-sm">
            <button
              onClick={() => setActiveTab('new')}
              className={cn("px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2", activeTab === 'new' ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-500 hover:bg-neutral-100')}
            >
              <FileText size={16} /> Nuevo Registro
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn("px-4 py-2 text-sm font-semibold rounded-md transition-colors flex items-center gap-2", activeTab === 'history' ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-500 hover:bg-neutral-100')}
            >
              <History size={16} /> Historial
            </button>
          </div>
        </header>

        {activeTab === 'new' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
            {/* Header Data */}
            <Card>
              <CardHeader className="bg-neutral-100/50 border-b pb-4">
                <CardTitle className="text-lg">Información General</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Lugar de Trabajo</Label>
                  <Input value={workplace} onChange={e => setWorkplace(e.target.value)} placeholder="Ej: Edificio Bicentenario" />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: Viña del Mar" />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Ej: Vertical Soluciones" />
                </div>
                
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hora Inicio</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hora Final</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
                
                <div className="space-y-2 lg:col-span-4">
                  <Label>Descripción detallada del trabajo</Label>
                  <Textarea value={workDescription} onChange={e => setWorkDescription(e.target.value)} placeholder="Ej: Instalación de fierros para malla..." className="resize-none" />
                </div>
                <div className="space-y-2 lg:col-span-4">
                  <Label>Temas Tratados</Label>
                  <Input value={topics} onChange={e => setTopics(e.target.value)} placeholder="Ej: AST, PTS, EPP, Orden y Limpieza" />
                </div>
              </CardContent>
            </Card>

            {/* Attendees */}
            <Card>
              <CardHeader className="bg-neutral-100/50 border-b pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Asistentes a la Charla</CardTitle>
                  <CardDescription>Condición (ELC: Eléctrico, CAL: Caliente, ALT: Altura, PIS: Piso, AND: Andamios)</CardDescription>
                </div>
                <Button onClick={handleAddAttendee} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Plus size={16} className="mr-2" /> Agregar Asistente
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b">
                      <tr>
                        <th className="px-4 py-3">Nombres y Apellidos</th>
                        <th className="px-4 py-3">RUT</th>
                        <th className="px-4 py-3">Cargo</th>
                        <th className="px-4 py-3 w-32">Condición</th>
                        <th className="px-4 py-3 w-28">Exp. (Si/No)</th>
                        <th className="px-4 py-3 text-center">Firma</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((attendee) => (
                        <tr key={attendee.id} className="border-b">
                          <td className="p-2"><Input value={attendee.name} onChange={e => updateAttendee(attendee.id, 'name', e.target.value)} className="h-8 text-xs" /></td>
                          <td className="p-2"><Input value={attendee.rut} onChange={e => updateAttendee(attendee.id, 'rut', e.target.value)} className="h-8 text-xs" /></td>
                          <td className="p-2"><Input value={attendee.role} onChange={e => updateAttendee(attendee.id, 'role', e.target.value)} className="h-8 text-xs" /></td>
                          <td className="p-2"><Input value={attendee.workCondition} onChange={e => updateAttendee(attendee.id, 'workCondition', e.target.value)} className="h-8 text-xs uppercase" placeholder="ALT" /></td>
                          <td className="p-2">
                            <Select value={attendee.hasExperience} onValueChange={(v) => updateAttendee(attendee.id, 'hasExperience', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Si">Si</SelectItem>
                                <SelectItem value="No">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={attendee.signed} 
                              onChange={e => updateAttendee(attendee.id, 'signed', e.target.checked)}
                              className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <Button variant="ghost" size="icon" onClick={() => removeAttendee(attendee.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {attendees.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center p-6 text-neutral-400">No hay asistentes registrados. Haz clic en "Agregar Asistente".</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* EPP & Tools */}
            <Card>
              <CardHeader className="bg-neutral-100/50 border-b pb-4">
                <CardTitle className="text-lg">Equipos de Protección Personal y Herramientas</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {EPP_TOOLS_LIST.map((item, idx) => (
                    <label key={idx} className={cn("flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors text-xs hover:bg-neutral-50", eppAndTools.includes(item) ? "bg-indigo-50/50 border-indigo-200" : "border-neutral-200")}>
                      <input 
                        type="checkbox" 
                        checked={eppAndTools.includes(item)}
                        onChange={() => toggleEppTool(item)}
                        className="mt-0.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className={cn("leading-tight", eppAndTools.includes(item) ? "text-indigo-900 font-medium" : "text-neutral-700")}>{item}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Safety Checklist */}
            <Card>
              <CardHeader className="bg-neutral-100/50 border-b pb-4">
                <CardTitle className="text-lg">Inspección de Seguridad (SI / NO / N/A)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 p-0">
                <div className="divide-y divide-neutral-200">
                  {safetyChecklists.map((section, sIdx) => (
                    <div key={sIdx} className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-bold text-neutral-800">{section.title}</th>
                            <th className="px-2 py-2 text-center w-12 border-l border-neutral-200">SI</th>
                            <th className="px-2 py-2 text-center w-12 border-l border-neutral-200">NO</th>
                            <th className="px-2 py-2 text-center w-12 border-l border-neutral-200">N/A</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {section.items.map((item, iIdx) => (
                            <tr key={iIdx} className="hover:bg-neutral-50/50">
                              <td className="px-4 py-2 text-xs text-neutral-700">{item.question}</td>
                              <td className="px-2 py-2 text-center border-l border-neutral-100 cursor-pointer" onClick={() => updateChecklistAnswer(sIdx, iIdx, 'SI')}>
                                <div className={cn("w-full h-full flex items-center justify-center font-bold", item.answer === 'SI' ? "text-green-600" : "text-transparent")}>✓</div>
                              </td>
                              <td className="px-2 py-2 text-center border-l border-neutral-100 cursor-pointer" onClick={() => updateChecklistAnswer(sIdx, iIdx, 'NO')}>
                                <div className={cn("w-full h-full flex items-center justify-center font-bold", item.answer === 'NO' ? "text-red-600" : "text-transparent")}>✗</div>
                              </td>
                              <td className="px-2 py-2 text-center border-l border-neutral-100 cursor-pointer" onClick={() => updateChecklistAnswer(sIdx, iIdx, 'N/A')}>
                                <div className={cn("w-full h-full flex items-center justify-center font-bold", item.answer === 'N/A' ? "text-neutral-500" : "text-transparent")}>-</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Signatures */}
            <Card>
              <CardHeader className="bg-neutral-100/50 border-b pb-4">
                <CardTitle className="text-lg">Firmas de Responsables</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Supervisor */}
                <div className="space-y-4 border p-5 rounded-xl bg-white shadow-sm">
                  <h3 className="font-bold text-neutral-800 border-b pb-2">Supervisor</h3>
                  <div className="space-y-2">
                    <Label>Nombres y Apellidos</Label>
                    <Input value={supervisorName} onChange={e => setSupervisorName(e.target.value)} placeholder="Ej: Juan Pérez" />
                  </div>
                  <div className="space-y-2">
                    <Label>RUT</Label>
                    <Input value={supervisorRut} onChange={e => setSupervisorRut(e.target.value)} placeholder="Ej: 12.345.678-9" />
                  </div>
                  <label className="flex items-center gap-2 mt-4 cursor-pointer pt-2">
                    <input 
                      type="checkbox" 
                      checked={supervisorSigned} 
                      onChange={e => setSupervisorSigned(e.target.checked)} 
                      className="w-5 h-5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                    />
                    <span className="text-sm font-semibold text-neutral-700">Firma digital (Supervisor)</span>
                  </label>
                </div>

                {/* Prevencionista */}
                <div className="space-y-4 border p-5 rounded-xl bg-white shadow-sm">
                  <h3 className="font-bold text-neutral-800 border-b pb-2">Prevencionista de Riesgos</h3>
                  <div className="space-y-2">
                    <Label>Nombres y Apellidos</Label>
                    <Input value={prevencionistaName} onChange={e => setPrevencionistaName(e.target.value)} placeholder="Ej: María González" />
                  </div>
                  <div className="space-y-2">
                    <Label>RUT</Label>
                    <Input value={prevencionistaRut} onChange={e => setPrevencionistaRut(e.target.value)} placeholder="Ej: 9.876.543-2" />
                  </div>
                  <label className="flex items-center gap-2 mt-4 cursor-pointer pt-2">
                    <input 
                      type="checkbox" 
                      checked={prevencionistaSigned} 
                      onChange={e => setPrevencionistaSigned(e.target.checked)} 
                      className="w-5 h-5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                    />
                    <span className="text-sm font-semibold text-neutral-700">Firma digital (Prevencionista)</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-6 rounded-xl shadow-md text-lg">
                <Save className="mr-2 h-5 w-5" /> {isSubmitting ? 'Guardando...' : 'Guardar y Finalizar Registro'}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-600"></div>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed border-neutral-200 rounded-xl bg-white text-neutral-500">
                <ClipboardList size={48} className="mx-auto mb-4 text-neutral-300" />
                <p className="font-semibold text-lg text-neutral-700">Sin registros</p>
                <p className="text-sm mt-1">Aún no se han guardado actas de charlas diarias.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {records.map(record => (
                  <Card key={record.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-lg text-neutral-900">{record.workplace}</h3>
                          <p className="text-sm text-neutral-500">{record.company} - {record.city}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                          <CalendarDays size={14} />
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-neutral-500 uppercase">Trabajo / Tarea</p>
                          <p className="text-sm text-neutral-800 line-clamp-2">{record.workDescription}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                          <div>
                            <span className="text-neutral-500 block text-xs">Asistentes</span>
                            <span className="font-bold">{record.attendees.length} registrados</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-xs">Horario</span>
                            <span className="font-medium">{record.startTime || '-'} a {record.endTime || '-'}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-neutral-500 uppercase">Temas</p>
                          <p className="text-sm text-neutral-700">{record.topics}</p>
                        </div>
                        
                        <div className="pt-3 border-t flex flex-col gap-1 text-xs text-neutral-600">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-neutral-500">Supervisor:</span>
                            <span>{record.supervisorName || 'No especificado'} {record.supervisorSigned && <span className="text-indigo-600 font-bold ml-1">✓</span>}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-neutral-500">Prevencionista:</span>
                            <span>{record.prevencionistaName || 'No especificado'} {record.prevencionistaSigned && <span className="text-indigo-600 font-bold ml-1">✓</span>}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
