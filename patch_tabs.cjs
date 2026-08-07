const fs = require('fs');
let code = fs.readFileSync('src/components/EquipmentDeliverySheet.tsx', 'utf8');

if (!code.includes('import { Tabs')) {
  code = code.replace(
    "import { toast } from 'sonner';",
    "import { toast } from 'sonner';\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';\nimport { Calendar, Eye } from 'lucide-react';"
  );
}

// Extract the form to a separate part or just wrap the main return in a Tabs component.
// First, add a state for saved lists and useEffect to fetch them.

code = code.replace(
  "export function EquipmentDeliverySheet({ users }: { users?: User[] }) {",
  `export interface EquipmentDeliveryList {
  id: string;
  projectName: string;
  year: string;
  items: DeliveryItem[];
  createdAt: string;
}

export function EquipmentDeliverySheet({ users }: { users?: User[] }) {
  const [savedLists, setSavedLists] = useState<EquipmentDeliveryList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);

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

  React.useEffect(() => {
    fetchSavedLists();
  }, []);
`
);

code = code.replace(
  "toast.success(\"Lista guardada exitosamente\");",
  "toast.success(\"Lista guardada exitosamente\");\n      fetchSavedLists();"
);

code = code.replace(
  `  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">`,
  `  return (
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
          <div className="flex justify-end gap-2">`
);

// We need to remove the original top bar because it's replaced.
code = code.replace(
  `      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      </div>`,
  ""
);

code = code.replace(
  `        </DialogContent>
      </Dialog>
    </div>
  );
}`,
  `        </DialogContent>
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
}`
);

fs.writeFileSync('src/components/EquipmentDeliverySheet.tsx', code);
