const fs = require('fs');
let code = fs.readFileSync('src/components/EquipmentDeliverySheet.tsx', 'utf8');

// Update imports
code = code.replace(
  "import { toast } from 'sonner';",
  "import { toast } from 'sonner';\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';\nimport { SignaturePad } from './SignaturePad';\nimport { PenTool } from 'lucide-react';"
);

// Update DeliveryItem interface
code = code.replace(
  "interface DeliveryItem {\n  id: string;\n  workerName: string;\n  tools: string;\n  date: string;\n}",
  "interface DeliveryItem {\n  id: string;\n  workerName: string;\n  tools: string;\n  date: string;\n  deliverySignature?: string;\n  returnSignature?: string;\n}"
);

// Update init state
code = code.replace(
  "{ id: crypto.randomUUID(), workerName: '', tools: '', date: new Date().toLocaleDateString('es-CL') }",
  "{ id: crypto.randomUUID(), workerName: '', tools: '', date: new Date().toLocaleDateString('es-CL') }"
);

fs.writeFileSync('src/components/EquipmentDeliverySheet.tsx', code);
