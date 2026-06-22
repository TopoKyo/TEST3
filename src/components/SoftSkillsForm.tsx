import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  SkillEvaluation, 
  SkillCategory, 
  SKILL_LABELS 
} from '@/src/types';
import { firestoreService, handleFirestoreError, OperationType } from '@/src/lib/firestoreService';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  ClipboardCheck, 
  History, 
  Save, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare,
  Award,
  ChevronRight,
  User as UserIcon,
  Calendar,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SoftSkillsFormProps {
  users: User[];
  onSuccess?: () => void;
}

const CATEGORIES: SkillCategory[] = [
  'puntualidad',
  'trabajo_equipo',
  'seguridad_industrial',
  'comunicacion',
  'iniciativa',
  'productividad',
  'limpieza_orden'
];

export const SoftSkillsForm: React.FC<SoftSkillsFormProps> = ({ users, onSuccess }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [scores, setScores] = useState<Record<SkillCategory, number>>({
    puntualidad: 0,
    trabajo_equipo: 0,
    seguridad_industrial: 0,
    comunicacion: 0,
    iniciativa: 0,
    productividad: 0,
    limpieza_orden: 0
  });
  const [positiveObs, setPositiveObs] = useState('');
  const [negativeObs, setNegativeObs] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SkillEvaluation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const average = useMemo(() => {
    const activeScores = (Object.values(scores) as number[]).filter(s => s > 0);
    if (activeScores.length === 0) return 0;
    const sum = activeScores.reduce((acc, curr) => acc + curr, 0);
    return Math.round((sum / activeScores.length) * 10) / 10;
  }, [scores]);

  const getResultConfig = (avg: number) => {
    if (avg === 0) return { label: 'Sin Procesa', color: 'text-zinc-400 bg-zinc-400/10', border: 'border-zinc-400/20' };
    if (avg >= 4.5) return { label: 'Excelente', color: 'text-emerald-500 bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (avg >= 3.5) return { label: 'Bueno', color: 'text-blue-500 bg-blue-500/10', border: 'border-blue-500/20' };
    if (avg >= 2.5) return { label: 'Regular', color: 'text-amber-500 bg-amber-500/10', border: 'border-amber-500/20' };
    return { label: 'Bajo Desempeño', color: 'text-red-500 bg-red-500/10', border: 'border-red-500/20' };
  };

  const result = getResultConfig(average);

  const fetchHistory = async (userId: string) => {
    setLoadingHistory(true);
    try {
      // Temporarily removing orderBy to rule out index issues
      const q = query(
        collection(db, 'skillEvaluations'),
        where('userId', '==', userId),
        limit(10)
      );
      const snap = await getDocs(q);
      const evals = snap.docs.map(doc => doc.data() as SkillEvaluation);
      // Sort in memory instead
      evals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistory(evals);
    } catch (error) {
      console.error("Error fetching history:", error);
      // Try to use the error handler for more details
      try {
        handleFirestoreError(error, OperationType.LIST, `skillEvaluations (query for ${userId})`);
      } catch (e) {
        // Fallback for safety
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      fetchHistory(selectedUserId);
      // Reset form when user changes
      setScores({
        puntualidad: 0,
        trabajo_equipo: 0,
        seguridad_industrial: 0,
        comunicacion: 0,
        iniciativa: 0,
        productividad: 0,
        limpieza_orden: 0
      });
      setPositiveObs('');
      setNegativeObs('');
      setGeneralComments('');
    }
  }, [selectedUserId]);

  const handleSave = async () => {
    if (!selectedUserId) {
      toast.error('Seleccione un operario');
      return;
    }

    const allResponded = (Object.values(scores) as number[]).every(s => s > 0);
    if (!allResponded) {
      toast.error('Por favor califique todas las categorías');
      return;
    }

    setSaving(true);
    try {
      const user = users.find(u => u.id === selectedUserId);
      const evalId = crypto.randomUUID();
      const evaluation: SkillEvaluation = {
        id: evalId,
        userId: selectedUserId,
        userName: user?.name || 'Desconocido',
        supervisorId: 'system-admin', // Ideally current auth user
        supervisorName: 'Supervisor de Turno',
        date: format(new Date(), 'yyyy-MM-dd'),
        scores,
        average,
        positiveObservations: positiveObs,
        negativeObservations: negativeObs,
        generalComments,
        timestamp: new Date().toISOString()
      };

      await firestoreService.add('skillEvaluations', evaluation);
      toast.success('Evaluación guardada exitosamente');
      fetchHistory(selectedUserId);
      onSuccess?.();
    } catch (error) {
      toast.error('Error al guardar evaluación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-zinc-500">
          <ClipboardCheck className="w-5 h-5" />
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Evaluación Directiva de Habilidades</h1>
        </div>
        <p className="text-sm text-zinc-600">Gestión diaria del desempeño conductual y soft skills en planta.</p>
      </header>

      {/* User Selection */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 block">Operario Industrial</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select 
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="">Seleccione un operario...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {selectedUserId && (
            <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900 leading-tight">
                  {users.find(u => u.id === selectedUserId)?.name}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-tighter">EN PLANTA • ACTIVO</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedUserId && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Dimensiones Conductuales</h2>
                <div className={cn("px-4 py-1.5 rounded-full text-xs font-bold border transition-colors", result.color, result.border)}>
                  {result.label}: {average.toFixed(1)}
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-300">{SKILL_LABELS[cat]}</span>
                      <span className="text-xs font-mono text-zinc-500">Nivel: {scores[cat]}</span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => setScores(prev => ({ ...prev, [cat]: val }))}
                          className={cn(
                            "flex-1 h-10 rounded-md text-xs font-bold transition-all border",
                            scores[cat] === val 
                              ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]" 
                              : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Puntos Positivos</span>
                </div>
                <textarea 
                  value={positiveObs}
                  onChange={(e) => setPositiveObs(e.target.value)}
                  placeholder="Fortalezas detectadas hoy..."
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none h-24"
                />
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3 shadow-lg">
                <div className="flex items-center gap-2 text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70">Oportunidades de Mejora</span>
                </div>
                <textarea 
                  value={negativeObs}
                  onChange={(e) => setNegativeObs(e.target.value)}
                  placeholder="Desviaciones o áreas críticas..."
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/30 resize-none h-24"
                />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4 shadow-lg">
              <div className="flex items-center gap-2 text-indigo-400">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Comentarios Generales</span>
              </div>
              <textarea 
                value={generalComments}
                onChange={(e) => setGeneralComments(e.target.value)}
                placeholder="Notas adicionales del supervisor..."
                className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none h-20"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(37,99,235,0.2)]"
            >
              <Save className="w-5 h-5" />
              {saving ? 'GUARDANDO...' : 'FINALIZAR EVALUACIÓN'}
            </button>
          </div>

          {/* History Sidebar */}
          <div className="flex flex-col gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-full flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400">
                  <History className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Historial Reciente</span>
                </div>
                <Award className="w-4 h-4 text-zinc-600" />
              </div>

              {loadingHistory ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600 text-center py-10">
                  <Calendar className="w-10 h-10 opacity-20" />
                  <p className="text-xs">Sin registros previos para este operario.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.map((item) => {
                    const cfg = getResultConfig(item.average);
                    return (
                      <div key={item.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono text-zinc-500">{format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: es })}</span>
                          <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded uppercase", cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full", item.average >= 3.5 ? "bg-emerald-500" : "bg-amber-500")} 
                              style={{ width: `${(item.average / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-white">{item.average.toFixed(1)}</span>
                        </div>
                        {item.positiveObservations && (
                          <p className="text-[10px] text-zinc-400 line-clamp-1 italic">“{item.positiveObservations}”</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-zinc-800">
                <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-tighter">
                  <span>Métrica Global</span>
                  <span>{history.length > 0 ? (history.reduce((a, b) => a + b.average, 0) / history.length).toFixed(1) : '---'}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Aesthetic Helper Classes */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
};
