const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

const exportAllCode = `
  const exportAllToExcel = () => {
    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    const getSafeSheetName = (name: string) => {
      let baseName = name.replace(/[\\\\\\/\\?\\*\\[\\]]/g, '').substring(0, 28).trim();
      if (!baseName) baseName = 'Usuario';
      let finalName = baseName;
      let counter = 2;
      while (usedSheetNames.has(finalName)) {
        finalName = \`\${baseName.substring(0, 25)} (\${counter})\`;
        counter++;
      }
      usedSheetNames.add(finalName);
      return finalName;
    };

    // 1. HOJA GENERAL: "Asistencia"
    // Filtramos todos los registros del mes para todo el personal
    const allMonthLogs = logs.filter(log => format(parseISO(log.timestamp), 'yyyy-MM') === selectedMonth)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const generalData = [];
    generalData.push(['Reporte General de Asistencia']);
    generalData.push(['Período:', selectedMonth]);
    generalData.push([]);
    generalData.push(['ID / RUT', 'Nombre', 'Cargo', 'Fecha', 'Hora', 'Tipo de Marcaje', 'Estado Entrada', 'Atraso (min)']);

    allMonthLogs.forEach(log => {
      const user = users.find(u => u.id === log.userId);
      const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
      generalData.push([
        log.userId,
        log.userName,
        user?.role || 'Operativo',
        format(parseISO(log.timestamp), 'dd/MM/yyyy'),
        format(parseISO(log.timestamp), 'HH:mm:ss'),
        ATTENDANCE_LABELS[log.type] || log.type,
        delayInfo ? delayInfo.label : '-',
        delayInfo ? delayInfo.delayMinutes : 0
      ]);
    });

    const generalWs = XLSX.utils.aoa_to_sheet(generalData);
    generalWs['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, generalWs, 'Asistencia');
    usedSheetNames.add('Asistencia');

    // 2. HOJAS INDIVIDUALES POR PERSONA
    // Ordenamos a los usuarios alfabeticamente
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedUsers.forEach(user => {
      const userLogs = allMonthLogs.filter(log => log.userId === user.id);
      
      const wsData = [];
      wsData.push(['REPORTE DE ASISTENCIA']);
      wsData.push(['Nombre:', user.name, 'RUT:', user.id]);
      wsData.push(['Cargo:', user.role || 'Operativo', 'Período:', selectedMonth]);
      wsData.push([]);
      wsData.push(['Fecha', 'Hora', 'Tipo de Marcaje', 'Estado Entrada', 'Atraso (min)']);
      
      userLogs.forEach(log => {
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
      const stats = monthlyStats[user.id];
      if (stats) {
         wsData.push(['Días Trabajados:', stats.days.size]);
         wsData.push(['Horas Totales Trabajadas:', Number((stats.totalMinutes / 60).toFixed(2))]);
         wsData.push(['Total Atrasos (min):', stats.totalDelayMinutes]);
      } else {
         wsData.push(['Días Trabajados:', 0]);
         wsData.push(['Horas Totales Trabajadas:', 0]);
         wsData.push(['Total Atrasos (min):', 0]);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }
      ];

      const sheetName = getSafeSheetName(user.name);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, \`Asistencia_\${selectedMonth}.xlsx\`);
    toast.success('Todas las asistencias exportadas con éxito');
  };
`;

code = code.replace(
  "  const exportToExcel = () => {",
  exportAllCode + "\n  const exportToExcel = () => {"
);

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
