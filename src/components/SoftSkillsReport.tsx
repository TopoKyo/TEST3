import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  SkillEvaluation, 
  SkillCategory, 
  SKILL_LABELS 
} from '@/src/types';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  FileText, 
  Calendar, 
  User as UserIcon, 
  TrendingUp, 
  Download,
  BarChart3,
  Filter,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';

interface SoftSkillsReportProps {
  users: User[];
}

export const SoftSkillsReport: React.FC<SoftSkillsReportProps> = ({ users }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [evaluations, setEvaluations] = useState<SkillEvaluation[]>([]);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!selectedUserId) {
      toast.error('Seleccione un operario');
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, 'skillEvaluations'),
        where('userId', '==', selectedUserId),
        orderBy('timestamp', 'desc')
      );
      
      const snap = await getDocs(q);
      const allEvals = snap.docs.map(doc => doc.data() as SkillEvaluation);
      
      // Filter by date range manually to avoid complex index requirements initially
      // although timestamp is ordered, we filter by the 'date' string
      const filtered = allEvals.filter(ev => {
        const evDate = ev.date;
        return evDate >= startDate && evDate <= endDate;
      });

      setEvaluations(filtered);
      if (filtered.length === 0) {
        toast.info('No se encontraron evaluaciones en este rango');
      } else {
        toast.success(`Se encontraron ${filtered.length} evaluaciones`);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error('Error al generar el informe');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (evaluations.length === 0) return null;

    const categories: SkillCategory[] = [
      'puntualidad',
      'trabajo_equipo',
      'seguridad_industrial',
      'comunicacion',
      'iniciativa',
      'productividad',
      'limpieza_orden'
    ];

    const categoryAverages = categories.map(cat => {
      const sum = evaluations.reduce((acc, ev) => acc + (ev.scores[cat] || 0), 0);
      const avg = sum / evaluations.length;
      return {
        category: SKILL_LABELS[cat],
        average: Math.round(avg * 10) / 10,
        fullCat: cat
      };
    });

    const globalAvg = evaluations.reduce((acc, ev) => acc + ev.average, 0) / evaluations.length;

    const timeline = [...evaluations].sort((a,b) => a.date.localeCompare(b.date)).map(ev => ({
      date: format(parseISO(ev.date), 'dd/MM'),
      avg: ev.average
    }));

    return {
      categoryAverages,
      globalAvg: Math.round(globalAvg * 10) / 10,
      totalEvaluations: evaluations.length,
      timeline
    };
  }, [evaluations]);

  const getResultConfig = (avg: number) => {
    if (avg >= 4.5) return { label: 'Excelente', color: 'text-emerald-400 bg-emerald-500/10' };
    if (avg >= 3.5) return { label: 'Bueno', color: 'text-blue-400 bg-blue-500/10' };
    if (avg >= 2.5) return { label: 'Regular', color: 'text-yellow-400 bg-yellow-500/10' };
    return { label: 'Bajo Desempeño', color: 'text-rose-400 bg-rose-500/10' };
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-zinc-500">
          <FileText className="w-5 h-5" />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Informe Consolidado de Habilidades</h1>
        </div>
        <p className="text-sm text-zinc-600">Análisis evolutivo y comparativo del desempeño conductual.</p>
      </header>

      {/* Filters */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Operario</label>
            <select 
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">Seleccione...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Desde</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Hasta</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
          >
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Filter className="w-4 h-4" />}
            GENERAR INFORME
          </button>
        </div>
      </section>

      {stats ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Summary Card */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <UserIcon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">{users.find(u => u.id === selectedUserId)?.name}</h3>
                  <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Resultado del Periodo</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-8 bg-zinc-950 border border-zinc-800 rounded-lg shadow-inner">
                <span className="text-6xl font-black text-white mb-2 leading-none">{stats.globalAvg.toFixed(1)}</span>
                <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-current", getResultConfig(stats.globalAvg).color)}>
                  {getResultConfig(stats.globalAvg).label}
                </span>
                <p className="text-[10px] text-zinc-500 mt-6 uppercase tracking-widest font-mono">Basado en {stats.totalEvaluations} registros</p>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Dimensiones Clave</h4>
                {stats.categoryAverages.map(cat => (
                  <div key={cat.category} className="flex flex-col gap-2">
                    <div className="flex justify-between text-[11px] items-center">
                      <span className="text-zinc-400 font-medium">{cat.category}</span>
                      <span className="text-white font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">{cat.average.toFixed(1)}</span>
                    </div>
                    <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.5)]", 
                          cat.average >= 4.5 ? "bg-emerald-500" :
                          cat.average >= 3.5 ? "bg-blue-500" : 
                          cat.average >= 2.5 ? "bg-yellow-500" : "bg-rose-500"
                        )}
                        style={{ width: `${(cat.average / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Area */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-zinc-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Evolución del Desempeño</span>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                  <BarChart data={stats.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#71717a" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={[0, 5]}
                    />
                    <Tooltip cursor={false} 
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#6366f1' }}
                    />
                    <Bar 
                      dataKey="avg" 
                      fill="#6366f1" 
                      radius={[4, 4, 0, 0]} 
                      barSize={24}
                      className="drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-zinc-400 mb-6">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Radar de Habilidades</span>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.categoryAverages}>
                        <PolarGrid stroke="#27272a" />
                        <PolarAngleAxis dataKey="fullCat" tick={{ fill: '#71717a', fontSize: 8 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                        <Radar
                          name="Promedio"
                          dataKey="average"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.4}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center gap-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-lg group transition-colors hover:bg-emerald-500/20">
                    <h5 className="text-[10px] font-bold text-emerald-500 uppercase mb-1 tracking-widest font-mono">Fuerza Operativa</h5>
                    <p className="text-white font-black text-lg">{stats.categoryAverages.sort((a,b) => b.average - a.average)[0].category}</p>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-lg group transition-colors hover:bg-rose-500/20">
                    <h5 className="text-[10px] font-bold text-rose-500 uppercase mb-1 tracking-widest font-mono">Déficit Crítico</h5>
                    <p className="text-white font-black text-lg">{stats.categoryAverages.sort((a,b) => a.average - b.average)[0].category}</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="md:col-span-3">
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">Detalle de Evaluaciones en el Periodo</h3>
                  <button className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1">
                    <Download className="w-3 h-3" /> EXPORTAR CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-950/50">
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase">Fecha</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase">Supervisor</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase">Promedio</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase">Comentarios</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {evaluations.map(ev => (
                          <tr key={ev.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-4 text-xs text-white">{format(parseISO(ev.date), 'dd MMM yyyy')}</td>
                            <td className="px-6 py-4 text-xs text-zinc-400">{ev.supervisorName}</td>
                            <td className="px-6 py-4">
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", getResultConfig(ev.average).color)}>
                                {ev.average.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-zinc-500 max-w-xs truncate">{ev.generalComments || 'Sin comentarios'}</td>
                            <td className="px-6 py-4">
                              <button className="text-zinc-600 hover:text-white transition-colors">
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        </motion.div>
      ) : (
        <section className="flex-1 flex flex-col items-center justify-center py-20 bg-white border border-zinc-200 border-dashed rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-400 mb-4">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h3 className="text-zinc-900 font-bold mb-1">Informe no generado</h3>
          <p className="text-xs text-zinc-500 max-w-xs">Seleccione un operario y un rango de fechas para visualizar el análisis consolidado.</p>
        </section>
      )}
    </div>
  );
};
