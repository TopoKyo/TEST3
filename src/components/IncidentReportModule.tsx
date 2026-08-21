import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Trash2, Camera, Save, Download, Clock, MapPin, AlertTriangle, FileText, ChevronLeft, Calendar } from 'lucide-react';
import { IncidentReport, IncidentReportPhoto } from '../types';
import { firestoreService } from '../lib/firestoreService';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function IncidentReportModule() {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [activeReport, setActiveReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await firestoreService.getAll<IncidentReport>('incidentReports');
      setReports(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newReport: IncidentReport = {
      id: Math.random().toString(36).substr(2, 9),
      projectId: '',
      projectName: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      reporter: '',
      area: '',
      location: '',
      description: '',
      severity: 'Media',
      type: 'Seguridad',
      immediateAction: '',
      photos: [],
      status: 'Abierto',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setActiveReport(newReport);
  };

  const handleSave = async () => {
    if (!activeReport) return;
    if (!activeReport.projectName || !activeReport.description) {
      toast.error('Proyecto y descripción son obligatorios');
      return;
    }

    try {
      const isExisting = reports.some(r => r.id === activeReport.id);
      activeReport.updatedAt = new Date().toISOString();
      
      if (isExisting) {
        await firestoreService.update('incidentReports', activeReport.id, activeReport);
        setReports(prev => prev.map(r => r.id === activeReport.id ? activeReport : r));
      } else {
        await firestoreService.add('incidentReports', activeReport);
        setReports(prev => [activeReport, ...prev]);
      }
      
      toast.success('Reporte guardado correctamente');
      setActiveReport(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar el reporte');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este reporte de incidencia?')) return;
    try {
      await firestoreService.delete('incidentReports', id);
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success('Reporte eliminado');
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeReport) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: IncidentReportPhoto = {
        id: Math.random().toString(36).substr(2, 9),
        url: reader.result as string,
        description: ''
      };
      setActiveReport({
        ...activeReport,
        photos: [...activeReport.photos, newPhoto]
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExportExcel = async (report: IncidentReport) => {
    try {
      toast.info('Generando reporte en Excel...');
      
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Incidencia');

      // Add logo
      let logoBase64 = null;
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('Could not load logo', err);
      }

      if (logoBase64) {
        const imageId = workbook.addImage({
          base64: logoBase64,
          extension: 'png',
        });
        sheet.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 120, height: 60 }
        });
      }

      // Formatting
      sheet.getColumn('A').width = 20;
      sheet.getColumn('B').width = 40;
      sheet.getColumn('C').width = 20;
      sheet.getColumn('D').width = 40;

      // Title
      sheet.mergeCells('A4:D4');
      const titleCell = sheet.getCell('A4');
      titleCell.value = 'REPORTE DE INCIDENCIA';
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };

      // Data
      sheet.getCell('A6').value = 'Proyecto:';
      sheet.getCell('A6').font = { bold: true };
      sheet.getCell('B6').value = report.projectName;

      sheet.getCell('C6').value = 'Fecha:';
      sheet.getCell('C6').font = { bold: true };
      sheet.getCell('D6').value = report.date;

      sheet.getCell('A7').value = 'Reportado por:';
      sheet.getCell('A7').font = { bold: true };
      sheet.getCell('B7').value = report.reporter;

      sheet.getCell('C7').value = 'Hora:';
      sheet.getCell('C7').font = { bold: true };
      sheet.getCell('D7').value = report.time;

      sheet.getCell('A8').value = 'Área:';
      sheet.getCell('A8').font = { bold: true };
      sheet.getCell('B8').value = report.area;

      sheet.getCell('C8').value = 'Ubicación:';
      sheet.getCell('C8').font = { bold: true };
      sheet.getCell('D8').value = report.location;

      sheet.getCell('A9').value = 'Tipo:';
      sheet.getCell('A9').font = { bold: true };
      sheet.getCell('B9').value = report.type;

      sheet.getCell('C9').value = 'Severidad:';
      sheet.getCell('C9').font = { bold: true };
      sheet.getCell('D9').value = report.severity;

      // Description
      sheet.mergeCells('A11:D11');
      const descTitle = sheet.getCell('A11');
      descTitle.value = 'DESCRIPCIÓN DE LA INCIDENCIA';
      descTitle.font = { bold: true };
      descTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

      sheet.mergeCells('A12:D14');
      const descContent = sheet.getCell('A12');
      descContent.value = report.description;
      descContent.alignment = { wrapText: true, vertical: 'top' };

      // Action
      sheet.mergeCells('A16:D16');
      const actionTitle = sheet.getCell('A16');
      actionTitle.value = 'ACCIÓN INMEDIATA TOMADA';
      actionTitle.font = { bold: true };
      actionTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

      sheet.mergeCells('A17:D19');
      const actionContent = sheet.getCell('A17');
      actionContent.value = report.immediateAction;
      actionContent.alignment = { wrapText: true, vertical: 'top' };

      // Photos
      sheet.mergeCells('A21:D21');
      const photoTitle = sheet.getCell('A21');
      photoTitle.value = 'EVIDENCIA FOTOGRÁFICA';
      photoTitle.font = { bold: true };
      photoTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

      let currentRow = 23;
      for (const photo of report.photos) {
        try {
          sheet.getCell(`A${currentRow}`).value = photo.description || 'Sin descripción';
          sheet.getCell(`A${currentRow}`).font = { bold: true };
          
          const imgId = workbook.addImage({
            base64: photo.url,
            extension: 'png',
          });
          sheet.addImage(imgId, {
            tl: { col: 0, row: currentRow },
            ext: { width: 300, height: 200 }
          });
          
          currentRow += 12; // Leave space for the image
        } catch (e) {
          console.error('Error adding image to excel', e);
        }
      }

      // Borders
      const setBorder = (cell: string) => {
        sheet.getCell(cell).border = {
          top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
        };
      };
      
      const boxes = ['A6','B6','C6','D6','A7','B7','C7','D7','A8','B8','C8','D8','A9','B9','C9','D9', 'A11', 'A12', 'A16', 'A17'];
      boxes.forEach(setBorder);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Incidencia-${report.projectName.replace(/\s+/g, '_')}-${report.date}.xlsx`);
      
      toast.success('Reporte Excel descargado');
    } catch (error) {
      console.error(error);
      toast.error('Error al generar Excel');
    }
  };

  const filteredReports = reports.filter(r => 
    r.projectName.toLowerCase().includes(search.toLowerCase()) || 
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            Reporte de Incidencias
          </h1>
          <p className="text-neutral-500">Documenta, adjunta evidencia y exporta reportes de incidentes</p>
        </div>

        {!activeReport && (
          <Button onClick={handleCreateNew} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Reporte
          </Button>
        )}
      </div>

      {activeReport ? (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-neutral-50/50 pb-4">
            <div>
              <CardTitle>Detalles del Reporte</CardTitle>
              <CardDescription>Completa la información de la incidencia</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setActiveReport(null)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
              <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="mr-2 h-4 w-4" />
                Guardar Reporte
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Proyecto <span className="text-red-500">*</span></Label>
                <Input 
                  value={activeReport.projectName}
                  onChange={(e) => setActiveReport({...activeReport, projectName: e.target.value})}
                  placeholder="Nombre del proyecto"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input 
                  type="date"
                  value={activeReport.date}
                  onChange={(e) => setActiveReport({...activeReport, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input 
                  type="time"
                  value={activeReport.time}
                  onChange={(e) => setActiveReport({...activeReport, time: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Reportado por</Label>
                <Input 
                  value={activeReport.reporter}
                  onChange={(e) => setActiveReport({...activeReport, reporter: e.target.value})}
                  placeholder="Nombre del responsable"
                />
              </div>
              <div className="space-y-2">
                <Label>Área / Sector</Label>
                <Input 
                  value={activeReport.area}
                  onChange={(e) => setActiveReport({...activeReport, area: e.target.value})}
                  placeholder="Ej: Subterráneo, Torre A"
                />
              </div>
              <div className="space-y-2">
                <Label>Ubicación Específica</Label>
                <Input 
                  value={activeReport.location}
                  onChange={(e) => setActiveReport({...activeReport, location: e.target.value})}
                  placeholder="Ej: Eje 4, nivel -2"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Incidencia</Label>
                <Select value={activeReport.type} onValueChange={(v: any) => setActiveReport({...activeReport, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Seguridad">Seguridad (SSO)</SelectItem>
                    <SelectItem value="Calidad">Calidad</SelectItem>
                    <SelectItem value="Medio Ambiente">Medio Ambiente</SelectItem>
                    <SelectItem value="Operacional">Operacional</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severidad</Label>
                <Select value={activeReport.severity} onValueChange={(v: any) => setActiveReport({...activeReport, severity: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">Baja</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Crítica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción de la incidencia <span className="text-red-500">*</span></Label>
              <Textarea 
                value={activeReport.description}
                onChange={(e) => setActiveReport({...activeReport, description: e.target.value})}
                placeholder="Describe detalladamente qué sucedió..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Acción inmediata tomada</Label>
              <Textarea 
                value={activeReport.immediateAction}
                onChange={(e) => setActiveReport({...activeReport, immediateAction: e.target.value})}
                placeholder="¿Qué medidas de mitigación se tomaron al momento de identificar la incidencia?"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Evidencia Fotográfica</h3>
                  <p className="text-sm text-neutral-500">Sube fotos relacionadas a la incidencia</p>
                </div>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="mr-2 h-4 w-4" />
                  Añadir Foto
                </Button>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                />
              </div>

              {activeReport.photos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {activeReport.photos.map((photo, index) => (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border">
                      <img src={photo.url} alt={`Evidencia ${index + 1}`} className="w-full h-48 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <div className="flex justify-end">
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setActiveReport({
                              ...activeReport,
                              photos: activeReport.photos.filter(p => p.id !== photo.id)
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="bg-white p-2 border-t">
                        <Input 
                          placeholder="Descripción (opcional)" 
                          className="h-8 text-sm"
                          value={photo.description}
                          onChange={(e) => {
                            const newPhotos = [...activeReport.photos];
                            newPhotos[index].description = e.target.value;
                            setActiveReport({...activeReport, photos: newPhotos});
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-neutral-50 rounded-xl border border-dashed border-neutral-300 p-8 text-center flex flex-col items-center">
                  <Camera className="h-10 w-10 text-neutral-400 mb-3" />
                  <p className="text-neutral-600 font-medium">No hay fotos adjuntas</p>
                  <p className="text-neutral-500 text-sm mt-1">Haz clic en Añadir Foto para adjuntar evidencia</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Buscar reportes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.map(report => (
                  <div key={report.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border
                          ${report.severity === 'Crítica' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                            report.severity === 'Alta' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            report.severity === 'Media' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'}
                        `}>
                          {report.severity}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {report.type}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleExportExcel(report)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500" onClick={() => setActiveReport(report)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleDelete(report.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-bold text-neutral-900 mb-1 line-clamp-1">{report.projectName}</h3>
                    <p className="text-sm text-neutral-600 line-clamp-2 mb-4 h-10">{report.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> {report.date}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {report.time}
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{report.area || 'Sin área definida'}</span>
                      </div>
                    </div>
                    
                    {report.photos.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                        <Camera className="h-3.5 w-3.5" />
                        {report.photos.length} {report.photos.length === 1 ? 'foto adjunta' : 'fotos adjuntas'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="bg-neutral-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 mb-1">No hay reportes de incidencia</h3>
                <p className="text-neutral-500">Crea el primer reporte para comenzar a documentar hallazgos</p>
                <Button onClick={handleCreateNew} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Reporte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
