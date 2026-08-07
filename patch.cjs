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
  /<td className="px-4 py-3 text-center">[\s\S]*?<\/td>/,
  `<td className="px-4 py-3 flex gap-2 justify-center">
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
                    </td>`
);

// Add Dialog to end of file
code = code.replace(
  "    </div>\n  );\n}",
  `      <Dialog open={!!activeSignature} onOpenChange={(open) => !open && setActiveSignature(null)}>
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
    </div>
  );
}`
);

// Update PDF generation to support signatures
code = code.replace(
  "      // Table Data",
  `      // Table Data`
);

code = code.replace(
  `        styles: {
          minCellHeight: 15, // Make rows a bit taller for signatures
          fontSize: 10
        },`,
  `        styles: {
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
        },`
);

fs.writeFileSync('src/components/EquipmentDeliverySheet.tsx', code);
