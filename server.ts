import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const DATA_DIR = path.join(__dirname, "data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  const USERS_FILE = path.join(DATA_DIR, "users.json");
  const LOGS_FILE = path.join(DATA_DIR, "logs.json");
  const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
  const MOVEMENTS_FILE = path.join(DATA_DIR, "movements.json");
  const WORKLOGS_FILE = path.join(DATA_DIR, "worklogs.json");

  const readData = (file: string) => {
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (e) {
      return [];
    }
  };

  const writeData = (file: string, data: any) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };

  // API Routes
  app.get("/api/users", (req, res) => {
    res.json(readData(USERS_FILE));
  });

  app.post("/api/users", (req, res) => {
    const users = readData(USERS_FILE);
    const newUser = req.body;
    if (users.some((u: any) => u.id === newUser.id)) {
      return res.status(400).send("User ID already exists");
    }
    users.push(newUser);
    writeData(USERS_FILE, users);
    res.status(201).json(newUser);
  });

  app.put("/api/users/:id", (req, res) => {
    const users = readData(USERS_FILE);
    const index = users.findIndex((u: any) => u.id === req.params.id);
    if (index !== -1) {
      users[index] = { ...users[index], ...req.body };
      writeData(USERS_FILE, users);
      res.json(users[index]);
    } else {
      res.status(404).send("User not found");
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    let users = readData(USERS_FILE);
    users = users.filter((u: any) => u.id !== req.params.id);
    writeData(USERS_FILE, users);
    res.status(204).send();
  });

  app.get("/api/logs", (req, res) => {
    res.json(readData(LOGS_FILE));
  });

  app.post("/api/logs", (req, res) => {
    const logs = readData(LOGS_FILE);
    const newLog = req.body;
    logs.push(newLog);
    writeData(LOGS_FILE, logs);
    res.status(201).json(newLog);
  });

  // Inventory Routes
  app.get("/api/products", (req, res) => {
    res.json(readData(PRODUCTS_FILE));
  });

  app.post("/api/products", (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const newProduct = req.body;
    if (products.some((p: any) => p.id === newProduct.id)) {
      return res.status(400).send("Product ID already exists");
    }
    products.push(newProduct);
    writeData(PRODUCTS_FILE, products);
    res.status(201).json(newProduct);
  });

  app.put("/api/products/:id", (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const index = products.findIndex((p: any) => p.id === req.params.id);
    if (index !== -1) {
      products[index] = { ...products[index], ...req.body };
      writeData(PRODUCTS_FILE, products);
      res.json(products[index]);
    } else {
      res.status(404).send("Product not found");
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    let products = readData(PRODUCTS_FILE);
    products = products.filter((p: any) => p.id !== req.params.id);
    writeData(PRODUCTS_FILE, products);
    res.status(204).send();
  });

  app.get("/api/movements", (req, res) => {
    res.json(readData(MOVEMENTS_FILE));
  });

  app.post("/api/movements", (req, res) => {
    const movements = readData(MOVEMENTS_FILE);
    const newMovement = req.body;
    movements.push(newMovement);
    writeData(MOVEMENTS_FILE, movements);
    res.status(201).json(newMovement);
  });

  // WorkLog Routes
  app.get("/api/worklogs", (req, res) => {
    res.json(readData(WORKLOGS_FILE));
  });

  app.post("/api/worklogs", (req, res) => {
    const worklogs = readData(WORKLOGS_FILE);
    const newWorkLog = req.body;
    worklogs.push(newWorkLog);
    writeData(WORKLOGS_FILE, worklogs);
    res.status(201).json(newWorkLog);
  });

  app.put("/api/worklogs/:id", (req, res) => {
    const worklogs = readData(WORKLOGS_FILE);
    const index = worklogs.findIndex((l: any) => l.id === req.params.id);
    if (index !== -1) {
      worklogs[index] = { ...worklogs[index], ...req.body };
      writeData(WORKLOGS_FILE, worklogs);
      res.json(worklogs[index]);
    } else {
      res.status(404).send("WorkLog not found");
    }
  });

  app.delete("/api/worklogs/:id", (req, res) => {
    let worklogs = readData(WORKLOGS_FILE);
    worklogs = worklogs.filter((l: any) => l.id !== req.params.id);
    writeData(WORKLOGS_FILE, worklogs);
    res.status(204).send();
  });

  // Bulk Import
  app.post("/api/import", (req, res) => {
    const { users, logs, products, movements } = req.body;
    if (users) writeData(USERS_FILE, users);
    if (logs) writeData(LOGS_FILE, logs);
    if (products) writeData(PRODUCTS_FILE, products);
    if (movements) writeData(MOVEMENTS_FILE, movements);
    res.json({ status: "success" });
  });

  // Generación con IA para Informe Semanal Inteligente
  app.post("/api/weekly-report/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "La API key de Gemini (GEMINI_API_KEY) no está configurada en los Secrets de la plataforma." 
        });
      }

      const { metadata, tasks, incidents } = req.body;

      const ai = new GoogleGenAI({ 
        apiKey,
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
        Analiza detalladamente las tareas, horas de trabajo y las incidencias del siguiente informe y genera la síntesis semanal estructurada en formato JSON:

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
          "generalProgressAnalysis": "Explicación narrativa descriptiva del progreso general técnico en base a horas empleadas, actividades ejecutadas y contingencias, sin incluir números porcentuales ni símbolos '%'.",
          "recommendations": ["Recomendación 1 corregir...", "Recomendación 2 prevenir..."],
          "suggestedStatus": "Uno de estos valores exactamente: Excelente | Bueno | Regular | Crítico"
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
              suggestedStatus: { type: Type.STRING }
            },
            required: ["executiveSummary", "generalProgressAnalysis", "recommendations", "suggestedStatus"]
          }
        }
      });

      const textOutput = response.text || "{}";
      const resultData = JSON.parse(textOutput);
      res.json(resultData);
    } catch (err) {
      console.error("Gemini Weekly Report generator error:", err);
      res.status(500).json({ 
        error: "Incidente al procesar la IA de Gemini: " + (err instanceof Error ? err.message : String(err)) 
      });
    }
  });

  // Generación con IA para Informe Consolidado
  app.post("/api/consolidated-report/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "La API key de Gemini (GEMINI_API_KEY) no está configurada en los Secrets de la plataforma." 
        });
      }

      const { stats, projectContext } = req.body;

      const ai = new GoogleGenAI({ 
        apiKey,
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
        `
      });

      res.json({ text: response.text });
    } catch (err) {
      console.error("Gemini Consolidated Report error:", err);
      res.status(500).json({ 
        error: "Error al generar el análisis de IA: " + (err instanceof Error ? err.message : String(err)) 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
