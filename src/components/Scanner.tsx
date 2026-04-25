import { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, UserCheck, AlertCircle, Clock, Coffee, LogOut, ArrowRight } from 'lucide-react';
import { User, AttendanceType, ATTENDANCE_LABELS } from '@/src/types';
import { faceService } from '@/src/lib/faceService';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerProps {
  users: User[];
  onLogCreated: () => void;
}

export default function Scanner({ users, onLogCreated }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [recognizedUser, setRecognizedUser] = useState<User | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [lastLogType, setLastLogType] = useState<AttendanceType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: NodeJS.Timeout;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        toast.error('No se pudo acceder a la cámara');
      }
    }

    startCamera();

    if (users.length > 0) {
      const matcher = faceService.createMatcher(users.map(u => ({ name: u.id, descriptor: u.faceDescriptor })));

      interval = setInterval(async () => {
        if (videoRef.current && isScanning) {
          const results = await faceService.recognizeFace(videoRef.current, matcher);
          if (results.length > 0) {
            const bestMatch = results[0];
            if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.45) {
              const user = users.find(u => u.id === bestMatch.label);
              if (user) {
                // Fetch last log for this user to prevent duplicates
                const userLogs = await fetch(`/api/logs?userId=${user.id}`).then(r => r.json());
                const userFilteredLogs = userLogs.filter((l: any) => l.userId === user.id)
                  .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                
                if (userFilteredLogs.length > 0) {
                  setLastLogType(userFilteredLogs[0].type);
                } else {
                  setLastLogType(null);
                }

                setRecognizedUser(user);
                setIsScanning(false);
              }
            } else if (bestMatch.label === 'unknown' && bestMatch.distance < 0.4) {
               // Only toast if we are reasonably sure it's a face but not recognized
               // To avoid spamming, we could use a ref to track when we last toasted
            }
          } else {
            setRecognizedUser(null);
          }
        }
      }, 500);
    }

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      clearInterval(interval);
    };
  }, [users, isScanning]);

  const handleAttendance = async (type: AttendanceType) => {
    if (!recognizedUser) return;
    setLoading(true);

    try {
      const now = new Date();
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        userId: recognizedUser.id,
        userName: recognizedUser.name,
        type,
        timestamp: now.toISOString()
      };

      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });

      if (res.ok) {
        toast.success(`Asistencia de ${ATTENDANCE_LABELS[type]} registrada para ${recognizedUser.name}`);
        onLogCreated();
        setRecognizedUser(null);
        setIsScanning(true);
      }
    } catch (error) {
      toast.error('Error al registrar asistencia');
    } finally {
      setLoading(false);
    }
  };

  const getButtonClass = (type: AttendanceType) => {
    // Logic to prevent repetitive marks could go here if we tracked last log for current user
    return "h-24 flex flex-col gap-2 text-lg";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="overflow-hidden border-2 border-neutral-200">
        <CardHeader className="bg-white border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Escaneo Facial</CardTitle>
              <CardDescription>Posiciona tu rostro frente a la cámara</CardDescription>
            </div>
            <Badge variant={recognizedUser ? "default" : "outline"} className="animate-pulse">
              {recognizedUser ? "Usuario Identificado" : "Buscando..."}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative bg-neutral-950 aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover grayscale-[0.5]"
          />
          <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20 flex items-center justify-center">
             <div className="w-64 h-64 border-2 border-primary/50 rounded-full border-dashed animate-[spin_10s_linear_infinite]"></div>
          </div>
          
          <AnimatePresence>
            {!recognizedUser && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10"
              >
                <div className="flex items-center gap-3 text-white">
                  <Camera className="text-primary animate-pulse" size={20} />
                  <p className="text-sm font-light">Escanéo activo. Por favor, mire a la lente.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <AnimatePresence mode="wait">
          {recognizedUser ? (
            <motion.div
              key="recognized"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <Card className="border-primary/20 bg-primary/5 border-2 shadow-lg shadow-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <img 
                      src={recognizedUser.image} 
                      alt="" 
                      className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-xl" 
                    />
                    <div>
                      <Badge className="mb-2 bg-primary/20 text-primary hover:bg-primary/20 border-none">Identidad Confirmada</Badge>
                      <h3 className="text-3xl font-bold tracking-tight">{recognizedUser.name}</h3>
                      <p className="text-neutral-500 font-mono text-sm tracking-tight capitalize">ID: {recognizedUser.id}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  disabled={loading || lastLogType === 'arrival'}
                  onClick={() => handleAttendance('arrival')}
                  className="h-28 flex flex-col gap-2 rounded-2xl bg-white text-emerald-600 border-2 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm disabled:opacity-30"
                  variant="outline"
                >
                  <ArrowRight size={28} />
                  <span className="font-bold uppercase tracking-wide text-xs">Entrada</span>
                </Button>
                <Button 
                   disabled={loading || lastLogType === 'break_start'}
                  onClick={() => handleAttendance('break_start')}
                  className="h-28 flex flex-col gap-2 rounded-2xl bg-white text-blue-600 border-2 border-blue-100 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm disabled:opacity-30"
                  variant="outline"
                >
                  <Coffee size={28} />
                  <span className="font-bold uppercase tracking-wide text-xs">Inicio Descanso</span>
                </Button>
                <Button 
                   disabled={loading || lastLogType === 'break_end'}
                  onClick={() => handleAttendance('break_end')}
                  className="h-28 flex flex-col gap-2 rounded-2xl bg-white text-amber-600 border-2 border-amber-100 hover:bg-amber-50 hover:border-amber-200 transition-all shadow-sm disabled:opacity-30"
                  variant="outline"
                >
                  <Clock size={28} />
                  <span className="font-bold uppercase tracking-wide text-xs">Fin Descanso</span>
                </Button>
                <Button 
                   disabled={loading || lastLogType === 'departure'}
                  onClick={() => handleAttendance('departure')}
                  className="h-28 flex flex-col gap-2 rounded-2xl bg-white text-rose-600 border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 transition-all shadow-sm disabled:opacity-30"
                  variant="outline"
                >
                  <LogOut size={28} />
                  <span className="font-bold uppercase tracking-wide text-xs">Salida</span>
                </Button>
              </div>

              <Button 
                variant="ghost" 
                className="w-full text-neutral-400 hover:text-neutral-600"
                onClick={() => {
                  setRecognizedUser(null);
                  setIsScanning(true);
                }}
              >
                No soy yo, intentar de nuevo
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border-2 border-dashed border-neutral-200"
            >
              <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
                <UserCheck size={32} className="text-neutral-300" />
              </div>
              <h3 className="text-xl font-medium text-neutral-400">Esperando Identificación</h3>
              <p className="text-neutral-400 text-sm mt-2 max-w-xs">
                El sistema reconocerá automáticamente tu rostro cuando estés en posición.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
