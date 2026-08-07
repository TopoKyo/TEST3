const fs = require('fs');
let code = fs.readFileSync('src/components/EquipmentDeliverySheet.tsx', 'utf8');

code = code.replace(
  "import { FileDown, Plus, Trash2 } from 'lucide-react';",
  "import { FileDown, Plus, Trash2, Save, Loader2 } from 'lucide-react';\nimport { firestoreService } from '../lib/firestoreService';"
);

code = code.replace(
  "const [activeSignature, setActiveSignature] = useState<{id: string, type: 'delivery' | 'return'} | null>(null);",
  "const [isSaving, setIsSaving] = useState(false);\n  const [activeSignature, setActiveSignature] = useState<{id: string, type: 'delivery' | 'return'} | null>(null);"
);

code = code.replace(
  "const addItem = () => {",
  `const saveList = async () => {
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
    } catch (error) {
      console.error("Error saving list:", error);
      toast.error("Error al guardar la lista");
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {`
);

code = code.replace(
  "<Button onClick={generatePDF} className=\"bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 shadow-md\">\n          <FileDown size={18} />\n          Generar PDF\n        </Button>",
  `<div className="flex gap-2">
          <Button onClick={saveList} disabled={isSaving} variant="outline" className="rounded-xl gap-2">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar Lista
          </Button>
          <Button onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 shadow-md">
            <FileDown size={18} />
            Generar PDF
          </Button>
        </div>`
);

fs.writeFileSync('src/components/EquipmentDeliverySheet.tsx', code);
