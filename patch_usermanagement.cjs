const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

code = code.replace(
  /const handleSubmit = async \(\) => \{[\s\S]*?onUpdate\(\);/g,
  `const handleSubmit = async () => {
    if (!formData.id || !formData.name) {
      toast.error('El ID y nombre son obligatorios');
      return;
    }

    try {
      let descriptorArray = [];

      if (formData.image) {
        const img = new Image();
        const loadPromise = new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Image failed to load'));
        });
        img.src = formData.image;
        await loadPromise;
        
        const descriptor = await faceService.getFaceDescriptor(img);
        if (!descriptor) {
          toast.error('No se detectó ningún rostro en la foto. Intenta de nuevo, o guarda sin foto.');
          return;
        }
        descriptorArray = Array.from(descriptor);
      }

      const isDuplicate = !editingUser && users.some(u => u.id === formData.id);
      if (isDuplicate) {
        toast.error('Este ID ya está registrado. Usa un identificador diferente.');
        return;
      }

      const userDataToSave = {
        id: formData.id,
        name: formData.name,
        image: formData.image || ''
      };

      if (descriptorArray.length > 0) {
         userDataToSave.faceDescriptor = descriptorArray;
      } else if (editingUser && editingUser.faceDescriptor && !formData.image) {
         // Keep existing descriptor if editing and no new image
         userDataToSave.faceDescriptor = editingUser.faceDescriptor;
      } else {
         userDataToSave.faceDescriptor = [];
      }

      if (editingUser) {
        await firestoreService.update('users', editingUser.id, userDataToSave);
        toast.success('Usuario actualizado');
      } else {
        await firestoreService.add('users', userDataToSave);
        toast.success('Usuario creado');
      }

      onUpdate();`
);

fs.writeFileSync('src/components/UserManagement.tsx', code);
