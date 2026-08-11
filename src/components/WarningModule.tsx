import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { firestoreService } from '../lib/firestoreService';
import { toast } from 'sonner';
import { Camera, AlertTriangle, ImageIcon, Trash2, Send, FileDown } from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import domtoimage from 'dom-to-image';

interface WarningModuleProps {
  users: User[];
}

interface WarningLog {
  id?: string;
  userId: string;
  userName: string;
  cause: string;
  severity: 'Baja' | 'Media' | 'Grave';
  photoData?: string;
  createdAt: string;
}

export default function WarningModule({ users }: WarningModuleProps) {
  const [userId, setUserId] = useState('');
  const [cause, setCause] = useState('');
  const [severity, setSeverity] = useState<'Baja' | 'Media' | 'Grave'>('Baja');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<WarningLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWarnings();
  }, []);

  const fetchWarnings = async () => {
    try {
      const data = await firestoreService.getAll<WarningLog>('warnings');
      setWarnings(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error fetching warnings:', error);
      toast.error('Error al cargar amonestaciones');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es muy grande. Máximo 5MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress with JPEG at 0.7 quality to ensure it fits in Firestore
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          // Check size roughly (base64 size * 0.75 gives bytes)
          if (compressedDataUrl.length * 0.75 > 900000) {
            toast.error('La imagen sigue siendo muy grande después de comprimir.');
            return;
          }
          
          setPhoto(compressedDataUrl);
        };
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error('Debe seleccionar un empleado');
      return;
    }
    if (!cause.trim()) {
      toast.error('Debe ingresar la causa de la amonestación');
      return;
    }

    const selectedUser = users.find(u => u.id === userId);
    if (!selectedUser) return;

    setIsSubmitting(true);
    
    const newWarning: WarningLog = {
      id: crypto.randomUUID(),
      userId: selectedUser.id,
      userName: selectedUser.name,
      cause: cause.trim(),
      severity,
      ...(photo && { photoData: photo }),
      createdAt: new Date().toISOString()
    };

    try {
      const added = await firestoreService.add('warnings', newWarning as WarningLog & { id: string });
      setWarnings([added, ...warnings]);
      
      // Reset form
      setUserId('');
      setCause('');
      setSeverity('Baja');
      setPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      toast.success('Amonestación registrada exitosamente');
    } catch (error) {
      console.error('Error saving warning:', error);
      toast.error('Error al guardar la amonestación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = (warning: WarningLog) => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(220, 38, 38); 
      doc.text("AMONESTACIÓN DISCIPLINARIA", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Fecha: ${new Date(warning.createdAt).toLocaleString()}`, 20, 40);
      doc.text(`Empleado: ${warning.userName}`, 20, 50);
      doc.text(`Gravedad: ${warning.severity}`, 20, 60);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Motivo de la Amonestación:", 20, 80);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      
      const splitCause = doc.splitTextToSize(warning.cause, 170);
      doc.text(splitCause, 20, 90);
      
      let nextY = 90 + (splitCause.length * 7) + 10;
      
      if (warning.photoData) {
        if (nextY > 180) {
          doc.addPage();
          nextY = 20;
        }
        
        doc.setFont("helvetica", "bold");
        doc.text("Evidencia Fotográfica:", 20, nextY);
        
        try {
          doc.addImage(warning.photoData, 'JPEG', 20, nextY + 10, 100, 100, undefined, 'FAST');
          nextY += 120;
        } catch (e) {
          console.error("Error adding image to PDF", e);
          doc.setFont("helvetica", "normal");
          doc.text("(Error al cargar la evidencia fotográfica)", 20, nextY + 10);
          nextY += 20;
        }
      }
      
      if (nextY > 230) {
          doc.addPage();
          nextY = 20;
      }
      
      nextY += 40;
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      
      doc.line(30, nextY, 90, nextY);
      doc.text("Firma del Supervisor", 60, nextY + 5, { align: "center" });
      
      doc.line(120, nextY, 180, nextY);
      doc.text("Firma del Empleado", 150, nextY + 5, { align: "center" });
      
      const dateStr = new Date(warning.createdAt).toLocaleDateString().replace(/\//g, '-');
      doc.save(`Amonestacion_${warning.userName.replace(/\s+/g, '_')}_${dateStr}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error('Error al generar el PDF');
    }
  };

  const severityColors = {
    'Baja': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Media': 'bg-orange-100 text-orange-800 border-orange-200',
    'Grave': 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <div className="flex-1 overflow-auto bg-neutral-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertTriangle className="text-red-600" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Amonestaciones</h1>
            <p className="text-neutral-500">Registro y control de faltas o incidencias del personal</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm sticky top-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                Nueva Amonestación
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Empleado</Label>
                  <select 
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Seleccione un empleado...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Gravedad</Label>
                  <select 
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Grave">Grave</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Causa o Motivo</Label>
                  <Textarea 
                    placeholder="Describa el motivo de la amonestación..."
                    value={cause}
                    onChange={(e) => setCause(e.target.value)}
                    className="resize-none h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Evidencia Fotográfica (Opcional)</Label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                  />
                  {photo ? (
                    <div className="relative rounded-lg overflow-hidden border border-neutral-200 group">
                      <img src={photo} alt="Evidencia" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="sm"
                          onClick={() => {
                            setPhoto(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          <Trash2 size={16} className="mr-1" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full gap-2 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={18} /> Adjuntar Foto
                    </Button>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full gap-2 mt-4 bg-red-600 hover:bg-red-700 text-white">
                  <Send size={16} />
                  {isSubmitting ? 'Guardando...' : 'Registrar Amonestación'}
                </Button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4">Historial de Amonestaciones</h2>
              
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div>
                </div>
              ) : warnings.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50 text-neutral-500">
                  <AlertTriangle size={32} className="mx-auto mb-2 text-neutral-400" />
                  <p>No hay amonestaciones registradas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {warnings.map((warning) => (
                    <motion.div 
                      key={warning.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-neutral-100 bg-white rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row gap-4">
                        {warning.photoData && (
                          <div className="w-full sm:w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-neutral-200">
                            <img src={warning.photoData} alt="Evidencia" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                            <div>
                              <h3 className="font-bold text-neutral-900">{warning.userName}</h3>
                              <p className="text-xs text-neutral-500">
                                {new Date(warning.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${severityColors[warning.severity]}`}>
                                {warning.severity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => generatePDF(warning)}
                              >
                                <FileDown size={14} className="mr-1" /> PDF
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-100 mt-2">
                            {warning.cause}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
