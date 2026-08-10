const fs = require('fs');
let code = fs.readFileSync('src/components/EquipmentDeliverySheet.tsx', 'utf8');

// imports
code = code.replace(
  "import { Label } from '@/components/ui/label';",
  "import { Label } from '@/components/ui/label';\nimport { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';\nimport { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';\nimport { Badge } from '@/components/ui/badge';\nimport { Check } from 'lucide-react';"
);

code = code.replace(
  "import { Product } from '../types';",
  "" // wait, it might not be imported yet
);

code = code.replace(
  "import { User } from '../types';",
  "import { User, Product } from '../types';"
);

// state
code = code.replace(
  "const [isLoadingLists, setIsLoadingLists] = useState(false);",
  "const [isLoadingLists, setIsLoadingLists] = useState(false);\n  const [products, setProducts] = useState<Product[]>([]);"
);

code = code.replace(
  "React.useEffect(() => {",
  `const fetchProducts = async () => {
    try {
      const prods = await firestoreService.getAll<Product>('products');
      setProducts(prods);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  React.useEffect(() => {
    fetchProducts();`
);

// ToolSelector component inside the same file (above EquipmentDeliverySheet)
const toolSelectorCode = `
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
                    className={\`mr-2 h-4 w-4 \${selectedTools.includes(product.name) ? "opacity-100" : "opacity-0"}\`}
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
`;

code = code.replace(
  "export interface EquipmentDeliveryList {",
  toolSelectorCode + "\nexport interface EquipmentDeliveryList {"
);

// update UI where tools are rendered
code = code.replace(
  `<Input 
                        value={item.tools} 
                        onChange={(e) => updateItem(item.id, 'tools', e.target.value)}
                        className="h-9 rounded-lg bg-white border-neutral-200"
                        placeholder="Ej: Rotamartillo, 2 Cinceles, Taladro"
                      />`,
  `<ToolSelector value={item.tools} onChange={(val) => updateItem(item.id, 'tools', val)} products={products} />`
);

fs.writeFileSync('src/components/EquipmentDeliverySheet.tsx', code);
