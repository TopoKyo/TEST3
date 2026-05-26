import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  User as UserIcon, 
  Clipboard, 
  AlertTriangle, 
  Sparkles, 
  Download, 
  Plus, 
  Trash2, 
  Check, 
  CheckSquare, 
  Square,
  Search, 
  RefreshCw, 
  Save, 
  Clock, 
  ShieldAlert, 
  Share2, 
  Copy, 
  PlusCircle, 
  Filter, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  X,
  FileCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { firestoreService } from '@/src/lib/firestoreService';
import { geminiService, getApiKey, saveApiKey } from '@/src/lib/geminiService';
import { User, WorkLog, WeeklyReport, WeeklyReportTask, WeeklyReportIncident } from '@/src/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface WeeklyReportModuleProps {
  users: User[];
  workLogs: WorkLog[];
  onReportSaved?: () => void;
}

export default function WeeklyReportModule({ users, workLogs, onReportSaved }: WeeklyReportModuleProps) {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'nuevo' | 'historial'>('nuevo');

  // Metadatos / Inputs
  const [weekLabel, setWeekLabel] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [responsibleName, setResponsibleName] = useState<string>('');
  
  // Tasks Checklist
  const [loadedTasks, setLoadedTasks] = useState<WeeklyReportTask[]>([]);
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('todos');

  // Incidents List
  const [loadedIncidents, setLoadedIncidents] = useState<WeeklyReportIncident[]>([]);
  
  // Custom manual incident modal state
  const [showManualIncidentModal, setShowManualIncidentModal] = useState(false);
  const [newIncidentDesc, setNewIncidentDesc] = useState('');
  const [newIncidentDate, setNewIncidentDate] = useState('');
  const [newIncidentGravity, setNewIncidentGravity] = useState<'Baja' | 'Media' | 'Alta' | 'Crítica'>('Media');
  const [newIncidentResponsible, setNewIncidentResponsible] = useState('');
  const [newIncidentImpact, setNewIncidentImpact] = useState('');
  const [newIncidentCorrective, setNewIncidentCorrective] = useState('');

  // Zoom/Full-screen observations editor modal state
  const [activeObsTask, setActiveObsTask] = useState<WeeklyReportTask | null>(null);
  const [tempObservations, setTempObservations] = useState<string>('');

  const handleOpenObservationsModal = (task: WeeklyReportTask) => {
    setActiveObsTask(task);
    setTempObservations(task.observations || '');
  };

  const handleSaveObservations = () => {
    if (activeObsTask) {
      handleUpdateTaskField(activeObsTask.id, 'observations', tempObservations);
      setActiveObsTask(null);
      toast.success("Observaciones actualizadas.");
    }
  };

  // AI Gen States
  const [generatingWithAI, setGeneratingWithAI] = useState(false);
  const [generatedAIPayload, setGeneratedAIPayload] = useState<WeeklyReport['aiSummary'] | null>(null);

  // Custom API key modal state for browser fallback users
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');

  // General Report State
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // History State
  const [historicalReports, setHistoricalReports] = useState<WeeklyReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [selectedHistoricalReport, setSelectedHistoricalReport] = useState<WeeklyReport | null>(null);

  // Auto-fill dates based on current week
  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diffToMonday));
    const sunday = new Date(today.setDate(monday.getDate() + 6));
    
    const fmtDate = (d: Date) => d.toISOString().split('T')[0];
    setStartDate(fmtDate(monday));
    setEndDate(fmtDate(sunday));

    // Calculate Week label
    const weekNum = Math.ceil((monday.getDate() + 6 - monday.getDay()) / 7);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    setWeekLabel(`Semana ${weekNum} - ${months[monday.getMonth()]} ${monday.getFullYear()}`);
  }, []);

  // Fetch Historical Reports
  const fetchHistory = async (silently = false) => {
    if (!silently) setLoadingHistory(true);
    try {
      const reports = await firestoreService.getAll<WeeklyReport>('weekly_reports');
      // Sort newest first
      reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistoricalReports(reports);
    } catch (e) {
      console.error("Error loading reports history", e);
      toast.error("No se pudo cargar el historial de informes");
    } finally {
      if (!silently) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [activeTab]);

  // Load Tasks of the Week Automatically
  const handleLoadWeekActivities = () => {
    if (!startDate || !endDate) {
      toast.warning("Por favor ingrese un rango de fechas válido");
      return;
    }
    setLoadingTasks(true);

    try {
      // Filter worklogs by dates on workspace context
      let filteredLogs = workLogs.filter(log => {
        const dateOk = log.date >= startDate && log.date <= endDate;
        const projectOk = !selectedProject || log.project?.toLowerCase().includes(selectedProject.toLowerCase()) || log.client?.toLowerCase().includes(selectedProject.toLowerCase());
        return dateOk && projectOk;
      });

      // Simple fallback: if nothing matches with selectedProject filter but logs exist for the selected dates
      if (filteredLogs.length === 0 && selectedProject) {
        const justDatesLogs = workLogs.filter(log => log.date >= startDate && log.date <= endDate);
        if (justDatesLogs.length > 0) {
          toast.info("No se encontraron bitácoras para el proyecto especificado. Cargando todas las de la semana.");
          filteredLogs = justDatesLogs;
        }
      }

      if (filteredLogs.length === 0) {
        toast.info("No se encontraron bitácoras de obra para el rango especificado.");
      }

      // Pre-fill metadata from filtered worklogs
      if (filteredLogs.length > 0 && !selectedProject) {
        setSelectedProject(filteredLogs[0].project || '');
      }
      if (filteredLogs.length > 0 && !responsibleName) {
        setResponsibleName(filteredLogs[0].residentHead || '');
      }
      if (filteredLogs.length > 0 && !selectedArea) {
        setSelectedArea(filteredLogs[0].workAddress || '');
      }

      // Map Tasks
      const allTasksMapped: WeeklyReportTask[] = [];
      const allIncidentsMapped: WeeklyReportIncident[] = [];

      filteredLogs.forEach(log => {
        if (log.activities && Array.isArray(log.activities)) {
          log.activities.forEach(act => {
            allTasksMapped.push({
              id: `${log.id}-${act.id}`,
              name: act.description,
              date: log.date,
              responsible: act.operator || (act.operators && act.operators.length > 0 ? act.operators[0] : 'S/R'),
              status: act.status || 'pendiente',
              priority: 'Media',
              observations: '',
              photos: act.image ? [act.image] : [],
              selected: true,
              tower: act.tower,
              side: act.side
            });
          });
        }

        if (log.problems && Array.isArray(log.problems)) {
          log.problems.forEach(prob => {
            allIncidentsMapped.push({
              id: `${log.id}-${prob.id}`,
              description: prob.description,
              date: log.date || log.date,
              impact: prob.impact,
              correctiveAction: prob.correctiveAction,
              responsible: prob.responsible,
              gravity: prob.impact?.toLowerCase().includes('alto') || prob.impact?.toLowerCase().includes('crítico') ? 'Alta' : 'Media',
              selected: true,
              isManual: false
            });
          });
        }
      });

      // Avoid duplication
      setLoadedTasks(allTasksMapped);
      setLoadedIncidents(allIncidentsMapped);
      setGeneratedAIPayload(null); // reset AI state

      toast.success(`Cargadas ${allTasksMapped.length} tareas y ${allIncidentsMapped.length} incidencias.`);
    } catch (e) {
      console.error(e);
      toast.error("Ocurrió un error al procesar las bitácoras semanales");
    } finally {
      setLoadingTasks(false);
    }
  };

  // Helper selectors
  const toggleSelectAllTasks = () => {
    const visibleIds = filteredTasks.map(t => t.id);
    const allSelected = visibleIds.every(id => loadedTasks.find(t => t.id === id)?.selected);
    
    setLoadedTasks(prev => prev.map(t => {
      if (visibleIds.includes(t.id)) {
        return { ...t, selected: !allSelected };
      }
      return t;
    }));
  };

  const handleToggleTask = (id: string) => {
    setLoadedTasks(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const handleUpdateTaskField = (id: string, field: keyof WeeklyReportTask, value: any) => {
    setLoadedTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddTask = () => {
    const newTask: WeeklyReportTask = {
      id: `manual_${Date.now()}`,
      name: '',
      date: new Date().toISOString().split('T')[0],
      responsible: '',
      status: 'pendiente',
      priority: 'Media',
      observations: '',
      selected: true,
      photos: []
    };
    setLoadedTasks([newTask, ...loadedTasks]);
  };

  const handlePhotoUpload = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target && typeof ev.target.result === 'string') {
          const base64Str = ev.target.result;
          setLoadedTasks(prev => prev.map(t => 
            t.id === taskId ? { ...t, photos: [...(t.photos || []), base64Str] } : t
          ));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSelectIncident = (id: string) => {
    setLoadedIncidents(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const handleRemoveIncident = (id: string) => {
    setLoadedIncidents(prev => prev.filter(i => i.id !== id));
    toast.info("Incidencia removida del informe");
  };

  // Manual Incidents add trigger
  const handleAddManualIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentDesc) {
      toast.error("Suministre la descripción de la incidencia");
      return;
    }

    const manualItem: WeeklyReportIncident = {
      id: `manual-${Date.now()}`,
      description: newIncidentDesc,
      date: newIncidentDate || new Date().toISOString().split('T')[0],
      gravity: newIncidentGravity,
      responsible: newIncidentResponsible || 'Operario general',
      impact: newIncidentImpact,
      correctiveAction: newIncidentCorrective,
      selected: true,
      isManual: true
    };

    setLoadedIncidents(prev => [...prev, manualItem]);
    setNewIncidentDesc('');
    setNewIncidentDate('');
    setNewIncidentGravity('Media');
    setNewIncidentResponsible('');
    setNewIncidentImpact('');
    setNewIncidentCorrective('');
    setShowManualIncidentModal(false);
    toast.success("Incidencia agregada manualmente exitosamente.");
  };

  // AI request trigger
  const handleGenerateAIReport = async () => {
    const selectedTasks = loadedTasks.filter(t => t.selected !== false);
    const selectedIncidents = loadedIncidents.filter(i => i.selected !== false);

    if (selectedTasks.length === 0) {
      toast.warning("Debe seleccionar al menos una tarea hecha para que la IA realice el análisis.");
      return;
    }

    setGeneratingWithAI(true);
    try {
      const payloadMetadata = {
        weekLabel,
        startDate,
        endDate,
        area: selectedArea,
        project: selectedProject,
        responsibleName
      };

      const payloadTasks = selectedTasks.map(t => ({
        name: t.name,
        responsible: t.responsible,
        status: t.status,
        priority: t.priority,
        observations: t.observations
      }));

      const payloadIncidents = selectedIncidents.map(i => ({
        description: i.description,
        gravity: i.gravity,
        impact: i.impact,
        correctiveAction: i.correctiveAction,
        responsible: i.responsible,
        date: i.date
      }));

      const parsedJSON = await geminiService.generateWeeklyReport(payloadMetadata, payloadTasks, payloadIncidents);
      
      setGeneratedAIPayload(parsedJSON);
      toast.success("Resumen Inteligente generado con éxito por Gemini 3.5-Flash.");
    } catch (error: any) {
      console.error(error);
      if (error && error.message === "API_KEY_REQUIRED") {
        setCustomApiKey(getApiKey() || '');
        setApiKeyModalOpen(true);
        toast.info("Por favor, configure su API Key de Gemini para generar el informe desde su dominio / Vercel.");
      } else {
        toast.error(error instanceof Error ? error.message : "Error al conectar con la generación de informe de IA.");
      }
    } finally {
      setGeneratingWithAI(false);
    }
  };

  // Filter Tasks criteria list
  const filteredTasks = loadedTasks.filter(task => {
    const taskName = task.name || '';
    const taskResp = task.responsible || '';
    const matchesSearch = taskName.toLowerCase().includes(taskSearch.toLowerCase()) || 
                          taskResp.toLowerCase().includes(taskSearch.toLowerCase());
    const matchesStatus = taskStatusFilter === 'todos' || task.status === taskStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Visual KPIs
  const tasksSelectedOnly = loadedTasks.filter(t => t.selected !== false);
  const totalTasksCount = loadedTasks.length;
  const selectedTasksCount = tasksSelectedOnly.length;
  const completedTasksCount = tasksSelectedOnly.filter(t => t.status === 'listo').length;
  const totalIncidentsCount = loadedIncidents.filter(i => i.selected !== false).length;

  const compliancePercentage = selectedTasksCount > 0 
    ? Math.round((completedTasksCount / selectedTasksCount) * 100) 
    : 0;

  // Smart productivity weighted logic
  const calculateProductivityIndex = () => {
    if (selectedTasksCount === 0) return 0;
    // Standard compliance
    let base = (completedTasksCount / selectedTasksCount) * 100;
    
    // Penalize for incidents gravity
    loadedIncidents.filter(i => i.selected).forEach(inc => {
      if (inc.gravity === 'Crítica') base -= 15;
      else if (inc.gravity === 'Alta') base -= 8;
      else if (inc.gravity === 'Media') base -= 4;
      else base -= 1;
    });

    return Math.max(0, Math.min(100, Math.round(base)));
  };

  const productivityScore = calculateProductivityIndex();
  const finalStatus = generatedAIPayload?.suggestedStatus || (productivityScore >= 85 ? 'Excelente' : productivityScore >= 70 ? 'Bueno' : productivityScore >= 50 ? 'Regular' : 'Crítico');

  // Save report to Firestore DB
  const handleSaveReportToDatabase = async () => {
    if (!weekLabel || !startDate || !endDate || !selectedProject || !responsibleName) {
      toast.error("Complete los de metadatos básicos del informe (Semana, Proyecto, Rango, Responsable)");
      return;
    }

    setSubmittingReport(true);
    try {
      const finalStatus = generatedAIPayload?.suggestedStatus || (productivityScore >= 85 ? 'Excelente' : productivityScore >= 70 ? 'Bueno' : productivityScore >= 50 ? 'Regular' : 'Crítico');
      
      const newReport: WeeklyReport = {
        id: `weekly-rep-${Date.now()}`,
        weekLabel,
        startDate,
        endDate,
        area: selectedArea || 'General',
        project: selectedProject,
        responsibleName,
        createdAt: new Date().toISOString(),
        createdBy: users[0]?.id || 'admin',
        status: finalStatus as any,
        aiSummary: generatedAIPayload ? {
          executiveSummary: generatedAIPayload.executiveSummary,
          generalProgressAnalysis: generatedAIPayload.generalProgressAnalysis,
          progressPercentage: generatedAIPayload.progressPercentage || compliancePercentage,
          recommendations: generatedAIPayload.recommendations,
          suggestedStatus: finalStatus as any
        } : undefined,
        tasks: loadedTasks,
        incidents: loadedIncidents,
        productivityScore
      };

      await firestoreService.add<WeeklyReport>('weekly_reports', newReport);
      toast.success("Informe Semanal Inteligente guardado con éxito en la base de datos.");
      
      // Pull history again
      fetchHistory(true);
      if (onReportSaved) onReportSaved();
      
      // Select report for viewing & change tab
      setSelectedHistoricalReport(newReport);
      setActiveTab('historial');
    } catch (e) {
      console.error(e);
      toast.error("Ocurrió un error al persistir el informe semanal");
    } finally {
      setSubmittingReport(false);
    }
  };

  const exportToPDF = (report: WeeklyReport) => {
    try {
      const doc = new jsPDF();
      
      // Professional design standards (high-contrast, sleek branding)
      doc.setFillColor(79, 70, 229); // Indigo 600 corporativo
      doc.rect(0, 0, 210, 15, 'F');

      // Title header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("INFORME SEMANAL INTELIGENTE - RESUMEN EJECUTIVO", 15, 10);

      // Meta grid box
      doc.setFillColor(243, 244, 246); // gray-100
      doc.rect(15, 22, 180, 48, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81); // gray-700
      doc.setFont("helvetica", "bold");
      doc.text("Información de Control", 20, 28);
      
      doc.setFont("helvetica", "normal");
      doc.text(`Semana de reporte: ${report.weekLabel}`, 20, 36);
      doc.text(`Rango de fechas: ${report.startDate} al ${report.endDate}`, 20, 42);
      doc.text(`Proyecto o Planta: ${report.project}`, 20, 48);
      doc.text(`Sector o Área: ${report.area}`, 20, 54);
      doc.text(`Supervisor / Responsable: ${report.responsibleName}`, 20, 60);
      doc.text(`Fecha Impresión: ${new Date().toLocaleDateString()}`, 20, 66);

      // Status indicator box
      doc.setFillColor(224, 242, 254); // Light blue
      doc.rect(130, 26, 60, 40, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(2, 132, 199);
      doc.text("Estado General", 135, 34);
      
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(report.status, 135, 48);

      // Section: Executive Summary (AI Gen Content)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text("1. Resumen Ejecutivo (Análisis de Desempeño)", 15, 80);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(31, 41, 55);
      const summaryText = report.aiSummary?.executiveSummary || "No se ha generado un resumen ejecutivo automático de IA para este periodo.";
      const splitSummary = doc.splitTextToSize(summaryText, 180);
      doc.text(splitSummary, 15, 87);

      let currentY = 87 + (splitSummary.length * 5) + 6;

      // Section: general analysis
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text("2. Avance General de Fase", 15, currentY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(31, 41, 55);
      const progressText = report.aiSummary?.generalProgressAnalysis || `El equipo completó con éxito las metas planificadas del sector, con un total de ${report.tasks.filter(t=>t.selected).length} actividades atendidas.`;
      const splitProgress = doc.splitTextToSize(progressText, 180);
      doc.text(splitProgress, 15, currentY + 7);

      currentY = currentY + 7 + (splitProgress.length * 5) + 8;

      // Section: Tareas y Evidencias
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text("3. Registro Detallado de Tareas y Evidencias", 15, currentY);
      currentY += 8;

      const selectedTasks = (report.tasks || []).filter(t => t.selected !== false);
      for (const t of selectedTasks) {
        if (currentY > 220) {
          doc.addPage();
          currentY = 20;
        }

        // Draw boundary line
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(15, currentY, 195, currentY);
        currentY += 5;

        // Task name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text(`TAREA: ${t.name}`, 15, currentY);
        currentY += 5;

        // Details row
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(75, 85, 99);
        doc.text(`Fecha: ${t.date || 'S/F'}  |  Estado: ${t.status}  |  Responsable: ${t.responsible}  |  Prioridad: ${t.priority}  |  Torre: ${t.tower || 'N/A'}  |  Lado: ${t.side || 'N/A'}`, 15, currentY);
        currentY += 5;

        if (t.observations) {
          doc.setFont("helvetica", "italic");
          doc.text(`Observaciones: ${t.observations}`, 15, currentY);
          currentY += 5;
        }

        // Associated photos
        const photos = t.photos || [];
        if (photos.length > 0) {
          currentY += 1;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(79, 70, 229);
          doc.text("📸 Evidencia Fotográfica:", 15, currentY);
          currentY += 4;

          let xOffset = 15;
          const imgWidth = 42;
          const imgHeight = 30;

          for (const photo of photos) {
            if (xOffset + imgWidth > 195) {
              xOffset = 15;
              currentY += imgHeight + 4;
            }
            if (currentY + imgHeight > 270) {
              doc.addPage();
              currentY = 20;
              xOffset = 15;
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(79, 70, 229);
              doc.text("Evidencia Fotográfica (continuación):", 15, currentY);
              currentY += 4;
            }

            try {
              doc.setDrawColor(229, 231, 235);
              doc.rect(xOffset - 0.5, currentY - 0.5, imgWidth + 1, imgHeight + 1, 'D');
              doc.addImage(photo, 'JPEG', xOffset, currentY, imgWidth, imgHeight);
            } catch (e) {
              console.error("Error drawing photo in task card:", e);
            }
            xOffset += imgWidth + 5;
          }
          currentY += imgHeight + 5;
        } else {
          currentY += 3;
        }
      }

      // Check height for Incidents
      let newY = currentY + 5;
      if (newY > 230) {
        doc.addPage();
        newY = 20;
      }

      // Incidents Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text("4. Detalle de Incidencias Operativas", 15, newY);

      const incidentData = report.incidents.filter(i => i.selected).map(i => [
        i.description,
        i.date,
        i.gravity.toUpperCase(),
        i.responsible || 'General',
        i.correctiveAction || '-'
      ]);

      if (incidentData.length > 0) {
        autoTable(doc, {
          startY: newY + 5,
          head: [['Incidencia / Riesgo', 'Fecha', 'Gravedad', 'Persona / Área', 'Mitigación']],
          body: incidentData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255] }
        });
        newY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("No se reportaron incidentes notables ni paros de obra en el periodo actual.", 15, newY + 8);
        newY = newY + 18;
      }

      if (newY > 230) {
        doc.addPage();
        newY = 20;
      }

      // Signature Area
      const sigY = newY + 20;
      doc.setDrawColor(156, 163, 175);
      doc.line(70, sigY + 10, 140, sigY + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text("Sello y Firma del Responsable Técnico de Planta", 105, sigY + 15, { align: "center" });

      doc.save(`Informe_Semanal_${report.project}_${report.weekLabel}.pdf`);
      toast.success("PDF descargado correctamente.");
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al compilar el PDF");
    }
  };

  const exportToExcel = (report: WeeklyReport) => {
    try {
      const wb = XLSX.utils.book_new();

      // General Data sheet
      const summaryRows = [
        ["INFORME SEMANAL INTELIGENTE", ""],
        ["Proyecto / Obra:", report.project],
        ["Cargo / Área:", report.area],
        ["Rango Semanal:", `${report.startDate} a ${report.endDate}`],
        ["Creado por:", report.responsibleName],
        ["Estado Final:", report.status],
        ["Fecha de Generación:", new Date(report.createdAt).toLocaleDateString()],
        ["", ""],
        ["RESUMEN EJECUTIVO IA:", report.aiSummary?.executiveSummary || "S/N"]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "SINOPSIS GENERAL");

      // Tasks Sheet
      const taskHeaders = [["ID Actividad", "Descripción de Tarea", "Fecha", "Estipulado Responsable", "Estado", "Prioridad", "Observaciones"]];
      const taskBody = (report.tasks || []).filter(t => t.selected !== false).map(t => [
        t.id, t.name, t.date, t.responsible, t.status, t.priority, t.observations || ""
      ]);
      const wsTasks = XLSX.utils.aoa_to_sheet([...taskHeaders, ...taskBody]);
      XLSX.utils.book_append_sheet(wb, wsTasks, "TAREAS");

      // Incidents Sheet
      const incidentHeaders = [["Descripción", "Fecha", "Nivel de Gravedad", "Sujeto / Rol", "Acción de Mitigación", "Impacto Estimado"]];
      const incidentBody = (report.incidents || []).filter(i => i.selected !== false).map(i => [
        i.description, i.date, i.gravity, i.responsible || "General", i.correctiveAction || "-", i.impact || "-"
      ]);
      const wsIncidents = XLSX.utils.aoa_to_sheet([...incidentHeaders, ...incidentBody]);
      XLSX.utils.book_append_sheet(wb, wsIncidents, "INCIDENCIAS");

      XLSX.writeFile(wb, `Informe_Semanal_${report.project}_${report.weekLabel}.xlsx`);
      toast.success("Excel exportado perfectamente.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo estructurar el libro de Excel");
    }
  };

  const exportToWord = (report: WeeklyReport) => {
    try {
      const content = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <title>Informe Semanal - ${report.project}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #1e293b; background: #ffffff; }
            h1 { color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; font-size: 26px; }
            h2 { color: #1e3a8a; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-top: 35px; font-size: 20px; }
            .header-info { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px; margin-bottom: 25px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge-excelente { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
            .badge-bueno { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
            .badge-regular { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            .badge-critico { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .task-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 15px; background: #f8fafc; }
            .task-title { margin: 0 0 6px 0; color: #1e293b; font-size: 14px; font-weight: bold; }
            .meta-text { font-size: 12px; color: #64748b; margin: 4px 0; }
            .image-gallery { margin-top: 8px; }
            .task-img { max-width: 150px; height: auto; max-height: 120px; border-radius: 6px; border: 1px solid #e2e8f0; margin-right: 8px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f1f5f9; text-align: left; padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 12px; }
            td { padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; }
            .recs { padding-left: 20px; font-size: 12px; }
            .rec-item { margin-bottom: 10px; }
            .footer-notes { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; }
            .sig-area { width: 300px; border-top: 1px solid #cbd5e1; margin: 40px auto 10px auto; text-align: center; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>INFORME SEMANAL DE CONTROL INDUSTRIAL & PLANTA</h1>
          
          <div class="header-info">
            <h3 style="margin-top: 0; color: #334155;">Información General</h3>
            <p><b>Semana Reportada:</b> ${report.weekLabel}</p>
            <p><b>Rango:</b> ${report.startDate} a ${report.endDate}</p>
            <p><b>Proyecto / Obra / Planta:</b> ${report.project}</p>
            <p><b>Unidad / Sector:</b> ${report.area}</p>
            <p><b>Supervisor a Cargo:</b> ${report.responsibleName}</p>
            <p><b>Fecha de Generación:</b> ${new Date(report.createdAt).toLocaleDateString()}</p>
            <p><b>Estado de Desempeño:</b> <span class="badge badge-${report.status.toLowerCase()}">${report.status}</span></p>
          </div>

          <h2>1. Resumen Ejecutivo de la Fase</h2>
          <p style="line-height: 1.6; font-size: 12px;">${report.aiSummary?.executiveSummary || 'No integrado o no compilado con IA.'}</p>

          <h2>2. Nivel de Cumplimiento Técnico</h2>
          <p style="line-height: 1.6; font-size: 12px;">${report.aiSummary?.generalProgressAnalysis || 'El equipo ha manifestado su ritmo de trabajo operacional estándar sin desviaciones graves.'}</p>

          <h2>3. Registro de Tareas Semanales y Evidencia de Campo</h2>
          <div>
            ${(report.tasks || []).filter(t => t.selected !== false).map(t => `
              <div class="task-card">
                <p class="task-title">TAREA: ${t.name}</p>
                <p class="meta-text">
                  <b>Fecha:</b> ${t.date || 'S/F'} &nbsp;|&nbsp;
                  <b>Estado:</b> ${t.status} &nbsp;|&nbsp;
                  <b>Torre:</b> ${t.tower || 'N/A'} &nbsp;|&nbsp;
                  <b>Lado:</b> ${t.side || 'N/A'} &nbsp;|&nbsp;
                  <b>Responsable:</b> ${t.responsible} &nbsp;|&nbsp;
                  <b>Prioridad:</b> ${t.priority}
                </p>
                ${t.observations ? `<p class="meta-text" style="font-style: italic;"><b>Observaciones:</b> ${t.observations}</p>` : ''}
                ${t.photos && t.photos.length > 0 ? `
                  <div class="image-gallery">
                    ${t.photos.map(p => `<img src="${p}" class="task-img" />`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <h2>4. Resumen de Desvíos e Incidencias del Periodo</h2>
          ${(report.incidents || []).filter(i => i.selected !== false).length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Incidencia Sucidida</th>
                  <th>Fecha Ocurrida</th>
                  <th>Gravedad</th>
                  <th>Responsable Reporte</th>
                  <th>Acciones Correctivas Tomadas</th>
                </tr>
              </thead>
              <tbody>
                ${(report.incidents || []).filter(i => i.selected !== false).map(i => `
                  <tr>
                    <td>${i.description}</td>
                    <td>${i.date}</td>
                    <td style="color:red; font-weight:bold;">${i.gravity.toUpperCase()}</td>
                    <td>${i.responsible || 'Operario de turno'}</td>
                    <td>${i.correctiveAction || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="font-size: 12px; font-style: italic;">Sin desviaciones ni incidencias de planta dignas de mención.</p>'}

          <h2>5. Recomendaciones de Planificación y Seguridad (IA)</h2>
          <ol class="recs">
            ${report.aiSummary?.recommendations?.map(r => `<li class="rec-item">${r}</li>`).join('') || `
              <li class="rec-item">Continuar con las inducciones diarias de 5 minutos al iniciar los trabajos.</li>
              <li class="rec-item">Monitorear horas pico para evitar fatiga en mano de obra clave.</li>
            `}
          </ol>

          <footer class="footer-notes">
            <div class="sig-area">
              Firma y Cédula del Ing. / Supervisor
            </div>
            <p>Control Interno Corporativo • Documento Autogenerado</p>
          </footer>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_Semanal_${report.project.replace(/\s+/g, '_')}_${report.weekLabel.replace(/\s+/g, '_')}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento Word exportado satisfactoriamente.");
    } catch (e) {
      console.error(e);
      toast.error("Ocurrió un error al preparar el Word");
    }
  };

  // Clone/Duplicate Report Setup
  const handleDuplicateReport = (report: WeeklyReport) => {
    setWeekLabel(`${report.weekLabel} (Copia)`);
    setStartDate(report.startDate);
    setEndDate(report.endDate);
    setSelectedArea(report.area);
    setSelectedProject(report.project);
    setResponsibleName(report.responsibleName);
    setLoadedTasks((report.tasks || []).map(t => ({ ...t, selected: t.selected !== false })));
    setLoadedIncidents((report.incidents || []).map(i => ({ ...i, selected: i.selected !== false })));
    setGeneratedAIPayload(report.aiSummary);

    setActiveTab('nuevo');
    toast.success("Se han cargado todos los datos del informe en el formulario para duplicarse/editar.");
  };

  // Copy report view variables
  const handleShareClipboard = (report: WeeklyReport) => {
    const textToCopy = `
📋 *INFORME SEMANAL INTELIGENTE*
👷‍♂️ *Supervisor:* ${report.responsibleName}
🏢 *Proyecto / Planta:* ${report.project} (${report.area})
📅 *Periodo:* ${report.startDate} al ${report.endDate}
📈 *Estatus Final:* ${report.status}

🤖 *RESPUESTA DE IA (RESUMEN):*
"${report.aiSummary?.executiveSummary || 'N/A'}"

🛠️ *Tareas Clave:* ${report.tasks.filter(t=>t.selected).length} registradas.
⚠️ *Incidentes:* ${report.incidents.filter(i=>i.selected).length} reportados.
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    toast.success("Detalles del informe copiados al portapapeles. ¡Listo para compartir por WhatsApp o Slack!");
  };

  // Delete previously saved report
  const handleDeleteReport = async (reportId: string) => {
    if(!window.confirm("¿Está seguro de querer eliminar este informe de la base de datos de manera irreversible?")) {
      return;
    }
    try {
      await firestoreService.delete('weekly_reports', reportId);
      toast.success("Informe semanal removido de la base de datos.");
      if (selectedHistoricalReport?.id === reportId) {
        setSelectedHistoricalReport(null);
      }
      fetchHistory(true);
    } catch (e) {
      console.error(e);
      toast.error("Falla al suprimir el recurso");
    }
  };

  // Charts mapping
  const getTasksChartData = () => {
    const listCount = loadedTasks.filter(t => t.selected !== false && t.status === 'listo').length;
    const processCount = loadedTasks.filter(t => t.selected !== false && t.status === 'en proceso').length;
    const pendingCount = loadedTasks.filter(t => t.selected !== false && t.status === 'pendiente').length;

    return [
      { name: 'Listo', cantidad: listCount, fill: '#10b981' },
      { name: 'En Proceso', cantidad: processCount, fill: '#6366f1' },
      { name: 'Pendiente', cantidad: pendingCount, fill: '#f59e0b' }
    ];
  };

  const getIncidentsChartData = () => {
    const selectedList = loadedIncidents.filter(i => i.selected !== false);
    const crits = selectedList.filter(i => i.gravity === 'Crítica').length;
    const highs = selectedList.filter(i => i.gravity === 'Alta').length;
    const meds = selectedList.filter(i => i.gravity === 'Media').length;
    const lows = selectedList.filter(i => i.gravity === 'Baja').length;

    return [
      { name: 'Crítica', cantidad: crits },
      { name: 'Alta', cantidad: highs },
      { name: 'Media', cantidad: meds },
      { name: 'Baja', cantidad: lows }
    ].filter(item => item.cantidad > 0);
  };

  // Incident gravity colors tag
  const getGravityBadgeColor = (gravity: string) => {
    switch (gravity) {
      case 'Crítica': return 'bg-red-100 text-red-800 border-red-300';
      case 'Alta': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Media': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 bg-zinc-50 min-h-screen text-zinc-900">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
            <FileCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Informe Semanal Inteligente</h1>
            <p className="text-xs text-zinc-500">Asistente de resúmenes de obra y análisis de fase impulsado por IA Gemini.</p>
          </div>
        </div>

        {/* Custom Navigation Tab Selector */}
        <div className="flex border border-zinc-200 rounded-lg p-1 bg-white shadow-sm max-w-[320px]">
          <button
            onClick={() => setActiveTab('nuevo')}
            className={cn(
              "flex-1 px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'nuevo' ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Informe
          </button>
          <button
            onClick={() => {
              setActiveTab('historial');
              fetchHistory();
            }}
            className={cn(
              "flex-1 px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'historial' ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Historial ({historicalReports.length})
          </button>
        </div>
      </header>

      {/* Tabs panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'nuevo' ? (
          <motion.div 
            key="new-report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left Control Panel / Form Inputs */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Form 1: Metadata Config */}
              <section className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm tracking-wider uppercase border-b border-zinc-100 pb-3">
                  <Sliders className="w-4 h-4" />
                  <span>Configuración del Reporte</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Label picker */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Identificador de la Semana</label>
                    <input 
                      type="text"
                      placeholder="Ej: Semana 21 - Mayo"
                      value={weekLabel}
                      onChange={(e) => setWeekLabel(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-semibold"
                    />
                  </div>

                  {/* Range selectors */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Supervisor Responsable</label>
                    <select
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="">Seleccione Supervisor...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Fecha de Inicio (Lunes)</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Fecha de Fin (Domingo)</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Filtro de Proyecto / Cliente</label>
                    <input 
                      type="text"
                      placeholder="Ej: Torre A, Planta de Lácteos, etc."
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 block">Área o Frente de Trabajo</label>
                    <input 
                      type="text"
                      placeholder="Ej: Sector Envasado / Obra civil"
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleLoadWeekActivities}
                    disabled={loadingTasks}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_12px_rgba(79,70,229,0.2)]"
                  >
                    {loadingTasks ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Cargar bitácoras de la semana
                  </button>
                </div>
              </section>

              {/* Form 2: Tasks Checklist Table */}
              {loadedTasks.length > 0 && (
                <section className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm tracking-wider uppercase">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Actividades y Tareas Hechas ({loadedTasks.filter(t => t.selected !== false).length}/{loadedTasks.length})</span>
                    </div>

                    {/* Simple filter tools */}
                    <div className="flex items-center gap-2">
                      <div className="relative max-w-[150px]">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Buscar..."
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-md pl-8 pr-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <select
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value)}
                        className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 text-xs text-zinc-600 focus:outline-none"
                      >
                        <option value="todos">Todos</option>
                        <option value="listo">Listo</option>
                        <option value="en proceso">En Proceso</option>
                        <option value="pendiente">Pendiente</option>
                      </select>

                      <button
                        onClick={handleAddTask}
                        className="px-2.5 py-1 rounded bg-indigo-50 font-bold hover:bg-indigo-100 text-[10px] text-indigo-700 transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Añadir
                      </button>
                      <button
                        onClick={toggleSelectAllTasks}
                        className="px-2.5 py-1 rounded bg-zinc-100 font-bold hover:bg-zinc-200 text-[10px] text-zinc-700 transition"
                      >
                        Marcar Todos
                      </button>
                    </div>
                  </div>

                  {/* Tasks List Table */}
                  <div className="overflow-x-auto border border-zinc-100 rounded-lg max-h-[350px] overflow-y-auto">
                    <table className="min-w-full text-xs text-left divide-y divide-zinc-200">
                      <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3 w-10">Sel</th>
                          <th className="p-3">Actividad / Tarea</th>
                          <th className="p-3 w-28">Responsable</th>
                          <th className="p-3 w-28">Estado Log</th>
                          <th className="p-3 w-24">Prioridad</th>
                          <th className="p-3">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 bg-white">
                        {filteredTasks.map((task) => (
                          <tr 
                            key={task.id}
                            className={cn(
                              "hover:bg-zinc-50/50 transition-colors",
                              task.selected === false && "opacity-45 bg-zinc-50/20"
                            )}
                          >
                            <td className="p-3">
                              <button
                                onClick={() => handleToggleTask(task.id)}
                                className="text-zinc-400 hover:text-indigo-600 transition"
                              >
                                {task.selected !== false ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="p-3 font-medium text-zinc-800">
                              <div className="flex flex-col gap-1.5 min-w-[200px]">
                                <input
                                  type="text"
                                  value={task.name}
                                  onChange={(e) => handleUpdateTaskField(task.id, 'name', e.target.value)}
                                  disabled={!task.selected}
                                  placeholder="Nombre de la tarea"
                                  className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                                />
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="bg-indigo-50 border border-indigo-120/40 text-indigo-750 text-[9px] px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {task.date || 'S/F'}
                                  </span>
                                  {task.tower && (
                                    <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                                      🏢 Torre: {task.tower}
                                    </span>
                                  )}
                                  {task.side && task.side !== '-' && (
                                    <span className="bg-amber-50 border border-amber-200/60 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                                      ⇄ Lado: {task.side}
                                    </span>
                                  )}
                                  {task.photos && task.photos.length > 0 && (
                                    <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                      📸 {task.photos.length} Evidencia
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1.5 mt-1 overflow-x-auto py-1 items-center">
                                  {task.photos && task.photos.map((ph, idx) => (
                                    <div key={idx} className="relative w-12 h-10 border border-zinc-200 rounded-md overflow-hidden bg-zinc-50 shrink-0">
                                      <img 
                                        src={ph} 
                                        alt="Evidencia" 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  ))}
                                  {task.selected && (
                                    <label className="cursor-pointer flex items-center justify-center w-12 h-10 border border-dashed border-zinc-300 rounded-md hover:bg-zinc-50 hover:border-indigo-400 transition text-zinc-400 shrink-0 title='Añadir Evidencia'">
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => handlePhotoUpload(task.id, e)} 
                                        disabled={!task.selected}
                                      />
                                      <Plus className="w-4 h-4" />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={task.responsible}
                                onChange={(e) => handleUpdateTaskField(task.id, 'responsible', e.target.value)}
                                disabled={!task.selected}
                                placeholder="Resp."
                                className="w-20 bg-zinc-100 border-none px-1.5 py-0.5 rounded text-[10px] text-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                value={task.status}
                                disabled={!task.selected}
                                onChange={(e) => handleUpdateTaskField(task.id, 'status', e.target.value)}
                                className={cn(
                                  "px-2 py-1 rounded-full text-[9px] font-bold uppercase outline-none appearance-none cursor-pointer border border-transparent hover:border-zinc-300 block w-full text-center",
                                  task.status === 'listo' ? "bg-emerald-100 text-emerald-800" :
                                  task.status === 'en proceso' ? "bg-indigo-100 text-indigo-800" :
                                  "bg-amber-100 text-amber-800"
                                )}
                              >
                                <option value="pendiente" className="bg-white text-zinc-900">PENDIENTE</option>
                                <option value="en proceso" className="bg-white text-zinc-900">EN PROCESO</option>
                                <option value="listo" className="bg-white text-zinc-900">LISTO</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <select
                                disabled={!task.selected}
                                value={task.priority}
                                onChange={(e) => handleUpdateTaskField(task.id, 'priority', e.target.value)}
                                className="bg-zinc-50 border border-zinc-200 rounded text-xs px-1 py-0.5"
                              >
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <div className="relative flex items-center gap-1.5 w-full min-w-[220px]">
                                <input 
                                  type="text"
                                  placeholder="Generar o escribir..."
                                  readOnly
                                  disabled={!task.selected}
                                  value={task.observations}
                                  onClick={() => {
                                    if (task.selected) {
                                      handleOpenObservationsModal(task);
                                    }
                                  }}
                                  className={cn(
                                    "w-full bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-zinc-700 select-none cursor-pointer text-xs truncate transition-all pr-8",
                                    task.selected ? "hover:border-indigo-400 hover:bg-zinc-100/50" : "opacity-50 cursor-not-allowed"
                                  )}
                                />
                                <button
                                  type="button"
                                  disabled={!task.selected}
                                  onClick={() => handleOpenObservationsModal(task)}
                                  className="absolute right-1 text-zinc-400 hover:text-indigo-600 p-1 rounded-md hover:bg-zinc-200 transition disabled:opacity-40 cursor-pointer"
                                  title="Editar observaciones cómodamente"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Form 3: Incidents list block */}
              {loadedTasks.length > 0 && (
                <section className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-sm tracking-wider uppercase">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Incidencias y Riesgos Reportados ({loadedIncidents.filter(i=>i.selected !== false).length})</span>
                    </div>

                    <button
                      onClick={() => setShowManualIncidentModal(true)}
                      className="text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Agregar Manual
                    </button>
                  </div>

                  {loadedIncidents.length === 0 ? (
                    <div className="py-8 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200 text-center text-zinc-400 text-xs">
                      No hay desviaciones ni paros de obra cargados del periodo. Todo fluye de manera excelente.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {loadedIncidents.map((inc) => (
                        <div 
                          key={inc.id}
                          className={cn(
                            "border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm transition",
                            inc.selected ? "border-rose-150 bg-rose-50/15" : "border-zinc-200 bg-zinc-100/30 opacity-60"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-start gap-2.5">
                              <button 
                                onClick={() => toggleSelectIncident(inc.id)}
                                className="mt-0.5 text-rose-500 hover:scale-105"
                              >
                                {inc.selected ? (
                                  <CheckSquare className="w-4 h-4 text-rose-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-400" />
                                )}
                              </button>
                              <div>
                                <span className={cn("px-2 py-0.5 text-[9px] uppercase font-black rounded border italic tracking-wider", getGravityBadgeColor(inc.gravity))}>
                                  {inc.gravity}
                                </span>
                                <p className="text-xs font-medium text-zinc-800 mt-2">{inc.description}</p>
                              </div>
                            </div>

                            <button 
                              onClick={() => handleRemoveIncident(inc.id)}
                              className="text-zinc-300 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="border-t border-zinc-100 pt-2.5 flex flex-wrap justify-between items-center text-[10px] text-zinc-400 font-mono">
                            <span>Sujeto: {inc.responsible || 'Operario'}</span>
                            <span>Corrección: {inc.correctiveAction || 'Ninguna'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Form 4: Generated Report Summary (Visual Screen) */}
              {generatedAIPayload && (
                <section className="bg-white border-2 border-indigo-500/20 rounded-2xl p-6 shadow-md flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-2 text-indigo-600 font-black text-base tracking-wider uppercase">
                      <FileCheck className="w-5 h-5 text-indigo-500" />
                      <span>SÍNTESIS DEL INFORME (EDITABLE)</span>
                    </div>

                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      generatedAIPayload.suggestedStatus === 'Excelente' ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                      generatedAIPayload.suggestedStatus === 'Bueno' ? "bg-blue-100 text-blue-800 border-blue-300" :
                      generatedAIPayload.suggestedStatus === 'Regular' ? "bg-amber-100 text-amber-800 border-amber-300" :
                      "bg-rose-100 text-rose-800 border-rose-300"
                    )}>
                      Estatus: {generatedAIPayload.suggestedStatus}
                    </span>
                  </div>

                  {/* Executive Summary detail */}
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Resumen Ejecutivo</h4>
                    <textarea
                      value={generatedAIPayload.executiveSummary}
                      onChange={(e) => setGeneratedAIPayload({ ...generatedAIPayload, executiveSummary: e.target.value })}
                      className="w-full text-sm text-zinc-800 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      rows={4}
                      placeholder="Redacte el resumen ejecutivo aquí..."
                    />
                  </div>

                  {/* Complicance & analysis */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Análisis de Cumplimiento</h4>
                      <textarea
                        value={generatedAIPayload.generalProgressAnalysis}
                        onChange={(e) => setGeneratedAIPayload({ ...generatedAIPayload, generalProgressAnalysis: e.target.value })}
                        className="w-full text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        rows={3}
                        placeholder="Redacte el análisis de progreso y cumplimiento aquí..."
                      />
                    </div>

                    <div className="bg-indigo-50/50 border border-indigo-120/40 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider font-mono">Estatus del Periodo</span>
                      <select
                        value={generatedAIPayload.suggestedStatus}
                        onChange={(e) => setGeneratedAIPayload({ ...generatedAIPayload, suggestedStatus: e.target.value as any })}
                        className="bg-white border border-indigo-200 text-indigo-950 text-xs font-black rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full"
                      >
                        <option value="Excelente">Excelente</option>
                        <option value="Bueno">Bueno</option>
                        <option value="Regular">Regular</option>
                        <option value="Crítico">Crítico</option>
                      </select>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Recomendaciones Correctivas</h4>
                      <button
                        onClick={() => {
                          const updatedRecs = [...(generatedAIPayload.recommendations || []), ""];
                          setGeneratedAIPayload({ ...generatedAIPayload, recommendations: updatedRecs });
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition"
                      >
                        <Plus className="w-3 h-3" />
                        Añadir Recomendación
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(generatedAIPayload.recommendations || []).map((rec, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 font-bold" />
                          <input
                            type="text"
                            value={rec}
                            onChange={(e) => {
                              const updatedRecs = [...generatedAIPayload.recommendations];
                              updatedRecs[i] = e.target.value;
                              setGeneratedAIPayload({ ...generatedAIPayload, recommendations: updatedRecs });
                            }}
                            className="bg-transparent border-none focus:outline-none w-full text-xs text-zinc-700 font-medium"
                            placeholder="Describa la recomendación..."
                          />
                          <button
                            onClick={() => {
                              const updatedRecs = generatedAIPayload.recommendations.filter((_, idx) => idx !== i);
                              setGeneratedAIPayload({ ...generatedAIPayload, recommendations: updatedRecs });
                            }}
                            className="text-zinc-400 hover:text-rose-500 px-1 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions to Persist or export right away */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={handleSaveReportToDatabase}
                      disabled={submittingReport}
                      className="w-full py-2.5 px-4 font-bold bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <Save className="w-4 h-4" />
                      Guardar y Desplegar Informe
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => exportToPDF({
                          id: '',
                          weekLabel,
                          startDate,
                          endDate,
                          area: selectedArea,
                          project: selectedProject,
                          responsibleName,
                          createdAt: new Date().toISOString(),
                          createdBy: '',
                          status: generatedAIPayload.suggestedStatus as any,
                          aiSummary: generatedAIPayload,
                          tasks: loadedTasks,
                          incidents: loadedIncidents,
                          productivityScore
                        })}
                        className="py-2.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl flex items-center justify-center gap-1 border border-zinc-200 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        PDF
                      </button>

                      <button
                        onClick={() => exportToExcel({
                          id: '',
                          weekLabel,
                          startDate,
                          endDate,
                          area: selectedArea,
                          project: selectedProject,
                          responsibleName,
                          createdAt: new Date().toISOString(),
                          createdBy: '',
                          status: generatedAIPayload.suggestedStatus as any,
                          aiSummary: generatedAIPayload,
                          tasks: loadedTasks,
                          incidents: loadedIncidents,
                          productivityScore
                        })}
                        className="py-2.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl flex items-center justify-center gap-1 border border-zinc-200 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        Excel
                      </button>

                      <button
                        onClick={() => exportToWord({
                          id: '',
                          weekLabel,
                          startDate,
                          endDate,
                          area: selectedArea,
                          project: selectedProject,
                          responsibleName,
                          createdAt: new Date().toISOString(),
                          createdBy: '',
                          status: generatedAIPayload.suggestedStatus as any,
                          aiSummary: generatedAIPayload,
                          tasks: loadedTasks,
                          incidents: loadedIncidents,
                          productivityScore
                        })}
                        className="py-2.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl flex items-center justify-center gap-1 border border-zinc-200 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                        Word
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Right Side metrics panel & AI execution */}
            <div className="flex flex-col gap-6">
              
              {/* Box 1: Run AI Report */}
              <section className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md flex flex-col gap-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-black text-base tracking-tight">Análisis Inteligente</h3>
                </div>
                
                <p className="text-xs text-indigo-200 leading-relaxed">
                  Utiliza inteligencia artificial avanzada para compilar un informe ejecutivo técnico impecable en segundos basándote en las bitácoras semanales seleccionadas y los problemas corregidos en la planta.
                </p>

                {loadedTasks.length === 0 ? (
                  <div className="p-3.5 text-center text-[11px] text-indigo-300 bg-indigo-950/20 border border-indigo-800 border-dashed rounded-xl">
                    ⚠️ Primero debe cargar las bitácoras semanales usando el botón en la configuración para calibrar el análisis.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      onClick={handleGenerateAIReport}
                      disabled={generatingWithAI}
                      className="w-full bg-white hover:bg-indigo-50 disabled:opacity-50 text-indigo-950 font-black text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
                    >
                      {generatingWithAI ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>Analizando datos de planta...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-indigo-650" />
                          <span>Generar con IA Gemini</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setGeneratedAIPayload({
                          executiveSummary: "Resumen ejecutivo elaborado de forma manual. Describa aquí los hitos principales de la semana.",
                          generalProgressAnalysis: `Durante la semana se completaron ${completedTasksCount} de ${selectedTasksCount} actividades estipuladas en obra, alcanzando un progreso de cumplimiento del ${compliancePercentage}%.`,
                          progressPercentage: compliancePercentage,
                          recommendations: [
                            "Optimizar la asignación de materiales y de frentes de obra.",
                            "Mantener el control e inspección rutinaria de seguridad en las áreas de trabajo."
                          ],
                          suggestedStatus: (productivityScore >= 85 ? 'Excelente' : productivityScore >= 70 ? 'Bueno' : productivityScore >= 50 ? 'Regular' : 'Crítico')
                        });
                        toast.success("Se abrió el editor de síntesis manual de forma exitosa.");
                      }}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-zinc-700/30"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Redactar Síntesis Manual (Sin IA)
                    </button>

                    {/* Pre-save without AI */}
                    <button
                      onClick={handleSaveReportToDatabase}
                      disabled={submittingReport}
                      className="w-full bg-indigo-850 hover:bg-indigo-800 text-xs font-bold text-indigo-100 py-2 rounded-xl transition"
                    >
                      Guardar Borrador Rápido (Sin IA)
                    </button>
                  </div>
                )}
              </section>

              {/* Box 2: Visual KPIs Metrics */}
              {loadedTasks.length > 0 && (
                <section className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                  <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-100 pb-2">Métricas de Rendimiento Semanal</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Tareas</span>
                      <p className="text-xl font-black text-zinc-800 mt-1">{completedTasksCount} / {selectedTasksCount}</p>
                      <span className="text-[9px] text-zinc-400">Hechas / Totales</span>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Desempeño</span>
                      <p className="text-sm font-black text-emerald-600 mt-2.5 uppercase tracking-wider">{finalStatus}</p>
                      <span className="text-[9px] text-zinc-400">Estado de planta</span>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Desvíos</span>
                      <p className="text-xl font-black text-rose-600 mt-1">{totalIncidentsCount}</p>
                      <span className="text-[9px] text-zinc-400">Incidencias reportadas</span>
                    </div>
                  </div>

                  {/* Recharts chart */}
                  {selectedTasksCount > 0 && (
                    <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Estado de Actividades Semanales</h4>
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getTasksChartData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} barSize={20}>
                              {getTasksChartData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history-grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            {/* Historical reports listing panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              {/* Small sidebar search control */}
              <div className="md:col-span-1 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm h-fit flex flex-col gap-4">
                <h3 className="font-bold text-sm text-zinc-900 border-b border-zinc-100 pb-2">Búsqueda y Filtros</h3>
                
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar por proyecto..."
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 text-[11px] text-zinc-400 leading-relaxed pt-2">
                  <span>Seleccione un informe de la lista para cargarlo, verificar su resumen, duplicarlo, o exportarlo a Excel o PDF.</span>
                </div>
              </div>

              {/* Central/Right content layout */}
              <div className="md:col-span-3 flex flex-col md:flex-row gap-6">
                
                {/* Reports List */}
                <div className="flex-1 flex flex-col gap-3 min-w-[280px]">
                  {historicalReports.length === 0 ? (
                    <div className="py-16 text-center bg-white border border-dashed border-zinc-200 rounded-2xl text-zinc-400 text-xs">
                      No hay informes guardados aún en la base de datos de Firebase. ¡Comience generando uno hoy mismo!
                    </div>
                  ) : (
                    historicalReports
                      .filter(rep => rep.project.toLowerCase().includes(reportSearchQuery.toLowerCase()) || rep.weekLabel.toLowerCase().includes(reportSearchQuery.toLowerCase()))
                      .map((report) => (
                        <div 
                          key={report.id}
                          onClick={() => setSelectedHistoricalReport(report)}
                          className={cn(
                            "bg-white border rounded-2xl p-4 shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-between gap-4 border-l-4",
                            selectedHistoricalReport?.id === report.id ? "border-indigo-600 ring-1 ring-indigo-100" : "border-zinc-200",
                            report.status === 'Excelente' ? "border-l-emerald-500" :
                            report.status === 'Bueno' ? "border-l-blue-500" :
                            report.status === 'Regular' ? "border-l-amber-500" :
                            "border-l-rose-500"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-650">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-zinc-800">{report.project}</h4>
                                <span className="text-[10px] text-zinc-400 block font-mono">({report.weekLabel})</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-medium">Supervisor: {report.responsibleName} • {new Date(report.createdAt).toLocaleDateString()}</p>
                              
                              <div className="flex items-center gap-3 mt-1.5 font-mono text-[9px] text-zinc-400 uppercase">
                                <span>Tareas: {(report.tasks || []).filter(t => t.selected !== false).length}</span>
                                <span>Incidencias: {(report.incidents || []).filter(i => i.selected !== false).length}</span>
                                <span className="font-bold text-zinc-650">Estado: {report.status}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          </div>
                        </div>
                      ))
                  )}
                </div>

                {/* Selected report visualization sheet */}
                {selectedHistoricalReport && (
                  <div className="flex-1 bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm h-fit flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b pb-3 border-zinc-100">
                      <div>
                        <span className="text-[9px] font-black font-mono uppercase tracking-widest text-zinc-400">Detalle de Control</span>
                        <h3 className="font-black text-[15px] text-zinc-900 leading-tight mt-0.5">{selectedHistoricalReport.project}</h3>
                        <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{selectedHistoricalReport.weekLabel} • {new Date(selectedHistoricalReport.createdAt).toLocaleDateString()}</p>
                      </div>

                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        selectedHistoricalReport.status === 'Excelente' ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                        selectedHistoricalReport.status === 'Bueno' ? "bg-blue-100 text-blue-800 border-blue-300" :
                        selectedHistoricalReport.status === 'Regular' ? "bg-amber-100 text-amber-800 border-amber-300" :
                        "bg-rose-100 text-rose-800 border-rose-300"
                      )}>
                        {selectedHistoricalReport.status}
                      </span>
                    </div>

                    {/* Meta info short summary */}
                    <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-3 rounded-xl border border-zinc-150">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase">Área / Sucursal</span>
                        <span className="font-medium text-zinc-800">{selectedHistoricalReport.area}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase">Supervisor</span>
                        <span className="font-medium text-zinc-800">{selectedHistoricalReport.responsibleName}</span>
                      </div>
                    </div>

                    {/* AI narrative */}
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 font-mono flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>Resumen de Inteligencia Artificial</span>
                      </h4>
                      <p className="text-xs text-zinc-600 bg-zinc-50/50 p-3 rounded-lg border border-zinc-100 leading-relaxed font-normal">
                        {selectedHistoricalReport.aiSummary?.executiveSummary || "Este borrador manual no contiene síntesis de recomendación ejecutiva de IA."}
                      </p>
                    </div>

                    {/* Recommendations inside report */}
                    {selectedHistoricalReport.aiSummary?.recommendations && selectedHistoricalReport.aiSummary.recommendations.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 font-mono">Acciones Correctivas Sugeridas</h4>
                        <div className="flex flex-col gap-2">
                          {selectedHistoricalReport.aiSummary.recommendations.map((rec, k) => (
                            <div key={k} className="flex gap-2 text-xs text-zinc-650 bg-zinc-50 p-2 rounded border border-zinc-100">
                              <span className="text-emerald-500 font-bold">✓</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tareas Semanales y Evidencia Fotográfica */}
                    <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
                      <h4 className="text-[10px] uppercase tracking-wider font-bold text-zinc-450 font-mono flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Tareas Registradas y Evidencia en Obra</span>
                      </h4>
                      
                      <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {!selectedHistoricalReport.tasks || selectedHistoricalReport.tasks.filter(t => t.selected !== false).length === 0 ? (
                          <p className="text-[11px] text-zinc-400 text-center py-4 bg-zinc-50 rounded-xl">Sin tareas seleccionadas en este informe.</p>
                        ) : (
                          selectedHistoricalReport.tasks.filter(t => t.selected !== false).map((t) => (
                            <div key={t.id} className="bg-zinc-50 border border-zinc-200/50 rounded-xl p-3 flex flex-col gap-2">
                              {/* Task header */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h5 className="font-bold text-xs text-zinc-800 leading-tight">{t.name}</h5>
                                  <span className="text-[9px] text-zinc-400 mt-1 block font-mono">
                                    📅 {t.date || 'Sin Fecha'} • Responsable: <span className="font-sans font-medium text-zinc-650">{t.responsible}</span>
                                    {t.tower && ` • Torre: ${t.tower}`}
                                    {t.side && t.side !== '-' && ` • Lado: ${t.side}`}
                                  </span>
                                </div>
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0",
                                  t.status === 'listo' ? "bg-emerald-100 text-emerald-800" :
                                  t.status === 'en proceso' ? "bg-indigo-100 text-indigo-800" :
                                  "bg-amber-100 text-amber-800"
                                )}>
                                  {t.status}
                                </span>
                              </div>

                              {/* Task Details Row */}
                              <div className="flex flex-wrap items-center gap-3 text-[9px] text-zinc-550 border-t border-dashed border-zinc-200/60 pt-1.5 mt-0.5">
                                <span><b>Prioridad:</b> {t.priority}</span>
                                {t.observations && (
                                  <>
                                    <span>&bull;</span>
                                    <span><b>Obs:</b> <span className="italic">{t.observations}</span></span>
                                  </>
                                )}
                              </div>

                              {/* Task Photos List */}
                              {t.photos && t.photos.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-200/40">
                                  {t.photos.map((ph, pIdx) => (
                                    <div key={pIdx} className="relative w-16 h-12 rounded overflow-hidden border border-zinc-200 bg-white shadow-sm shrink-0">
                                      <img 
                                        src={ph} 
                                        alt={`Evidencia ${pIdx + 1}`} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Actions block for Historical report */}
                    <div className="border-t border-zinc-100 pt-5 flex flex-col gap-3">
                      
                      {/* Action 1: Export Row standard buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => exportToPDF(selectedHistoricalReport)}
                          className="py-2 font-bold text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg flex items-center justify-center gap-1 border border-zinc-200 transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          PDF
                        </button>

                        <button
                          onClick={() => exportToExcel(selectedHistoricalReport)}
                          className="py-2 font-bold text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg flex items-center justify-center gap-1 border border-zinc-200 transition"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          Excel
                        </button>

                        <button
                          onClick={() => exportToWord(selectedHistoricalReport)}
                          className="py-2 font-bold text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg flex items-center justify-center gap-1 border border-zinc-200 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-blue-650" />
                          Word
                        </button>
                      </div>

                      {/* Action 2: Clone & share layout */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleDuplicateReport(selectedHistoricalReport)}
                          className="py-2 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center gap-1 border border-indigo-150 transition"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Duplicar/Editar
                        </button>

                        <button
                          onClick={() => handleShareClipboard(selectedHistoricalReport)}
                          className="py-2 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center gap-1 border border-emerald-150 transition"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Compartir
                        </button>
                      </div>

                      {/* Suppress Button */}
                      <button
                        onClick={() => handleDeleteReport(selectedHistoricalReport.id)}
                        className="w-full mt-2 py-1.5 font-bold text-[10px] uppercase text-zinc-400 hover:bg-red-50 hover:text-red-700 rounded-lg border border-transparent hover:border-red-150 transition flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar Registro Permanente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Incident Add Dialog/Modal */}
      {showManualIncidentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-zinc-150 flex flex-col gap-4 text-zinc-900"
          >
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="font-black text-zinc-900 text-base flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-rose-500" />
                Agregar Incidencia Manual
              </h3>
              <button 
                onClick={() => setShowManualIncidentModal(false)}
                className="text-zinc-400 hover:text-zinc-650 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualIncident} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Descripción del Problema</label>
                <textarea
                  required
                  placeholder="Ej: Retraso en suministro por falla mecánica..."
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                  className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Fecha de Ocurrencia</label>
                  <input
                    type="date"
                    value={newIncidentDate}
                    onChange={(e) => setNewIncidentDate(e.target.value)}
                    className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Nivel Gravedad</label>
                  <select
                    value={newIncidentGravity}
                    onChange={(e) => setNewIncidentGravity(e.target.value as any)}
                    className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Persona Asignada</label>
                  <input
                    type="text"
                    placeholder="Sujeto de reporte..."
                    value={newIncidentResponsible}
                    onChange={(e) => setNewIncidentResponsible(e.target.value)}
                    className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Impacto en Turno</label>
                  <input
                    type="text"
                    placeholder="Paro 1hr, etc."
                    value={newIncidentImpact}
                    onChange={(e) => setNewIncidentImpact(e.target.value)}
                    className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Mitigación / Acción Correctiva</label>
                <input
                  type="text"
                  placeholder="Se solucionó activando motor auxiliar..."
                  value={newIncidentCorrective}
                  onChange={(e) => setNewIncidentCorrective(e.target.value)}
                  className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition"
              >
                Agregar Incidencia
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Spacious Observations Zoom/Edit Modal */}
      {activeObsTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-zinc-150 flex flex-col gap-4 text-zinc-900"
          >
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest font-mono">
                  Observaciones de la Actividad
                </span>
                <h3 className="font-black text-zinc-900 text-sm mt-0.5 line-clamp-1">
                  {activeObsTask.name}
                </h3>
              </div>
              <button 
                onClick={() => setActiveObsTask(null)}
                className="text-zinc-400 hover:text-zinc-650 cursor-pointer p-1 rounded-full hover:bg-zinc-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">
                Escribir Observaciones / Notas de Obra
              </label>
              <textarea
                placeholder="Indique cualquier comentario, retraso constructivo, avance particular, contratiempos, retrasos con subcontratistas, etc. de esta tarea..."
                value={tempObservations}
                onChange={(e) => setTempObservations(e.target.value)}
                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[160px] leading-relaxed resize-y"
                rows={6}
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setActiveObsTask(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObservations}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar Observaciones
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Configure Gemini API Key Fallback Modal */}
      {apiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-zinc-150 flex flex-col gap-4 text-zinc-900"
          >
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest font-mono">
                  Configuración Externa (Vercel)
                </span>
                <h3 className="font-black text-zinc-900 text-sm mt-0.5">
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
                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  saveApiKey(customApiKey);
                  setApiKeyModalOpen(false);
                  toast.success("API Key de Gemini guardada de forma local exitosamente.");
                  handleGenerateAIReport();
                }}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar y Generar Informe
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
