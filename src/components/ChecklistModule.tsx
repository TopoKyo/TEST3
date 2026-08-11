import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckSquare, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  Circle,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { firestoreService } from '../lib/firestoreService';
import { cn } from '@/lib/utils';
import { User } from '../types';
import { toast } from 'sonner';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  description?: string;
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed';
}

interface ChecklistModuleProps {
  users?: User[];
}

export default function ChecklistModule({ users }: ChecklistModuleProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newItemText, setNewItemText] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    setIsLoading(true);
    try {
      const data = await firestoreService.getAll<Checklist>('checklists');
      const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setChecklists(sorted);
      if (sorted.length > 0 && !activeChecklistId) {
        setActiveChecklistId(sorted[0].id);
      }
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error('Error al cargar las listas de verificación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChecklist = async () => {
    if (!newTitle.trim()) {
      toast.error('El título es requerido');
      return;
    }

    const newChecklist = { id: crypto.randomUUID(),
      title: newTitle.trim(),
      description: newDescription.trim(),
      items: [],
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const added = await firestoreService.add('checklists', newChecklist);
      setChecklists([{...newChecklist, id: added.id} as Checklist, ...checklists]);
      setActiveChecklistId(added.id);
      setIsCreating(false);
      setNewTitle('');
      setNewDescription('');
      toast.success('Lista de verificación creada');
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast.error('Error al crear la lista');
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta lista?')) return;
    
    try {
      await firestoreService.delete('checklists', id);
      setChecklists(checklists.filter(c => c.id !== id));
      if (activeChecklistId === id) {
        setActiveChecklistId(checklists.length > 1 ? checklists.find(c => c.id !== id)?.id || null : null);
      }
      toast.success('Lista eliminada');
    } catch (error) {
      console.error('Error deleting checklist:', error);
      toast.error('Error al eliminar la lista');
    }
  };

  const handleUpdateChecklist = async (id: string, updates: Partial<Checklist>) => {
    try {
      const currentList = checklists.find(c => c.id === id);
      if (!currentList) return;

      const updatedList = {
        ...currentList,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await firestoreService.update('checklists', id, updatedList);
      setChecklists(checklists.map(c => c.id === id ? updatedList : c));
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Error al actualizar la lista');
    }
  };

  const handleAddItem = async (checklistId: string) => {
    if (!newItemText.trim()) return;

    const currentList = checklists.find(c => c.id === checklistId);
    if (!currentList) return;

    const newItem: ChecklistItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      text: newItemText.trim(),
      completed: false
    };

    await handleUpdateChecklist(checklistId, {
      items: [...currentList.items, newItem]
    });
    setNewItemText('');
  };

  const handleToggleItem = async (checklistId: string, itemId: string) => {
    const currentList = checklists.find(c => c.id === checklistId);
    if (!currentList) return;

    const newItems = currentList.items.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    await handleUpdateChecklist(checklistId, { items: newItems });
  };

  const handleDeleteItem = async (checklistId: string, itemId: string) => {
    const currentList = checklists.find(c => c.id === checklistId);
    if (!currentList) return;

    const newItems = currentList.items.filter(item => item.id !== itemId);
    await handleUpdateChecklist(checklistId, { items: newItems });
  };

  const activeChecklist = checklists.find(c => c.id === activeChecklistId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Checklists</h1>
          <p className="text-neutral-500 mt-1">Gestiona listas de verificación y tareas</p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
        >
          <Plus size={18} className="mr-2" />
          Nueva Lista
        </Button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <Card className="border-indigo-100 shadow-md shadow-indigo-100/50 bg-white">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-indigo-900">Crear Nueva Lista</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="rounded-full hover:bg-neutral-100">
                      <X size={18} className="text-neutral-500" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Título</label>
                      <Input 
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Ej. Revisión de Maquinaria"
                        className="bg-neutral-50 border-neutral-200"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Descripción (Opcional)</label>
                      <Textarea 
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Propósito o detalles de esta lista..."
                        className="bg-neutral-50 border-neutral-200 resize-none h-20"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={handleCreateChecklist}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                      disabled={!newTitle.trim()}
                    >
                      <Save size={16} className="mr-2" />
                      Guardar Lista
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-neutral-500 font-medium animate-pulse">Cargando listas...</p>
            </div>
          ) : checklists.length === 0 ? (
            <div className="bg-neutral-50 rounded-2xl p-6 text-center border border-neutral-200 border-dashed">
              <ListTodo size={32} className="mx-auto text-neutral-300 mb-3" />
              <p className="text-sm text-neutral-500 font-medium">No hay listas aún.</p>
              <p className="text-xs text-neutral-400 mt-1">Crea la primera para empezar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden divide-y divide-neutral-100">
              {checklists.map(checklist => {
                const isActive = activeChecklistId === checklist.id;
                const completedCount = checklist.items.filter(i => i.completed).length;
                const totalCount = checklist.items.length;
                const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                
                return (
                  <button
                    key={checklist.id}
                    onClick={() => setActiveChecklistId(checklist.id)}
                    className={cn(
                      "w-full text-left p-4 transition-all hover:bg-neutral-50 relative overflow-hidden group",
                      isActive ? "bg-indigo-50/50" : ""
                    )}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="activeIndicator" 
                        className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"
                      />
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={cn(
                        "font-semibold truncate pr-2",
                        isActive ? "text-indigo-900" : "text-neutral-700"
                      )}>
                        {checklist.title}
                      </h4>
                      {totalCount > 0 && completedCount === totalCount && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 shrink-0">
                          COMPLETADO
                        </Badge>
                      )}
                    </div>
                    
                    {totalCount > 0 ? (
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">{completedCount} de {totalCount} items</span>
                          <span className={cn(
                            "font-medium",
                            progress === 100 ? "text-emerald-600" : "text-indigo-600"
                          )}>
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500 ease-out",
                              progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 mt-1">Sin items</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Area */}
        <div className="lg:col-span-3">
          {activeChecklist ? (
            <Card className="border-neutral-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl text-neutral-900">{activeChecklist.title}</CardTitle>
                    {activeChecklist.description && (
                      <CardDescription className="mt-2 text-neutral-600">
                        {activeChecklist.description}
                      </CardDescription>
                    )}
                    <div className="flex items-center gap-3 mt-4 text-xs font-medium text-neutral-400">
                      <span>Creado: {new Date(activeChecklist.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span>•</span>
                      <span>{activeChecklist.items.length} items en total</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteChecklist(activeChecklist.id)}
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Eliminar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 space-y-6">
                  {/* Progress Bar Header */}
                  {activeChecklist.items.length > 0 && (
                    <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50">
                      <div className="flex items-center justify-between text-sm font-semibold text-indigo-900 mb-2">
                        <span>Progreso de la Lista</span>
                        <span>
                          {Math.round((activeChecklist.items.filter(i => i.completed).length / activeChecklist.items.length) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${(activeChecklist.items.filter(i => i.completed).length / activeChecklist.items.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-2">
                    {activeChecklist.items.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <div className="bg-neutral-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckSquare size={24} className="text-neutral-400" />
                        </div>
                        <h4 className="text-neutral-900 font-semibold mb-1">Lista vacía</h4>
                        <p className="text-neutral-500 text-sm max-w-sm mx-auto">Agrega tu primer ítem para empezar a usar esta lista de verificación.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeChecklist.items.map(item => (
                          <div 
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border transition-all group",
                              item.completed 
                                ? "bg-neutral-50 border-neutral-200" 
                                : "bg-white border-neutral-200 hover:border-indigo-200 hover:shadow-sm"
                            )}
                          >
                            <button
                              onClick={() => handleToggleItem(activeChecklist.id, item.id)}
                              className="shrink-0 focus:outline-none"
                            >
                              {item.completed ? (
                                <CheckCircle2 size={22} className="text-emerald-500 fill-emerald-50" />
                              ) : (
                                <Circle size={22} className="text-neutral-300 group-hover:text-indigo-400 transition-colors" />
                              )}
                            </button>
                            <span className={cn(
                              "flex-1 font-medium transition-all",
                              item.completed ? "text-neutral-400 line-through" : "text-neutral-700"
                            )}>
                              {item.text}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteItem(activeChecklist.id, item.id)}
                              className="opacity-0 group-hover:opacity-100 shrink-0 h-8 w-8 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add New Item */}
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleAddItem(activeChecklist.id); }}
                    className="flex items-center gap-2 mt-4"
                  >
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Plus size={16} className="text-neutral-400" />
                      </div>
                      <Input 
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Añadir nuevo ítem a la lista..."
                        className="pl-9 bg-neutral-50 border-neutral-200 rounded-xl"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={!newItemText.trim()}
                      className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl px-6"
                    >
                      Añadir
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ) : !isLoading ? (
            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-neutral-200 rounded-3xl bg-neutral-50/50">
              <div className="text-center px-6">
                <div className="bg-white w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-neutral-100">
                  <CheckSquare size={24} className="text-indigo-500" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">Ninguna lista seleccionada</h3>
                <p className="text-neutral-500 max-w-sm mx-auto mb-6">Selecciona una lista del panel lateral o crea una nueva para comenzar a gestionar tareas.</p>
                <Button 
                  onClick={() => setIsCreating(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                >
                  <Plus size={18} className="mr-2" />
                  Crear Primera Lista
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
