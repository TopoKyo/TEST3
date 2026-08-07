const fs = require('fs');
let code = fs.readFileSync('src/components/EquipmentDeliverySheet.tsx', 'utf8');

// Update imports
code = code.replace(
  "import { toast } from 'sonner';",
  "import { toast } from 'sonner';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';\nimport { SignaturePad } from './SignaturePad';\nimport { PenTool, CheckCircle2 } from 'lucide-react';"
);

// Update DeliveryItem interface
code = code.replace(
  "interface DeliveryItem {\n  id: string;\n  workerName: string;\n  tools: string;\n  date: string;\n}",
  "interface DeliveryItem {\n  id: string;\n  workerName: string;\n  tools: string;\n  date: string;\n  deliverySignature?: string;\n  returnSignature?: string;\n}"
);

// Add state for dialogs
code = code.replace(
  "const [items, setItems] = useState<DeliveryItem[]>([",
  "const [activeSignature, setActiveSignature] = useState<{id: string, type: 'delivery' | 'return'} | null>(null);\n  const [items, setItems] = useState<DeliveryItem[]>(["
);

// Update table headers in JSX
code = code.replace(
  "<th className=\"px-4 py-3 w-32\">Fecha</th>",
  "<th className=\"px-4 py-3 w-32\">Fecha</th>\n                  <th className=\"px-4 py-3 text-center\">Firmas</th>"
);

// Update table row in JSX
code = code.replace(
  "<td className=\"px-4 py-3\">\n                      <Input \n                        value={item.date} ",
  "<td className=\"px-4 py-3\">\n                      <Input \n                        value={item.date} "
);

// Actually let's use edit_file or a clean replacement script
