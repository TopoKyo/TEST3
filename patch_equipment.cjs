const fs = require('fs');
let code = fs.readFileSync('src/components/EquipmentDeliverySheet.tsx', 'utf-8');

code = code.replace(
  '<PopoverTrigger asChild>',
  '<PopoverTrigger render={'
);

code = code.replace(
  '        </Button>\n      </PopoverTrigger>',
  '        </Button>\n      } />'
);

fs.writeFileSync('src/components/EquipmentDeliverySheet.tsx', code);
