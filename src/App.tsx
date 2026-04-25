/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Camera, Users, FileBarChart, Settings, Package, ClipboardList, Mountain, Home as HomeIcon, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import Scanner from './components/Scanner';
import UserManagement from './components/UserManagement';
import AttendanceHistory from './components/AttendanceHistory';
import InventoryManagement from './components/InventoryManagement';
import DailyLog from './components/DailyLog';
import Dashboard from './components/Dashboard';
import { User, AttendanceLog } from './types';
import { faceService } from './lib/faceService';
import { firestoreService } from './lib/firestoreService';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type View = 'home' | 'scanner' | 'users' | 'history' | 'inventory' | 'worklogs';

export default function App() {
  const [activeView, setActiveView] = useState<View>('home');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const menuItems = [
    { id: 'home', label: 'Inicio', icon: HomeIcon },
    { id: 'scanner', label: 'Escaner Facial', icon: Camera },
    { id: 'users', label: 'Personal', icon: Users },
    { id: 'history', label: 'Asistencia', icon: FileBarChart },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'worklogs', label: 'Bitácora de Obra', icon: ClipboardList },
  ];

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    async function init() {
      try {
        await faceService.loadModels();
        const [usersData, logsData] = await Promise.all([
          firestoreService.getAll<User>('users'),
          firestoreService.getAll<AttendanceLog>('attendance')
        ]);
        setUsers(usersData);
        setLogs(logsData);
      } catch (error) {
        console.error('Error initialization:', error);
        toast.error('Error al inicializar el sistema');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const refreshData = async () => {
    const [usersData, logsData] = await Promise.all([
      firestoreService.getAll<User>('users'),
      firestoreService.getAll<AttendanceLog>('attendance')
    ]);
    setUsers(usersData);
    setLogs(logsData);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="p-4 bg-primary rounded-[2rem] shadow-2xl mb-8">
            <Mountain size={48} className="text-primary-foreground" />
          </div>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary mb-6"></div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-400">Vertical Aplicación</p>
        </motion.div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'home': return <Dashboard onNavigate={(view) => setActiveView(view as View)} />;
      case 'scanner': return <Scanner users={users} onLogCreated={refreshData} />;
      case 'users': return <UserManagement users={users} onUpdate={refreshData} />;
      case 'history': return <AttendanceHistory logs={logs} users={users} onUpdate={refreshData} />;
      case 'inventory': return <InventoryManagement users={users} />;
      case 'worklogs': return <DailyLog users={users} attendanceLogs={logs} />;
      default: return <Dashboard onNavigate={(view) => setActiveView(view as View)} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans text-neutral-900">
      {/* Sidebar Navigation */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="h-full bg-white border-r border-neutral-200 flex flex-col z-50 relative shadow-sm"
      >
        <div className="p-6 mb-4 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div 
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="bg-primary p-2 rounded-xl text-white">
                  <Mountain size={20} />
                </div>
                <span className="font-bold text-lg tracking-tight whitespace-nowrap">Vertical App</span>
              </motion.div>
            ) : (
              <motion.div 
                key="logo-mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-primary p-2 rounded-xl text-white mx-auto"
              >
                <Mountain size={20} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as View)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {isSidebarOpen && (
                  <span className={cn("font-medium", isActive ? "font-bold" : "")}>
                    {item.label}
                  </span>
                )}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-medium z-[100] whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-neutral-100">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full justify-center rounded-xl text-neutral-400"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
              {menuItems.find(i => i.id === activeView)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">Sistema Activo</span>
             </div>
             <Button variant="outline" size="icon" className="rounded-full md:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu size={18} />
             </Button>
          </div>
        </header>

        <div className="p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

