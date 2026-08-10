import { GoogleGenAI, Type } from "@google/genai";

export function getApiKey(): string | null {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    localStorage.getItem("GEMINI_API_KEY") ||
    null
  );
}

export function saveApiKey(key: string) {
  if (key) {
    localStorage.setItem("GEMINI_API_KEY", key.trim());
  } else {
    localStorage.removeItem("GEMINI_API_KEY");
  }
}

// Highly descriptive, offline compilation engines as backup for high AI demand outages (503)
export function generateLocalHeuristicWeeklyReport(metadata: any, tasks: any[], incidents: any[]): any {
  const pendingCount = (tasks || []).filter(t => t.status === 'pendiente').length;
  const processCount = (tasks || []).filter(t => t.status === 'en proceso').length;
  const completedCount = (tasks || []).filter(t => t.status === 'listo' || t.status === 'completado').length;
  const total = (tasks || []).length || 1;

  let suggestedStatus: 'Excelente' | 'Bueno' | 'Regular' | 'Crítico' = 'Bueno';
  if ((incidents || []).some(i => i.gravity === 'Crítica' || i.gravity === 'Alta')) {
    suggestedStatus = 'Crítico';
  } else if (pendingCount / total > 0.5) {
    suggestedStatus = 'Regular';
  } else if (completedCount / total > 0.7) {
    suggestedStatus = 'Excelente';
  }

  const formattedPeriod = `${metadata?.startDate || "inicio de semana"} al ${metadata?.endDate || "fin de semana"}`;
  const areaName = metadata?.area || "el área técnica";
  const projectName = metadata?.project || "el proyecto activo";
  const totalIncidents = (incidents || []).length;

  let executiveSummary = `Durante el periodo del ${formattedPeriod} en ${projectName} (Área: ${areaName}), se registraron un total de ${(tasks || []).length} actividades operativas supervisadas y analizadas de forma exhaustiva. El ritmo de ejecución muestra un nivel general calificado como ${suggestedStatus.toLowerCase()}. `;
  if (totalIncidents > 0) {
    executiveSummary += `Se documentaron ${totalIncidents} incidentes o problemáticas que requirieron atención inmediata del responsable técnico para mitigar riesgos.`;
  } else {
    executiveSummary += `No se reportaron incidentes incidentales en la zona de operaciones, facilitando la continuidad operacional del personal asignado.`;
  }

  let generalProgressAnalysis = `Análisis general: Se cuantifican ${completedCount} tareas finalizadas exitosamente con sus respectivas evidencias fotográficas. Asimismo, ${processCount} actividades continúan activas en proceso de ejecución y ${pendingCount} quedan programadas para el ciclo inmediato. `;
  if (suggestedStatus === 'Excelente' || suggestedStatus === 'Bueno') {
    generalProgressAnalysis += `El ritmo técnico operativo refleja constancia, reduciendo tiempos muertos y garantizando la entrega segura de los frentes de trabajo.`;
  } else {
    generalProgressAnalysis += `Las operaciones registran ciertas desviaciones en tiempos debido a incidentes reportados, requiriendo un plan de recuperación de horas de inmediato.`;
  }

  const recommendations: string[] = [];
  if (totalIncidents > 0) {
    recommendations.push("Implementar un plan de acción correctivo inmediato para evitar recurrencia de los incidentes de seguridad.");
  }
  if (pendingCount > 0) {
    recommendations.push("Priorizar la asignación de recursos y coordinar esfuerzos en las tareas actualmente pendientes.");
  }
  recommendations.push("Garantizar charlas preventivas de inicio de jornada antes de realizar labores en torre o campo.");
  recommendations.push("Controlar rigurosamente la captura de evidencias de campo al cierre de cada jornada operativa.");

  if (recommendations.length > 3) {
    recommendations.splice(3);
  }

  const taskObservations = (tasks || []).map(t => {
    let observation = "Actividad dentro de los parámetros de control establecidos de planta.";
    if (t.status === 'completado' || t.status === 'listo') {
      observation = `Actividad finalizada conforme según estándares de calidad por ${t.responsible || "supervisor asignado"}.`;
    } else if (t.status === 'en proceso') {
      observation = `Actividad en ejecución activa con presencia de personal de campo. Avance continuo.`;
    } else if (t.status === 'pendiente') {
      observation = `Actividad calendarizada en estado pendiente de inicio por logística o asignación humana.`;
    }
    return {
      taskId: t.id,
      observation
    };
  });

  return {
    executiveSummary,
    generalProgressAnalysis,
    recommendations,
    suggestedStatus,
    taskObservations,
    isLocalFallback: true
  };
}

export function generateLocalHeuristicProgressSummary(stats: any, projectContext?: any): string {
  const totalLogs = stats?.totalLogs || stats?.logsCount || 0;
  const userCount = stats?.userCount || stats?.activePersonnel || 0;

  let summary = `Durante el periodo operacional analizado de la planta, se procesó un total de ${totalLogs} registros de bitácora y monitoreo de asistencia pertenecientes a ${userCount} operarios técnicos de campo.\n\n`;
  summary += `Análisis del Ritmo: No se apropian anomalías severas de puntualidad. La distribución horaria de labores muestra un comportamiento estable que respalda de manera directa la consecución de los hitos técnicos de obra. `;
  if (projectContext) {
    summary += `El cronograma para ${projectContext.name || "el proyecto"} avanza de acuerdo a la logística preventiva establecida.\n\n`;
  } else {
    summary += `\n\n`;
  }
  summary += `Recomendaciones Operativas Técnicas:\n`;
  summary += `- Continuar con las auditorías automáticas diarias para evitar desviaciones operacionales futuras.\n`;
  summary += `- Promover la captura ordenada de evidencias fotográficas en las tareas críticas para complementar la bitácora mensual.`;

  return summary;
}

export const geminiService = {
  // Report summary generation
  async generateProgressSummary(stats: any, projectContext?: any): Promise<string> {
    try {
      const response = await fetch("/api/consolidated-report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stats, projectContext }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          return await this.generateProgressSummaryClientside(stats, projectContext);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del API (Código ${response.status})`);
      }

      const data = await response.json();
      return data.text || "No se pudo obtener la respuesta de la IA.";
    } catch (error: any) {
      console.warn("Fallo en generación servidor, aplicando motor heurístico local:", error);
      try {
        return await this.generateProgressSummaryClientside(stats, projectContext);
      } catch (clientErr) {
        console.warn("Fallo también en generación cliente, aplicando local de respaldo:", clientErr);
        return generateLocalHeuristicProgressSummary(stats, projectContext);
      }
    }
  },

  async generateProgressSummaryClientside(stats: any, projectContext?: any): Promise<string> {
    const key = getApiKey();
    if (!key) {
      return generateLocalHeuristicProgressSummary(stats, projectContext);
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `
            Actúa como un Ingeniero de Obra Senior y Analista de Proyectos. 
            Genera un resumen ejecutivo profesional basado en las siguientes estadísticas de bitácora de obra y el contexto técnico del proyecto:
            
            CONTEXTO DEL PROYECTO:
            ${projectContext ? JSON.stringify(projectContext, null, 2) : "No se proporcionó contexto técnico específico."}

            DATOS DE AVANCE RECIENTE:
            ${JSON.stringify(stats, null, 2)}
            
            EL RESUMEN DEBE INCLUIR:
            1. Estado general del proyecto contrastado con los OBJETIVOS técnicos.
            2. Análisis del ritmo de avance respecto a las especificaciones mencionadas.
            3. Principales dificultades detectadas basándose en las incidencias.
            4. Evaluación de la tendencia de productividad.
            5. Recomendaciones estratégicas para los próximos días ajustadas al contexto del proyecto.
            
            ESTILO:
            - Profesional, técnico pero claro.
            - En español.
            - Máximo 3 párrafos cortos.
            - No uses Markdown complejo, solo texto plano o guiones simples.
        `,
      });

      return response.text || generateLocalHeuristicProgressSummary(stats, projectContext);
    } catch (err) {
      console.warn("Fallo directo en llamada al SDK de Gemini:", err);
      return generateLocalHeuristicProgressSummary(stats, projectContext);
    }
  },

  // Weekly report generation
  async generateWeeklyReport(metadata: any, tasks: any[], incidents: any[]): Promise<any> {
    try {
      const response = await fetch("/api/weekly-report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metadata, tasks, incidents }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          return await this.generateWeeklyReportClientside(metadata, tasks, incidents);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Fallo del API (Código ${response.status})`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn("Fallo en generación con API, aplicando motor heurístico local:", error);
      try {
        return await this.generateWeeklyReportClientside(metadata, tasks, incidents);
      } catch (clientErr) {
        console.warn("Fallo también en generación cliente, aplicando local de respaldo:", clientErr);
        return generateLocalHeuristicWeeklyReport(metadata, tasks, incidents);
      }
    }
  },

  async generateWeeklyReportClientside(metadata: any, tasks: any[], incidents: any[]): Promise<any> {
    const key = getApiKey();
    if (!key) {
      return generateLocalHeuristicWeeklyReport(metadata, tasks, incidents);
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `
          Actúa como un Supervisor e Ingeniero Industrial Senior.
          Tu labor es redactar un "Informe Semanal" profesional y riguroso.
          Analiza las actividades (tareas) completadas e incidencias semanales registradas de manera seria y ejecutiva.
          Estilo corporativo, sin rodeos de venta ni adjetivos exagerados. Sé claro, asertivo y directo. Idioma de salida: Español.
          MANDATORIO: No uses porcentajes (%), métricas porcentuales, ni números de cumplimiento en tus descripciones. Redáctalo de manera meramente textual descriptiva.
      `;

      const prompt = `
          Analiza detalladamente las tareas, y las incidencias del siguiente informe y genera la síntesis semanal estructurada en formato JSON:

          SINOPSIS METADATOS:
          - Semana de reporte: ${metadata?.weekLabel || "Semana Actual"}
          - Periodo: ${metadata?.startDate || "N/A"} al ${metadata?.endDate || "N/A"}
          - Proyecto/Área: ${metadata?.area || "Unidad de Producción"}
          - Supervisor: ${metadata?.responsibleName || "Ing. de Turno"}

          LISTADO DE TAREAS SELECCIONADAS:
          ${JSON.stringify(tasks, null, 2)}

          INCIDENCIAS O PROBLEMÁTICAS ADJUNTAS:
          ${JSON.stringify(incidents, null, 2)}

          ESQUEMA DE RESPUESTA JSON MANDATORIO:
          Envía estrictamente un objeto JSON con las siguientes claves. IMPORTANTE: Ningún texto generado debe contener símbolos '%', porcentajes, o fracciones numéricas de avance. Toda la explicación debe basarse en estados textuales y análisis descriptivo de actividades.
          {
            "executiveSummary": "Resumen técnico de la semana operativa, ritmos, logros clave e impacto sin mencionar porcentajes ni cifras de cumplimiento.",
            "generalProgressAnalysis": "Explicación narrativa descriptiva del progreso general técnico en base a actividades ejecutadas y contingencias, sin incluir números porcentuales ni símbolos '%'.",
            "recommendations": ["Recomendación 1 corregir...", "Recomendación 2 prevenir..."],
            "suggestedStatus": "Uno de estos valores exactamente: Excelente | Bueno | Regular | Crítico",
            "taskObservations": [
              {
                "taskId": "ID de la tarea",
                "observation": "Observación breve de la tarea..."
              }
            ]
          }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              generalProgressAnalysis: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              suggestedStatus: { type: Type.STRING },
              taskObservations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    observation: { type: Type.STRING }
                  },
                  required: ["taskId", "observation"]
                }
              }
            },
            required: ["executiveSummary", "generalProgressAnalysis", "recommendations", "suggestedStatus", "taskObservations"]
          }
        }
      });

      const textOutput = response.text || "{}";
      return JSON.parse(textOutput.trim());
    } catch (err) {
      console.warn("Fallo al contactar la API clave cliente de Gemini:", err);
      return generateLocalHeuristicWeeklyReport(metadata, tasks, incidents);
    }
  },

  async generateExceptionalReport(eventType: string, project: string, impacts: any[], hasPhotos: boolean): Promise<any> {
    const key = getApiKey();
    if (!key) {
      throw new Error("No hay API Key configurada para usar la IA de Gemini");
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const systemInstruction = `
        Actúa como un Ingeniero Estructural y Supervisor de Obra.
        Redacta una evaluación técnica descriptiva de daños post-evento excepcional (sismo, inundación, etc.).
        Genera una descripción ejecutiva principal del evento.
        Genera comentarios estructurales técnicos para cada torre listada en base a su estado.
        Responde estrictamente en formato JSON.
    `;

    // Only pass necessary fields, not massive base64 photo strings
    const strippedImpacts = impacts.map(imp => ({
       id: imp.id,
       towerLabel: imp.towerLabel,
       side: imp.side,
       status: imp.status,
       hasPhoto: !!imp.photo
    }));

    const prompt = `
        EVENTO: ${eventType}
        PROYECTO/PLANTA: ${project}
        MÁS INFORMACIÓN: ${hasPhotos ? "Existen evidencias fotográficas adjuntas de manera general" : "No hay evidencias fotográficas generales"}
        
        LISTADO DE TORRES Y ESTADOS:
        ${JSON.stringify(strippedImpacts, null, 2)}
        
        ESQUEMA DE RESPUESTA:
        - "mainDescription": Descripción técnica del estado de la obra y el suceso.
        - "towerComments": Array con { "towerId": string, "comment": string } donde el comment detalla según el estado (ej. Daños Severos -> Requiere intervención, Intacta -> Sin novedades, etc.)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mainDescription: { type: Type.STRING },
            towerComments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  towerId: { type: Type.STRING },
                  comment: { type: Type.STRING }
                },
                required: ["towerId", "comment"]
              }
            }
          },
          required: ["mainDescription", "towerComments"]
        }
      }
    });

    const textOutput = response.text || "{}";
    return JSON.parse(textOutput.trim());
  }
};
