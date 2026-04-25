import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
