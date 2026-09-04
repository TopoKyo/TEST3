const fs = require('fs');
let code = fs.readFileSync('src/lib/faceService.ts', 'utf-8');

code = code.replace(
  /createMatcher\(users: \{ name: string; descriptor: number\[\] \}\[\]\) \{[\s\S]*?const labeledDescriptors = users.map\(user => \{[\s\S]*?const float32Descriptor = new Float32Array\(user.descriptor\);[\s\S]*?return new faceapi.LabeledFaceDescriptors\(user.name, \[float32Descriptor\]\);[\s\S]*?\}\);/g,
  `createMatcher(users: { name: string; descriptor: number[] }[]) {
    const validUsers = users.filter(u => u.descriptor && u.descriptor.length > 0);
    if (validUsers.length === 0) return null;
    
    const labeledDescriptors = validUsers.map(user => {
      const float32Descriptor = new Float32Array(user.descriptor);
      return new faceapi.LabeledFaceDescriptors(user.name, [float32Descriptor]);
    });`
);

fs.writeFileSync('src/lib/faceService.ts', code);
