import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const geminiService = {
  async generateProgressSummary(stats: any, projectContext?: any) {
    if (!API_KEY) {
      console.warn("GEMINI_API_KEY is not set.");
      return "No se pudo generar el resumen automático debido a la falta de configuración de IA.";
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
      `});

      return response.text;
    } catch (error) {
      console.error("Error generating AI summary:", error);
      return "Error al generar el análisis automático de IA.";
    }
  }
};
