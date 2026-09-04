const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

code = code.replace(
  /const exportWeeklyToExcel = \(\) => \{[\s\S]*?toast.success\('Reporte semanal exportado a Excel'\);\n  \};/g,
  `const exportWeeklyToExcel = () => {
    const weekLabel = \`\${format(weekStart, 'dd-MM-yyyy')}_al_\${format(weekEnd, 'dd-MM-yyyy')}\`;
    
    const wsData = [];
    wsData.push(['Reporte Semanal de Asistencia y Horas']);
    wsData.push(['Semana:', \`\${format(weekStart, 'dd/MM/yyyy')} al \${format(weekEnd, 'dd/MM/yyyy')}\`]);
    wsData.push([]);
    
    // Headers
    const headers = ['ID / RUT', 'Nombre', 'Cargo'];
    const sampleItem = filteredWeeklyData[0];
    if (sampleItem) {
       sampleItem.dailyMinutes.forEach(d => {
         headers.push(\`\${format(d.date, 'EEEE dd/MM', { locale: es })}\`);
       });
    }
    headers.push('Días Trabajados', 'Total Horas Semanales', 'Límite Legal (42h)', 'Estado Jornada');
    wsData.push(headers);

    filteredWeeklyData.forEach(item => {
      const row = [
        item.user.id,
        item.user.name,
        item.user.role || 'Operativo'
      ];

      item.dailyMinutes.forEach(d => {
        row.push(d.hours > 0 ? Number(d.hours.toFixed(2)) : 0);
      });

      row.push(
        item.activeDaysCount,
        Number(item.totalWeeklyHours.toFixed(2)),
        '42 hrs',
        item.isOver42 ? \`SUPERA 42h (+\${item.excessHours.toFixed(2)}h)\` : (item.totalWeeklyHours > 0 ? 'Dentro de norma' : 'Sin horas')
      );
      wsData.push(row);
    });

    wsData.push([]);
    wsData.push(['Resumen de la Semana']);
    wsData.push(['Total Trabajadores Activos', weeklySummary.activeWorkers]);
    wsData.push(['Total Horas Globales', weeklySummary.grandTotalHours.toFixed(2)]);
    wsData.push(['Trabajadores con Exceso', weeklySummary.over42Count]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!cols'] = [
      { wch: 15 }, // ID
      { wch: 30 }, // Nombre
      { wch: 20 }, // Cargo
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, // Dias
      { wch: 15 }, // Dias trabajados
      { wch: 20 }, // Total Horas
      { wch: 15 }, // Limite
      { wch: 25 }, // Estado
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horas_Semanales');
    XLSX.writeFile(wb, \`Horas_Semanales_\${weekLabel}.xlsx\`);
    toast.success('Reporte semanal exportado a Excel');
  };`
);

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
