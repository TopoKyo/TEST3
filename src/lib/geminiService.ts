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
          // Fallback to client-side if server route does not exist or lacks API key
          return await this.generateProgressSummaryClientside(stats, projectContext);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Fallo del API (Código ${response.status})`);
      }

      const data = await response.json();
      return data.text || "No se pudo obtener la respuesta de la IA.";
    } catch (error: any) {
      if (error.message === "API_KEY_REQUIRED") {
        throw error;
      }
      // If we failed to fetch (server offline, Vercel SPA) or other network error, trigger fallback
      if (error instanceof TypeError || error?.message?.includes("fetch") || error?.message?.includes("comunicación")) {
        console.log("Detectado error de red o 404. Iniciando fallback de generación con IA de cliente...");
        return await this.generateProgressSummaryClientside(stats, projectContext);
      }
      console.error("Error in generateProgressSummary:", error);
      throw error;
    }
  },

  async generateProgressSummaryClientside(stats: any, projectContext?: any): Promise<string> {
    const key = getApiKey();
    if (!key) {
      throw new Error("API_KEY_REQUIRED");
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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

    return response.text || "No se pudo obtener la respuesta de la IA.";
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
          // Fallback to client-side if server route does not exist or lacks API key
          return await this.generateWeeklyReportClientside(metadata, tasks, incidents);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Fallo del API (Código ${response.status})`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.message === "API_KEY_REQUIRED") {
        throw error;
      }
      if (error instanceof TypeError || error?.message?.includes("fetch") || error?.message?.includes("comunicación")) {
        console.log("Detectado error de red o 404. Iniciando fallback de generación de informe semanal en cliente...");
        return await this.generateWeeklyReportClientside(metadata, tasks, incidents);
      }
      console.error("Error in generateWeeklyReport:", error);
      throw error;
    }
  },

  async generateWeeklyReportClientside(metadata: any, tasks: any[], incidents: any[]): Promise<any> {
    const key = getApiKey();
    if (!key) {
      throw new Error("API_KEY_REQUIRED");
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
      model: "gemini-3.5-flash",
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
  }
};
