import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { User, Product } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { FileDown, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { firestoreService } from '../lib/firestoreService';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SignaturePad } from './SignaturePad';
import { PenTool, CheckCircle2 } from 'lucide-react';

interface DeliveryItem {
  id: string;
  workerName: string;
  tools: string;
  date: string;
  deliverySignature?: string;
  returnSignature?: string;
}


function ToolSelector({ value, onChange, products }: { value: string; onChange: (val: string) => void; products: Product[] }) {
  const [open, setOpen] = useState(false);
  const selectedTools = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const toggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onChange(selectedTools.filter(t => t !== toolName).join(', '));
    } else {
      onChange([...selectedTools, toolName].join(', '));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-auto min-h-[36px] px-3 py-2 text-left font-normal border-neutral-200 bg-white hover:bg-neutral-50/50">
          <div className="flex flex-wrap gap-1">
            {selectedTools.length > 0 ? (
              selectedTools.map((tool, i) => (
                <Badge key={i} variant="secondary" className="font-normal text-xs bg-neutral-100 hover:bg-neutral-200">
                  {tool}
                </Badge>
              ))
            ) : (
              <span className="text-neutral-500">Seleccionar herramientas...</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar herramienta en inventario..." />
          <CommandList>
            <CommandEmpty>No se encontraron herramientas.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={(currentValue) => {
                    // currentValue is lowercase, let's use product.name
                    toggleTool(product.name);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${selectedTools.includes(product.name) ? "opacity-100" : "opacity-0"}`}
                  />
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="p-2 border-t border-neutral-100">
            <Input 
              placeholder="O escribe manualmente y presiona Enter..." 
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    if (!selectedTools.includes(val)) {
                      onChange([...selectedTools, val].join(', '));
                    }
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export interface EquipmentDeliveryList {
  id: string;
  projectName: string;
  year: string;
  items: DeliveryItem[];
  createdAt: string;
}

export function EquipmentDeliverySheet({ users }: { users?: User[] }) {
  const [savedLists, setSavedLists] = useState<EquipmentDeliveryList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const fetchSavedLists = async () => {
    setIsLoadingLists(true);
    try {
      const lists = await firestoreService.getAll<EquipmentDeliveryList>('equipmentDeliveries');
      // Sort by newest first
      lists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedLists(lists);
    } catch (error) {
      console.error("Error fetching saved lists:", error);
    } finally {
      setIsLoadingLists(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const prods = await firestoreService.getAll<Product>('products');
      setProducts(prods);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  React.useEffect(() => {
    fetchProducts();
    fetchSavedLists();
  }, []);

  const [projectName, setProjectName] = useState('PROYECTO BICENTENARIO');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isSaving, setIsSaving] = useState(false);
  const [activeSignature, setActiveSignature] = useState<{id: string, type: 'delivery' | 'return'} | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([
    { id: crypto.randomUUID(), workerName: '', tools: '', date: new Date().toLocaleDateString('es-CL') }
  ]);

  const saveList = async () => {
    setIsSaving(true);
    try {
      await firestoreService.add('equipmentDeliveries', {
        id: crypto.randomUUID(),
        projectName,
        year,
        items,
        createdAt: new Date().toISOString()
      });
      toast.success("Lista guardada exitosamente");
      fetchSavedLists();
    } catch (error) {
      console.error("Error saving list:", error);
      toast.error("Error al guardar la lista");
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), workerName: '', tools: '', date: new Date().toLocaleDateString('es-CL') }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof DeliveryItem, value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(year, 180, 20);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('VERTICAL SOLUCIONES', 15, 20);
      
      doc.setFontSize(14);
      doc.text(projectName.toUpperCase(), 105, 30, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text('FICHA TECNICA DE ENTREGA DE EQUIPOS Y/O HERRAMIENTAS', 105, 40, { align: 'center' });

      // Table Data
      const tableData = items.map((item, index) => [
        (index + 1).toString(),
        item.workerName,
        item.tools,
        '', // Firma Recibido
        '', // Firma Devolución
        item.date
      ]);

      (doc as any).autoTable({
        startY: 50,
        head: [['N°', 'NOMBRE DEL TRABAJADOR', 'HERRAMIENTAS', 'FIRMA\nRECIBIDO', 'FIRMA\nDEVOLUCION', 'FECHA']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
          lineColor: [150, 150, 150]
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          lineWidth: 0.1,
          lineColor: [150, 150, 150],
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 45 },
          2: { cellWidth: 55 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
          5: { cellWidth: 20, halign: 'center' },
        },
        styles: {
          minCellHeight: 25, // Make rows taller for signature boxes
          fontSize: 10
        },
        didDrawCell: function(data: any) {
          if (data.column.index === 3 && data.cell.section === 'body') {
            const item = items[data.row.index];
            if (item && item.deliverySignature) {
              const imgData = item.deliverySignature;
              const dim = data.cell.height - 4;
              const textPos = data.cell.textPos;
              doc.addImage(imgData, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, dim);
            }
          }
          if (data.column.index === 4 && data.cell.section === 'body') {
            const item = items[data.row.index];
            if (item && item.returnSignature) {
              const imgData = item.returnSignature;
              const dim = data.cell.height - 4;
              const textPos = data.cell.textPos;
              doc.addImage(imgData, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, dim);
            }
          }
        },
      });

      doc.save(`Ficha_Entrega_Herramientas_${new Date().getTime()}.pdf`);
      toast.success("PDF generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Hubo un error al generar el PDF");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Tabs defaultValue="new" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Ficha de Entrega de Herramientas</h1>
            <p className="text-neutral-500">Gestiona las fichas técnicas de entrega de equipos</p>
          </div>
          <TabsList className="bg-white border border-neutral-200">
            <TabsTrigger value="new">Nueva Ficha</TabsTrigger>
            <TabsTrigger value="saved">Fichas Guardadas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="new" className="space-y-6">
          <div className="flex justify-end gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Ficha de Entrega de Herramientas</h1>
          <p className="text-neutral-500">Genera fichas técnicas de entrega de equipos en PDF</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={saveList} disabled={isSaving} variant="outline" className="rounded-xl gap-2 bg-white">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar Lista
          </Button>
          <Button onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 shadow-md">
            <FileDown size={18} />
            Generar PDF
          </Button>
        </div>
      </div>

      <Card className="border-neutral-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-4">
          <CardTitle className="text-lg font-semibold">Datos del Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Nombre del Proyecto</Label>
            <Input 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)} 
              className="rounded-xl bg-neutral-50"
              placeholder="Ej: PROYECTO BICENTENARIO"
            />
          </div>
          <div className="space-y-2">
            <Label>Año / Referencia</Label>
            <Input 
              value={year} 
              onChange={(e) => setYear(e.target.value)} 
              className="rounded-xl bg-neutral-50"
              placeholder="Ej: 2026"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-neutral-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Herramientas Entregadas</CardTitle>
          <Button onClick={addItem} variant="outline" size="sm" className="rounded-lg gap-1 border-neutral-200">
            <Plus size={16} /> Agregar Fila
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">N°</th>
                  <th className="px-4 py-3 w-48">Trabajador</th>
                  <th className="px-4 py-3">Herramientas (separadas por coma)</th>
                  <th className="px-4 py-3 w-32">Fecha</th>
                  <th className="px-4 py-3 text-center">Firmas</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium text-neutral-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <Input 
                        value={item.workerName} 
                        onChange={(e) => updateItem(item.id, 'workerName', e.target.value)}
                        className="h-9 rounded-lg bg-white border-neutral-200"
                        placeholder="Nombre completo"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ToolSelector value={item.tools} onChange={(val) => updateItem(item.id, 'tools', val)} products={products} />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        value={item.date} 
                        onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                        className="h-9 rounded-lg bg-white border-neutral-200"
                        placeholder="DD/MM/YYYY"
                      />
                    </td>
                    <td className="px-4 py-3 flex gap-2 justify-center">
                      <Button size="sm" variant={item.deliverySignature ? "default" : "outline"} className={item.deliverySignature ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""} onClick={() => setActiveSignature({id: item.id, type: 'delivery'})}>
                        {item.deliverySignature ? <CheckCircle2 size={14} className="mr-1" /> : <PenTool size={14} className="mr-1" />}
                        Entrega
                      </Button>
                      <Button size="sm" variant={item.returnSignature ? "default" : "outline"} className={item.returnSignature ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""} onClick={() => setActiveSignature({id: item.id, type: 'return'})}>
                        {item.returnSignature ? <CheckCircle2 size={14} className="mr-1" /> : <PenTool size={14} className="mr-1" />}
                        Devolución
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={!!activeSignature} onOpenChange={(open) => !open && setActiveSignature(null)}>
        <DialogContent className="sm:max-w-[500px] bg-neutral-50 p-0 border-0 overflow-hidden">
          {activeSignature && (
            <SignaturePad
              title={activeSignature.type === 'delivery' ? 'Firma de Entrega' : 'Firma de Devolución'}
              role="Trabajador"
              name={items.find(i => i.id === activeSignature.id)?.workerName || ''}
              onNameChange={(name) => updateItem(activeSignature.id, 'workerName', name)}
              signature={activeSignature.type === 'delivery' ? items.find(i => i.id === activeSignature.id)?.deliverySignature : items.find(i => i.id === activeSignature.id)?.returnSignature}
              onSignatureChange={(sig) => {
                if (activeSignature.type === 'delivery') {
                  updateItem(activeSignature.id, 'deliverySignature', sig || '');
                } else {
                  updateItem(activeSignature.id, 'returnSignature', sig || '');
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="saved" className="space-y-6">
          <Card className="border-neutral-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-neutral-50/50 border-b border-neutral-100">
              <CardTitle className="text-lg font-semibold">Listas Guardadas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      <th className="px-6 py-4">Proyecto</th>
                      <th className="px-6 py-4">Año</th>
                      <th className="px-6 py-4">Herramientas/Items</th>
                      <th className="px-6 py-4">Fecha de Creación</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLists ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                          <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                          Cargando listas...
                        </td>
                      </tr>
                    ) : savedLists.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                          No hay listas guardadas aún.
                        </td>
                      </tr>
                    ) : (
                      savedLists.map((list) => (
                        <tr key={list.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50">
                          <td className="px-6 py-4 font-medium text-neutral-900">{list.projectName}</td>
                          <td className="px-6 py-4">{list.year}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                              {list.items.length} items
                            </span>
                          </td>
                          <td className="px-6 py-4 text-neutral-500">
                            {new Date(list.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-lg gap-2"
                              onClick={() => {
                                setProjectName(list.projectName);
                                setYear(list.year);
                                setItems(list.items);
                                toast.success("Lista cargada. Ve a 'Nueva Ficha' para editarla o generar el PDF.");
                              }}
                            >
                              <Eye size={16} />
                              Ver / Cargar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
