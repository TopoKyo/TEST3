/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Camera, Users, FileBarChart, Settings, Package, ClipboardList, Mountain, Home as HomeIcon, ChevronLeft, ChevronRight, Menu, Sparkles, RefreshCw, Award, FileCheck, AlertTriangle, Building2, CheckSquare } from 'lucide-react';
import Scanner from './components/Scanner';
import UserManagement from './components/UserManagement';
import AttendanceHistory from './components/AttendanceHistory';
import InventoryManagement from './components/InventoryManagement';
import DailyLog from './components/DailyLog';
import Dashboard from './components/Dashboard';
import WishList from './components/WishList';
import { SoftSkillsForm } from './components/SoftSkillsForm';
import { SoftSkillsReport } from './components/SoftSkillsReport';
import WeeklyReportModule from './components/WeeklyReportModule';
import ExceptionalReportModule from './components/ExceptionalReportModule';
import ArchitectureReports from './components/ArchitectureReports';
import { EquipmentDeliverySheet } from './components/EquipmentDeliverySheet';
import { User, AttendanceLog, InventoryMovement, WorkLog, WishListItem } from './types';
import { faceService } from './lib/faceService';
import { firestoreService } from './lib/firestoreService';
import { doc, getDoc, enableNetwork } from 'firebase/firestore';
import { db } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import ChecklistModule from './components/ChecklistModule';
import SpdcChecklist from './components/SpdcChecklist';
import WarningModule from './components/WarningModule';
import ObligationsAuditModule from './components/ObligationsAuditModule';
import DailyBriefingModule from './components/DailyBriefingModule';

type View = 'home' | 'scanner' | 'users' | 'history' | 'inventory' | 'worklogs' | 'wishlist' | 'evaluations' | 'skill-reports' | 'weekly-report' | 'exceptional' | 'architecture' | 'tools-delivery' | 'checklists' | 'spdc' | 'warnings' | 'obligations' | 'briefing';

export default function App() {
  const [activeView, setActiveView] = useState<View>('home');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishListItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);

    const handleOnline = () => {
      console.log("Browser went online");
      toast.success("Conexión restablecida");
      setIsOnline(true);
      enableNetwork(db).catch(console.error);
    };
    const handleOffline = () => {
      console.log("Browser went offline");
      toast.error("Sin conexión a internet");
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const menuItems = [
    { id: 'home', label: 'Inicio', icon: HomeIcon },
    { id: 'scanner', label: 'Escaner Facial', icon: Camera },
    { id: 'users', label: 'Personal', icon: Users },
    { id: 'history', label: 'Asistencia', icon: FileBarChart },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'wishlist', label: 'Pendientes', icon: Sparkles },
    { id: 'tools-delivery', label: 'Entrega Herramientas', icon: ClipboardList },
    { id: 'worklogs', label: 'Bitácora de Obra', icon: ClipboardList },
    { id: 'weekly-report', label: 'Informe Semanal', icon: FileCheck },
    { id: 'exceptional', label: 'Informe Excepcional', icon: AlertTriangle },
    { id: 'architecture', label: 'Arquitectura', icon: Building2 },
    { id: 'evaluations', label: 'Habilidades Blandas', icon: Award },
    { id: 'skill-reports', label: 'Informes de Personal', icon: FileBarChart },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare },
    { id: 'spdc', label: 'Checklist SPDC', icon: ClipboardList },
    { id: 'warnings', label: 'Amonestaciones', icon: AlertTriangle },
    { id: 'obligations', label: 'Cumplimiento Diario', icon: CheckSquare },
    { id: 'briefing', label: 'Charla Diaria', icon: ClipboardList },
  ];

  useEffect(() => {
    async function testConnection() {
      try {
        await enableNetwork(db);
        const testDoc = await getDoc(doc(db, 'test', 'connection'));
        console.log("Firebase connection status:", testDoc.exists() ? "OK" : "OK (New DB)");
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
        if(error instanceof Error) {
          console.warn("Initial connection check failed, will retry implicitly:", error.message);
        }
      }
    }
    testConnection();

    async function init() {
      try {
        await faceService.loadModels();
        // Wait a bit more for Firestore to settle with long polling
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const [usersData, logsData, movementsData, workLogsData, wishlistData] = await Promise.all([
          firestoreService.getAll<User>('users'),
          firestoreService.getAll<AttendanceLog>('attendance'),
          firestoreService.getAll<InventoryMovement>('inventoryMovements'),
          firestoreService.getAll<WorkLog>('workLogs'),
          firestoreService.getAll<WishListItem>('wishlist')
        ]);
        setUsers(usersData);
        setLogs(logsData);
        setMovements(movementsData);
        setWorkLogs(workLogsData);
        setWishlistItems(wishlistData);
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
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const [usersData, logsData, movementsData, workLogsData, wishlistData] = await Promise.all([
        firestoreService.getAll<User>('users'),
        firestoreService.getAll<AttendanceLog>('attendance'),
        firestoreService.getAll<InventoryMovement>('inventoryMovements'),
        firestoreService.getAll<WorkLog>('workLogs'),
        firestoreService.getAll<WishListItem>('wishlist')
      ]);
      setUsers(usersData);
      setLogs(logsData);
      setMovements(movementsData);
      setWorkLogs(workLogsData);
      setWishlistItems(wishlistData);
      setIsOnline(true);
      if (activeView !== 'home') toast.success('Datos actualizados');
    } catch (e) {
      console.error('Refresh error:', e);
      setIsOnline(false);
      toast.error('Error de sincronización');
    } finally {
      setIsRefreshing(false);
    }
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
      case 'home': return <Dashboard onNavigate={(view) => setActiveView(view as View)} movements={movements} workLogs={workLogs} wishlistItems={wishlistItems} />;
      case 'scanner': return <Scanner users={users} onLogCreated={refreshData} />;
      case 'users': return <UserManagement users={users} onUpdate={refreshData} />;
      case 'history': return <AttendanceHistory logs={logs} users={users} onUpdate={refreshData} />;
      case 'inventory': return <InventoryManagement users={users} onUpdate={refreshData} />;
      case 'worklogs': return <DailyLog users={users} attendanceLogs={logs} />;
      case 'weekly-report': return <WeeklyReportModule users={users} workLogs={workLogs} onReportSaved={refreshData} />;
      case 'exceptional': return <ExceptionalReportModule users={users} />;
      case 'architecture': return <ArchitectureReports />;
      case 'wishlist': return <WishList users={users} />;
      case 'evaluations': return <SoftSkillsForm users={users} />;
      case 'skill-reports': return <SoftSkillsReport users={users} />;
      case 'tools-delivery': return <EquipmentDeliverySheet users={users} />;
      case 'checklists': return <ChecklistModule users={users} />;
      case 'spdc': return <SpdcChecklist />;
      case 'warnings': return <WarningModule users={users} />;
      case 'obligations': return <ObligationsAuditModule users={users} />;
      case 'briefing': return <DailyBriefingModule users={users} />;
      default: return <Dashboard onNavigate={(view) => setActiveView(view as View)} movements={movements} workLogs={workLogs} wishlistItems={wishlistItems} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans text-neutral-900">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 80,
          x: isDesktop ? 0 : (isMobileMenuOpen ? 0 : -280),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed inset-y-0 left-0 z-[70] md:relative h-full bg-white border-r border-neutral-200 flex flex-col shadow-xl md:shadow-sm print:hidden",
          (!isDesktop && !isMobileMenuOpen) && "pointer-events-none"
        )}
      >
        <div className="p-6 mb-4 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {(isSidebarOpen || isMobileMenuOpen) ? (
              <motion.div 
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="bg-primary/10 p-1 rounded-xl">
                  <img src="/logo.png" alt="Vertical Solutions" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.src = 'https://placehold.co/40x40?text=VS'} />
                </div>
                <span className="font-bold text-lg tracking-tight whitespace-nowrap">Vertical App</span>
              </motion.div>
            ) : (
              <motion.div 
                key="logo-mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mx-auto"
              >
                <img src="/logo.png" alt="VS" className="w-10 h-10 object-contain" onError={(e) => e.currentTarget.src = 'https://placehold.co/40x40?text=VS'} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as View);
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {(isSidebarOpen || isMobileMenuOpen) && (
                  <span className={cn("font-medium", isActive ? "font-bold" : "")}>
                    {item.label}
                  </span>
                )}
                {(!isSidebarOpen && !isMobileMenuOpen) && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-medium z-[100] whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-neutral-100 hidden md:block">
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
      <main className="flex-1 overflow-y-auto relative w-full print:overflow-visible">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-6 md:px-8 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="rounded-xl flex md:hidden h-10 w-10 shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={20} />
            </Button>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
              {menuItems.find(i => i.id === activeView)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full">
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500")}></div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                {isOnline ? 'Sistema Online' : 'Sistema Offline'}
              </span>
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              className={cn("rounded-xl h-10 w-10 shrink-0 transition-all", isRefreshing && "animate-spin text-primary")} 
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw size={18} />
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-8 print:p-0">
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

