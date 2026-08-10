import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Printer, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ValueType = 'SI' | 'NO' | null;

interface RowData {
  id: string;
  item: string;
  description: string;
  value: ValueType;
  obs: string;
}

interface SectionData {
  id: string;
  title: string;
  rows: RowData[];
}

const defaultRows = [
  { id: 'ficha', item: 'Ficha técnica disponible', description: 'Ficha técnica del fabricante presente y legible, coincide con el modelo en uso.', value: null as ValueType, obs: '' },
  { id: 'cert', item: 'Certificación vigente', description: 'Resolución Exenta ISP y/o Declaración UE de Conformidad correspondiente al componente.', value: null as ValueType, obs: '' },
  { id: 'insp', item: 'Registro de inspección formal', description: 'Registro de inspección periódica que acredite el estado operativo del componente.', value: null as ValueType, obs: '' },
  { id: 'traz', item: 'Trazabilidad por N° de serie', description: 'N° de serie visible y coincidente con el registro/certificado del componente.', value: null as ValueType, obs: '' },
  { id: 'fecha', item: 'Fecha de puesta en servicio', description: 'Fecha de primer uso registrada, permite calcular la vida útil transcurrida.', value: null as ValueType, obs: '' },
  { id: 'vida', item: 'Vigencia de vida útil', description: 'Vida útil definida por el fabricante no superada a la fecha de la inspección.', value: null as ValueType, obs: '' },
  { id: 'estado', item: 'Estado físico general', description: 'Sin cortes, deshilachados, corrosión, deformaciones, quemaduras ni desgaste excesivo.', value: null as ValueType, obs: '' },
];

const initialSections: SectionData[] = [
  {
    id: 's1',
    title: '1. ARNÉS DE CUERPO COMPLETO',
    rows: [...defaultRows.map(r => ({ ...r, id: `s1_${r.id}` }))]
  },
  {
    id: 's2',
    title: '2. AMORTIGUADOR DE IMPACTO',
    rows: [...defaultRows.map(r => ({ ...r, id: `s2_${r.id}` }))]
  },
  {
    id: 's3',
    title: '3. DESCENDEDOR (Ej. Petzl)',
    rows: [
      ...defaultRows.map(r => ({ ...r, id: `s3_${r.id}` })),
      { id: 's3_freno', item: 'Funcionamiento del freno', description: 'Sistema de frenado/bloqueo opera correctamente, sin deslizamiento anómalo.', value: null, obs: '' }
    ]
  },
  {
    id: 's4',
    title: '4. CONECTORES / MOSQUETONES',
    rows: [
      ...defaultRows.map(r => ({ ...r, id: `s4_${r.id}` })),
      { id: 's4_cierre', item: 'Cierre y bloqueo del gatillo', description: 'Gatillo/leva cierra y bloquea correctamente (manual, automático o triple acción).', value: null, obs: '' }
    ]
  },
  {
    id: 's5',
    title: '5. LÍNEAS DE VIDA / CUERDAS',
    rows: [
      ...defaultRows.filter(r => r.id !== 'estado').map(r => ({ ...r, id: `s5_${r.id}` })),
      { id: 's5_estado1', item: 'Estado físico general', description: 'Sin cortes, deshilachados, corrosión, deformaciones, quemaduras ni desgaste excesivo.', value: null, obs: '' },
      { id: 's5_estado2', item: 'Estado de la cuerda/línea de vida', description: 'Sin cortes en el alma, camisa dañada, rigidez anómala ni contacto con químicos.', value: null, obs: '' },
      { id: 's5_term', item: 'Terminaciones y costuras', description: 'Terminaciones cosidas o empalmadas en buen estado, sin hilos sueltos.', value: null, obs: '' }
    ]
  }
];

export default function SpdcChecklist() {
  const [sections, setSections] = useState<SectionData[]>(initialSections);
  const [headerData, setHeaderData] = useState({
    obra: '',
    responsable: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const handleRowChange = (sectionId: string, rowId: string, field: 'value' | 'obs', newValue: any) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          rows: sec.rows.map(row => {
            if (row.id === rowId) {
              return { ...row, [field]: newValue };
            }
            return row;
          })
        };
      }
      return sec;
    }));
  };

  const handlePrint = async () => {
    try {
      // Import dynamically to avoid SSR issues if this were Next.js, and to keep initial bundle small
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = document.getElementById('checklist-content');
      if (!element) return;
      
      // Add a class temporarily for PDF generation if needed to hide UI elements
      element.classList.add('pdf-mode');
      
      const canvas = await html2canvas(element, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      element.classList.remove('pdf-mode');
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // A4 is 210x297mm. If height > 297mm, we might need multiple pages, but for this checklist we'll scale it to fit or let it span
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = 295; // slightly less than 297 to allow margins
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Checklist_SPDC_${headerData.obra || 'Vertical'}_${headerData.fecha}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      // Fallback to window.print() if canvas fails
      window.print();
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-12 print:pb-0 print:max-w-none print:w-full">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Checklist SPDC</h1>
          <p className="text-neutral-500 mt-1">Verificación de Sistemas Personales de Detención de Caídas</p>
        </div>
        <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm">
          <Printer size={18} className="mr-2" />
          Exportar a PDF
        </Button>
      </div>

      <Card className="border-neutral-200 shadow-sm bg-white overflow-hidden print:shadow-none print:border-none">
        <CardContent id="checklist-content" className="p-8 print:p-0">
          {/* Form Header matching the image exactly */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-[#1a365d] uppercase">CHECK LIST: VERIFICACIÓN DE SISTEMAS PERSONALES DE DETENCIÓN DE CAÍDAS (SPDC)</h2>
            <p className="text-sm text-neutral-600 mt-1">Documentación técnica, certificación y trazabilidad de equipos de protección contra caídas</p>
            <p className="text-sm text-neutral-500">Ley 16.744 ~ DS44 | Reglamento de Trabajo en Altura Físico</p>
          </div>

          <div className="border border-black mb-6 w-full text-sm">
            <div className="flex border-b border-black">
              <div className="w-1/4 border-r border-black font-bold p-2 bg-neutral-50">CÓD. INTERNO</div>
              <div className="w-1/4 border-r border-black p-2">VS-CL-SPDC-2026-001</div>
              <div className="w-1/4 border-r border-black font-bold p-2 bg-neutral-50">VERSIÓN</div>
              <div className="w-1/4 p-2">1.0</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-1/4 border-r border-black font-bold p-2 bg-neutral-50">FECHA ELAB.</div>
              <div className="w-1/4 border-r border-black p-2">
                <Input 
                  type="date" 
                  value={headerData.fecha}
                  onChange={(e) => setHeaderData({...headerData, fecha: e.target.value})}
                  className="h-6 p-0 border-none rounded-none focus-visible:ring-0 shadow-none text-sm w-full bg-transparent"
                />
              </div>
              <div className="w-1/4 border-r border-black font-bold p-2 bg-neutral-50">ESTADO</div>
              <div className="w-1/4 p-2">APTO PARA USO EN TERRENO</div>
            </div>
            <div className="flex">
              <div className="w-1/4 border-r border-black font-bold p-2 bg-neutral-50 flex items-center">OBRA / PROYECTO</div>
              <div className="w-1/4 border-r border-black p-1">
                <Input 
                  value={headerData.obra}
                  onChange={(e) => setHeaderData({...headerData, obra: e.target.value})}
                  className="h-8 border-none rounded-none focus-visible:ring-0 shadow-none text-sm w-full bg-transparent"
                  placeholder="Ingrese obra..."
                />
              </div>
              <div className="w-1/4 border-r border-black font-bold p-2 bg-neutral-50 flex items-center">RESPONSABLE DE VERIFICACIÓN</div>
              <div className="w-1/4 p-1">
                <Input 
                  value={headerData.responsable}
                  onChange={(e) => setHeaderData({...headerData, responsable: e.target.value})}
                  className="h-8 border-none rounded-none focus-visible:ring-0 shadow-none text-sm w-full bg-transparent"
                  placeholder="Ingrese nombre..."
                />
              </div>
            </div>
          </div>

          <p className="text-sm text-justify mb-6">
            Este check list verifica, para la totalidad de los Sistemas Personales de Detención de Caídas (SPDC) que serán utilizados por
            cada persona trabajadora en la obra, que se cuente con ficha técnica, certificación vigente (Resolución Exenta ISP /
            Declaración UE de Conformidad), registro de inspección formal, trazabilidad por número de serie y fecha de puesta en
            servicio, con el fin de acreditar el estado operativo y la vigencia de la vida útil de cada componente.
          </p>

          <div className="space-y-8">
            {sections.map(section => (
              <div key={section.id} className="print:break-inside-avoid">
                <div className="inline-block bg-[#c00000] text-white font-bold px-3 py-1 mb-2 border border-black text-sm">
                  {section.title}
                </div>
                <table className="w-full border-collapse border border-black text-sm">
                  <thead>
                    <tr className="bg-[#1a365d] text-white">
                      <th className="border border-black p-2 text-left w-[25%]">Ítem de verificación</th>
                      <th className="border border-black p-2 text-left w-[45%]">Qué se verifica</th>
                      <th className="border border-black p-2 text-center w-[5%]">SI</th>
                      <th className="border border-black p-2 text-center w-[5%]">NO</th>
                      <th className="border border-black p-2 text-center w-[20%] leading-tight">N° Serie /<br/>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map(row => (
                      <tr key={row.id}>
                        <td className="border border-black p-2 font-medium">{row.item}</td>
                        <td className="border border-black p-2 text-xs">{row.description}</td>
                        <td className="border border-black p-0 text-center align-middle cursor-pointer" onClick={() => handleRowChange(section.id, row.id, 'value', 'SI')}>
                          <div className="flex justify-center items-center h-full w-full p-2">
                            <div className={cn("w-4 h-4 border border-black flex items-center justify-center", row.value === 'SI' && "bg-black text-white font-bold")}>
                              {row.value === 'SI' && "X"}
                            </div>
                          </div>
                        </td>
                        <td className="border border-black p-0 text-center align-middle cursor-pointer" onClick={() => handleRowChange(section.id, row.id, 'value', 'NO')}>
                          <div className="flex justify-center items-center h-full w-full p-2">
                            <div className={cn("w-4 h-4 border border-black flex items-center justify-center", row.value === 'NO' && "bg-black text-white font-bold")}>
                              {row.value === 'NO' && "X"}
                            </div>
                          </div>
                        </td>
                        <td className="border border-black p-0">
                          <Input 
                            value={row.obs}
                            onChange={(e) => handleRowChange(section.id, row.id, 'obs', e.target.value)}
                            className="h-full min-h-[40px] border-none rounded-none focus-visible:ring-0 shadow-none text-xs w-full bg-transparent px-2"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="mt-12 print:break-inside-avoid">
            <h3 className="text-lg font-bold text-[#1a365d] uppercase mb-2 border-b-2 border-[#1a365d] inline-block">CONTROL DE VERIFICACIÓN</h3>
            <table className="w-full border-collapse border border-black text-sm mt-4">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-black p-2 text-center w-1/3">Verificó (Prevención / Supervisor)</th>
                  <th className="border border-black p-2 text-center w-1/3">Revisó y aprobó (Rep. Legal)</th>
                  <th className="border border-black p-2 text-center w-1/3">Recibió (Mandante)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black h-24 p-2 relative">
                    <span className="absolute bottom-1 left-2 text-[10px] text-neutral-400">Firma</span>
                  </td>
                  <td className="border border-black h-24 p-2 relative">
                    <span className="absolute bottom-1 left-2 text-[10px] text-neutral-400">Firma</span>
                  </td>
                  <td className="border border-black h-24 p-2 relative">
                    <span className="absolute bottom-1 left-2 text-[10px] text-neutral-400">Firma</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-between items-center text-[10px] font-bold text-neutral-600 print:block">
            <div className="uppercase">VERTICAL SOLUCIONES SPA | RUT: 76.864.184-6</div>
            <div className="print:text-right print:mt-[-15px]">Página 1 de 1</div>
          </div>
        </CardContent>
      </Card>
      
      {/* Global Print Styles to fix margins and hide unnecessary things */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          /* Hide inputs and show values if needed, but since they are styled as invisible borders it should be fine */
        }
      `}} />
    </div>
  );
}
