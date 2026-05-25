export const geminiService = {
  async generateProgressSummary(stats: any, projectContext?: any) {
    try {
      const response = await fetch("/api/consolidated-report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stats, projectContext }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Fallo en la comunicación con la API");
      }

      const data = await response.json();
      return data.text || "No se pudo obtener la respuesta de la IA.";
    } catch (error) {
      console.error("Error generating AI summary:", error);
      return "Error al generar el análisis automático de IA.";
    }
  }
};
