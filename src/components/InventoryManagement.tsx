import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Plus, 
  Search, 
  Download, 
  Upload, 
  AlertTriangle, 
  Camera,
  Trash2,
  Pencil,
  BarChart3,
  Box,
  FileSpreadsheet,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { Product, InventoryMovement, User, MovementType } from '@/src/types';
import { faceService } from '@/src/lib/faceService';
import { firestoreService } from '@/src/lib/firestoreService';
import { format, parseISO, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Progress } from '@/components/ui/progress';

interface InventoryManagementProps {
  users: User[];
}

export default function InventoryManagement({ users }: InventoryManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dialog states
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>('entry');
  
  // Form states
  const [productForm, setProductForm] = useState<Partial<Product>>({
    id: '',
    name: '',
    unit: 'unidad',
    lowStockThreshold: 5,
    category: '',
    description: ''
  });
  
  const [movementForm, setMovementForm] = useState({
    productId: '',
    quantity: 1,
    observation: '',
    userId: '',
    reason: ''
  });

  // Camera settings
  const [isScanning, setIsScanning] = useState(false);
  const [recognizedUser, setRecognizedUser] = useState<User | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Advanced Import states
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importResults, setImportResults] = useState<{
    valid: any[];
    errors: { row: number; msg: string; data: any }[];
    summary: { created: number; updated: number; skipped: number };
  }>({ valid: [], errors: [], summary: { created: 0, updated: 0, skipped: 0 } });
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodData, movData] = await Promise.all([
        firestoreService.getAll<Product>('products'),
        firestoreService.getAll<InventoryMovement>('inventoryMovements')
      ]);
      setProducts(prodData);
      setMovements(movData);
    } catch (error) {
      toast.error('Error al cargar datos de inventario');
    } finally {
      setLoading(false);
    }
  };

  const getStock = (productId: string) => {
    return movements
      .filter(m => m.productId === productId)
      .reduce((acc, m) => acc + (m.type === 'entry' ? m.quantity : -m.quantity), 0);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.id || !productForm.name) return;

    try {
      if (editingProduct) {
        await firestoreService.update('products', editingProduct.id, productForm);
        toast.success('Producto actualizado');
      } else {
        await firestoreService.add('products', productForm as Product);
        toast.success('Producto creado');
      }
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      toast.error('Error al guardar producto');
    }
  };

  const handleAddMovement = async () => {
    if (!movementForm.productId || movementForm.quantity <= 0) {
      toast.error('Datos incompletos');
      return;
    }

    const product = products.find(p => p.id === movementForm.productId);
    if (!product) return;

    if (movementType === 'exit') {
      const currentStock = getStock(product.id);
      if (currentStock < movementForm.quantity) {
        toast.error('Stock insuficiente');
        return;
      }
      if (!recognizedUser && !movementForm.userId) {
        toast.error('Se requiere identificar al usuario para la salida');
        return;
      }
    }

    const user = recognizedUser || users.find(u => u.id === movementForm.userId);

    try {
      const newMovement: InventoryMovement = {
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        productName: product.name,
        type: movementType,
        quantity: movementForm.quantity,
        userId: user?.id || 'anonymous',
        userName: user?.name || 'Anónimo',
        timestamp: new Date().toISOString(),
        observation: movementForm.observation,
        reason: movementForm.reason
      };

      await firestoreService.add('inventoryMovements', newMovement);

      toast.success('Movimiento registrado');
      setIsMovementDialogOpen(false);
      setRecognizedUser(null);
      setIsScanning(false);
      fetchData();
      setMovementForm({ ...movementForm, quantity: 1, observation: '', reason: '' });
    } catch (error) {
      toast.error('Error al registrar movimiento');
    }
  };

  // Camera integration
  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: NodeJS.Timeout;

    if (isScanning && movementType === 'exit') {
      const startCam = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) { toast.error('Cámara no disponible'); }
      };
      startCam();

      if (users.length > 0) {
        const matcher = faceService.createMatcher(users.map(u => ({ name: u.id, descriptor: u.faceDescriptor })));
        interval = setInterval(async () => {
          if (videoRef.current && isScanning) {
            const results = await faceService.recognizeFace(videoRef.current, matcher);
            if (results.length > 0) {
              const match = results[0];
              if (match.label !== 'unknown' && match.distance < 0.45) {
                const user = users.find(u => u.id === match.label);
                if (user) {
                  setRecognizedUser(user);
                  setIsScanning(false);
                }
              }
            }
          }
        }, 500);
      }
    }

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      clearInterval(interval);
    };
  }, [isScanning, movementType, users]);

  const exportData = (type: 'products' | 'movements') => {
    const data = type === 'products' ? products.map(p => ({
      ID: p.id,
      Nombre: p.name,
      Categoría: p.category,
      Unidad: p.unit,
      Stock: getStock(p.id)
    })) : movements.map(m => ({
      Fecha: format(parseISO(m.timestamp), 'PPpp', { locale: es }),
      Producto: m.productName,
      Tipo: m.type === 'entry' ? 'Entrada' : 'Salida',
      Cantidad: m.quantity,
      Usuario: m.userName,
      Observación: m.observation || m.reason || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'products' ? 'Productos' : 'Movimientos');
    XLSX.writeFile(wb, `${type}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const importProducts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Get headers to match columns
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const headers: string[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + '1';
          headers.push(String(ws[address]?.v || '').toLowerCase().trim());
        }

        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        const columnMap = {
          product: headers.findIndex(h => h.includes('prod') || h.includes('nombre') || h.includes('item')),
          category: headers.findIndex(h => h.includes('cat') || h.includes('tipo')),
          quantity: headers.findIndex(h => h.includes('cant') || h.includes('stock') || h.includes('actual')),
          unit: headers.findIndex(h => h.includes('unid') || h.includes('u/m')),
          location: headers.findIndex(h => h.includes('ubica') || h.includes('lugar') || h.includes('pasillo')),
          lastMov: headers.findIndex(h => h.includes('fecha') || h.includes('movimiento') || h.includes('última')),
          lastUser: headers.findIndex(h => h.includes('retirante') || h.includes('quien') || h.includes('usuario')),
        };

        const valid: any[] = [];
        const errors: any[] = [];

        data.forEach((row, index) => {
          const rowData = Object.values(row);
          const rawProduct = rowData[columnMap.product] || row.Producto || row.producto || row.Name || row.name;
          const rawQty = rowData[columnMap.quantity] || row.Cantidad || row.cantidad || row.Stock || row.stock;
          
          if (!rawProduct) {
            errors.push({ row: index + 2, msg: 'Falta nombre del producto', data: row });
            return;
          }

          const qty = parseFloat(String(rawQty));
          if (isNaN(qty)) {
            errors.push({ row: index + 2, msg: 'Cantidad inválida o no numérica', data: row });
            return;
          }

          const rawCategory = rowData[columnMap.category] || row.Categoría || row.categoria || '';
          const rawUnit = rowData[columnMap.unit] || row.Unidad || row.unidad || 'unidad';
          const rawLocation = rowData[columnMap.location] || row.Ubicación || row.ubicacion || 'N/A';
          const rawDate = rowData[columnMap.lastMov] || row['Última Fecha Mov.'] || row.fecha || 'Sin mov.';
          const rawUser = rowData[columnMap.lastUser] || row['Último Retirante'] || row.Usuario || 'N/A';

          // Normalization
          const normalizedUnit = String(rawUnit).trim().toLowerCase().startsWith('unid') ? 'unidad' : String(rawUnit).trim().toLowerCase();
          const location = String(rawLocation).trim() === 'N/A' ? null : String(rawLocation).trim();
          const user = String(rawUser).trim() === 'N/A' ? 'Sistema (Importación)' : String(rawUser).trim();
          
          // Date parsing
          let timestamp = new Date().toISOString();
          if (rawDate && String(rawDate).trim() !== 'Sin mov.') {
            const parsed = parse(String(rawDate), 'dd/MM/yyyy HH:mm', new Date());
            if (isValid(parsed)) {
              timestamp = parsed.toISOString();
            }
          }

          valid.push({
            name: String(rawProduct).trim(),
            category: String(rawCategory).trim() || 'General',
            quantity: qty,
            unit: normalizedUnit,
            location: location,
            lastMov: timestamp,
            lastUser: user,
            originalRow: row
          });
        });

        setImportResults({
          valid,
          errors,
          summary: { created: 0, updated: 0, skipped: 0 }
        });
        setIsImportPreviewOpen(true);
      } catch (error) {
        console.error(error);
        toast.error('Error al analizar archivo. Verifica el formato.');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  const confirmImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    const total = importResults.valid.length;
    let created = 0;
    let updated = 0;

    for (let i = 0; i < total; i++) {
      const item = importResults.valid[i];
      try {
        // Find existing product by name
        const existing = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        
        let targetProductId = '';
        if (existing) {
          targetProductId = existing.id;
          updated++;
        } else {
          // Create new
          const newId = `PROD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          await firestoreService.add('products', {
            id: newId,
            name: item.name,
            category: item.category,
            unit: item.unit,
            location: item.location,
            lowStockThreshold: 5
          } as Product);
          targetProductId = newId;
          created++;
        }

        if (targetProductId) {
          // Add movement
          await firestoreService.add('inventoryMovements', {
            id: Math.random().toString(36).substr(2, 9),
            productId: targetProductId,
            productName: item.name,
            type: 'entry',
            quantity: item.quantity,
            userId: 'system',
            userName: item.lastUser,
            timestamp: item.lastMov,
            observation: 'Importado de archivo excel'
          } as InventoryMovement);
        }
      } catch (e) {
        console.error('Error importing row', i, e);
      }
      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    toast.success(`Importación finalizada: ${created} creados, ${updated} actualizados`);
    setIsImporting(false);
    setIsImportPreviewOpen(false);
    fetchData();
  };

  // Dashboard Stats
  const lowStockItems = products.filter(p => getStock(p.id) > 0 && getStock(p.id) <= p.lowStockThreshold);
  const zeroStockItems = products.filter(p => getStock(p.id) === 0);
  const recentMovements = movements.slice(-5).reverse();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900">Bodega</h2>
          <p className="text-neutral-500 mt-1">Control de inventario, stock y trazabilidad de materiales.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="rounded-xl shadow-lg bg-emerald-600 hover:bg-emerald-700" 
            onClick={() => {
              setMovementType('entry');
              setIsMovementDialogOpen(true);
            }}
          >
            <ArrowUpRight className="mr-2 h-4 w-4" /> Entrada
          </Button>
          <Button 
            className="rounded-xl shadow-lg bg-rose-600 hover:bg-rose-700" 
            onClick={() => {
              setMovementType('exit');
              setIsMovementDialogOpen(true);
            }}
          >
            <ArrowDownLeft className="mr-2 h-4 w-4" /> Salida
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-neutral-100 p-1 rounded-2xl mb-8">
          <TabsTrigger value="dashboard" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-sm font-medium"> Resumen</TabsTrigger>
          <TabsTrigger value="products" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-sm font-medium">Productos</TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-sm font-medium">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-3xl border-none shadow-sm bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                    <Box size={24} />
                  </div>
                  <Badge variant="secondary" className="bg-blue-100/50 text-blue-700 font-medium">Items</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-600/80">Total Productos</p>
                  <h3 className="text-3xl font-bold tracking-tight text-blue-900">{products.length}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-sm bg-rose-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
                    <AlertTriangle size={24} />
                  </div>
                  <Badge variant="secondary" className="bg-rose-100/50 text-rose-700 font-medium font-mono">STOCK 0</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-rose-600/80">Sin Existencias</p>
                  <h3 className="text-3xl font-bold tracking-tight text-rose-900">{zeroStockItems.length}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-sm bg-amber-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                    <BarChart3 size={24} />
                  </div>
                  <Badge variant="secondary" className="bg-amber-100/50 text-amber-700 font-medium font-mono">STOCK BAJO</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600/80">Para Reponer</p>
                  <h3 className="text-3xl font-bold tracking-tight text-amber-900">{lowStockItems.length}</h3>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-sm bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600">
                    <History size={24} />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100/50 text-emerald-700 font-medium">MES</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-600/80">Movimientos Hoy</p>
                  <h3 className="text-3xl font-bold tracking-tight text-emerald-900">
                    {movements.filter(m => format(parseISO(m.timestamp), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-neutral-100 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={18} />
                  Alertas de Stock Bajo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-neutral-100">
                  {lowStockItems.length > 0 ? lowStockItems.map(p => (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                      <div>
                        <p className="font-medium text-neutral-900">{p.name}</p>
                        <p className="text-xs text-neutral-500 font-mono">ID: {p.id}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-bold">
                          {getStock(p.id)} {p.unit}
                        </Badge>
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Mínimo sugerido: {p.lowStockThreshold}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center text-neutral-400 italic">No hay alertas de stock bajo</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-neutral-100 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="text-neutral-900" size={18} />
                  Últimos Movimientos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-neutral-100">
                  {recentMovements.length > 0 ? recentMovements.map(m => (
                    <div key={m.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-xl",
                          m.type === 'entry' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {m.type === 'entry' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{m.productName}</p>
                          <p className="text-xs text-neutral-500">{m.userName} • {format(parseISO(m.timestamp), 'HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-bold text-lg",
                          m.type === 'entry' ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {m.type === 'entry' ? '+' : '-'}{m.quantity}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center text-neutral-400 italic">Sin movimientos recientes</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-6 outline-none">
          <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-neutral-100 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <Input 
                    placeholder="Buscar productos por nombre o ID..." 
                    className="pl-10 h-11 rounded-2xl border-neutral-200 bg-neutral-50/50 focus:bg-white transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <label className={cn(buttonVariants({ variant: 'outline' }), "h-11 rounded-2xl border-neutral-200 gap-2 cursor-pointer transition-all hover:bg-neutral-50")}>
                    <Upload size={18} />
                    <span className="hidden sm:inline">Importar</span>
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={importProducts} />
                  </label>
                  <Button variant="outline" className="h-11 rounded-2xl border-neutral-200 gap-2 transition-all hover:bg-neutral-50" onClick={() => exportData('products')}>
                    <Download size={18} />
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                  <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                    <DialogTrigger render={
                      <Button className="h-11 rounded-2xl gap-2 shadow-md" onClick={() => {
                        setEditingProduct(null);
                        setProductForm({ id: '', name: '', unit: 'unidad', lowStockThreshold: 5, category: '', description: '' });
                      }}>
                        <Plus size={18} />
                        Nuevo
                      </Button>
                    } />
                    <DialogContent className="rounded-3xl p-8 max-w-lg">
                      <DialogHeader className="mb-6 px-0 text-left">
                        <DialogTitle className="text-2xl font-bold tracking-tight">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                        <DialogDescription>Completa los datos del producto o material.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSaveProduct} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>ID del Producto</Label>
                            <Input 
                              disabled={!!editingProduct}
                              value={productForm.id} 
                              onChange={e => setProductForm({...productForm, id: e.target.value.toUpperCase()})}
                              className="rounded-xl h-11 border-neutral-200"
                              placeholder="PROD-001"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Input 
                              value={productForm.category} 
                              onChange={e => setProductForm({...productForm, category: e.target.value})}
                              className="rounded-xl h-11 border-neutral-200"
                              placeholder="Herramientas"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nombre del Producto</Label>
                            <Input 
                              value={productForm.name} 
                              onChange={e => setProductForm({...productForm, name: e.target.value})}
                              className="rounded-xl h-11 border-neutral-200"
                              placeholder="Tornillo Hexagonal"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Ubicación / Pasillo</Label>
                            <Input 
                              value={productForm.location || ''} 
                              onChange={e => setProductForm({...productForm, location: e.target.value})}
                              className="rounded-xl h-11 border-neutral-200"
                              placeholder="Pasillo A-4"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Unidad de Medida</Label>
                            <Select value={productForm.unit} onValueChange={v => setProductForm({...productForm, unit: v})}>
                              <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="unidad">Unidad</SelectItem>
                                <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                                <SelectItem value="litro">Litro (L)</SelectItem>
                                <SelectItem value="metro">Metro (m)</SelectItem>
                                <SelectItem value="caja">Caja</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Alerta Stock Bajo</Label>
                            <Input 
                              type="number"
                              value={productForm.lowStockThreshold} 
                              onChange={e => setProductForm({...productForm, lowStockThreshold: Number(e.target.value)})}
                              className="rounded-xl h-11 border-neutral-200"
                              min={1}
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción (Opcional)</Label>
                          <Input 
                            value={productForm.description} 
                            onChange={e => setProductForm({...productForm, description: e.target.value})}
                            className="rounded-xl h-11 border-neutral-200"
                            placeholder="Detalles sobre el material..."
                          />
                        </div>
                        <DialogFooter className="pt-4 gap-2">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            className="rounded-xl h-11" 
                            onClick={() => setIsProductDialogOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" className="rounded-xl h-11 px-8">Guardar</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-neutral-50/50">
                  <TableRow className="border-neutral-100">
                    <TableHead className="w-[120px] font-bold text-neutral-900 pl-6">ID</TableHead>
                    <TableHead className="font-bold text-neutral-900">Nombre</TableHead>
                    <TableHead className="font-bold text-neutral-900">Categoría</TableHead>
                    <TableHead className="font-bold text-neutral-900">Ubicación</TableHead>
                    <TableHead className="font-bold text-neutral-900">Unidad</TableHead>
                    <TableHead className="font-bold text-neutral-900 text-right">Stock</TableHead>
                    <TableHead className="font-bold text-neutral-900 text-center pr-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center text-neutral-400 italic">
                        No hay productos registrados todavía.
                      </TableCell>
                    </TableRow>
                  ) : products
                      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(product => {
                        const stock = getStock(product.id);
                        const isLow = stock > 0 && stock <= product.lowStockThreshold;
                        const isZero = stock === 0;

                        return (
                          <TableRow key={product.id} className="hover:bg-neutral-50/30 transition-all border-neutral-50 group">
                            <TableCell className="font-mono text-xs font-bold pl-6 text-neutral-500">{product.id}</TableCell>
                            <TableCell className="font-medium text-neutral-900">{product.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-lg font-normal border-neutral-200 bg-white text-neutral-600">
                                {product.category || 'Sin categoría'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-neutral-500 font-medium">{product.location || '-'}</TableCell>
                            <TableCell className="text-neutral-500">{product.unit}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn(
                                "rounded-lg px-2.5 py-1 font-bold font-mono min-w-[3rem] text-center",
                                isZero ? "bg-rose-50 text-rose-600 border border-rose-200" :
                                isLow ? "bg-amber-50 text-amber-600 border border-amber-200" :
                                "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              )}>
                                {stock}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center pr-6">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setProductForm({...product});
                                    setIsProductDialogOpen(true);
                                  }}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                  onClick={async () => {
                                    if(confirm('¿Seguro que deseas eliminar este producto? Se perderá el historial.')) {
                                      await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
                                      fetchData();
                                      toast.success('Producto eliminado');
                                    }
                                  }}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 outline-none">
          <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
             <CardHeader className="bg-white border-b border-neutral-100 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <h3 className="text-lg font-bold">Historial de Trazabilidad</h3>
                 <Button variant="outline" className="rounded-2xl border-neutral-200 h-10 gap-2 font-medium" onClick={() => exportData('movements')}>
                    <FileSpreadsheet size={16} /> Exportar Excel
                 </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                <TableHeader className="bg-neutral-50/50">
                  <TableRow className="border-neutral-100">
                    <TableHead className="pl-6 font-bold text-neutral-900">Fecha y Hora</TableHead>
                    <TableHead className="font-bold text-neutral-900">Producto</TableHead>
                    <TableHead className="font-bold text-neutral-900 text-center">Tipo</TableHead>
                    <TableHead className="font-bold text-neutral-900 text-right">Cant.</TableHead>
                    <TableHead className="font-bold text-neutral-900">Responsable / Usuario</TableHead>
                    <TableHead className="font-bold text-neutral-900 pr-6">Motivo / Observación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center text-neutral-400 italic">
                        No hay movimientos registrados.
                      </TableCell>
                    </TableRow>
                  ) : movements.slice().reverse().map(m => (
                    <TableRow key={m.id} className="hover:bg-neutral-50/30 border-neutral-50">
                      <TableCell className="pl-6 text-neutral-500 font-mono text-xs whitespace-nowrap">
                        {format(parseISO(m.timestamp), 'PPpp', { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium text-neutral-900">{m.productName}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "uppercase text-[10px] tracking-widest font-black px-2 py-0.5",
                          m.type === 'entry' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200" : "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200"
                        )} variant="outline">
                          {m.type === 'entry' ? 'Entrada' : 'Salida'}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold font-mono",
                        m.type === 'entry' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {m.type === 'entry' ? '+' : '-'}{m.quantity}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center overflow-hidden">
                             {users.find(u => u.id === m.userId)?.image ? (
                               <img src={users.find(u => u.id === m.userId)?.image} alt="" className="w-full h-full object-cover" />
                             ) : <Box size={12} className="text-neutral-400" />}
                          </div>
                          <span className="text-sm font-medium">{m.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-neutral-500 text-sm pr-6 italic">
                        {m.observation || m.reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Movement Dialog */}
      <Dialog open={isMovementDialogOpen} onOpenChange={(open) => {
        setIsMovementDialogOpen(open);
        if (!open) {
          setRecognizedUser(null);
          setIsScanning(false);
          setMovementForm({ ...movementForm, userId: '', observation: '', reason: '' });
        }
      }}>
        <DialogContent className="rounded-3xl p-8 max-w-2xl">
          <DialogHeader className="mb-6 px-0 text-left">
            <DialogTitle className="text-3xl font-bold tracking-tight">
              {movementType === 'entry' ? 'Registrar Entrada' : 'Registrar Salida de Bodega'}
            </DialogTitle>
            <DialogDescription>
              {movementType === 'entry' ? 'Aumenta el stock del producto.' : 'Identificación requerida para retirar productos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Producto</Label>
                <Select value={movementForm.productId} onValueChange={v => setMovementForm({...movementForm, productId: v})}>
                  <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {getStock(p.id)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input 
                  type="number"
                  value={movementForm.quantity} 
                  onChange={e => setMovementForm({...movementForm, quantity: Number(e.target.value)})}
                  className="rounded-xl h-11 border-neutral-200"
                  min={1}
                />
              </div>

              {movementType === 'entry' ? (
                <div className="space-y-2">
                  <Label>Responsable (Opcional)</Label>
                  <Select value={movementForm.userId} onValueChange={v => setMovementForm({...movementForm, userId: v})}>
                    <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                      <SelectValue placeholder="Quien recibe..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>{movementType === 'entry' ? 'Observaciones' : 'Motivo / Destino'}</Label>
                <Input 
                  value={movementType === 'entry' ? movementForm.observation : movementForm.reason} 
                  onChange={e => setMovementForm({...movementForm, [movementType === 'entry' ? 'observation' : 'reason']: e.target.value})}
                  className="rounded-xl h-11 border-neutral-200"
                  placeholder={movementType === 'entry' ? "Ej: Pedido proveedor..." : "Ej: Reparación oficina..."}
                />
              </div>
            </div>

            <div className="space-y-4">
              {movementType === 'exit' && (
                <div className="flex flex-col h-full gap-4">
                  <Label className="flex items-center gap-2">
                    <UserCheck size={16} className="text-primary" />
                    Identificación del Solicitante
                  </Label>
                  
                  <div className="flex-1 bg-neutral-900 rounded-3xl overflow-hidden relative border-4 border-neutral-50 shadow-inner min-h-[240px]">
                    {isScanning ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover grayscale-[0.3]"
                      />
                    ) : recognizedUser ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-primary/10">
                         <img src={recognizedUser.image} alt="" className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-xl mb-4" />
                         <h4 className="text-lg font-bold text-primary">{recognizedUser.name}</h4>
                         <Badge variant="outline" className="mt-2 bg-white/50 border-primary/20 text-primary">Identidad Verificada</Badge>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-4 text-xs h-8 rounded-lg"
                            onClick={() => {
                              setRecognizedUser(null);
                              setIsScanning(true);
                            }}
                          >
                           Re-intentar escaneo
                         </Button>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-neutral-400 p-8 text-center">
                        <Camera size={48} className="opacity-20 translate-y-2" />
                        <p className="text-sm">Inicia la cámara para el reconocimiento facial</p>
                        <Button 
                          variant="secondary" 
                          className="rounded-2xl h-10 w-full"
                          onClick={() => setIsScanning(true)}
                        >
                          Escanear Rostro
                        </Button>
                        <div className="flex items-center gap-2 w-full">
                          <div className="h-[1px] bg-neutral-800 flex-1"></div>
                          <span className="text-[10px] font-bold text-neutral-600 uppercase">o selecciona manual</span>
                          <div className="h-[1px] bg-neutral-800 flex-1"></div>
                        </div>
                        <Select value={movementForm.userId} onValueChange={v => setMovementForm({...movementForm, userId: v})}>
                          <SelectTrigger className="rounded-xl h-10 bg-neutral-800 border-neutral-700 text-neutral-200">
                            <SelectValue placeholder="Seleccionar usuario..." />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-8 pt-6 border-t border-neutral-100 gap-2">
            <Button variant="ghost" className="rounded-xl h-11" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button className={cn(
              "rounded-xl h-11 px-10 shadow-lg font-bold transition-all",
              movementType === 'entry' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            )} onClick={handleAddMovement}>
              Finalizar Registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-6 px-0 text-left">
            <DialogTitle className="text-3xl font-bold tracking-tight">Previsualización de Importación</DialogTitle>
            <DialogDescription>
              Hemos analizado el archivo. Revisa los datos y posibles errores antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="py-20 text-center space-y-4">
              <RefreshCw className="animate-spin mx-auto text-primary" size={48} />
              <h3 className="text-xl font-bold text-neutral-900">Importando datos...</h3>
              <div className="max-w-md mx-auto">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-neutral-500 mt-2 font-mono">{importProgress}% completado</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {importResults.errors.length > 0 && (
                <Card className="rounded-2xl border-rose-100 bg-rose-50/50">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-bold text-rose-800 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Se encontraron {importResults.errors.length} errores en el archivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0 pb-4">
                    <div className="max-h-[150px] overflow-y-auto space-y-1">
                      {importResults.errors.map((err, i) => (
                        <p key={i} className="text-xs text-rose-600">
                          <span className="font-bold">Fila {err.row}:</span> {err.msg}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <Package size={18} />
                  Productos a importar ({importResults.valid.length})
                </h4>
                <div className="border rounded-2xl overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-neutral-50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-bold">Producto</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Categoría</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">Cant.</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Unidad</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Ubicación</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Último Ret.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.valid.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs">{item.name}</TableCell>
                          <TableCell className="text-xs">{item.category}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-emerald-600">+{item.quantity}</TableCell>
                          <TableCell className="text-xs">{item.unit}</TableCell>
                          <TableCell className="text-xs">{item.location || '-'}</TableCell>
                          <TableCell className="text-xs text-neutral-500 italic">{item.lastUser}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="pt-4 gap-2 border-t border-neutral-100 flex-col sm:flex-row">
                <div className="flex-1 text-sm text-neutral-500 italic flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   Los productos existentes sumarán el nuevo stock.
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="rounded-xl h-11" onClick={() => setIsImportPreviewOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    className="rounded-xl h-11 px-8 shadow-md" 
                    onClick={confirmImport}
                    disabled={importResults.valid.length === 0}
                  >
                    Confirmar Importación
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
