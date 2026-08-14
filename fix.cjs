const fs = require('fs');
let code = fs.readFileSync('src/components/DailyLog.tsx', 'utf-8');

const moveItemFunc = `  const moveItem = (section: string, id: string, direction: 'up' | 'down') => {
    if (!currentLog) return;
    const allItems = [...(currentLog as any)[section]];
    const index = allItems.findIndex((i: any) => i.id === id);
    if (index === -1) return;

    if (section === 'activities') {
      const activity = allItems[index];
      const periodMatches = (a: any) => activity.period === 'morning' || !activity.period 
        ? a.period === 'morning' || !a.period 
        : a.period === activity.period;
      
      const periodItems = allItems.filter(periodMatches);
      const periodIndex = periodItems.findIndex((a: any) => a.id === id);

      if (direction === 'up' && periodIndex > 0) {
        const prevId = periodItems[periodIndex - 1].id;
        const prevIndex = allItems.findIndex((a: any) => a.id === prevId);
        [allItems[index], allItems[prevIndex]] = [allItems[prevIndex], allItems[index]];
      } else if (direction === 'down' && periodIndex < periodItems.length - 1) {
        const nextId = periodItems[periodIndex + 1].id;
        const nextIndex = allItems.findIndex((a: any) => a.id === nextId);
        [allItems[index], allItems[nextIndex]] = [allItems[nextIndex], allItems[index]];
      }

      let counter = 1;
      for (const a of allItems) {
        if (periodMatches(a)) {
          a.item = counter++;
        }
      }
    } else {
      if (direction === 'up' && index > 0) {
        [allItems[index], allItems[index - 1]] = [allItems[index - 1], allItems[index]];
      } else if (direction === 'down' && index < allItems.length - 1) {
        [allItems[index], allItems[index + 1]] = [allItems[index + 1], allItems[index]];
      }
    }
    setCurrentLog({ ...currentLog, [section]: allItems });
  };`;

if (!code.includes("const moveItem = ")) {
  code = code.replace("  const removeItem = ", moveItemFunc + "\n\n  const removeItem = ");
}

fs.writeFileSync('src/components/DailyLog.tsx', code);
