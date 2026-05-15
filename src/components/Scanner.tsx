import { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, UserCheck, AlertCircle, Clock, Coffee, LogOut, ArrowRight, RefreshCcw } from 'lucide-react';
import { User, AttendanceType, ATTENDANCE_LABELS, AttendanceLog } from '@/src/types';
import { faceService } from '@/src/lib/faceService';
import * as faceapi from 'face-api.js';
import { firestoreService } from '@/src/lib/firestoreService';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInMinutes } from 'date-fns';

// Simple cn helper for tailwind classes
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

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
  const [restartKey, setRestartKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState({ fps: 0, latency: 0 });
  const [scanMessage, setScanMessage] = useState('Buscando rostro...');
  const [faceQuality, setFaceQuality] = useState(0); // 0-100

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let lastProcessTime = 0;
    const FRAME_INTERVAL = 80; // ~12 fps for processing (enough for real-time and efficient)
    let isActive = true;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
          } 
        });
        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        toast.error('No se pudo acceder a la cámara');
        setError('Error de cámara');
      }
    }

    startCamera();

    if (users.length > 0) {
      const matcher = faceService.createMatcher(users.map(u => ({ name: u.id, descriptor: u.faceDescriptor })));
      let lastActivityTime = Date.now();

      const loop = async (time: number) => {
        if (!isActive) return;
        
        // Always schedule next frame first to ensure loop resilience
        // But we guard it to prevent multiple concurrent processing runs
        animationFrameId = requestAnimationFrame(loop);

        if (!isScanning || !videoRef.current || !matcher) {
          return;
        }

        if (time - lastProcessTime > FRAME_INTERVAL) {
          lastProcessTime = time;
          lastActivityTime = Date.now(); // Update watchdog
          const startTime = performance.now();
          
          try {
            // Check if video is actually playing/not stuck
            if (videoRef.current.paused || videoRef.current.ended) return;

            const results = await faceService.recognizeFace(videoRef.current, matcher);
            const latency = performance.now() - startTime;
            setDebugInfo(prev => ({ fps: Math.round(1000 / (performance.now() - startTime)), latency: Math.round(latency) }));

            if (canvasRef.current && videoRef.current) {
              const canvas = canvasRef.current;
              const video = videoRef.current;
              const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
              
              if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
                faceapi.matchDimensions(canvas, displaySize);
              }
              
              const resizedResults = faceapi.resizeResults(results, displaySize);
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (resizedResults.length > 0) {
                  const result = resizedResults[0];
                  const box = result.box;
                  
                  // Centrality check
                  const centerX = box.x + box.width / 2;
                  const videoCenterX = displaySize.width / 2;
                  const distFromCenter = Math.abs(centerX - videoCenterX);
                  
                  // Distance/Size check
                  const faceArea = (box.width * box.height) / (displaySize.width * displaySize.height);
                  
                  let quality = 0;
                  if (faceArea > 0.04) quality += 40;
                  if (distFromCenter < displaySize.width * 0.15) quality += 30;
                  if (result.distance && result.distance < 0.45) quality += 30;
                  setFaceQuality(quality);

                  // Modern UI markers
                  const color = result.label !== 'unknown' ? '#10b981' : '#f59e0b';
                  ctx.strokeStyle = color;
                  ctx.lineWidth = 4;
                  const cL = Math.min(box.width, box.height) * 0.2;
                  ctx.beginPath();
                  ctx.moveTo(box.x, box.y + cL); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cL, box.y);
                  ctx.moveTo(box.x + box.width - cL, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cL);
                  ctx.moveTo(box.x + box.width, box.y + box.height - cL); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width - cL, box.y + box.height);
                  ctx.moveTo(box.x + cL, box.y + box.height); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x, box.y + box.height - cL);
                  ctx.stroke();

                  if (faceArea < 0.04) {
                    setScanMessage('Acércate un poco más');
                  } else if (distFromCenter > displaySize.width * 0.15) {
                    setScanMessage('Centra tu rostro');
                  } else if (result.label !== 'unknown' && result.distance && result.distance < 0.4) {
                    setScanMessage('Identificando...');
                    const userMatch = users.find(u => u.id === result.label);
                    if (userMatch) {
                      // Small delay for UX and stability
                      setTimeout(async () => {
                        if (!isActive) return;
                        try {
                          const logsRef = collection(db, 'attendance');
                          const q = query(logsRef, where('userId', '==', userMatch.id), orderBy('timestamp', 'desc'), limit(1));
                          const snap = await getDocs(q);
                          if (!snap.empty) {
                            setLastLogType(snap.docs[0].data().type as AttendanceType);
                          } else {
                            setLastLogType(null);
                          }
                          setRecognizedUser(userMatch);
                          setIsScanning(false);
                        } catch (e) {
                          console.error('Match error:', e);
                        }
                      }, 200);
                    }
                  } else {
                    setScanMessage('Rostro detectado');
                  }
                } else {
                  setFaceQuality(0);
                  setScanMessage('Buscando rostro...');
                }
              }
            }
          } catch (error) {
            console.error("Frame error:", error);
            // On error, the loop continues because of the animationFrameId at top
          }
        }
      };

      // Watchdog interval
      const watchdogInterval = setInterval(() => {
        if (isActive && isScanning && Date.now() - lastActivityTime > 3000) {
          console.warn("Scanner appears stuck, auto-restarting...");
          handleRestartCamera();
        }
      }, 4000);

      animationFrameId = requestAnimationFrame(loop);

      return () => {
        isActive = false;
        clearInterval(watchdogInterval);
        stream?.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animationFrameId);
      };
    }

    return () => {
      isActive = false;
      stream?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animationFrameId);
    };
  }, [users, isScanning, restartKey]);

  useEffect(() => {
    if (recognizedUser && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [recognizedUser]);

  const handleRestartCamera = () => {
    setRestartKey(prev => prev + 1);
    toast.info('Reiniciando cámara...');
  };

  const handleAttendance = async (type: AttendanceType) => {
    if (!recognizedUser) return;
    setLoading(true);

    try {
      const now = new Date();
      const newLog: AttendanceLog = {
        id: Math.random().toString(36).substr(2, 9),
        userId: recognizedUser.id,
        userName: recognizedUser.name,
        type,
        timestamp: now.toISOString()
      };

      await firestoreService.add('attendance', newLog);
      
      toast.success(`Asistencia de ${ATTENDANCE_LABELS[type]} registrada para ${recognizedUser.name}`);
      onLogCreated();
      setRecognizedUser(null);
      setIsScanning(true);
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
            className="w-full h-full object-cover grayscale-[0.5] -scale-x-100"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-10"
          />
          
          {/* Facial Guide UI */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={cn(
              "w-64 h-64 md:w-80 md:h-80 rounded-full border-2 transition-all duration-300 flex flex-col items-center justify-end pb-8",
              faceQuality > 60 ? "border-emerald-500 bg-emerald-500/5" : "border-white/20 bg-black/10"
            )}>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                faceQuality > 60 ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
              )}>
                {scanMessage}
              </span>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1">
             <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-mono text-white/70">LATENCY: {debugInfo.latency}ms</span>
             </div>
             <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-mono text-white/70">FPS: {debugInfo.fps}</span>
             </div>
          </div>

          <div className="absolute top-4 right-4 z-20">
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full bg-black/40 border-white/20 text-white hover:bg-black/60 backdrop-blur-sm"
              onClick={handleRestartCamera}
              title="Reiniciar Cámara"
            >
              <RefreshCcw size={18} />
            </Button>
          </div>
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
