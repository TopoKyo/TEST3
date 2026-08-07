const fs = require('fs');
let code = fs.readFileSync('src/components/DailyLog.tsx', 'utf8');

// 1. Add generalObservations to newLog initialization
code = code.replace(
  "nextDayPlan: []",
  "nextDayPlan: [],\n  generalObservations: ''"
);

// 2. Add generalObservations to PDF generation
// Find the PDF generation part for Safety and add a new table for General Observations if it exists
code = code.replace(
  "// Safety\n    autoTable(doc, {",
  `if (currentLog.generalObservations) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        head: [['OBSERVACIONES GENERALES']],
        body: [[currentLog.generalObservations]],
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] }
      });
    }

    // Safety
    autoTable(doc, {`
);

// 3. Rename Observaciones Grales in Safety table to Observaciones SSO
code = code.replace(
  "['Observaciones Grales:', currentLog.safety.observations || '-']",
  "['Observaciones SSO:', currentLog.safety.observations || '-']"
);

// 4. Add the section in JSX right after Plan Trabajo Mañana (Section 7)
const sectionToInsertAfter = `                 </LogSection>
              </div>`;
const replacementSection = `                 </LogSection>
              </div>

              {/* Section 8: Observaciones Generales */}
              <LogSection title="Observaciones Generales" icon={<FileText />} isEditing={isEditing}>
                 <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                   <textarea
                     value={currentLog?.generalObservations || ''}
                     onChange={e => setCurrentLog(l => l ? {...l, generalObservations: e.target.value} : null)}
                     disabled={!isEditing}
                     className="w-full min-h-[100px] p-3 rounded-lg border border-neutral-200 bg-white resize-y focus:ring-1 focus:ring-primary outline-none"
                     placeholder="Escribe aquí observaciones generales, comentarios adicionales o notas importantes del día..."
                   />
                 </div>
              </LogSection>`;

code = code.replace(sectionToInsertAfter, replacementSection);

fs.writeFileSync('src/components/DailyLog.tsx', code);
