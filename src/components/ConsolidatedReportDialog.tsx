import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileBarChart, 
  Calendar, 
  Download, 
  Loader2, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle,
  History,
  Settings,
  Target,
  FileText,
  Save,
  CheckCircle2,
  Check,
  X
} from 'lucide-react';
import { WorkLog, ProjectContext } from '@/src/types';
import { format, parseISO, isWithinInterval, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { geminiService, getApiKey, saveApiKey } from '@/src/lib/geminiService';
import { firestoreService } from '@/src/lib/firestoreService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ConsolidatedReportDialogProps {
  workLogs: WorkLog[];
  trigger?: React.ReactNode;
}

export default function ConsolidatedReportDialog({ workLogs, trigger }: ConsolidatedReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedProject, setSelectedProject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  
  const uniqueProjects = React.useMemo(() => {
    const projs = new Set<string>();
    workLogs.forEach(log => {
      if (log.project && log.project.trim() !== '') projs.add(log.project.trim());
    });
    return Array.from(projs).sort();
  }, [workLogs]);

  const [projectContext, setProjectContext] = useState<ProjectContext>({
    id: 'projectContext',
    name: 'Nombre del Proyecto',
    technicalSpecs: '',
    objectives: '',
    generalDescription: '',
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    const loadContext = async () => {
      const context = await firestoreService.getProjectContext();
      if (context) setProjectContext(context as ProjectContext);
    };
    loadContext();
  }, []);

  const handleSaveContext = async () => {
    setIsSavingContext(true);
    try {
      await firestoreService.saveProjectContext(projectContext);
      toast.success('Información del proyecto guardada');
      setActiveTab('generate');
    } catch (e) {
      toast.error('Error al guardar');
    } finally {
      setIsSavingContext(false);
    }
  };

  const presets = [
    { label: '7 días', value: 7 },
    { label: '15 días', value: 15 },
    { label: '30 días', value: 30 },
  ];

  const handlePreset = (days: number) => {
    setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const processData = (logs: WorkLog[]) => {
    if (logs.length === 0) return null;

    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Progress stats
    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];
    
    const totalAdvanceM2 = lastLog.advanceM2; // Assuming advanceM2 is cumulative across the project
    const advanceDuringPeriod = lastLog.advancePercentage - firstLog.advancePercentage;
    const daysCount = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    const avgDailyAdvance = logs.length > 0 ? advanceDuringPeriod / logs.length : 0;

    // Best/Worst days
    const dailyIncrements = sortedLogs.map((log, i) => {
      if (i === 0) return { date: log.date, inc: log.advancePercentage };
      return { date: log.date, inc: log.advancePercentage - sortedLogs[i-1].advancePercentage };
    });

    const bestDay = [...dailyIncrements].sort((a, b) => b.inc - a.inc)[0];
    const worstDay = [...dailyIncrements].sort((a, b) => a.inc - b.inc)[0];

    // Problem analysis
    const allProblems = logs.flatMap(l => l.problems);
    const problemsByImpact = {
      Bajo: allProblems.filter(p => p.impact === 'Bajo').length,
      Medio: allProblems.filter(p => p.impact === 'Medio').length,
      Alto: allProblems.filter(p => p.impact === 'Alto').length,
      Crítico: allProblems.filter(p => p.impact === 'Crítico').length,
    };

    const problemRecurrence: Record<string, number> = {};
    allProblems.forEach(p => {
      const key = p.description.toLowerCase().trim();
      problemRecurrence[key] = (problemRecurrence[key] || 0) + 1;
    });

    const recurrentProblems = Object.entries(problemRecurrence)
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3);

    return {
      period: { start: startDate, end: endDate, days: daysCount, logsCount: logs.length },
      progress: {
        totalPercentage: lastLog.advancePercentage,
        totalM2: totalAdvanceM2,
        periodIncrement: advanceDuringPeriod,
        avgDaily: avgDailyAdvance.toFixed(2),
        bestDay,
        worstDay,
        trend: avgDailyAdvance > 0.5 ? 'Ascendente' : 'Estable'
      },
      problems: {
        total: allProblems.length,
        byImpact: problemsByImpact,
        recurrent: recurrentProblems,
        mostIncidentsDay: sortedLogs.sort((a, b) => b.problems.length - a.problems.length)[0]
      },
      rawLogs: sortedLogs
    };
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const filteredLogs = workLogs.filter(log => {
        const dateOk = isWithinInterval(parseISO(log.date), {
          start: startOfDay(parseISO(startDate)),
          end: endOfDay(parseISO(endDate))
        });
        const projectOk = !selectedProject || selectedProject === 'all' || 
          log.project?.trim() === selectedProject;
        return dateOk && projectOk;
      });

      if (filteredLogs.length === 0) {
        toast.error('No se encontraron bitácoras en el rango seleccionado');
        setIsGenerating(false);
        return;
      }

      const stats = processData(filteredLogs);
      setReportData(stats);

      const aiSummary = await geminiService.generateProgressSummary(stats, projectContext);
      
      await exportToPDF(stats, aiSummary);
      toast.success('Informe consolidado generado con éxito');
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error generating report:', error);
      if (error && error.message === "API_KEY_REQUIRED") {
        setCustomApiKey(getApiKey() || '');
        setApiKeyModalOpen(true);
        toast.info("Por favor, configure su API Key de Gemini para generar el informe desde su dominio / Vercel.");
      } else {
        toast.error('Error al generar el informe: ' + (error instanceof Error ? error.message : String(error)));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = async (stats: any, aiSummary: string) => {
    const doc = new jsPDF();
    
    // Add Logo
    try {
      const logoUrl = `${window.location.origin}/logo.png`;
      const logoData = await getBase64ImageFromURL(logoUrl);
      doc.addImage(logoData, 'PNG', 15, 12, 40, 20);
    } catch (e) {
      console.warn('Logo could not be loaded for PDF', e);
    }

    // Title & Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME CONSOLIDADO DE AVANCE', 110, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${stats.period.start} al ${stats.period.end} (${stats.period.days} días)`, 110, 32, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 40, 195, 40);

    // Resumen Ejecutivo (AI)
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN EJECUTIVO', 15, 52);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const splitSummary = doc.splitTextToSize(aiSummary, 180);
    doc.text(splitSummary, 15, 60);

    let currentY = 60 + (splitSummary.length * 5) + 10;

    // Estadísticas Clave
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('ANÁLISIS DE AVANCE', 15, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Métrica', 'Valor']],
      body: [
        ['Avance Total Acumulado', `${stats.progress.totalPercentage}%`],
        ['Avance en m2 (Acumulado)', `${stats.progress.totalM2} m2`],
        ['Incremento en el período', `${stats.progress.periodIncrement.toFixed(2)}%`],
        ['Promedio de avance diario', `${stats.progress.avgDaily}% / día`],
        ['Tendencia declarada', stats.progress.trend],
        ['Día de mayor productividad', `${stats.progress.bestDay.date} (+${stats.progress.bestDay.inc.toFixed(1)}%)`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Problemas e Incidencias
    doc.setFontSize(14);
    doc.text('ANÁLISIS DE INCIDENCIAS', 15, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Impacto', 'Cantidad']],
      body: [
        ['Crítico', stats.problems.byImpact.Crítico],
        ['Alto', stats.problems.byImpact.Alto],
        ['Medio', stats.problems.byImpact.Medio],
        ['Bajo', stats.problems.byImpact.Bajo],
        ['TOTAL INCIDENCIAS', stats.problems.total],
      ],
      theme: 'grid',
      headStyles: { fillColor: [153, 27, 27] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Detalle por día
    doc.addPage();
    doc.setFontSize(14);
    doc.text('DESGLOSE DIARIO DE AVANCE', 15, 20);

    autoTable(doc, {
      startY: 25,
      head: [['FECHA', 'REPORTE #', 'PROYECTO', 'AVANCE %', 'M2', 'PROBLEMAS']],
      body: stats.rawLogs.map((l: WorkLog) => [
        l.date, 
        l.reportNumber,
        l.project,
        `${l.advancePercentage}%`,
        l.advanceM2,
        l.problems.length
      ]),
      theme: 'striped'
    });

    doc.save(`Consolidado_${stats.period.start}_${stats.period.end}.pdf`);
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
      img.onerror = reject;
      img.src = url;
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger
          nativeButton={true}
          render={
            trigger || (
              <button className="inline-flex items-center justify-center rounded-2xl gap-2 bg-neutral-900 text-white hover:bg-neutral-800 shadow-lg px-6 py-3 font-medium transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                <FileBarChart size={20} />
                <span>Generar Informe de Avance</span>
              </button>
            )
          }
        />
        <DialogContent className="rounded-[2.5rem] sm:max-w-[650px] p-0 overflow-hidden border-none shadow-2xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-neutral-50 px-8 pt-8 pb-4">
              <DialogHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-[1rem] shadow-sm">
                      {activeTab === 'generate' ? <Sparkles size={24} /> : <Settings size={24} />}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-black tracking-tight">
                        {activeTab === 'generate' ? 'Análisis de Avance' : 'Base de Conocimientos'}
                      </DialogTitle>
                      <p className="text-neutral-500 text-sm font-medium">
                        {activeTab === 'generate' 
                          ? 'Genera reportes inteligentes basados en tus bitácoras.' 
                          : 'Entrena a la IA con información técnica del proyecto.'}
                      </p>
                    </div>
                  </div>
                  <TabsList className="bg-neutral-200/50 rounded-xl p-1 h-11">
                    <TabsTrigger value="generate" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                      <FileBarChart size={16} className="mr-2" /> Reporte
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
                      <Target size={16} className="mr-2" /> Contexto
                    </TabsTrigger>
                  </TabsList>
                </div>
              </DialogHeader>
            </div>

            <div className="px-8 pb-8 pt-4">
              <TabsContent value="generate" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {presets.map(p => (
                      <Button 
                        key={p.value} 
                        variant="outline" 
                        size="sm" 
                        className="rounded-full text-[10px] font-black uppercase tracking-widest px-5 h-8 border-neutral-200 hover:bg-primary hover:text-white hover:border-primary transition-all"
                        onClick={() => handlePreset(p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Filtro de Proyecto</Label>
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger className="w-full rounded-xl h-12 border-neutral-100 bg-neutral-50/50 focus:bg-white transition-all font-medium">
                        <SelectValue placeholder="Todos los proyectos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los proyectos</SelectItem>
                        {uniqueProjects.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Fecha Inicio</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="rounded-xl h-12 border-neutral-100 bg-neutral-50/50 focus:bg-white transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Fecha Fin</Label>
                      <Input 
                         type="date" 
                         value={endDate} 
                         onChange={e => setEndDate(e.target.value)}
                         className="rounded-xl h-12 border-neutral-100 bg-neutral-50/50 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <Card className="rounded-[1.5rem] bg-neutral-50/50 border-none overflow-hidden ring-1 ring-neutral-100 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Contexto IA activo:</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                           <div className="flex items-center gap-2.5 text-xs text-neutral-600 font-medium">
                             <CheckCircle2 size={14} className="text-emerald-500" /> Avance Progresivo
                           </div>
                           <div className="flex items-center gap-2.5 text-xs text-neutral-600 font-medium">
                             <CheckCircle2 size={14} className="text-emerald-500" /> Mapa de Riesgos
                           </div>
                        </div>
                        <div className="space-y-3">
                           <div className="flex items-center gap-2.5 text-xs text-neutral-600 font-medium">
                             <CheckCircle2 size={14} className="text-emerald-500" /> Resumen Inteligente
                           </div>
                           <div className="flex items-center gap-2.5 text-xs text-neutral-600 font-medium">
                             <Badge variant="secondary" className="text-[9px] h-4 rounded-full bg-primary/10 text-primary border-none">
                               {projectContext.technicalSpecs ? 'CON CONTEXTO OBRA' : 'CONTEXTO BÁSICO'}
                             </Badge>
                           </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button 
                  disabled={isGenerating} 
                  onClick={generateReport} 
                  className="w-full h-16 rounded-2xl bg-neutral-900 text-lg font-black group relative overflow-hidden shadow-xl shadow-neutral-200 hover:scale-[1.01] transition-all"
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Analizando Proyecto...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <Download className="h-6 w-6 group-hover:-translate-y-1 transition-transform" />
                      <span>Generar Reporte Maestro</span>
                    </div>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="knowledge" className="mt-0 space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Nombre del Proyecto</Label>
                    <Input 
                      placeholder="Ej: Conjunto Habitacional Las Torres"
                      value={projectContext.name}
                      onChange={e => setProjectContext({...projectContext, name: e.target.value})}
                      className="rounded-xl h-12 border-neutral-100 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Especificaciones Técnicas / Materiales</Label>
                    <Textarea 
                      placeholder="Describe materiales clave, métodos constructivos o normativas que la IA debe conocer..."
                      className="rounded-xl min-h-[100px] border-neutral-100 bg-neutral-50/30 resize-none"
                      value={projectContext.technicalSpecs}
                      onChange={e => setProjectContext({...projectContext, technicalSpecs: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Objetivos del Período / Metas</Label>
                    <Textarea 
                      placeholder="¿Qué hitos se deben cumplir en estas fechas? (Ej: Terminar vaciado de losa 4)..."
                      className="rounded-xl min-h-[100px] border-neutral-100 bg-neutral-50/30 resize-none"
                      value={projectContext.objectives}
                      onChange={e => setProjectContext({...projectContext, objectives: e.target.value})}
                    />
                  </div>
                  
                  <p className="text-[10px] text-neutral-400 italic text-center">
                    Esta información "entrena" a la IA para que sus recomendaciones y análisis de avance sean realistas y orientados a resultados.
                  </p>
                </div>

                <Button 
                  onClick={handleSaveContext}
                  disabled={isSavingContext}
                  className="w-full h-14 rounded-2xl bg-neutral-100 text-neutral-900 border-neutral-200 hover:bg-neutral-200 font-bold"
                >
                  {isSavingContext ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                  Guardar Configuración del Proyecto
                </Button>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Fallback API Key Configuration Modal for Consolidated Reports */}
      {apiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-neutral-100 flex flex-col gap-4 text-neutral-900 duration-200"
          >
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest font-mono">
                  Configuración Externa (Vercel)
                </span>
                <h3 className="font-black text-neutral-900 text-sm mt-0.5">
                  Establecer API Key de Gemini
                </h3>
              </div>
              <button 
                onClick={() => setApiKeyModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-650 cursor-pointer p-1 rounded-full hover:bg-zinc-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              En dominios externos como <strong>Vercel</strong>, el servidor proxy de IA de Google AI Studio no está disponible.
              Para utilizar la generación de informes con IA Gemini, proporcione su propia API Key de Gemini. Se guardará de forma local segura en su navegador.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                Gemini API Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  saveApiKey(customApiKey);
                  setApiKeyModalOpen(false);
                  toast.success("API Key de Gemini guardada de forma local exitosamente.");
                  generateReport();
                }}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar y Generar Reporte
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
