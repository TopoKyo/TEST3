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
  UserCheck,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  PackageCheck,
  Printer,
  Sparkles,
  FileText
} from 'lucide-react';
import { Product, InventoryMovement, User, MovementType, EPPDelivery } from '@/src/types';
import { faceService } from '@/src/lib/faceService';
import { firestoreService } from '@/src/lib/firestoreService';
import { format, parseISO, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface InventoryManagementProps {
  users: User[];
  onUpdate?: () => void;
}

const DEFAULT_EPP_ITEMS: Partial<Product>[] = [
  { id: 'EPP-001', name: 'Casco de Seguridad Dieléctrico', category: 'EPP', unit: 'unidad', lowStockThreshold: 5, location: 'Bodega EPP - Estante 1', isEpp: true, description: 'Casco tipo I clase E con arnés y perilla de ajuste' },
  { id: 'EPP-002', name: 'Lentes de Seguridad Transparentes', category: 'EPP', unit: 'unidad', lowStockThreshold: 10, location: 'Bodega EPP - Estante 1', isEpp: true, description: 'Lentes policarbonato anti-rayaduras y protección UV' },
  { id: 'EPP-003', name: 'Guantes de Cabritilla / Trabajo', category: 'EPP', unit: 'par', lowStockThreshold: 15, location: 'Bodega EPP - Caja 2', isEpp: true, description: 'Guantes de cuero de alta resistencia' },
  { id: 'EPP-004', name: 'Chaleco Reflectante Geólogo', category: 'EPP', unit: 'unidad', lowStockThreshold: 5, location: 'Bodega EPP - Estante 2', isEpp: true, description: 'Chaleco con cintas reflectantes de alta visibilidad' },
  { id: 'EPP-005', name: 'Zapatos de Seguridad (Punta de Acero)', category: 'EPP', unit: 'par', lowStockThreshold: 4, location: 'Bodega EPP - Estante 3', isEpp: true, description: 'Calzado dieléctrico con puntera de acero' },
  { id: 'EPP-006', name: 'Arnés de Seguridad Anti-caídas', category: 'EPP', unit: 'unidad', lowStockThreshold: 3, location: 'Bodega EPP - Perchero A', isEpp: true, description: 'Arnés multipropósito de 4 puntos de anclaje' },
  { id: 'EPP-007', name: 'Protector Auditivo (Tipo Copa / Fono)', category: 'EPP', unit: 'unidad', lowStockThreshold: 5, location: 'Bodega EPP - Caja 4', isEpp: true, description: 'Protector auditivo fono atenúa hasta 27 dB' },
  { id: 'EPP-008', name: 'Mascarilla de Protección N95 / P100', category: 'EPP', unit: 'caja', lowStockThreshold: 5, location: 'Bodega EPP - Caja 1', isEpp: true, description: 'Caja x 20 mascarillas para polvo fino' },
  { id: 'EPP-009', name: 'Barbiquejo para Casco con Mentonera', category: 'EPP', unit: 'unidad', lowStockThreshold: 10, location: 'Bodega EPP - Caja 2', isEpp: true, description: 'Barbiquejo elástico para casco de protección' }
];

export default function InventoryManagement({ users, onUpdate }: InventoryManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [eppDeliveries, setEppDeliveries] = useState<EPPDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // EPP specific states
  const [eppSubTab, setEppSubTab] = useState<'inventory' | 'deliveries'>('inventory');
  const [eppSearchTerm, setEppSearchTerm] = useState('');
  const [isEPPDeliveryDialogOpen, setIsEPPDeliveryDialogOpen] = useState(false);
  const [isEPPCountAuditOpen, setIsEPPCountAuditOpen] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, { count: number; note: string }>>({});
  const [selectedEppDeliveryForReceipt, setSelectedEppDeliveryForReceipt] = useState<EPPDelivery | null>(null);

  // EPP delivery form
  const [eppDeliveryForm, setEppDeliveryForm] = useState({
    productId: '',
    quantity: 1,
    size: 'Estándar',
    condition: 'Nuevo (Entrega inicial)',
    userId: '',
    deliveredBy: '',
    observation: ''
  });

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
    description: '',
    isEpp: false
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
      const [prodData, movData, delivData] = await Promise.all([
        firestoreService.getAll<Product>('products'),
        firestoreService.getAll<InventoryMovement>('inventoryMovements'),
        firestoreService.getAll<EPPDelivery>('eppDeliveries')
      ]);
      setProducts(prodData || []);
      setMovements(movData || []);
      setEppDeliveries(delivData || []);
    } catch (error) {
      toast.error('Error al cargar datos de inventario');
    } finally {
      setLoading(false);
    }
  };

  const isEPPProduct = (p: Product) => {
    if (p.isEpp) return true;
    const cat = (p.category || '').toUpperCase();
    if (cat.includes('EPP') || cat.includes('PROTECCI') || cat.includes('SEGURIDAD')) return true;
    const name = p.name.toUpperCase();
    return ['CASCO', 'LENTES', 'GUANTES', 'CHALECO', 'ZAPATOS', 'ARNÉS', 'ARNES', 'PROTECTOR', 'MASCARILLA', 'BARBIQUEJO', 'TAPON', 'PUNTA DE ACERO'].some(kw => name.includes(kw));
  };

  const getStock = (productId: string) => {
    return movements
      .filter(m => m.productId === productId)
      .reduce((acc, m) => acc + (m.type === 'entry' ? m.quantity : -m.quantity), 0);
  };

  const seedBaseEPP = async () => {
    try {
      setLoading(true);
      let addedCount = 0;

      for (const item of DEFAULT_EPP_ITEMS) {
        const existing = products.find(p => p.id === item.id || p.name.toLowerCase() === item.name?.toLowerCase());
        if (!existing) {
          await firestoreService.add('products', item as Product);
          // Add initial stock entry movement of 20 units
          await firestoreService.add('inventoryMovements', {
            id: Math.random().toString(36).substr(2, 9),
            productId: item.id!,
            productName: item.name!,
            type: 'entry',
            quantity: 20,
            userId: 'system',
            userName: 'Stock Inicial EPP',
            timestamp: new Date().toISOString(),
            observation: 'Poblado inicial de inventario base de EPP'
          } as InventoryMovement);
          addedCount++;
        }
      }

      toast.success(`Se agregaron ${addedCount} elementos de EPP con stock inicial`);
      await fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Error al inicializar inventario de EPP');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.id || !productForm.name) return;

    try {
      const isEpp = productForm.isEpp || (productForm.category || '').toUpperCase().includes('EPP');
      const payload: Product = {
        id: productForm.id,
        name: productForm.name,
        category: productForm.category || (isEpp ? 'EPP' : 'General'),
        unit: productForm.unit || 'unidad',
        lowStockThreshold: productForm.lowStockThreshold ?? 5,
        location: productForm.location || '',
        description: productForm.description || '',
        isEpp: Boolean(isEpp)
      };

      if (editingProduct) {
        await firestoreService.update('products', editingProduct.id, payload);
        toast.success('Producto actualizado');
      } else {
        await firestoreService.add('products', payload);
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

  // EPP Delivery Registration ("Entregado")
  const handleDeliverEPP = async () => {
    if (!eppDeliveryForm.productId) {
      toast.error('Selecciona un elemento de EPP');
      return;
    }
    if (eppDeliveryForm.quantity <= 0) {
      toast.error('Ingresa una cantidad válida de EPP');
      return;
    }

    const recipient = recognizedUser || users.find(u => u.id === eppDeliveryForm.userId);
    if (!recipient) {
      toast.error('Selecciona o escanea al trabajador que recibe el EPP');
      return;
    }

    const product = products.find(p => p.id === eppDeliveryForm.productId);
    if (!product) return;

    const currentStock = getStock(product.id);
    if (currentStock < eppDeliveryForm.quantity) {
      toast.error(`Stock insuficiente de ${product.name}. Stock disponible: ${currentStock}`);
      return;
    }

    try {
      const timestamp = new Date().toISOString();

      // 1. Save EPP Delivery Log
      const deliveryRecord: EPPDelivery = {
        id: `DEL-${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
        productId: product.id,
        productName: product.name,
        quantity: eppDeliveryForm.quantity,
        recipientId: recipient.id,
        recipientName: recipient.name,
        deliveredByName: eppDeliveryForm.deliveredBy || 'Bodega / Supervisor',
        timestamp,
        size: eppDeliveryForm.size || 'Estándar',
        condition: eppDeliveryForm.condition || 'Nuevo',
        observation: eppDeliveryForm.observation
      };

      await firestoreService.add('eppDeliveries', deliveryRecord);

      // 2. Register Exit Movement in Inventory Movements
      const movementRecord: InventoryMovement = {
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        productName: product.name,
        type: 'exit',
        quantity: eppDeliveryForm.quantity,
        userId: recipient.id,
        userName: recipient.name,
        timestamp,
        reason: `Entrega EPP (${eppDeliveryForm.condition}) - Talla: ${eppDeliveryForm.size || 'Estándar'}`,
        observation: eppDeliveryForm.observation,
        isEppDelivery: true,
        eppSize: eppDeliveryForm.size,
        eppCondition: eppDeliveryForm.condition
      };

      await firestoreService.add('inventoryMovements', movementRecord);

      toast.success(`EPP (${product.name}) entregado exitosamente a ${recipient.name}`);
      setIsEPPDeliveryDialogOpen(false);
      setRecognizedUser(null);
      setIsScanning(false);
      setEppDeliveryForm({
        productId: '',
        quantity: 1,
        size: 'Estándar',
        condition: 'Nuevo (Entrega inicial)',
        userId: '',
        deliveredBy: '',
        observation: ''
      });
      fetchData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar la entrega de EPP');
    }
  };

  // EPP Stock Count Audit ("Hacer Inventario")
  const handleApplyEPPInventoryAudit = async () => {
    const eppProds = products.filter(isEPPProduct);
    let adjustmentsCount = 0;

    try {
      for (const prod of eppProds) {
        const sysStock = getStock(prod.id);
        const entry = physicalCounts[prod.id];
        if (entry && entry.count !== undefined && !isNaN(entry.count)) {
          const count = Number(entry.count);
          const diff = count - sysStock;

          if (diff !== 0) {
            adjustmentsCount++;
            const type: MovementType = diff > 0 ? 'entry' : 'exit';
            const qty = Math.abs(diff);
            const reason = `Ajuste conteo físico EPP (${diff > 0 ? '+' : ''}${diff}). ${entry.note ? 'Nota: ' + entry.note : ''}`;

            await firestoreService.add('inventoryMovements', {
              id: Math.random().toString(36).substr(2, 9),
              productId: prod.id,
              productName: prod.name,
              type,
              quantity: qty,
              userId: 'system',
              userName: 'Auditoría Inventario EPP',
              timestamp: new Date().toISOString(),
              observation: reason,
              reason
            } as InventoryMovement);
          }
        }
      }

      if (adjustmentsCount > 0) {
        toast.success(`Inventario de EPP actualizado: ${adjustmentsCount} ajuste(s) registrado(s)`);
      } else {
        toast.info('Sin diferencias detectadas entre conteo físico y sistema');
      }

      setIsEPPCountAuditOpen(false);
      setPhysicalCounts({});
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Error al aplicar el inventario de EPP');
    }
  };

  // Camera integration
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let isProcessing = false;
    let frameCount = 0;

    if (isScanning && (movementType === 'exit' || isEPPDeliveryDialogOpen)) {
      const startCam = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 }, 
              height: { ideal: 480 },
              facingMode: 'user'
            } 
          });
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) { toast.error('Cámara no disponible'); }
      };
      startCam();

      if (users.length > 0) {
        const matcher = faceService.createMatcher(users.map(u => ({ name: u.id, descriptor: u.faceDescriptor })));
        
        const scan = async () => {
          if (!videoRef.current || !isScanning) {
            animationFrameId = requestAnimationFrame(scan);
            return;
          }

          frameCount++;
          if (frameCount % 6 !== 0) {
            animationFrameId = requestAnimationFrame(scan);
            return;
          }

          if (isProcessing) {
            animationFrameId = requestAnimationFrame(scan);
            return;
          }

          isProcessing = true;

          try {
            const results = await faceService.recognizeFace(videoRef.current, matcher);
            if (results.length > 0 && isScanning) {
              const match = results[0];
              if (match.label !== 'unknown' && match.distance < 0.45) {
                const user = users.find(u => u.id === match.label);
                if (user) {
                  setRecognizedUser(user);
                  setIsScanning(false);
                }
              }
            }
          } catch (error) {
            console.error("Inventory scan error:", error);
          } finally {
            isProcessing = false;
            animationFrameId = requestAnimationFrame(scan);
          }
        };
        animationFrameId = requestAnimationFrame(scan);
      }
    }

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isScanning, movementType, isEPPDeliveryDialogOpen, users]);

  const exportData = (type: 'products' | 'movements' | 'epp') => {
    let data: any[] = [];
    let sheetName = 'Export';

    if (type === 'products') {
      sheetName = 'Productos';
      data = products.map(p => ({
        ID: p.id,
        Nombre: p.name,
        Categoría: p.category,
        Unidad: p.unit,
        Ubicación: p.location || '-',
        Stock: getStock(p.id)
      }));
    } else if (type === 'movements') {
      sheetName = 'Movimientos';
      data = movements.map(m => ({
        Fecha: format(parseISO(m.timestamp), 'PPpp', { locale: es }),
        Producto: m.productName,
        Tipo: m.type === 'entry' ? 'Entrada' : 'Salida',
        Cantidad: m.quantity,
        Usuario: m.userName,
        Observación: m.observation || m.reason || '-'
      }));
    } else if (type === 'epp') {
      sheetName = 'Entregas_EPP';
      data = eppDeliveries.map(d => ({
        ID_Entrega: d.id,
        Fecha: format(parseISO(d.timestamp), 'PPpp', { locale: es }),
        Trabajador: d.recipientName,
        EPP: d.productName,
        Cantidad: d.quantity,
        Talla: d.size || 'Estándar',
        Condición: d.condition || 'Nuevo',
        Supervisor: d.deliveredByName || '-',
        Observación: d.observation || '-'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
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

          const normalizedUnit = String(rawUnit).trim().toLowerCase().startsWith('unid') ? 'unidad' : String(rawUnit).trim().toLowerCase();
          const location = String(rawLocation).trim() === 'N/A' ? null : String(rawLocation).trim();
          const user = String(rawUser).trim() === 'N/A' ? 'Sistema (Importación)' : String(rawUser).trim();
          
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
        const existing = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        
        let targetProductId = '';
        if (existing) {
          targetProductId = existing.id;
          updated++;
        } else {
          const newId = `PROD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          const isEpp = item.category.toUpperCase().includes('EPP');
          await firestoreService.add('products', {
            id: newId,
            name: item.name,
            category: item.category,
            unit: item.unit,
            location: item.location,
            lowStockThreshold: 5,
            isEpp
          } as Product);
          targetProductId = newId;
          created++;
        }

        if (targetProductId) {
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

  // Stats
  const eppProducts = products.filter(isEPPProduct);
  const lowStockItems = products.filter(p => getStock(p.id) > 0 && getStock(p.id) <= p.lowStockThreshold);
  const zeroStockItems = products.filter(p => getStock(p.id) === 0);
  const recentMovements = movements.slice(-5).reverse();

  // EPP specific stats
  const eppLowStock = eppProducts.filter(p => getStock(p.id) <= p.lowStockThreshold);
  const totalEPPUnits = eppProducts.reduce((acc, p) => acc + getStock(p.id), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900">Bodega e Inventario</h2>
          <p className="text-neutral-500 mt-1">Control de inventario, gestión de EPP, entregas a personal y trazabilidad.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            className="rounded-xl shadow-md bg-amber-600 hover:bg-amber-700 text-white font-bold"
            onClick={() => {
              setEppDeliveryForm({
                productId: eppProducts[0]?.id || '',
                quantity: 1,
                size: 'Estándar',
                condition: 'Nuevo (Entrega inicial)',
                userId: '',
                deliveredBy: '',
                observation: ''
              });
              setIsEPPDeliveryDialogOpen(true);
            }}
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Entregar EPP
          </Button>
          <Button 
            className="rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700" 
            onClick={() => {
              setMovementType('entry');
              setIsMovementDialogOpen(true);
            }}
          >
            <ArrowUpRight className="mr-2 h-4 w-4" /> Entrada
          </Button>
          <Button 
            className="rounded-xl shadow-sm bg-rose-600 hover:bg-rose-700" 
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
        <TabsList className="bg-neutral-100 p-1 rounded-2xl mb-8 flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-sm font-medium">Resumen</TabsTrigger>
          <TabsTrigger value="products" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-sm font-medium">Productos General</TabsTrigger>
          <TabsTrigger value="epp" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white font-bold transition-all text-sm flex items-center gap-2">
            <ShieldCheck size={16} /> Sección EPP ({eppProducts.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-sm font-medium">Historial General</TabsTrigger>
        </TabsList>

        {/* DASHBOARD TAB */}
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

            <Card className="rounded-3xl border-none shadow-sm bg-amber-50/60">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-100 rounded-2xl text-amber-700">
                    <ShieldCheck size={24} />
                  </div>
                  <Badge variant="secondary" className="bg-amber-100/50 text-amber-800 font-bold">EPP</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-700/80">Equipos de Protección (EPP)</p>
                  <h3 className="text-3xl font-bold tracking-tight text-amber-950">{eppProducts.length} Ítems</h3>
                  <p className="text-xs text-amber-700/70 font-medium">{totalEPPUnits} unidades totales</p>
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

            <Card className="rounded-3xl border-none shadow-sm bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600">
                    <History size={24} />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100/50 text-emerald-700 font-medium">HOY</Badge>
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-neutral-900">{p.name}</p>
                          {isEPPProduct(p) && <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">EPP</Badge>}
                        </div>
                        <p className="text-xs text-neutral-500 font-mono">ID: {p.id}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-bold">
                          {getStock(p.id)} {p.unit}
                        </Badge>
                        <p className="text-[10px] text-neutral-400 mt-1 italic">Mínimo: {p.lowStockThreshold}</p>
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

        {/* GENERAL PRODUCTS TAB */}
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
                  <Button 
                    className="rounded-2xl h-11 px-4 gap-2 bg-neutral-900 text-white hover:bg-neutral-800 shadow-md font-medium"
                    onClick={() => {
                      setEditingProduct(null);
                      setProductForm({ id: `PROD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`, name: '', unit: 'unidad', lowStockThreshold: 5, category: 'General', description: '', isEpp: false });
                      setIsProductDialogOpen(true);
                    }}
                  >
                    <Plus size={18} />
                    Nuevo Producto
                  </Button>
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
                      <TableCell colSpan={7} className="h-48 text-center text-neutral-400 italic">
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
                            <TableCell className="font-medium text-neutral-900">
                              <div className="flex items-center gap-2">
                                <span>{product.name}</span>
                                {isEPPProduct(product) && <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold border-none">EPP</Badge>}
                              </div>
                            </TableCell>
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
                                      try {
                                        await firestoreService.delete('products', product.id);
                                      } catch(e) {
                                        await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
                                      }
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

        {/* EPP DEDICATED SECTION TAB */}
        <TabsContent value="epp" className="space-y-6 outline-none">
          {/* EPP Banner & Actions Header */}
          <Card className="rounded-3xl border-amber-200/60 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/50 shadow-sm overflow-hidden p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shadow-md">
                    <ShieldCheck size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-amber-950">Sección de Equipos de Protección Personal (EPP)</h3>
                </div>
                <p className="text-sm text-amber-900/80 max-w-2xl">
                  Gestión exclusiva del inventario de EPP, entrega registrada por trabajador y auditoría física de stock.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button 
                  className="rounded-2xl h-12 px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg gap-2"
                  onClick={() => {
                    setEppDeliveryForm({
                      productId: eppProducts[0]?.id || '',
                      quantity: 1,
                      size: 'Estándar',
                      condition: 'Nuevo (Entrega inicial)',
                      userId: '',
                      deliveredBy: '',
                      observation: ''
                    });
                    setIsEPPDeliveryDialogOpen(true);
                  }}
                >
                  <ShieldCheck size={18} />
                  <span>Entregado / Registrar Entrega</span>
                </Button>

                <Button 
                  className="rounded-2xl h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg gap-2"
                  onClick={() => {
                    const counts: Record<string, { count: number; note: string }> = {};
                    eppProducts.forEach(p => {
                      counts[p.id] = { count: getStock(p.id), note: '' };
                    });
                    setPhysicalCounts(counts);
                    setIsEPPCountAuditOpen(true);
                  }}
                >
                  <ClipboardList size={18} />
                  <span>Hacer Inventario (Conteo)</span>
                </Button>

                <Button 
                  variant="outline"
                  className="rounded-2xl h-12 px-5 border-amber-300 bg-white/80 hover:bg-white text-amber-900 font-bold gap-2"
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({ 
                      id: `EPP-${Math.random().toString(36).substr(2, 4).toUpperCase()}`, 
                      name: '', 
                      unit: 'unidad', 
                      lowStockThreshold: 5, 
                      category: 'EPP', 
                      description: '', 
                      isEpp: true 
                    });
                    setIsProductDialogOpen(true);
                  }}
                >
                  <Plus size={18} />
                  <span>Nuevo EPP</span>
                </Button>
              </div>
            </div>

            {/* EPP Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-amber-200/50">
              <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-amber-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Ítems de EPP</span>
                <p className="text-2xl font-black text-amber-950 mt-1">{eppProducts.length}</p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-amber-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Stock Total EPP</span>
                <p className="text-2xl font-black text-amber-950 mt-1">{totalEPPUnits} <span className="text-xs font-normal text-amber-800">unid.</span></p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-amber-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Entregas Registradas</span>
                <p className="text-2xl font-black text-amber-950 mt-1">{eppDeliveries.length}</p>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-amber-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Alertas Reposición</span>
                <p className="text-2xl font-black text-rose-600 mt-1">{eppLowStock.length}</p>
              </div>
            </div>
          </Card>

          {/* Sub Navigation Bar for EPP */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-neutral-100 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                variant={eppSubTab === 'inventory' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-bold flex-1 sm:flex-none", eppSubTab === 'inventory' && "bg-amber-600 hover:bg-amber-700")}
                onClick={() => setEppSubTab('inventory')}
              >
                <Package className="mr-2 h-4 w-4" /> Inventario de EPP ({eppProducts.length})
              </Button>
              <Button 
                variant={eppSubTab === 'deliveries' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-bold flex-1 sm:flex-none", eppSubTab === 'deliveries' && "bg-amber-600 hover:bg-amber-700")}
                onClick={() => setEppSubTab('deliveries')}
              >
                <History className="mr-2 h-4 w-4" /> Historial de Entregas (Entregado) ({eppDeliveries.length})
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {eppProducts.length === 0 && (
                <Button variant="outline" className="rounded-xl border-dashed border-amber-300 text-amber-800 bg-amber-50/50 hover:bg-amber-100 text-xs font-bold" onClick={seedBaseEPP}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Cargar EPP Base de Obra
                </Button>
              )}
              <Button variant="outline" className="rounded-xl border-neutral-200 h-10 text-xs gap-1.5" onClick={() => exportData(eppSubTab === 'inventory' ? 'products' : 'epp')}>
                <Download size={14} /> Exportar
              </Button>
            </div>
          </div>

          {/* SUB-TAB 1: INVENTARIO DE EPP */}
          {eppSubTab === 'inventory' && (
            <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-neutral-100 pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <Input 
                    placeholder="Buscar en el inventario de EPP..." 
                    className="pl-10 h-11 rounded-2xl border-neutral-200 bg-neutral-50/50 focus:bg-white transition-all"
                    value={eppSearchTerm}
                    onChange={(e) => setEppSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-amber-50/40">
                    <TableRow className="border-neutral-100">
                      <TableHead className="w-[110px] font-bold text-neutral-900 pl-6">ID EPP</TableHead>
                      <TableHead className="font-bold text-neutral-900">Elemento de Protección</TableHead>
                      <TableHead className="font-bold text-neutral-900">Ubicación</TableHead>
                      <TableHead className="font-bold text-neutral-900">Unidad</TableHead>
                      <TableHead className="font-bold text-neutral-900 text-right">Stock Actual</TableHead>
                      <TableHead className="font-bold text-neutral-900 text-center">Estado Stock</TableHead>
                      <TableHead className="font-bold text-neutral-900 text-center pr-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eppProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center text-neutral-400 italic">
                          <div className="flex flex-col items-center justify-center gap-3 py-6">
                            <ShieldCheck className="h-12 w-12 text-amber-300" />
                            <p className="font-medium text-neutral-600">No hay elementos de EPP registrados aún.</p>
                            <Button className="rounded-2xl bg-amber-600 hover:bg-amber-700 mt-2 font-bold" onClick={seedBaseEPP}>
                              <Sparkles className="mr-2 h-4 w-4" /> Cargar EPP Base de Obra
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : eppProducts
                        .filter(p => p.name.toLowerCase().includes(eppSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(eppSearchTerm.toLowerCase()))
                        .map(product => {
                          const stock = getStock(product.id);
                          const isLow = stock > 0 && stock <= product.lowStockThreshold;
                          const isZero = stock === 0;

                          return (
                            <TableRow key={product.id} className="hover:bg-amber-50/20 transition-all border-neutral-50 group">
                              <TableCell className="font-mono text-xs font-bold pl-6 text-amber-900/70">{product.id}</TableCell>
                              <TableCell className="font-medium text-neutral-900">
                                <div>
                                  <p className="font-bold text-neutral-900">{product.name}</p>
                                  {product.description && <p className="text-xs text-neutral-400 truncate max-w-md">{product.description}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="text-neutral-500 font-medium text-sm">{product.location || 'Bodega General'}</TableCell>
                              <TableCell className="text-neutral-500 text-sm">{product.unit}</TableCell>
                              <TableCell className="text-right">
                                <span className="font-black font-mono text-lg text-neutral-900">{stock}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={cn(
                                  "rounded-lg px-2.5 py-1 font-bold text-xs border-none",
                                  isZero ? "bg-rose-100 text-rose-700" :
                                  isLow ? "bg-amber-100 text-amber-800" :
                                  "bg-emerald-100 text-emerald-800"
                                )}>
                                  {isZero ? 'Sin Existencias' : isLow ? 'Stock Bajo' : 'Disponible'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center pr-6">
                                <div className="flex items-center justify-center gap-1">
                                  <Button 
                                    size="sm"
                                    className="h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3"
                                    onClick={() => {
                                      setEppDeliveryForm({
                                        productId: product.id,
                                        quantity: 1,
                                        size: 'Estándar',
                                        condition: 'Nuevo (Entrega inicial)',
                                        userId: '',
                                        deliveredBy: '',
                                        observation: ''
                                      });
                                      setIsEPPDeliveryDialogOpen(true);
                                    }}
                                  >
                                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Entregar
                                  </Button>
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
                                      if(confirm('¿Seguro que deseas eliminar este elemento de EPP?')) {
                                        try {
                                          await firestoreService.delete('products', product.id);
                                        } catch(e) {
                                          await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
                                        }
                                        fetchData();
                                        toast.success('EPP eliminado');
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
          )}

          {/* SUB-TAB 2: HISTORIAL DE ENTREGAS DE EPP (ENTREGADO) */}
          {eppSubTab === 'deliveries' && (
            <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-neutral-100 pb-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <ShieldCheck className="text-amber-600" size={20} />
                    Registro de Entregas de EPP
                  </h3>
                  <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <Input 
                      placeholder="Buscar por trabajador o EPP..." 
                      className="pl-9 h-10 rounded-xl text-sm"
                      value={eppSearchTerm}
                      onChange={e => setEppSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-neutral-50/50">
                    <TableRow className="border-neutral-100">
                      <TableHead className="pl-6 font-bold text-neutral-900">Fecha y Hora</TableHead>
                      <TableHead className="font-bold text-neutral-900">Trabajador / Receptor</TableHead>
                      <TableHead className="font-bold text-neutral-900">EPP Entregado</TableHead>
                      <TableHead className="font-bold text-neutral-900 text-center">Cant.</TableHead>
                      <TableHead className="font-bold text-neutral-900">Talla / Condición</TableHead>
                      <TableHead className="font-bold text-neutral-900">Entregado Por</TableHead>
                      <TableHead className="font-bold text-neutral-900 text-center pr-6">Comprobante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eppDeliveries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center text-neutral-400 italic">
                          No hay entregas de EPP registradas aún. Haz clic en "Entregado / Registrar Entrega" para registrar la primera.
                        </TableCell>
                      </TableRow>
                    ) : eppDeliveries
                        .slice()
                        .reverse()
                        .filter(d => 
                          d.recipientName.toLowerCase().includes(eppSearchTerm.toLowerCase()) || 
                          d.productName.toLowerCase().includes(eppSearchTerm.toLowerCase())
                        )
                        .map(d => (
                          <TableRow key={d.id} className="hover:bg-amber-50/10 border-neutral-50">
                            <TableCell className="pl-6 text-neutral-500 font-mono text-xs whitespace-nowrap">
                              {format(parseISO(d.timestamp), 'PPpp', { locale: es })}
                            </TableCell>
                            <TableCell className="font-bold text-neutral-900">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center font-bold text-amber-800 text-xs">
                                  {d.recipientName.charAt(0)}
                                </div>
                                <span>{d.recipientName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-amber-950">{d.productName}</TableCell>
                            <TableCell className="text-center font-black font-mono text-emerald-600">
                              {d.quantity}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs">
                                <span className="font-semibold text-neutral-700">Talla: {d.size || 'Estándar'}</span>
                                <span className="text-neutral-400 italic">{d.condition || 'Nuevo'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-neutral-600">{d.deliveredByName || 'Bodega'}</TableCell>
                            <TableCell className="text-center pr-6">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 rounded-xl text-xs font-bold gap-1 border-neutral-200"
                                onClick={() => setSelectedEppDeliveryForReceipt(d)}
                              >
                                <FileText size={14} /> Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GENERAL HISTORY TAB */}
        <TabsContent value="history" className="space-y-6 outline-none">
          <Card className="rounded-3xl border-neutral-100 shadow-sm overflow-hidden">
             <CardHeader className="bg-white border-b border-neutral-100 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <h3 className="text-lg font-bold">Historial de Trazabilidad General</h3>
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
                      <TableCell className="font-medium text-neutral-900">
                        <div className="flex items-center gap-1.5">
                          <span>{m.productName}</span>
                          {m.isEppDelivery && <Badge className="bg-amber-100 text-amber-800 text-[9px] font-bold">ENTREGA EPP</Badge>}
                        </div>
                      </TableCell>
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

      {/* DIALOG 1: REGISTRAR ENTREGA DE EPP (OPCION "ENTREGADO") */}
      <Dialog open={isEPPDeliveryDialogOpen} onOpenChange={(open) => {
        setIsEPPDeliveryDialogOpen(open);
        if (!open) {
          setRecognizedUser(null);
          setIsScanning(false);
        }
      }}>
        <DialogContent className="rounded-3xl p-8 max-w-2xl">
          <DialogHeader className="mb-4 px-0 text-left">
            <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2 text-amber-950">
              <ShieldCheck className="text-amber-600" size={28} />
              Entregar EPP a Trabajador
            </DialogTitle>
            <DialogDescription>
              Registra la entrega de Equipo de Protección Personal, asignándolo al trabajador correspondiente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold">Elemento de EPP</Label>
                <Select 
                  value={eppDeliveryForm.productId} 
                  onValueChange={v => setEppDeliveryForm({ ...eppDeliveryForm, productId: v })}
                >
                  <SelectTrigger className="rounded-xl h-11 border-neutral-200 bg-neutral-50">
                    <SelectValue placeholder="Seleccionar EPP..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
                    {eppProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (Stock: {getStock(p.id)} {p.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-bold">Cantidad</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={eppDeliveryForm.quantity}
                    onChange={e => setEppDeliveryForm({ ...eppDeliveryForm, quantity: Number(e.target.value) })}
                    className="rounded-xl h-11 border-neutral-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Talla / Medida</Label>
                  <Select 
                    value={eppDeliveryForm.size} 
                    onValueChange={v => setEppDeliveryForm({ ...eppDeliveryForm, size: v })}
                  >
                    <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                      <SelectValue placeholder="Talla" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Estándar">Estándar / Única</SelectItem>
                      <SelectItem value="S">Talla S</SelectItem>
                      <SelectItem value="M">Talla M</SelectItem>
                      <SelectItem value="L">Talla L</SelectItem>
                      <SelectItem value="XL">Talla XL</SelectItem>
                      <SelectItem value="XXL">Talla XXL</SelectItem>
                      <SelectItem value="38">Talla 38 (Calzado)</SelectItem>
                      <SelectItem value="39">Talla 39 (Calzado)</SelectItem>
                      <SelectItem value="40">Talla 40 (Calzado)</SelectItem>
                      <SelectItem value="41">Talla 41 (Calzado)</SelectItem>
                      <SelectItem value="42">Talla 42 (Calzado)</SelectItem>
                      <SelectItem value="43">Talla 43 (Calzado)</SelectItem>
                      <SelectItem value="44">Talla 44 (Calzado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Motivo / Condición de Entrega</Label>
                <Select 
                  value={eppDeliveryForm.condition} 
                  onValueChange={v => setEppDeliveryForm({ ...eppDeliveryForm, condition: v })}
                >
                  <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                    <SelectValue placeholder="Condición" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Nuevo (Entrega inicial)">Nuevo (Entrega inicial)</SelectItem>
                    <SelectItem value="Reemplazo por desgaste">Reemplazo por desgaste</SelectItem>
                    <SelectItem value="Reemplazo por daño / rotura">Reemplazo por daño / rotura</SelectItem>
                    <SelectItem value="Pérdida / Re-entrega">Pérdida / Re-entrega</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Observaciones (Opcional)</Label>
                <Input 
                  value={eppDeliveryForm.observation}
                  onChange={e => setEppDeliveryForm({ ...eppDeliveryForm, observation: e.target.value })}
                  placeholder="Ej: Entrega dotación inicial terreno..."
                  className="rounded-xl h-11 border-neutral-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Entregado Por (Supervisor / Bodega)</Label>
                <Input 
                  value={eppDeliveryForm.deliveredBy}
                  onChange={e => setEppDeliveryForm({ ...eppDeliveryForm, deliveredBy: e.target.value })}
                  placeholder="Ej: Juan Pérez (Jefe de Bodega)"
                  className="rounded-xl h-11 border-neutral-200"
                />
              </div>
            </div>

            {/* WORKER IDENTIFICATION SIDE */}
            <div className="space-y-4 flex flex-col justify-between">
              <Label className="font-bold flex items-center gap-2 text-neutral-900">
                <UserCheck size={18} className="text-amber-600" />
                Trabajador que Recibe el EPP
              </Label>

              <div className="flex-1 bg-neutral-900 rounded-3xl overflow-hidden relative border-4 border-amber-100 shadow-inner min-h-[220px] flex flex-col justify-center items-center">
                {isScanning ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : recognizedUser ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-amber-500/10 text-center">
                    {recognizedUser.image ? (
                      <img src={recognizedUser.image} alt="" className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-xl mb-3" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-3xl font-bold mb-3">
                        {recognizedUser.name.charAt(0)}
                      </div>
                    )}
                    <h4 className="text-base font-bold text-amber-950">{recognizedUser.name}</h4>
                    <Badge className="mt-1 bg-emerald-100 text-emerald-800 border-none font-bold">Rostro Verificado</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-3 text-xs h-7 rounded-lg text-neutral-600"
                      onClick={() => {
                        setRecognizedUser(null);
                        setIsScanning(true);
                      }}
                    >
                      Re-intentar escaneo
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-neutral-400 p-6 text-center">
                    <Camera size={40} className="opacity-30" />
                    <p className="text-xs">Escanear rostro para validar identidad</p>
                    <Button 
                      variant="secondary" 
                      className="rounded-xl h-9 w-full text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-700"
                      onClick={() => setIsScanning(true)}
                    >
                      Escanear Rostro
                    </Button>
                    <div className="flex items-center gap-2 w-full my-1">
                      <div className="h-[1px] bg-neutral-800 flex-1"></div>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">o selecciona manual</span>
                      <div className="h-[1px] bg-neutral-800 flex-1"></div>
                    </div>
                    <Select value={eppDeliveryForm.userId} onValueChange={v => setEppDeliveryForm({ ...eppDeliveryForm, userId: v })}>
                      <SelectTrigger className="rounded-xl h-10 bg-neutral-800 border-neutral-700 text-neutral-200 text-xs">
                        <SelectValue placeholder="Seleccionar trabajador..." />
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
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-neutral-100 gap-2">
            <Button variant="ghost" className="rounded-xl h-11" onClick={() => setIsEPPDeliveryDialogOpen(false)}>Cancelar</Button>
            <Button 
              className="rounded-xl h-11 px-8 shadow-lg font-bold bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleDeliverEPP}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar Entrega de EPP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: HACER INVENTARIO (CONTEO Y AUDITORIA DE EPP) */}
      <Dialog open={isEPPCountAuditOpen} onOpenChange={setIsEPPCountAuditOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4 px-0 text-left">
            <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2 text-blue-950">
              <ClipboardList className="text-blue-600" size={28} />
              Hacer Inventario de EPP (Conteo Físico)
            </DialogTitle>
            <DialogDescription>
              Ingresa el conteo físico real de cada elemento de EPP para ajustar y sincronizar el inventario del sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="border rounded-2xl overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader className="bg-blue-50/60">
                  <TableRow>
                    <TableHead className="font-bold text-xs uppercase">Elemento de EPP</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Ubicación</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-center">Stock Sistema</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-center w-[140px]">Conteo Físico</TableHead>
                    <TableHead className="font-bold text-xs uppercase text-center">Diferencia</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Nota de Ajuste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eppProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-neutral-400 italic">
                        No hay elementos de EPP registrados para auditar.
                      </TableCell>
                    </TableRow>
                  ) : eppProducts.map(p => {
                    const sysStock = getStock(p.id);
                    const entry = physicalCounts[p.id] || { count: sysStock, note: '' };
                    const diff = Number(entry.count) - sysStock;

                    return (
                      <TableRow key={p.id} className="hover:bg-neutral-50/50">
                        <TableCell className="font-bold text-neutral-900 text-sm">
                          <div>
                            <p>{p.name}</p>
                            <span className="font-mono text-[10px] text-neutral-400">{p.id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-neutral-500">{p.location || 'Bodega General'}</TableCell>
                        <TableCell className="text-center font-bold font-mono text-base text-neutral-800">
                          {sysStock}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input 
                            type="number"
                            value={entry.count}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              setPhysicalCounts({
                                ...physicalCounts,
                                [p.id]: { ...entry, count: val }
                              });
                            }}
                            className="h-10 text-center font-bold text-base rounded-xl border-blue-200 focus:ring-blue-500"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn(
                            "font-mono font-bold text-xs px-2.5 py-1 border-none",
                            diff === 0 ? "bg-neutral-100 text-neutral-600" :
                            diff > 0 ? "bg-emerald-100 text-emerald-800" :
                            "bg-rose-100 text-rose-800"
                          )}>
                            {diff === 0 ? 'Exacto (0)' : diff > 0 ? `+${diff} Sobrante` : `${diff} Faltante`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input 
                            placeholder="Motivo discrepancia..."
                            value={entry.note}
                            onChange={(e) => {
                              setPhysicalCounts({
                                ...physicalCounts,
                                [p.id]: { ...entry, note: e.target.value }
                              });
                            }}
                            className="h-9 text-xs rounded-xl border-neutral-200"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  className="rounded-xl h-11 text-xs font-bold border-neutral-300"
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({ 
                      id: `EPP-${Math.random().toString(36).substr(2, 4).toUpperCase()}`, 
                      name: '', 
                      unit: 'unidad', 
                      lowStockThreshold: 5, 
                      category: 'EPP', 
                      description: '', 
                      isEpp: true 
                    });
                    setIsProductDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Agregar Nuevo Ítem EPP
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" className="rounded-xl h-11" onClick={() => setIsEPPCountAuditOpen(false)}>Cancelar</Button>
                <Button 
                  className="rounded-xl h-11 px-8 shadow-lg font-bold bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleApplyEPPInventoryAudit}
                >
                  <PackageCheck className="mr-2 h-4 w-4" /> Aplicar Ajustes de Inventario
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: COMPROBANTE DE ENTREGA DE EPP */}
      <Dialog open={!!selectedEppDeliveryForReceipt} onOpenChange={() => setSelectedEppDeliveryForReceipt(null)}>
        <DialogContent className="rounded-3xl p-8 max-w-lg">
          {selectedEppDeliveryForReceipt && (
            <div className="space-y-6">
              <div className="text-center border-b pb-4 space-y-1">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto text-amber-800 mb-2">
                  <ShieldCheck size={28} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Comprobante de Entrega de EPP</h3>
                <p className="text-xs text-neutral-500 font-mono">N° {selectedEppDeliveryForReceipt.id}</p>
              </div>

              <div className="space-y-3 bg-neutral-50 p-4 rounded-2xl text-sm border border-neutral-100">
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Fecha y Hora:</span>
                  <span className="font-bold text-neutral-900">{format(parseISO(selectedEppDeliveryForReceipt.timestamp), 'PPpp', { locale: es })}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Trabajador:</span>
                  <span className="font-bold text-amber-950">{selectedEppDeliveryForReceipt.recipientName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Elemento de EPP:</span>
                  <span className="font-bold text-neutral-900">{selectedEppDeliveryForReceipt.productName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Cantidad Entregada:</span>
                  <span className="font-bold text-emerald-600">{selectedEppDeliveryForReceipt.quantity} unid.</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Talla / Medida:</span>
                  <span className="font-bold text-neutral-900">{selectedEppDeliveryForReceipt.size || 'Estándar'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-200/60">
                  <span className="text-neutral-500">Condición / Motivo:</span>
                  <span className="font-medium text-neutral-800">{selectedEppDeliveryForReceipt.condition || 'Nuevo'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Entregado Por:</span>
                  <span className="font-medium text-neutral-800">{selectedEppDeliveryForReceipt.deliveredByName || 'Bodega'}</span>
                </div>
              </div>

              {selectedEppDeliveryForReceipt.observation && (
                <div className="text-xs text-neutral-500 italic bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                  <span className="font-bold text-amber-900">Observación:</span> {selectedEppDeliveryForReceipt.observation}
                </div>
              )}

              <div className="pt-6 border-t border-dashed grid grid-cols-2 gap-6 text-center text-xs">
                <div className="space-y-8">
                  <div className="h-12 border-b border-neutral-300"></div>
                  <p className="font-bold text-neutral-700">Firma Trabajador</p>
                </div>
                <div className="space-y-8">
                  <div className="h-12 border-b border-neutral-300"></div>
                  <p className="font-bold text-neutral-700">Firma Bodega / Supervisor</p>
                </div>
              </div>

              <DialogFooter className="pt-4 gap-2">
                <Button variant="outline" className="rounded-xl h-11 flex-1" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Comprobante
                </Button>
                <Button className="rounded-xl h-11 flex-1 bg-amber-600 hover:bg-amber-700" onClick={() => setSelectedEppDeliveryForReceipt(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: PRODUCT DIALOG (NUEVO / EDITAR PRODUCTO O EPP) */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-lg">
          <DialogHeader className="mb-6 px-0 text-left">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingProduct ? 'Editar Producto / EPP' : 'Nuevo Producto / EPP'}
            </DialogTitle>
            <DialogDescription>Completa la información del ítem para el inventario de la obra.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID del Código</Label>
                <Input 
                  disabled={!!editingProduct}
                  value={productForm.id || ''} 
                  onChange={e => setProductForm({...productForm, id: e.target.value.toUpperCase()})}
                  className="rounded-xl h-11 border-neutral-200 font-mono"
                  placeholder="PROD-001 o EPP-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input 
                  value={productForm.category || ''} 
                  onChange={e => setProductForm({...productForm, category: e.target.value})}
                  className="rounded-xl h-11 border-neutral-200"
                  placeholder="EPP, Herramientas, Materiales..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre del Producto / EPP</Label>
              <Input 
                value={productForm.name || ''} 
                onChange={e => setProductForm({...productForm, name: e.target.value})}
                className="rounded-xl h-11 border-neutral-200 font-medium"
                placeholder="Ej: Casco Dieléctrico / Tornillos 2 pulgadas"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ubicación en Bodega</Label>
                <Input 
                  value={productForm.location || ''} 
                  onChange={e => setProductForm({...productForm, location: e.target.value})}
                  className="rounded-xl h-11 border-neutral-200"
                  placeholder="Pasillo A-4, Estante 2..."
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad de Medida</Label>
                <Select value={productForm.unit || 'unidad'} onValueChange={v => setProductForm({...productForm, unit: v})}>
                  <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="par">Par</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                    <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                    <SelectItem value="litro">Litro (L)</SelectItem>
                    <SelectItem value="metro">Metro (m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alerta Stock Mínimo</Label>
                <Input 
                  type="number"
                  value={productForm.lowStockThreshold ?? 5} 
                  onChange={e => setProductForm({...productForm, lowStockThreshold: Number(e.target.value)})}
                  className="rounded-xl h-11 border-neutral-200"
                  min={1}
                  required
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer p-2 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900">
                  <input 
                    type="checkbox"
                    checked={Boolean(productForm.isEpp || productForm.category?.toUpperCase().includes('EPP'))}
                    onChange={e => setProductForm({ ...productForm, isEpp: e.target.checked, category: e.target.checked ? 'EPP' : productForm.category })}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span>Pertenece a Sección EPP</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción / Especificación Taller</Label>
              <Input 
                value={productForm.description || ''} 
                onChange={e => setProductForm({...productForm, description: e.target.value})}
                className="rounded-xl h-11 border-neutral-200"
                placeholder="Detalles técnicos del material o EPP..."
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
              <Button type="submit" className="rounded-xl h-11 px-8 font-bold bg-neutral-900 text-white">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: GENERAL MOVEMENT DIALOG (ENTRADA / SALIDA GENERAL) */}
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
              {movementType === 'entry' ? 'Registrar Entrada de Bodega' : 'Registrar Salida de Bodega'}
            </DialogTitle>
            <DialogDescription>
              {movementType === 'entry' ? 'Aumenta el stock del producto en inventario.' : 'Identificación requerida para retirar productos de la bodega.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Producto</Label>
                <Select value={movementForm.productId || ''} onValueChange={v => setMovementForm({...movementForm, productId: v})}>
                  <SelectTrigger className="rounded-xl h-11 border-neutral-200">
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
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
                  value={movementForm.quantity ?? 1} 
                  onChange={e => setMovementForm({...movementForm, quantity: Number(e.target.value)})}
                  className="rounded-xl h-11 border-neutral-200"
                  min={1}
                />
              </div>

              {movementType === 'entry' ? (
                <div className="space-y-2">
                  <Label>Responsable (Opcional)</Label>
                  <Select value={movementForm.userId || ''} onValueChange={v => setMovementForm({...movementForm, userId: v})}>
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
                  value={(movementType === 'entry' ? movementForm.observation : movementForm.reason) || ''} 
                  onChange={e => setMovementForm({...movementForm, [movementType === 'entry' ? 'observation' : 'reason']: e.target.value})}
                  className="rounded-xl h-11 border-neutral-200"
                  placeholder={movementType === 'entry' ? "Ej: Pedido proveedor..." : "Ej: Reparación torre A..."}
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
                         {recognizedUser.image && <img src={recognizedUser.image} alt="" className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-xl mb-4" />}
                         <h4 className="text-lg font-bold text-primary">{recognizedUser.name}</h4>
                         <Badge variant="outline" className="mt-2 bg-white/50 border-primary/20 text-primary font-bold">Identidad Verificada</Badge>
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

      {/* DIALOG 6: IMPORT PREVIEW DIALOG */}
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
