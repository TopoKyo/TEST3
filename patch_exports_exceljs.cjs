const fs = require('fs');
let code = fs.readFileSync('src/components/AttendanceHistory.tsx', 'utf-8');

const exportWeeklyToExcel = `
  const exportWeeklyToExcel = async () => {
    const weekLabel = \`\${format(weekStart, 'dd-MM-yyyy')}_al_\${format(weekEnd, 'dd-MM-yyyy')}\`;
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Horas_Semanales');

    ws.addRow(['Reporte Semanal de Asistencia y Horas']).font = { bold: true, size: 14, color: { argb: 'FF333333' } };
    ws.addRow(['Semana:', \`\${format(weekStart, 'dd/MM/yyyy')} al \${format(weekEnd, 'dd/MM/yyyy')}\`]);
    ws.addRow([]);
    
    // Headers
    const headers = ['ID / RUT', 'Nombre', 'Cargo'];
    const sampleItem = filteredWeeklyData[0];
    if (sampleItem) {
       sampleItem.dailyMinutes.forEach(d => {
         headers.push(\`\${format(d.date, 'EEEE dd/MM', { locale: es })}\`);
       });
    }
    headers.push('Días Trabajados', 'Total Horas Semanales', 'Límite Legal (42h)', 'Estado Jornada');
    
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue 600

    filteredWeeklyData.forEach(item => {
      const rowData = [
        item.user.id,
        item.user.name,
        item.user.role || 'Operativo'
      ];

      item.dailyMinutes.forEach(d => {
        rowData.push(d.hours > 0 ? Number(d.hours.toFixed(2)) : 0);
      });

      rowData.push(
        item.activeDaysCount,
        Number(item.totalWeeklyHours.toFixed(2)),
        '42 hrs',
        item.isOver42 ? \`SUPERA 42h (+\${item.excessHours.toFixed(2)}h)\` : (item.totalWeeklyHours > 0 ? 'Dentro de norma' : 'Sin horas')
      );
      
      const row = ws.addRow(rowData);
      const estadoCell = row.getCell(rowData.length);
      if (item.isOver42) {
        estadoCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
      } else if (item.totalWeeklyHours > 0) {
        estadoCell.font = { color: { argb: 'FF16A34A' }, bold: true }; // Green
      }
    });

    ws.addRow([]);
    ws.addRow(['Resumen de la Semana']).font = { bold: true, size: 12 };
    ws.addRow(['Total Trabajadores Activos', weeklySummary.activeWorkers]);
    ws.addRow(['Total Horas Globales', Number(weeklySummary.grandTotalHours.toFixed(2))]);
    ws.addRow(['Trabajadores con Exceso', weeklySummary.over42Count]);

    ws.columns = [
      { width: 15 }, { width: 30 }, { width: 20 },
      ...((sampleItem?.dailyMinutes || []).map(() => ({ width: 15 }))),
      { width: 15 }, { width: 20 }, { width: 15 }, { width: 25 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), \`Horas_Semanales_\${weekLabel}.xlsx\`);
    toast.success('Reporte semanal exportado a Excel');
  };
`;

const exportAllToExcel = `
  const exportAllToExcel = async () => {
    const wb = new ExcelJS.Workbook();
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
    const allMonthLogs = logs.filter(log => format(parseISO(log.timestamp), 'yyyy-MM') === selectedMonth)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const generalWs = wb.addWorksheet('Asistencia');
    generalWs.addRow(['Reporte General de Asistencia']).font = { bold: true, size: 14 };
    generalWs.addRow(['Período:', selectedMonth]);
    generalWs.addRow([]);
    
    const generalHeader = generalWs.addRow(['ID / RUT', 'Nombre', 'Cargo', 'Fecha', 'Hora', 'Tipo de Marcaje', 'Estado Entrada', 'Atraso (min)']);
    generalHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    generalHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

    allMonthLogs.forEach(log => {
      const user = users.find(u => u.id === log.userId);
      const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
      const typeLabel = ATTENDANCE_LABELS[log.type] || log.type;
      const row = generalWs.addRow([
        log.userId,
        log.userName,
        user?.role || 'Operativo',
        format(parseISO(log.timestamp), 'dd/MM/yyyy'),
        format(parseISO(log.timestamp), 'HH:mm:ss'),
        typeLabel,
        delayInfo ? delayInfo.label : '-',
        delayInfo ? delayInfo.delayMinutes : 0
      ]);

      const typeCell = row.getCell(6);
      if (log.type === 'arrival') typeCell.font = { color: { argb: 'FF16A34A' }, bold: true };
      else if (log.type === 'departure') typeCell.font = { color: { argb: 'FFDC2626' }, bold: true };

      const delayCell = row.getCell(8);
      if (delayInfo && delayInfo.delayMinutes > 0) delayCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    });

    generalWs.columns = [
      { width: 15 }, { width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 20 }, { width: 15 }
    ];
    usedSheetNames.add('Asistencia');

    // 2. HOJAS INDIVIDUALES POR PERSONA
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedUsers.forEach(user => {
      const userLogs = allMonthLogs.filter(log => log.userId === user.id);
      const sheetName = getSafeSheetName(user.name);
      const ws = wb.addWorksheet(sheetName);
      
      ws.addRow(['REPORTE DE ASISTENCIA']).font = { bold: true, size: 14 };
      ws.addRow(['Nombre:', user.name, 'RUT:', user.id]);
      ws.addRow(['Cargo:', user.role || 'Operativo', 'Período:', selectedMonth]);
      ws.addRow([]);
      
      const headerRow = ws.addRow(['Fecha', 'Hora', 'Tipo de Marcaje', 'Estado Entrada', 'Atraso (min)']);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      
      userLogs.forEach(log => {
        const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
        const row = ws.addRow([
          format(parseISO(log.timestamp), 'dd/MM/yyyy'),
          format(parseISO(log.timestamp), 'HH:mm:ss'),
          ATTENDANCE_LABELS[log.type] || log.type,
          delayInfo ? delayInfo.label : '-',
          delayInfo ? delayInfo.delayMinutes : 0
        ]);

        const typeCell = row.getCell(3);
        if (log.type === 'arrival') typeCell.font = { color: { argb: 'FF16A34A' }, bold: true };
        else if (log.type === 'departure') typeCell.font = { color: { argb: 'FFDC2626' }, bold: true };

        const delayCell = row.getCell(5);
        if (delayInfo && delayInfo.delayMinutes > 0) delayCell.font = { color: { argb: 'FFDC2626' }, bold: true };
      });

      ws.addRow([]);
      ws.addRow(['Resumen Mensual', '']).font = { bold: true, size: 12 };
      const stats = monthlyStats[user.id];
      if (stats) {
         ws.addRow(['Días Trabajados:', stats.days.size]);
         ws.addRow(['Horas Totales Trabajadas:', Number((stats.totalMinutes / 60).toFixed(2))]);
         ws.addRow(['Total Atrasos (min):', stats.totalDelayMinutes]);
      } else {
         ws.addRow(['Días Trabajados:', 0]);
         ws.addRow(['Horas Totales Trabajadas:', 0]);
         ws.addRow(['Total Atrasos (min):', 0]);
      }

      ws.columns = [
        { width: 20 }, { width: 15 }, { width: 20 }, { width: 25 }, { width: 15 }
      ];
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), \`Asistencia_\${selectedMonth}.xlsx\`);
    toast.success('Todas las asistencias exportadas con éxito');
  };
`;

const exportToExcel = `
  const exportToExcel = async () => {
    if (!selectedUser) return;
    const selectedUserObj = users.find(u => u.id === selectedUser);
        
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Asistencia');

    ws.addRow(['Reporte de Asistencia Individual']).font = { bold: true, size: 14 };
    ws.addRow(['Empleado:', selectedUserObj?.name, 'ID/RUT:', selectedUserObj?.id]);
    ws.addRow(['Mes:', selectedMonth]);
    ws.addRow([]);
    
    const headerRow = ws.addRow(['Fecha', 'Hora', 'Tipo de Marcaje', 'Estado Entrada', 'Atraso (min)']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    
    filteredLogs.forEach(log => {
      const delayInfo = log.type === 'arrival' ? getDelayInfo(log.timestamp, officialStartTimeState) : null;
      const row = ws.addRow([
        format(parseISO(log.timestamp), 'dd/MM/yyyy'),
        format(parseISO(log.timestamp), 'HH:mm:ss'),
        ATTENDANCE_LABELS[log.type] || log.type,
        delayInfo ? delayInfo.label : '-',
        delayInfo ? delayInfo.delayMinutes : 0
      ]);

      const typeCell = row.getCell(3);
      if (log.type === 'arrival') typeCell.font = { color: { argb: 'FF16A34A' }, bold: true };
      else if (log.type === 'departure') typeCell.font = { color: { argb: 'FFDC2626' }, bold: true };

      const delayCell = row.getCell(5);
      if (delayInfo && delayInfo.delayMinutes > 0) delayCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    });

    ws.addRow([]);
    ws.addRow(['Resumen Mensual', '']).font = { bold: true, size: 12 };
    const stats = monthlyStats[selectedUser];
    if (stats) {
       ws.addRow(['Días Trabajados:', stats.days.size]);
       ws.addRow(['Horas Totales Trabajadas:', Number((stats.totalMinutes / 60).toFixed(2))]);
       ws.addRow(['Total Atrasos (min):', stats.totalDelayMinutes]);
    } else {
       ws.addRow(['Días Trabajados:', 0]);
       ws.addRow(['Horas Totales Trabajadas:', 0]);
       ws.addRow(['Total Atrasos (min):', 0]);
    }

    ws.columns = [
      { width: 20 }, { width: 15 }, { width: 20 }, { width: 25 }, { width: 15 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), \`Asistencia_\${selectedUserObj?.name.replace(/\\s+/g, '_')}_\${selectedMonth}.xlsx\`);
    toast.success('Exportación completada');
  };
`;

code = code.replace(/const exportWeeklyToExcel = \(\) => \{[\s\S]*?toast\.success\('Reporte semanal exportado a Excel'\);\n  \};/, exportWeeklyToExcel.trim());
code = code.replace(/const exportAllToExcel = \(\) => \{[\s\S]*?toast\.success\('Todas las asistencias exportadas con éxito'\);\n  \};/, exportAllToExcel.trim());
code = code.replace(/const exportToExcel = \(\) => \{[\s\S]*?toast\.success\('Exportación completada'\);\n  \};/, exportToExcel.trim());

fs.writeFileSync('src/components/AttendanceHistory.tsx', code);
