import React from 'react';
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
  Mountain
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
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

  const stats = [
    { label: 'Personal Activo', value: '12', icon: Users, trend: '+2 esta semana' },
    { label: 'Horas Mes', value: '1,240', icon: Activity, trend: 'En progreso' },
    { label: 'Obras Vigentes', value: '3', icon: TrendingUp, trend: 'Sincronizado' },
  ];

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="rounded-[2.5rem] border-none shadow-md overflow-hidden bg-white">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-neutral-50 rounded-2xl text-neutral-400">
                    <stat.icon size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                    {stat.trend}
                  </span>
                </div>
                <p className="text-3xl font-black tracking-tighter text-neutral-900">{stat.value}</p>
                <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
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
        <div className="flex items-center gap-2 text-neutral-300">
           <Mountain size={20} />
           <span className="font-mono text-[10px] uppercase tracking-[0.5em]">Vertical Solutions • 2024</span>
        </div>
      </div>
    </div>
  );
}
