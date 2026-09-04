const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

code = code.replace(
  /const exportToExcel = \(\) => \{[\s\S]*?toast.success\('Exportación completada'\);\n  \};/g,
  `const exportToExcel = () => {
    if (!selectedUser) return;
    const selectedUserObj = users.find(u => u.id === selectedUser);
    
    const wsData = [];
    wsData.push(['Reporte de Asistencia Individual']);
    wsData.push(['Empleado:', selectedUserObj?.name, 'ID/RUT:', selectedUserObj?.id]);
    wsData.push(['Mes:', selectedMonth]);
    wsData.push([]);
    wsData.push(['Fecha', 'Hora', 'Tipo de Marcaje', 'Estado Entrada', 'Atraso (min)']);
    
    filteredLogs.forEach(log => {
      const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
      wsData.push([
        format(parseISO(log.timestamp), 'dd/MM/yyyy'),
        format(parseISO(log.timestamp), 'HH:mm:ss'),
        ATTENDANCE_LABELS[log.type] || log.type,
        delayInfo ? delayInfo.label : '-',
        delayInfo ? delayInfo.delayMinutes : 0
      ]);
    });

    wsData.push([]);
    wsData.push(['Resumen Mensual', '']);
    const stats = monthlyStats[selectedUser];
    if (stats) {
       wsData.push(['Días Trabajados:', stats.days.size]);
       wsData.push(['Horas Totales Trabajadas:', (stats.totalMinutes / 60).toFixed(2)]);
       wsData.push(['Total Atrasos (min):', stats.totalDelayMinutes]);
    } else {
       wsData.push(['Días Trabajados:', 0]);
       wsData.push(['Horas Totales Trabajadas:', '0.00']);
       wsData.push(['Total Atrasos (min):', 0]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Style the sheet a bit by setting column widths
    ws['!cols'] = [
      { wch: 20 }, // Fecha / Labels
      { wch: 15 }, // Hora / Values
      { wch: 20 }, // Tipo
      { wch: 25 }, // Estado
      { wch: 15 }  // Atraso
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.writeFile(wb, \`Asistencia_\${selectedUserObj?.name.replace(/\\s+/g, '_')}_\${selectedMonth}.xlsx\`);
    toast.success('Exportación completada');
  };`
);

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
