/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Camera, Users, FileBarChart, Settings, Package, ClipboardList, Mountain } from 'lucide-react';
import Scanner from './components/Scanner';
import UserManagement from './components/UserManagement';
import AttendanceHistory from './components/AttendanceHistory';
import InventoryManagement from './components/InventoryManagement';
import DailyLog from './components/DailyLog';
import { User, AttendanceLog } from './types';
import { faceService } from './lib/faceService';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        await faceService.loadModels();
        const [usersRes, logsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/logs')
        ]);
        const usersData = await usersRes.json();
        const logsData = await logsRes.json();
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
    const [usersRes, logsRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/logs')
    ]);
    setUsers(await usersRes.json());
    setLogs(await logsRes.json());
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">Iniciando Vertical Aplicación...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="border-b bg-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Mountain size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Vertical Aplicación</h1>
          </div>
          <div className="text-xs font-mono text-neutral-400 uppercase tracking-widest hidden sm:block">
            Gestión Vertical y de Obra
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <Tabs defaultValue="scanner" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="scanner" className="flex items-center gap-2">
                <Camera size={16} /> <span className="hidden sm:inline">Escáner</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users size={16} /> <span className="hidden sm:inline">Usuarios</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                <Package size={16} /> <span className="hidden sm:inline">Bodega</span>
              </TabsTrigger>
              <TabsTrigger value="dailylog" className="flex items-center gap-2">
                <ClipboardList size={16} /> <span className="hidden sm:inline">Bitácora</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <FileBarChart size={16} /> <span className="hidden sm:inline">Asistencia</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="scanner" className="mt-0">
            <Scanner users={users} onLogCreated={refreshData} />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UserManagement users={users} onUpdate={refreshData} />
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <InventoryManagement users={users} />
          </TabsContent>

          <TabsContent value="dailylog" className="mt-0">
            <DailyLog users={users} attendanceLogs={logs} />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <AttendanceHistory logs={logs} users={users} onUpdate={refreshData} />
          </TabsContent>
        </Tabs>
      </main>

      <Toaster position="top-center" />
    </div>
  );
}

