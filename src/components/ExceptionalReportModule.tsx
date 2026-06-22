import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertOctagon, Save, Plus, Trash2, Download, Image as ImageIcon, MapPin, Search, RefreshCw, Sparkles, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { firestoreService } from '../lib/firestoreService';
import { ExceptionalReport, TowerImpact, User } from '../types';
import { compressImage } from '../lib/imageUtils';
import { geminiService, getApiKey, saveApiKey } from '../lib/geminiService';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  users?: User[];
}

export default function ExceptionalReportModule({ users }: Props) {
  const [reports, setReports] = useState<ExceptionalReport[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(true);

  // Form State
  const [eventType, setEventType] = useState('Terremoto');
  const [project, setProject] = useState('');
  const [description, setDescription] = useState('');
  const [impactAnalysis, setImpactAnalysis] = useState<TowerImpact[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  
  // Camera State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeTowerId, setActiveTowerId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatingWithAI, setGeneratingWithAI] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');

  const generateAIAnalysis = async () => {
    if (!eventType || !project) {
      toast.warning("Complete el tipo de evento y el proyecto antes de generar con IA.");
      return;
    }
    if (impactAnalysis.length === 0) {
      toast.warning("Añada al menos una torre afectada para generar el informe técnico.");
      return;
    }
    setGeneratingWithAI(true);
    try {
      const hasPhotos = photos.length > 0 || impactAnalysis.some(t => !!t.photo);
      const generated = await geminiService.generateExceptionalReport(eventType, project, impactAnalysis, hasPhotos);
      
      if (generated.mainDescription) {
        setDescription(generated.mainDescription);
      }
      if (generated.towerComments && Array.isArray(generated.towerComments)) {
        setImpactAnalysis(prev => prev.map(t => {
          const matched = generated.towerComments.find((c: any) => c.towerId === t.id);
          return matched && matched.comment ? { ...t, comments: matched.comment } : t;
        }));
      }
      toast.success("Análisis generado correctamente.");
    } catch (err: any) {
      if (err.message === "API_KEY_REQUIRED" || err.message === "No hay API Key configurada para usar la IA de Gemini") {
        setCustomApiKey(getApiKey() || '');
        setApiKeyModalOpen(true);
        toast.info("Por favor, configure su API Key de Gemini.");
      } else {
        toast.error(err.message || "Error al generar con IA");
      }
      console.error(err);
    } finally {
      setGeneratingWithAI(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

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
    if (videoRef.current && activeTowerId) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      try {
        const compressed = await compressImage(dataUrl, 800, 0.6);
        updateTowerImpact(activeTowerId, 'photo', compressed);
      } catch (e) {
        updateTowerImpact(activeTowerId, 'photo', dataUrl);
      }
      
      setCameraOpen(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await firestoreService.getAll<ExceptionalReport>('exceptionalReports');
      setReports(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar informes excepcionales');
    } finally {
      setLoading(false);
    }
  };

  const addTowerImpact = () => {
    setImpactAnalysis([...impactAnalysis, {
      id: Math.random().toString(36).substr(2, 9),
      towerLabel: '',
      side: '-',
      status: 'Intacta',
      comments: ''
    }]);
  };

  const updateTowerImpact = (id: string, field: keyof TowerImpact, value: any) => {
    setImpactAnalysis(impactAnalysis.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTowerImpact = (id: string) => {
    setImpactAnalysis(impactAnalysis.filter(t => t.id !== id));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach((file: any) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Una imagen es muy grande. Máximo 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          setPhotos(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const saveReport = async () => {
    if (!project || !description) {
      toast.error('Faltan campos obligatorios');
      return;
    }
    
    const newReport: ExceptionalReport = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      eventType,
      project,
      description,
      impactAnalysis,
      photos,
      createdAt: new Date().toISOString(),
      createdBy: 'Usuario Actual' // Normally would take from auth context
    };

    try {
      await firestoreService.add('exceptionalReports', newReport);
      toast.success('Informe guardado correctamente');
      setReports([newReport, ...reports]);
      setView('list');
      // Reset form
      setEventType('Terremoto');
      setProject('');
      setDescription('');
      setImpactAnalysis([]);
      setPhotos([]);
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el informe');
    }
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

  const exportPDF = async (report: ExceptionalReport) => {
    const doc = new jsPDF();
    
    try {
      const logoData = await getBase64ImageFromURL('/logo.png');
      doc.addImage(logoData, 'PNG', 15, 12, 40, 20);
    } catch (e) {
      console.warn('Logo could not be loaded for PDF', e);
    }

    // Header structure
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text('INFORME EXCEPCIONAL DE OBRA', 110, 24, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`ID: ${report.id} | Fecha: ${report.date}`, 110, 31, { align: 'center' });
    
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1);
    doc.line(15, 38, 195, 38);

    // Details Grid
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Tipo de Evento:`, 15, 50);
    doc.setFont("helvetica", "normal");
    doc.text(report.eventType, 50, 50);

    doc.setFont("helvetica", "bold");
    doc.text(`Proyecto/Planta:`, 105, 50);
    doc.setFont("helvetica", "normal");
    doc.text(report.project, 140, 50);

    doc.setFont("helvetica", "bold");
    doc.text(`Generado por:`, 15, 58);
    doc.setFont("helvetica", "normal");
    doc.text(report.createdBy || 'Sistema', 50, 58);

    doc.setFont("helvetica", "bold");
    doc.text("Descripción y Análisis del Evento:", 15, 70);
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(report.description, 180);
    doc.text(splitDesc, 15, 76);

    let yOffset = 76 + (splitDesc.length * 6) + 10;

    // Table of Tower Impacts
    if (report.impactAnalysis.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Evaluación de Impacto por Torre/Sector:", 15, yOffset);
      yOffset += 5;

      const tableData = report.impactAnalysis.map(imp => [
        imp.towerLabel || 'N/A',
        imp.side || '-',
        imp.status,
        imp.comments || 'Sin comentarios'
      ]);

      autoTable(doc, {
        startY: yOffset,
        head: [['Torre', 'Lado', 'Estado de Daño', 'Observaciones']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] }
      });
      yOffset = (doc as any).lastAutoTable.finalY + 15;
    }

    // General Photos
    if (report.photos && report.photos.length > 0) {
      if (yOffset > 250) {
        doc.addPage();
        yOffset = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text("Evidencia Fotográfica (General):", 15, yOffset);
      yOffset += 10;

      for (let i = 0; i < report.photos.length; i++) {
        if (yOffset > 220) {
          doc.addPage();
          yOffset = 20;
        }
        try {
          doc.addImage(report.photos[i], 'JPEG', 15, yOffset, 180, 100);
          yOffset += 110;
        } catch (e) {
          console.warn('Could not add image to PDF', e);
        }
      }
    }

    // Tower Specific Photos
    const towersWithPhotos = report.impactAnalysis.filter(t => t.photo);
    if (towersWithPhotos.length > 0) {
      if (yOffset > 250) {
        doc.addPage();
        yOffset = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text("Evidencia Fotográfica de Torres:", 15, yOffset);
      yOffset += 10;

      for (let i = 0; i < towersWithPhotos.length; i++) {
        if (yOffset > 220) {
          doc.addPage();
          yOffset = 20;
        }
        try {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
          doc.text(`Torre: ${towersWithPhotos[i].towerLabel} (Lado: ${towersWithPhotos[i].side}) - ${towersWithPhotos[i].status}`, 15, yOffset);
          yOffset += 6;
          
          if (towersWithPhotos[i].comments) {
            doc.setFont("helvetica", "normal");
            const splitComments = doc.splitTextToSize(`Observaciones: ${towersWithPhotos[i].comments}`, 180);
            doc.text(splitComments, 15, yOffset);
            yOffset += (splitComments.length * 5) + 3;
          }

          // Check again if we need a new page due to the large image height + offset
          if (yOffset + 100 > 280) {
            doc.addPage();
            yOffset = 20;
            doc.setFont("helvetica", "bold");
            doc.text(`Torre: ${towersWithPhotos[i].towerLabel} (Continuación)`, 15, yOffset);
            yOffset += 6;
          }

          doc.addImage(towersWithPhotos[i].photo!, 'JPEG', 15, yOffset, 180, 100);
          yOffset += 110;
        } catch (e) {
          console.warn('Could not add tower image to PDF', e);
        }
      }
    }

    doc.save(`Informe_Excepcional_${report.eventType}_${report.date}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-rose-500">Informes Excepcionales</h1>
          <p className="text-zinc-500 text-sm">Registro de contingencias post-eventos (Sismos, Inundaciones, etc)</p>
        </div>
        {view === 'list' ? (
          <Button onClick={() => setView('create')} className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <Plus size={16} /> Crear Reporte de Evento
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setView('list')}>Volver al Listado</Button>
        )}
      </div>

      {view === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reports.map(report => (
            <div key={report.id} className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertOctagon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">{report.eventType}</h3>
                    <p className="text-[11px] text-zinc-500">{new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => exportPDF(report)}>
                  <Download size={14} /> PDF
                </Button>
              </div>
              <p className="text-sm text-zinc-700 line-clamp-2">{report.description}</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold px-2 py-1 bg-zinc-100 rounded-lg text-zinc-600">Proyecto: {report.project}</span>
                <span className="text-[10px] font-bold px-2 py-1 bg-zinc-100 rounded-lg text-zinc-600">Impactos evaluados: {report.impactAnalysis.length}</span>
                <span className="text-[10px] font-bold px-2 py-1 bg-zinc-100 rounded-lg text-zinc-600">Fotos: {report.photos.length}</span>
              </div>
            </div>
          ))}
          {reports.length === 0 && !loading && (
             <div className="col-span-full py-12 text-center text-zinc-400">
               <AlertOctagon size={48} className="mx-auto mb-4 opacity-20" />
               <p>No se han registrado eventos excepcionales.</p>
             </div>
          )}
        </div>
      )}

      {view === 'create' && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-red-700 font-bold">Categoría del Evento</Label>
                <select 
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:ring-1 focus:ring-red-500 outline-none"
                >
                  <option value="Terremoto">Sismo / Terremoto</option>
                  <option value="Inundación">Inundación / Lluvias atípicas</option>
                  <option value="Derrumbe">Derrumbe / Deslizamiento</option>
                  <option value="Incendio">Incendio</option>
                  <option value="Otro">Otro Incidente Mayor</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Proyecto o Campamento Afectado</Label>
                <Input value={project} onChange={e => setProject(e.target.value)} placeholder="Ej. Lote 45..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Análisis de Situación (Descripción)</Label>
              <Textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describa cómo fue el evento y el panorama general..."
                className="h-28 resize-none"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-100 pt-6">
            <div className="flex justify-between items-center">
               <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                 <MapPin size={18} className="text-red-500" />
                 Evaluación de Estructuras (Torres)
               </h3>
               <Button onClick={addTowerImpact} size="sm" variant="outline" className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
                 <Plus size={14} /> Añadir Torre
               </Button>
            </div>
            
            <div className="space-y-3">
              {impactAnalysis.map(impact => (
                <div key={impact.id} className="flex flex-col md:flex-row gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200 items-start md:items-center">
                  <Input placeholder="Cod. Torre (Ej: T-102, Letras)" value={impact.towerLabel} onChange={e => updateTowerImpact(impact.id, 'towerLabel', e.target.value)} className="w-full md:w-32 bg-white h-9" />
                  
                  <select 
                    value={impact.side}
                    onChange={e => updateTowerImpact(impact.id, 'side', e.target.value)}
                    className="w-full md:w-24 h-9 rounded-lg border border-zinc-200 text-xs px-2 bg-white"
                  >
                    <option value="-">Lado: -</option>
                    <option value="A">Lado: A</option>
                    <option value="B">Lado: B</option>
                    <option value="Ambos">Ambos</option>
                  </select>

                  <select 
                    value={impact.status}
                    onChange={e => updateTowerImpact(impact.id, 'status', e.target.value)}
                    className="w-full md:w-40 h-9 rounded-lg border border-zinc-200 text-xs px-2 bg-white font-bold"
                  >
                    <option value="Intacta">🟢 Intacta (Sin daño)</option>
                    <option value="Daños Menores">🟡 Daños Menores</option>
                    <option value="Daños Severos">🟠 Daños Severos</option>
                    <option value="Derrumbe">🔴 Derrumbe Parcial/Total</option>
                  </select>

                  <Input placeholder="Comentarios estructurales..." value={impact.comments} onChange={e => updateTowerImpact(impact.id, 'comments', e.target.value)} className="flex-1 bg-white h-9 text-xs" />
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {impact.photo ? (
                      <div className="relative group w-9 h-9">
                        <img src={impact.photo} alt="Evidencia" className="w-9 h-9 rounded-md object-cover border border-zinc-200" />
                        <button 
                          onClick={() => updateTowerImpact(impact.id, 'photo', undefined)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => {
                          setActiveTowerId(impact.id);
                          setCameraOpen(true);
                        }}
                        className="h-9 w-9 text-zinc-400 hover:text-red-600 bg-white"
                        title="Tomar Foto a Torre"
                      >
                        <Camera size={16} />
                      </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => removeTowerImpact(impact.id)} className="text-zinc-400 hover:text-red-600 h-9 w-9">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              {impactAnalysis.length === 0 && (
                <p className="text-xs text-zinc-400 text-center py-4 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">No se han añadido torres para evaluación.</p>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-100 pt-6">
             <div className="flex justify-between items-center">
               <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                 <Camera size={18} className="text-zinc-500" />
                 Evidencia Fotográfica Formato Libre
               </h3>
               <div>
                  <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
                  <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" className="gap-1">
                    <ImageIcon size={14} /> Subir Fotos
                  </Button>
               </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group aspect-video">
                    <img src={photo} alt="" className="w-full h-full object-cover rounded-xl border border-zinc-200" />
                    <button 
                      onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                       <Trash2 size={12} />
                    </button>
                  </div>
                ))}
             </div>
             {photos.length === 0 && (
               <p className="text-xs text-zinc-400 text-center py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                 Agrega fotos del estado de las torres, grietas en el terreno, u otros impactos del sismo.
               </p>
             )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-zinc-100 flex-wrap gap-4">
             <Button
               variant="outline"
               onClick={generateAIAnalysis}
               disabled={generatingWithAI}
               className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold h-12 px-6"
             >
               {generatingWithAI ? (
                 <>
                   <RefreshCw size={18} className="animate-spin" /> Analizando Torre(s)...
                 </>
               ) : (
                 <>
                   <Sparkles size={18} /> Generar Análisis con IA
                 </>
               )}
             </Button>

             <Button onClick={saveReport} className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 gap-2 h-12">
               <Save size={18} /> Guardar Informe Excepcional
             </Button>
          </div>
        </div>
      )}

      {/* Camera Dialog */}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Camera className="text-red-500" />
              Capturar Evidencia de Torre
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
                <div className="p-4 bg-red-500/20 rounded-full animate-pulse">
                  <RefreshCw size={32} className="animate-spin text-red-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Iniciando cámara...</p>
                  <p className="text-xs text-zinc-500 mt-1">Usando cámara {facingMode === 'environment' ? 'trasera' : 'frontal'}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-3 p-6 mt-0">
            <Button 
              variant="ghost" 
              className="rounded-2xl flex-1 h-12 text-zinc-500 font-medium" 
              onClick={() => setCameraOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded-2xl flex-1 h-12 text-lg font-bold bg-zinc-900 shadow-xl shadow-zinc-200 text-white hover:bg-zinc-800" 
              onClick={capturePhoto} 
              disabled={!stream}
            >
              Tomar Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Modal */}
      <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Configurar API Key de Gemini
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-zinc-600">
              Para generar el informe técnico con Inteligencia Artificial, necesitas proporcionar una API Key de Gemini.
            </p>
            <div className="space-y-2">
              <Label>Tu Google Gemini API Key</Label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setApiKeyModalOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              onClick={() => {
                saveApiKey(customApiKey);
                setApiKeyModalOpen(false);
                toast.success("API Key guardada correctamente.");
                generateAIAnalysis();
              }}
            >
              <Check size={16} /> Guardar y Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
