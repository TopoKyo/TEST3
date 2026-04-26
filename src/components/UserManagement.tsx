import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Camera, UserPlus, RefreshCw, Users } from 'lucide-react';
import { User } from '@/src/types';
import { faceService } from '@/src/lib/faceService';
import { firestoreService } from '@/src/lib/firestoreService';
import { cn } from '@/lib/utils';

interface UserManagementProps {
  users: User[];
  onUpdate: () => void;
}

export default function UserManagement({ users, onUpdate }: UserManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ id: '', name: '', image: '' });
  const [activeTab, setActiveTab] = useState<'form' | 'camera'>('form');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      if (activeTab === 'camera' && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          toast.error('No se pudo acceder a la cámara');
          setActiveTab('form');
        }
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeTab]);

  const startCamera = async () => {
    setActiveTab('camera');
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setFormData({ ...formData, image: imageData });
      setActiveTab('form');
    }
  };

  const handleSubmit = async () => {
    if (!formData.id || !formData.name || !formData.image) {
      toast.error('Todos los campos son obligatorios');
      return;
    }

    try {
      // Validate face and get descriptor
      const img = new Image();
      img.src = formData.image;
      await new Promise(resolve => img.onload = resolve);
      
      const descriptor = await faceService.getFaceDescriptor(img);
      if (!descriptor) {
        toast.error('No se detectó ningún rostro en la foto. Intenta de nuevo.');
        return;
      }

      const isDuplicate = !editingUser && users.some(u => u.id === formData.id);
      if (isDuplicate) {
        toast.error('Este ID ya está registrado. Usa un identificador diferente.');
        return;
      }

      if (editingUser) {
        await firestoreService.update('users', editingUser.id, {
          ...formData,
          faceDescriptor: Array.from(descriptor)
        });
        toast.success('Usuario actualizado');
      } else {
        await firestoreService.add('users', {
          ...formData,
          faceDescriptor: Array.from(descriptor)
        });
        toast.success('Usuario creado');
      }

      onUpdate();
      setIsAdding(false);
      setEditingUser(null);
      setFormData({ id: '', name: '', image: '' });
    } catch (error) {
      toast.error('Error al guardar usuario');
    }
  };

  const handleDelete = async (id: string) => {
    toast.promise(
      async () => {
        await firestoreService.delete('users', id);
        onUpdate();
      },
      {
        loading: 'Eliminando usuario...',
        success: 'Usuario eliminado',
        error: 'Error al eliminar',
      }
    );
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl font-bold">Gestión de Personal</CardTitle>
          <CardDescription>Añade, edita o elimina usuarios registrados en el sistema.</CardDescription>
        </div>
        <Dialog open={isAdding || !!editingUser} onOpenChange={(open) => {
          if (open) {
            setIsAdding(true);
          } else {
            setIsAdding(false);
            setEditingUser(null);
            setFormData({ id: '', name: '', image: '' });
            setActiveTab('form');
          }
        }}>
          <DialogTrigger className={cn(buttonVariants(), "gap-2 rounded-xl")}>
            <UserPlus size={18} />
            Registrar Usuario
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuario' : 'Nuevo Registro'}</DialogTitle>
            </DialogHeader>
            
            {activeTab === 'form' ? (
              <div className="space-y-6 py-4">
                <div className="flex justify-center">
                  {formData.image ? (
                    <div className="relative group">
                      <img src={formData.image} alt="Profile" className="w-40 h-40 rounded-3xl object-cover ring-4 ring-neutral-100" />
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="absolute bottom-2 right-2 rounded-full shadow-lg"
                        onClick={startCamera}
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-40 h-40 rounded-3xl border-2 border-dashed flex flex-col gap-2"
                      onClick={startCamera}
                    >
                      <Camera size={32} className="text-neutral-400" />
                      <span className="text-xs uppercase font-bold text-neutral-400">Capturar Rostro</span>
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="id">ID Único / Identificador</Label>
                    <Input 
                      id="id" 
                      placeholder="Ej: 12345" 
                      value={formData.id || ''}
                      onChange={e => setFormData({ ...formData, id: e.target.value })}
                      disabled={!!editingUser}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo</Label>
                    <Input 
                      id="name" 
                      placeholder="Ej: Juan Pérez" 
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className="relative aspect-square bg-black rounded-3xl overflow-hidden">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-[30px] border-black/30 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white/50 border-dashed rounded-full"></div>
                  </div>
                </div>
                <Button onClick={capturePhoto} className="w-full h-14 text-lg font-bold rounded-2xl">
                  Capturar Ahora
                </Button>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                onClick={handleSubmit} 
                className="w-full h-12 rounded-xl text-lg font-bold"
                disabled={activeTab === 'camera'}
              >
                {editingUser ? 'Actualizar Datos' : 'Finalizar Registro'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="px-0 pt-4">
        <div className="rounded-2xl border bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-neutral-50/50">
              <TableRow>
                <TableHead className="w-20"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-neutral-400 italic">
                      <Users size={48} className="mb-4 opacity-20" />
                      No hay usuarios registrados todavía.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, index) => (
                  <TableRow key={`${user.id}-${index}`} className="group transition-colors hover:bg-neutral-50/50">
                    <TableCell>
                      <img src={user.image} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-transparent group-hover:ring-neutral-200 transition-all" />
                    </TableCell>
                    <TableCell className="font-semibold">{user.name}</TableCell>
                    <TableCell className="font-mono text-xs text-neutral-500">{user.id}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg"
                          onClick={() => {
                            setEditingUser(user);
                            setFormData({ id: user.id, name: user.name, image: user.image });
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <canvas ref={canvasRef} className="hidden" />
    </Card>
  );
}
