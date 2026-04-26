import { motion } from 'motion/react';
import { 
  Camera, 
  Users, 
  FileBarChart, 
  Package, 
  ClipboardList, 
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar,
  Mountain,
  History,
  FileText,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InventoryMovement, WorkLog } from '@/src/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardProps {
  onNavigate: (view: string) => void;
  movements: InventoryMovement[];
  workLogs: WorkLog[];
}

export default function Dashboard({ onNavigate, movements, workLogs }: DashboardProps) {
  const quickActions = [
    { 
      id: 'scanner', 
      label: 'Registrar Asistencia', 
      description: 'Lanzar escaner facial para entrada/salida',
      icon: Camera, 
      color: 'bg-indigo-500', 
      textColor: 'text-indigo-500' 
    },
    { 
      id: 'worklogs', 
      label: 'Nueva Bitácora', 
      description: 'Crear reporte diario de obra y avances',
      icon: ClipboardList, 
      color: 'bg-emerald-500', 
      textColor: 'text-emerald-500' 
    },
    { 
      id: 'inventory', 
      label: 'Control de Stock', 
      description: 'Gestionar entradas y salidas de materiales',
      icon: Package, 
      color: 'bg-orange-500', 
      textColor: 'text-orange-500' 
    },
  ];

  const lastMovements = movements.slice(0, 5);
  const lastWorkLog = workLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return (
    <div className="space-y-12">
      {/* Hero Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 mb-2">
            ¡Buen día, Capataz!
          </h1>
          <p className="text-neutral-500 font-medium">
            Bienvenido al panel central de <span className="text-primary font-bold">Vertical Aplicación</span>.
          </p>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-[2rem] border border-neutral-100 shadow-sm self-start">
          <Calendar className="text-primary" size={20} />
          <div className="text-right">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Hoy</p>
            <p className="text-lg font-bold text-neutral-800">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Detailed Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Last Movements */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 text-orange-500 rounded-2xl">
                <History size={20} />
              </div>
              <CardTitle className="text-xl font-black tracking-tight">Últimos Movimientos</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('inventory')} className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">
              Ver todo
            </Button>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="space-y-4">
              {lastMovements.length > 0 ? (
                lastMovements.map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                        mov.type === 'entry' ? 'bg-emerald-500' : 'bg-rose-500'
                      )}>
                        {mov.type === 'entry' ? '+' : '-'}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-900 leading-none">{mov.productName}</p>
                        <p className="text-xs text-neutral-400 mt-1">{mov.userName} • {format(new Date(mov.timestamp), 'HH:mm', { locale: es })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className={cn("font-black tracking-tight", mov.type === 'entry' ? 'text-emerald-500' : 'text-rose-500')}>
                         {mov.type === 'entry' ? '+' : '-'}{mov.quantity}
                       </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-neutral-400 font-medium italic">No hay movimientos recientes</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Last Work Log */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
                <FileText size={20} />
              </div>
              <CardTitle className="text-xl font-black tracking-tight">Último Informe</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('worklogs')} className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">
              Ver Historial
            </Button>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            {lastWorkLog ? (
              <div className="bg-neutral-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <ClipboardList size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      Reporte #{lastWorkLog.reportNumber}
                    </span>
                    <span className="text-neutral-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Clock size={12} /> {format(new Date(lastWorkLog.date), "dd 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <h4 className="text-2xl font-black tracking-tight mb-2">{lastWorkLog.project}</h4>
                  <p className="text-neutral-400 font-medium mb-6">{lastWorkLog.residentHead}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-white/10">
                      <span className="text-neutral-400 text-xs font-bold uppercase tracking-widest">Avance</span>
                      <span className="text-xl font-black text-emerald-400">{lastWorkLog.advancePercentage}%</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => onNavigate('worklogs')}
                    className="w-full mt-8 bg-white text-neutral-900 hover:bg-neutral-200 rounded-xl font-bold py-6"
                  >
                    Abrir Bitácora
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[300px]">
                 <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-200 mb-4">
                    <ClipboardList size={40} />
                 </div>
                 <p className="text-neutral-400 font-medium italic">Aún no se han registrado informes de obra</p>
                 <Button variant="outline" className="mt-4 rounded-xl font-black uppercase tracking-widest text-[10px]" onClick={() => onNavigate('worklogs')}>
                    Crear Primer Informe
                 </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Tiles */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold tracking-tight text-neutral-900 px-2">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.id}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(action.id)}
              className="text-left group"
            >
              <Card className="rounded-[2.5rem] border-none shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-white h-full">
                <CardContent className="p-10 flex flex-col h-full">
                  <div className={cn("p-6 rounded-[2rem] text-white w-fit mb-8 shadow-lg", action.color)}>
                    <action.icon size={40} />
                  </div>
                  <h4 className="text-2xl font-black tracking-tight text-neutral-900 group-hover:text-primary transition-colors">
                    {action.label}
                  </h4>
                  <p className="text-neutral-500 font-medium mt-3 flex-1">
                    {action.description}
                  </p>
                  <div className="mt-8 flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                    Comenzar <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </motion.button>
          ))}
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="py-12 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-neutral-300">
           <img src="/logo.png" alt="Vertical Solutions" className="w-16 h-16 object-contain opacity-20 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" onError={(e) => e.currentTarget.style.display = 'none'} />
           <span className="font-mono text-[10px] uppercase tracking-[0.5em]">Vertical Solutions • 2024</span>
        </div>
      </div>
    </div>
  );
}
