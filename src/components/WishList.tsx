import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Tag, 
  AlertCircle,
  Clock,
  Filter,
  Hammer,
  Box,
  ClipboardList,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { firestoreService } from '@/src/lib/firestoreService';
import { WishListItem, User } from '@/src/types';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WishListProps {
  users: User[];
}

export default function WishList({ users }: WishListProps) {
  const [items, setItems] = useState<WishListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  
  const [newItem, setNewItem] = useState<Partial<WishListItem>>({
    category: 'material',
    targetDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    status: 'pendiente',
    item: '',
    notes: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await firestoreService.getAll<WishListItem>('wishlist');
      setItems(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error loading wishlist:', error);
      toast.error('Error al cargar la lista de pendientes');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    if (!newItem.item) {
      toast.error('El nombre del item es obligatorio');
      return;
    }

    try {
      const item: WishListItem = {
        id: crypto.randomUUID(),
        item: newItem.item!,
        category: (newItem.category as any) || 'material',
        targetDate: newItem.targetDate || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        status: 'pendiente',
        notes: newItem.notes || '',
        createdAt: new Date().toISOString(),
        createdBy: 'Admin' // Should be dynamic if auth is implemented
      };

      await firestoreService.add('wishlist', item);
      setItems([item, ...items]);
      setIsDialogOpen(false);
      setNewItem({
        category: 'material',
        targetDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        status: 'pendiente',
        item: '',
        notes: ''
      });
      toast.success('Agregado a la lista de pendientes');
    } catch (error) {
       console.error('Error adding item:', error);
       toast.error('Error al guardar');
    }
  };

  const toggleStatus = async (item: WishListItem) => {
    const newStatus = item.status === 'pendiente' ? 'listo' : 'pendiente';
    try {
      await firestoreService.update<WishListItem>('wishlist', item.id, { status: newStatus });
      setItems(items.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      toast.success(`Marcado como ${newStatus}`);
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await firestoreService.delete('wishlist', id);
      setItems(items.filter(i => i.id !== id));
      toast.success('Eliminado de la lista');
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'material': return <Box className="text-blue-500" size={16} />;
      case 'herramienta': return <Hammer className="text-orange-500" size={16} />;
      case 'tarea': return <ClipboardList className="text-emerald-500" size={16} />;
      default: return <Tag className="text-neutral-500" size={16} />;
    }
  };

  const filteredItems = items.filter(item => {
    if (!filterDate) return true;
    return item.targetDate === filterDate;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900">Lista de Pendientes</h1>
          <p className="text-neutral-500 font-medium mt-1">¿Qué falta para los próximos días?</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            nativeButton={true}
            render={
              <button className="inline-flex items-center justify-center rounded-2xl h-14 px-8 bg-neutral-900 text-white hover:bg-neutral-800 shadow-xl shadow-neutral-200 gap-2 font-medium transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                <Plus size={20} />
                <span>Nuevo Pendiente</span>
              </button>
            }
          />
          <DialogContent className="rounded-[2rem] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Agregar Pendiente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label>¿Qué falta?</Label>
                <Input 
                  placeholder="Ej: 5 bolsas de cemento" 
                  value={newItem.item}
                  onChange={e => setNewItem({...newItem, item: e.target.value})}
                  className="rounded-xl h-12"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select 
                    value={newItem.category} 
                    onValueChange={v => setNewItem({...newItem, category: v as any})}
                  >
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="herramienta">Herramienta</SelectItem>
                      <SelectItem value="tarea">Tarea</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Para el día</Label>
                  <Input 
                    type="date"
                    value={newItem.targetDate}
                    onChange={e => setNewItem({...newItem, targetDate: e.target.value})}
                    className="rounded-xl h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas/Detalles</Label>
                <Input 
                  placeholder="Opcional..." 
                  value={newItem.notes}
                  onChange={e => setNewItem({...newItem, notes: e.target.value})}
                  className="rounded-xl h-12"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={addItem} className="w-full h-14 rounded-2xl bg-neutral-900">
                Guardar Pendiente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date Filter */}
      <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
        <CardContent className="p-6">
           <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
              <Button 
                variant={filterDate === '' ? 'default' : 'ghost'}
                onClick={() => setFilterDate('')}
                className="rounded-xl flex-shrink-0"
              >
                Todos
              </Button>
              {[0, 1, 2, 3, 4, 5].map(days => {
                const date = addDays(new Date(), days);
                const dateStr = format(date, 'yyyy-MM-dd');
                const isToday = days === 0;
                const isTomorrow = days === 1;
                
                return (
                  <Button 
                    key={days}
                    variant={filterDate === dateStr ? 'default' : 'ghost'}
                    onClick={() => setFilterDate(dateStr)}
                    className={cn(
                      "rounded-xl flex-shrink-0 flex flex-col items-center py-8 h-auto min-w-[80px]",
                      filterDate === dateStr ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {isToday ? 'HOY' : isTomorrow ? 'MAÑANA' : format(date, 'EEE', { locale: es }).toUpperCase()}
                    </span>
                    <span className="text-xl font-black">{format(date, 'dd')}</span>
                    <span className="text-[10px] font-medium">{format(date, 'MMM', { locale: es }).toUpperCase()}</span>
                  </Button>
                );
              })}
              <div className="flex-1" />
              <div className="flex items-center gap-2 px-4 border-l border-neutral-100">
                <Label className="text-neutral-400"><Filter size={14} /></Label>
                <Input 
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="border-none bg-transparent w-[140px] shadow-none focus-visible:ring-0"
                />
              </div>
           </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              >
                <Card className={cn(
                  "rounded-[2.5rem] border-none shadow-md transition-all duration-300 group overflow-hidden",
                  item.status === 'listo' ? "bg-neutral-50 opacity-70" : "bg-white hover:shadow-xl"
                )}>
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                         <div className="p-3 bg-neutral-50 rounded-2xl">
                           {getCategoryIcon(item.category)}
                         </div>
                         <Badge variant="outline" className="rounded-full font-bold text-[10px] uppercase tracking-widest border-neutral-100">
                           {item.category}
                         </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteItem(item.id)}
                        className="text-neutral-300 hover:text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    <div className="flex items-start gap-4 cursor-pointer" onClick={() => toggleStatus(item)}>
                      <div className="mt-1">
                        {item.status === 'listo' ? (
                          <CheckCircle2 size={24} className="text-emerald-500" />
                        ) : (
                          <Circle size={24} className="text-neutral-200 group-hover:text-neutral-400 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "text-xl font-black tracking-tight leading-7",
                          item.status === 'listo' ? "line-through text-neutral-400" : "text-neutral-900 shadow-text-neutral-900/10"
                        )}>
                          {item.item}
                        </p>
                        {item.notes && (
                          <p className="mt-2 text-sm text-neutral-500 font-medium">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-dashed border-neutral-100 flex items-center justify-between text-neutral-400">
                       <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                         <Calendar size={12} />
                         {format(parseISO(item.targetDate), "dd MMM", { locale: es })}
                       </div>
                       <div className="flex items-center gap-2 text-xs font-bold">
                         <Clock size={12} />
                         {format(parseISO(item.createdAt), "HH:mm")}
                       </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-neutral-300 scale-110">
              <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle size={40} />
              </div>
              <p className="text-xl font-black tracking-tight uppercase">Nada pendiente para este día</p>
              <p className="mt-1 font-bold text-sm tracking-widest opacity-50">TODA LA OBRA AL DÍA</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
