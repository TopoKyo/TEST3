import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Building2, Plus, Search, FileText, Check, 
  Clock, MapPin, ChevronRight, ChevronLeft,
  Camera, FileDown, Printer, Wand2,
  Trash2, Image as ImageIcon, Sparkles, Upload, PenTool
} from 'lucide-react';
import { ArchReport, ArchFinding, ArchPhoto } from '../types';
import { SignaturePad } from './SignaturePad';
import { firestoreService } from '../lib/firestoreService';
import { compressImage } from '../lib/imageUtils';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function ArchitectureReports() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new' | 'list'>('dashboard');
  const [reports, setReports] = useState<ArchReport[]>([]);
  const [currentReport, setCurrentReport] = useState<ArchReport | null>(null);
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await firestoreService.getAll<ArchReport>('archReports');
      setReports(data || []);
    } catch (e) {
      console.error('Error fetching arch reports:', e);
    }
  };

  const handleStartNew = () => {
    setCurrentReport({
      id: crypto.randomUUID(),
      number: `INF-${new Date().getFullYear()}-${String(reports.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      client: '',
      professional: 'Arquitecto Residente',
      address: '',
      commune: '',
      region: '',
      role: '',
      propertyType: '',
      use: '',
      approximateYear: '',
      area: '',
      observations: '',
      inspectionReasons: [],
      inspectionDate: new Date().toISOString().split('T')[0],
      inspectionTime: '',
      presentProfessionals: '',
      weatherConditions: '',
      inspectedSectors: '',
      inspectionMethod: '',
      limitations: '',
      findings: [],
      photos: [],
      regulations: [],
      recommendations: '',
      conclusions: '',
      architectSignature: undefined,
      civilEngineerName: '',
      civilEngineerReg: '',
      civilEngineerSignature: undefined,
      riskPrevName: '',
      riskPrevReg: '',
      riskPrevSignature: undefined,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setStep(1);
    setActiveTab('new');
  };

  const handleSaveDraft = async () => {
    if (!currentReport) return;
    
    // Check approximate size (Firestore limit is 1MB, let's limit to 900KB)
    const reportSize = new Blob([JSON.stringify(currentReport)]).size;
    if (reportSize > 900 * 1024) {
      toast.error('El informe es demasiado grande (excede 900KB). Reduce la cantidad de fotos o usa imágenes más pequeñas.');
      return;
    }

    try {
      if (reports.find(r => r.id === currentReport.id)) {
        await firestoreService.update('archReports', currentReport.id, currentReport);
      } else {
        await firestoreService.add('archReports', currentReport);
      }
      toast.success('Borrador guardado');
      fetchReports();
    } catch (e) {
      toast.error('Error al guardar borrador');
    }
  };

  const handleAIContentChange = (field: keyof NonNullable<ArchReport['aiContent']>, value: string) => {
    if (!currentReport || !currentReport.aiContent) return;
    setCurrentReport({
      ...currentReport,
      aiContent: {
        ...currentReport.aiContent,
        [field]: value
      }
    });
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    toast.info('Generando informe con IA...');
    try {
      const payloadReport = { ...currentReport };
      delete payloadReport.aiContent;
      if (payloadReport.photos) {
        payloadReport.photos = payloadReport.photos.map(p => ({ ...p, url: '[FOTO_ADJUNTA]' }));
      }
      if (payloadReport.findings) {
        payloadReport.findings = payloadReport.findings.map(f => ({ ...f, photo: f.photo ? '[FOTO_ADJUNTA]' : undefined }));
      }

      // call server
      const response = await fetch('/api/gemini/generate-arch-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: payloadReport })
      });
      if (!response.ok) throw new Error('Error en API');
      const data = await response.json();
      
      const updated = {
        ...currentReport!,
        aiContent: data.content
      };
      setCurrentReport(updated);
      await firestoreService.update('archReports', updated.id, updated);
      toast.success('Informe generado con éxito');
    } catch (e) {
      console.error(e);
      toast.error('Error al generar con IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportWord = async () => {
    if (!currentReport || !currentReport.aiContent) return;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `Informe Técnico: ${currentReport.number}`,
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [new TextRun({ text: `Cliente: ${currentReport.client}`, bold: true })]
          }),
          new Paragraph({ text: `Dirección: ${currentReport.address}, ${currentReport.commune}` }),
          new Paragraph({ text: "" }),
          ...Object.entries(currentReport.aiContent).flatMap(([key, value]) => [
            new Paragraph({ text: key.toUpperCase(), heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: value as string })
          ])
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${currentReport.number}.docx`);
    toast.success('Documento Word generado');
  };

  const handleCheckboxChange = (field: keyof ArchReport, value: string) => {
    if (!currentReport) return;
    const currentList = (currentReport[field] as string[]) || [];
    const newList = currentList.includes(value) 
      ? currentList.filter(item => item !== value)
      : [...currentList, value];
    updateField(field, newList);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64, 600, 0.5);
        callback(compressed);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Error al procesar la imagen');
    }
  };

  const renderStep2 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-lg font-bold">Motivo de Inspección</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Resolución Municipal', 'Denuncia', 'Solicitud Particular', 'Recepción', 'Venta', 'Mantención', 'Evaluación estructural', 'Otro'].map(motivo => (
          <Label key={motivo} className="flex items-center gap-2 p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
            <input 
              type="checkbox" 
              checked={currentReport?.inspectionReasons?.includes(motivo) || false}
              onChange={() => handleCheckboxChange('inspectionReasons', motivo)}
              className="rounded border-neutral-300 text-blue-600 focus:ring-blue-600 w-4 h-4"
            />
            <span className="text-sm">{motivo}</span>
          </Label>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-lg font-bold">Detalles de Inspección</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha de Inspección</Label>
          <Input type="date" value={currentReport?.inspectionDate || ''} onChange={e => updateField('inspectionDate', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Hora</Label>
          <Input type="time" value={currentReport?.inspectionTime || ''} onChange={e => updateField('inspectionTime', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Profesionales Presentes</Label>
          <Input value={currentReport?.presentProfessionals || ''} onChange={e => updateField('presentProfessionals', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Condiciones Climáticas</Label>
          <Input value={currentReport?.weatherConditions || ''} onChange={e => updateField('weatherConditions', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Método de Inspección</Label>
          <Input value={currentReport?.inspectionMethod || ''} onChange={e => updateField('inspectionMethod', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Sectores Inspeccionados</Label>
          <Textarea value={currentReport?.inspectedSectors || ''} onChange={e => updateField('inspectedSectors', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Limitaciones de la Inspección</Label>
          <Textarea value={currentReport?.limitations || ''} onChange={e => updateField('limitations', e.target.value)} />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const findings = currentReport?.findings || [];
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Hallazgos Registrados</h3>
          <Button size="sm" onClick={() => {
            const newFinding: ArchFinding = {
              id: crypto.randomUUID(), element: '', location: '', description: '', state: '', deteriorationLevel: '', probableCause: '', riskLevel: '', observations: ''
            };
            updateField('findings', [...findings, newFinding]);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Agregar Hallazgo
          </Button>
        </div>
        <div className="space-y-4">
          {findings.map((finding, idx) => (
            <Card key={finding.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardContent className="p-4 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="ghost" size="icon" 
                  className="absolute top-2 right-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                  onClick={() => updateField('findings', findings.filter(f => f.id !== finding.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="space-y-2"><Label>Elemento</Label><Input value={finding.element} onChange={e => { const f = [...findings]; f[idx].element = e.target.value; updateField('findings', f); }} /></div>
                <div className="space-y-2"><Label>Ubicación</Label><Input value={finding.location} onChange={e => { const f = [...findings]; f[idx].location = e.target.value; updateField('findings', f); }} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Descripción</Label><Textarea value={finding.description} onChange={e => { const f = [...findings]; f[idx].description = e.target.value; updateField('findings', f); }} /></div>
                <div className="space-y-2"><Label>Estado</Label><Input value={finding.state} onChange={e => { const f = [...findings]; f[idx].state = e.target.value; updateField('findings', f); }} /></div>
                <div className="space-y-2"><Label>Nivel de Riesgo</Label><Input value={finding.riskLevel} onChange={e => { const f = [...findings]; f[idx].riskLevel = e.target.value; updateField('findings', f); }} /></div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Fotografía (Opcional)</Label>
                  <div className="flex items-center gap-4">
                    {finding.photo ? (
                      <div className="relative w-32 h-32 border rounded-xl overflow-hidden group">
                        <img src={finding.photo} alt="Hallazgo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                          <Button size="icon" variant="destructive" onClick={() => { const f = [...findings]; f[idx].photo = undefined; updateField('findings', f); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
                        <Upload className="h-6 w-6 text-neutral-400 mb-2" />
                        <span className="text-xs text-neutral-500">Subir Foto</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, (base64) => { const f = [...findings]; f[idx].photo = base64; updateField('findings', f); })} />
                      </Label>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {findings.length === 0 && <p className="text-sm text-neutral-500 text-center py-4">No hay hallazgos registrados.</p>}
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    const photos = currentReport?.photos || [];
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Galería de Fotografías</h3>
          <Button size="sm" onClick={() => {
            const newPhoto: ArchPhoto = { id: crypto.randomUUID(), title: '', description: '', location: '', url: '' };
            updateField('photos', [...photos, newPhoto]);
          }}>
            <Camera className="mr-2 h-4 w-4" /> Agregar Fotografía
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, idx) => (
            <Card key={photo.id} className="overflow-hidden">
              <div className="h-40 bg-neutral-100 flex items-center justify-center relative border-b group">
                {photo.url ? (
                  <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                ) : (
                  <Label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-neutral-200 transition-colors">
                    <Upload className="h-8 w-8 text-neutral-400 mb-2" />
                    <span className="text-sm text-neutral-500 font-medium">Subir Imagen</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, (base64) => { const p = [...photos]; p[idx].url = base64; updateField('photos', p); })} />
                  </Label>
                )}
                <Button 
                  variant="ghost" size="icon" 
                  className="absolute top-2 right-2 bg-white/80 hover:bg-rose-50 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => updateField('photos', photos.filter(p => p.id !== photo.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1"><Label className="text-xs">Título</Label><Input size={1} value={photo.title} onChange={e => { const p = [...photos]; p[idx].title = e.target.value; updateField('photos', p); }} /></div>
                <div className="space-y-1"><Label className="text-xs">Ubicación / Detalle</Label><Input size={1} value={photo.location} onChange={e => { const p = [...photos]; p[idx].location = e.target.value; updateField('photos', p); }} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const isOtherSelected = currentReport?.regulations?.includes('Otra');
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <h3 className="text-lg font-bold">Normativa Aplicable</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {['LGUC', 'OGUC', 'Normas Chilenas (NCh)', 'Resolución Municipal', 'PRC', 'Otra'].map(norma => (
            <Label key={norma} className="flex items-center gap-2 p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
              <input 
                type="checkbox" 
                checked={currentReport?.regulations?.includes(norma) || false}
                onChange={() => handleCheckboxChange('regulations', norma)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-600 w-4 h-4"
              />
              <span className="text-sm">{norma}</span>
            </Label>
          ))}
        </div>
        {isOtherSelected && (
          <div className="space-y-2 mt-4">
            <Label>Especifique otra normativa</Label>
            <Input 
              value={currentReport?.otherRegulation || ''} 
              onChange={e => updateField('otherRegulation', e.target.value)} 
              placeholder="Ingrese la normativa específica..."
            />
          </div>
        )}
      </div>
    );
  };

  const renderStep7 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h3 className="text-lg font-bold">Recomendaciones, Conclusiones y Firmas Electrónicas</h3>
        <p className="text-sm text-neutral-500">Ingrese las conclusiones finales y registre las firmas electrónicas del equipo profesional.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Recomendaciones</Label>
          <Textarea className="min-h-[120px]" value={currentReport?.recommendations || ''} onChange={e => updateField('recommendations', e.target.value)} placeholder="Indique las recomendaciones técnicas..." />
        </div>
        <div className="space-y-2">
          <Label>Conclusiones Preliminares / Finales</Label>
          <Textarea className="min-h-[120px]" value={currentReport?.conclusions || ''} onChange={e => updateField('conclusions', e.target.value)} placeholder="Resuma las conclusiones técnicas..." />
        </div>
      </div>

      <div className="pt-6 border-t border-neutral-200 space-y-4">
        <div className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-blue-600" />
          <h4 className="font-bold text-md text-neutral-900">Firmas Electrónicas del Equipo Profesional</h4>
        </div>
        <p className="text-xs text-neutral-500">
          Dibuje la firma electrónica directamente en el cuadro correspondiente para el Arquitecto, Ingeniero Civil y Prevencionista de Riesgos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <SignaturePad
            title="Arquitecto / Prof. Responsable"
            role="Nombre Arquitecto / Profesional"
            name={currentReport?.professional || ''}
            onNameChange={(val) => updateField('professional', val)}
            signature={currentReport?.architectSignature}
            onSignatureChange={(sig) => updateField('architectSignature', sig)}
            placeholderName="Ej: Arq. Juan Pérez"
          />

          <SignaturePad
            title="Ingeniero Civil"
            role="Nombre Ingeniero Civil"
            name={currentReport?.civilEngineerName || ''}
            onNameChange={(val) => updateField('civilEngineerName', val)}
            regNumber={currentReport?.civilEngineerReg || ''}
            onRegNumberChange={(val) => updateField('civilEngineerReg', val)}
            regLabel="N° Reg. / RUT"
            signature={currentReport?.civilEngineerSignature}
            onSignatureChange={(sig) => updateField('civilEngineerSignature', sig)}
            placeholderName="Ej: Ing. Roberto Gómez"
          />

          <SignaturePad
            title="Prevencionista de Riesgos"
            role="Nombre Prevencionista de Riesgos"
            name={currentReport?.riskPrevName || ''}
            onNameChange={(val) => updateField('riskPrevName', val)}
            regNumber={currentReport?.riskPrevReg || ''}
            onRegNumberChange={(val) => updateField('riskPrevReg', val)}
            regLabel="N° Reg. SNS / RUT"
            signature={currentReport?.riskPrevSignature}
            onSignatureChange={(sig) => updateField('riskPrevSignature', sig)}
            placeholderName="Ej: Carlos Silva"
          />
        </div>
      </div>
    </div>
  );

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

  const handleExportPDF = async () => {
    if (!currentReport) return;
    const doc = new jsPDF();

    const drawHeader = async (pageTitle: string) => {
      try {
        const logoUrl = `${window.location.origin}/logo.png`;
        const logoData = await getBase64ImageFromURL(logoUrl);
        doc.addImage(logoData, 'PNG', 20, 10, 40, 20);
      } catch (e) {
        console.warn('Logo could not be loaded for PDF', e);
      }

      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('INFORME TÉCNICO DE ARQUITECTURA', 190, 20, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(pageTitle, 190, 28, { align: 'right' });
      
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 35, 190, 35);
    };

    const drawFooter = (pageNumber: number) => {
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      doc.setDrawColor(200, 200, 200);
      doc.line(20, pageHeight - 15, 190, pageHeight - 15);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Informe N°: ${currentReport.number} - Generado el: ${new Date().toLocaleDateString()}`, 20, pageHeight - 8);
      doc.text(`Página ${pageNumber}`, 180, pageHeight - 8);
    };

    await drawHeader('INFORMACIÓN GENERAL');

    // General Info Box
    doc.setFillColor(245, 247, 250);
    doc.rect(20, 45, 170, 50, 'F');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    doc.setFont('helvetica', 'bold');
    doc.text('N° Informe:', 25, 55);
    doc.text('Fecha:', 110, 55);
    doc.text('Cliente:', 25, 65);
    doc.text('Profesional:', 110, 65);
    doc.text('Dirección:', 25, 75);
    doc.text('Comuna:', 110, 75);
    doc.text('Región:', 25, 85);
    
    doc.setFont('helvetica', 'normal');
    doc.text(currentReport.number || '-', 50, 55);
    doc.text(currentReport.date || '-', 130, 55);
    doc.text(currentReport.client || '-', 50, 65);
    doc.text(currentReport.professional || '-', 140, 65);
    doc.text(currentReport.address || '-', 50, 75);
    doc.text(currentReport.commune || '-', 130, 75);
    doc.text(currentReport.region || '-', 50, 85);

    let currentY = 105;

    // AI Content Section
    if (currentReport.aiContent) {
      const sections = [
        { title: '1. Antecedentes', content: currentReport.aiContent.antecedentes },
        { title: '2. Objetivo', content: currentReport.aiContent.objetivo },
        { title: '3. Metodología', content: currentReport.aiContent.metodologia },
        { title: '4. Descripción del inmueble', content: currentReport.aiContent.descripcion },
        { title: '5. Observaciones', content: currentReport.aiContent.observaciones },
        { title: '6. Análisis técnico', content: currentReport.aiContent.analisis },
        { title: '7. Evaluación del riesgo', content: currentReport.aiContent.evaluacion },
        { title: '8. Conclusiones', content: currentReport.aiContent.conclusiones },
        { title: '9. Recomendaciones', content: currentReport.aiContent.recomendaciones },
        { title: '10. Anexos', content: currentReport.aiContent.anexos }
      ];

      let pageNum = 1;

      for (const section of sections) {
        if (!section.content) continue;

        if (currentY > 250) {
          drawFooter(pageNum);
          doc.addPage();
          pageNum++;
          await drawHeader('CONTENIDO TÉCNICO');
          currentY = 45;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 128, 185);
        doc.text(section.title, 20, currentY);
        currentY += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const splitText = doc.splitTextToSize(section.content, 170);
        
        for (let i = 0; i < splitText.length; i++) {
          if (currentY > 270) {
            drawFooter(pageNum);
            doc.addPage();
            pageNum++;
            await drawHeader('CONTENIDO TÉCNICO');
            currentY = 45;
          }
          doc.text(splitText[i], 20, currentY);
          currentY += 6;
        }
        currentY += 10;
      }
      
      // Findings Section
      if (currentReport.findings && currentReport.findings.length > 0) {
        drawFooter(pageNum);
        doc.addPage();
        pageNum++;
        await drawHeader('HALLAZGOS REGISTRADOS');
        currentY = 45;

        for (const finding of currentReport.findings) {
          const findingHeight = finding.photo ? 145 : 85;
          if (currentY + findingHeight > 270) {
            drawFooter(pageNum);
            doc.addPage();
            pageNum++;
            await drawHeader('HALLAZGOS REGISTRADOS');
            currentY = 45;
          }

          doc.setFillColor(245, 247, 250);
          doc.rect(20, currentY, 170, 75, 'F');
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(41, 128, 185);
          doc.text(`Elemento: ${finding.element}`, 25, currentY + 10);
          
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.setFont('helvetica', 'bold');
          doc.text('Ubicación:', 25, currentY + 20);
          doc.setFont('helvetica', 'normal');
          doc.text(finding.location || '-', 60, currentY + 20);
          
          doc.setFont('helvetica', 'bold');
          doc.text('Estado:', 110, currentY + 20);
          doc.setFont('helvetica', 'normal');
          doc.text(finding.state || '-', 130, currentY + 20);
          
          doc.setFont('helvetica', 'bold');
          doc.text('Nivel Riesgo:', 25, currentY + 30);
          doc.setFont('helvetica', 'normal');
          doc.text(finding.riskLevel || '-', 60, currentY + 30);
          
          doc.setFont('helvetica', 'bold');
          doc.text('Descripción:', 25, currentY + 40);
          doc.setFont('helvetica', 'normal');
          const descLines = doc.splitTextToSize(finding.description || '-', 160);
          doc.text(descLines, 25, currentY + 45);

          if (finding.photo) {
             try {
               const photoHeight = 60;
               currentY += 75;
               doc.addImage(finding.photo, 'JPEG', 65, currentY, 80, photoHeight);
               currentY += photoHeight + 10;
             } catch(e) {
               console.warn("Could not add finding photo to PDF");
               currentY += 85;
             }
          } else {
            currentY += 85;
          }
        }
      }

      // Photos Gallery Section
      if (currentReport.photos && currentReport.photos.length > 0) {
        drawFooter(pageNum);
        doc.addPage();
        pageNum++;
        await drawHeader('REGISTRO FOTOGRÁFICO');
        currentY = 45;

        // Print 2 photos per row, max 4 per page
        let col = 0;
        let row = 0;
        
        for (const photo of currentReport.photos) {
          if (!photo.url) continue;

          if (row > 1) { // Next page if more than 2 rows (4 photos)
            drawFooter(pageNum);
            doc.addPage();
            pageNum++;
            await drawHeader('REGISTRO FOTOGRÁFICO');
            currentY = 45;
            col = 0;
            row = 0;
          }

          const x = col === 0 ? 20 : 105;
          const y = currentY + (row * 110);
          
          try {
            doc.addImage(photo.url, 'JPEG', x, y, 80, 60);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(41, 128, 185);
            doc.text(photo.title || 'Sin Título', x, y + 70);
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(photo.location || 'Sin Ubicación', x, y + 76);
          } catch(e) {
             console.warn("Could not add photo to gallery");
          }

          col++;
          if (col > 1) {
            col = 0;
            row++;
          }
        }
        
        currentY = currentY + (row * 110) + (col > 0 ? 110 : 0);
      }

      // Signature Section
      if (currentY > 200) {
        drawFooter(pageNum);
        doc.addPage();
        pageNum++;
        await drawHeader('CIERRE Y FIRMAS');
        currentY = 45;
      } else {
        currentY += 25;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('VALIDACIÓN TÉCNICA Y FIRMAS ELECTRÓNICAS', 20, currentY);
      currentY += 10;

      const sigs = [
        {
          role: 'Arquitecto / Prof. a Cargo',
          name: currentReport.professional || 'Profesional Responsable',
          reg: '',
          signature: currentReport.architectSignature
        },
        {
          role: 'Ingeniero Civil',
          name: currentReport.civilEngineerName || 'Ingeniero Civil',
          reg: currentReport.civilEngineerReg ? `Reg/RUT: ${currentReport.civilEngineerReg}` : '',
          signature: currentReport.civilEngineerSignature
        },
        {
          role: 'Prevencionista de Riesgos',
          name: currentReport.riskPrevName || 'Prevencionista de Riesgos',
          reg: currentReport.riskPrevReg ? `Reg/RUT: ${currentReport.riskPrevReg}` : '',
          signature: currentReport.riskPrevSignature
        }
      ];

      const colWidth = 52;
      const startX = 20;
      const gap = 7;

      for (let i = 0; i < sigs.length; i++) {
        const s = sigs[i];
        const x = startX + i * (colWidth + gap);

        if (s.signature) {
          try {
            doc.addImage(s.signature, 'PNG', x + 6, currentY, 40, 20);
          } catch(e) {
            console.warn("Could not add signature image to PDF");
          }
        }

        const lineY = currentY + 22;
        doc.setDrawColor(180, 180, 180);
        doc.line(x, lineY, x + colWidth, lineY);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(s.role, x + colWidth / 2, lineY + 5, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(s.name, x + colWidth / 2, lineY + 10, { align: 'center' });

        if (s.reg) {
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text(s.reg, x + colWidth / 2, lineY + 14, { align: 'center' });
        }
      }

      if (currentReport.client) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(`Cliente / Mandante: ${currentReport.client}`, 105, currentY + 45, { align: 'center' });
      }

      drawFooter(pageNum);
    } else {
      drawFooter(1);
    }

    doc.save(`Informe_Arquitectura_${currentReport.number}.pdf`);
    toast.success('PDF generado con éxito');
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Arquitectura</h2>
          <p className="text-neutral-500 text-sm">Resumen de informes técnicos e inspecciones</p>
        </div>
        <Button onClick={handleStartNew} className="rounded-xl bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Informe
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Total Informes</p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Borradores</p>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === 'draft').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                <Check size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Completados</p>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">Resoluciones</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* List of recent reports */}
      <Card className="rounded-2xl shadow-sm border-neutral-200">
        <CardHeader>
          <CardTitle>Últimos Informes</CardTitle>
          <CardDescription>Informes técnicos recientes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.slice(0, 5).map(report => (
              <div key={report.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                <div>
                  <h4 className="font-bold text-sm text-neutral-900">{report.number} - {report.client || 'Sin cliente'}</h4>
                  <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {report.address || 'Sin dirección'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-[10px]", report.status === 'completed' ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                    {report.status === 'completed' ? 'Completado' : 'Borrador'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setCurrentReport(report); setStep(1); setActiveTab('new'); }}>
                    Editar
                  </Button>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">No hay informes registrados</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStepper = () => (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
        <div key={s} className="flex flex-col items-center gap-2 min-w-[60px] cursor-pointer" onClick={() => setStep(s)}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
            step === s ? "bg-blue-600 text-white shadow-md" : 
            step > s ? "bg-blue-100 text-blue-700" : "bg-neutral-100 text-neutral-400"
          )}>
            {s}
          </div>
          <span className="text-[10px] font-medium text-neutral-500 whitespace-nowrap hidden sm:block">
            {s === 1 ? 'General' : s === 2 ? 'Motivo' : s === 3 ? 'Inspección' : s === 4 ? 'Hallazgos' : s === 5 ? 'Fotos' : s === 6 ? 'Normativa' : s === 7 ? 'Firmas' : 'Informe IA'}
          </span>
        </div>
      ))}
    </div>
  );

  const updateField = (field: keyof ArchReport, value: any) => {
    if (currentReport) setCurrentReport({ ...currentReport, [field]: value });
  };

  const renderStep1 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-lg font-bold">Información General</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Informe</Label>
          <Input value={currentReport?.number || ''} disabled className="bg-neutral-50" />
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input type="date" value={currentReport?.date || ''} onChange={e => updateField('date', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Input value={currentReport?.client || ''} onChange={e => updateField('client', e.target.value)} placeholder="Nombre del cliente o empresa" />
        </div>
        <div className="space-y-2">
          <Label>Arquitecto / Prof. Responsable</Label>
          <Input value={currentReport?.professional || ''} onChange={e => updateField('professional', e.target.value)} placeholder="Nombre del Arquitecto" />
        </div>
        <div className="space-y-2">
          <Label>Ingeniero Civil</Label>
          <Input value={currentReport?.civilEngineerName || ''} onChange={e => updateField('civilEngineerName', e.target.value)} placeholder="Nombre del Ingeniero Civil" />
        </div>
        <div className="space-y-2">
          <Label>Prevencionista de Riesgos</Label>
          <Input value={currentReport?.riskPrevName || ''} onChange={e => updateField('riskPrevName', e.target.value)} placeholder="Nombre del Prevencionista" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Dirección</Label>
          <Input value={currentReport?.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="Calle y número" />
        </div>
        <div className="space-y-2">
          <Label>Comuna</Label>
          <Input value={currentReport?.commune || ''} onChange={e => updateField('commune', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Región</Label>
          <Input value={currentReport?.region || ''} onChange={e => updateField('region', e.target.value)} />
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="text-blue-500" /> Generación de Informe IA</h3>
          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-neutral-600">
                La Inteligencia Artificial analizará todos los datos ingresados (hallazgos, motivo de inspección, ubicación) y redactará un informe técnico completo siguiendo el estándar de arquitectura.
              </p>
              <Button onClick={handleGenerateAI} disabled={isGenerating} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                {isGenerating ? 'Generando...' : <><Wand2 className="mr-2 h-4 w-4" /> Generar Informe Completo</>}
              </Button>
            </CardContent>
          </Card>

          {currentReport?.aiContent && (
            <div className="space-y-4 mt-6">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown size={14} className="mr-1" /> Exportar PDF</Button>
                <Button variant="outline" size="sm" onClick={handleExportWord}><FileDown size={14} className="mr-1" /> Exportar Word</Button>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Vista Previa del Informe</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm text-neutral-700">
                  <div className="space-y-2"><Label className="font-bold">1. Antecedentes</Label><Textarea value={currentReport.aiContent.antecedentes} onChange={(e) => handleAIContentChange('antecedentes', e.target.value)} rows={3} /></div>
                  <div className="space-y-2"><Label className="font-bold">2. Objetivo</Label><Textarea value={currentReport.aiContent.objetivo} onChange={(e) => handleAIContentChange('objetivo', e.target.value)} rows={3} /></div>
                  <div className="space-y-2"><Label className="font-bold">3. Metodología</Label><Textarea value={currentReport.aiContent.metodologia} onChange={(e) => handleAIContentChange('metodologia', e.target.value)} rows={3} /></div>
                  <div className="space-y-2"><Label className="font-bold">4. Descripción del inmueble</Label><Textarea value={currentReport.aiContent.descripcion} onChange={(e) => handleAIContentChange('descripcion', e.target.value)} rows={4} /></div>
                  <div className="space-y-2"><Label className="font-bold">5. Observaciones</Label><Textarea value={currentReport.aiContent.observaciones} onChange={(e) => handleAIContentChange('observaciones', e.target.value)} rows={5} /></div>
                  <div className="space-y-2"><Label className="font-bold">6. Análisis técnico</Label><Textarea value={currentReport.aiContent.analisis} onChange={(e) => handleAIContentChange('analisis', e.target.value)} rows={5} /></div>
                  <div className="space-y-2"><Label className="font-bold">7. Evaluación del riesgo</Label><Textarea value={currentReport.aiContent.evaluacion} onChange={(e) => handleAIContentChange('evaluacion', e.target.value)} rows={4} /></div>
                  <div className="space-y-2"><Label className="font-bold">8. Conclusiones</Label><Textarea value={currentReport.aiContent.conclusiones} onChange={(e) => handleAIContentChange('conclusiones', e.target.value)} rows={4} /></div>
                  <div className="space-y-2"><Label className="font-bold">9. Recomendaciones</Label><Textarea value={currentReport.aiContent.recomendaciones} onChange={(e) => handleAIContentChange('recomendaciones', e.target.value)} rows={4} /></div>
                  <div className="space-y-2"><Label className="font-bold">10. Anexos</Label><Textarea value={currentReport.aiContent.anexos} onChange={(e) => handleAIContentChange('anexos', e.target.value)} rows={3} /></div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      );
      default: return null;
    }
  };

  const renderNewReport = () => (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setActiveTab('dashboard')} className="text-neutral-500 hover:text-neutral-900">
          <ChevronLeft className="mr-1 h-4 w-4" /> Volver al Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>Guardar Borrador</Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { updateField('status', 'completed'); handleSaveDraft(); }}>
            Finalizar Informe
          </Button>
        </div>
      </div>

      <Card className="rounded-[2rem] border-0 shadow-xl bg-white overflow-hidden">
        <div className="p-6 md:p-8 bg-neutral-900 text-white">
          <h2 className="text-2xl font-bold">Nuevo Informe Técnico</h2>
          <p className="text-neutral-400 text-sm mt-1">{currentReport?.number}</p>
        </div>
        <CardContent className="p-6 md:p-8">
          {renderStepper()}
          
          <div className="min-h-[400px]">
            {renderCurrentStep()}
          </div>

          <div className="flex items-center justify-between pt-8 mt-8 border-t border-neutral-100">
            <Button 
              variant="outline" 
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              Anterior
            </Button>
            <Button 
              onClick={() => setStep(s => Math.min(8, s + 1))}
              disabled={step === 8}
            >
              Siguiente <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="w-full">
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'new' && renderNewReport()}
    </div>
  );
}
