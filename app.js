import express from "express";
import morgan from "morgan";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

// Получение текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Настройка CORS
app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());

let acceptedOrders = [];
let completedOrders = [];

// Создание WebSocket сервера
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ acceptedOrders, completedOrders }));

  ws.on("message", (message) => {
    console.log(`Received message => ${message}`);
  });
});

const sendUpdates = () => {
  const data = JSON.stringify({ acceptedOrders, completedOrders });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

// Обновление при изменении orders.json
const handleNewOrderFile = (filePath) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}:`, err);
      return;
    }

    try {
      const orders = JSON.parse(data);
      acceptedOrders = orders.accepted || [];
      completedOrders = orders.completed || [];
      console.log(`Orders updated from file ${filePath}`);
      sendUpdates();
    } catch (err) {
      console.error(`Error parsing JSON from file ${filePath}:`, err);
    }
  });
};

// Настройка наблюдателя за orders.json
const watchFile = path.join(__dirname, "orders.json");
fs.watchFile(watchFile, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    console.log(`File ${watchFile} has been updated`);
    handleNewOrderFile(watchFile);
  }
});

// API endpoints

app.get("/accepted-orders", (req, res) => {
  res.json(acceptedOrders);
});

app.get("/completed-orders", (req, res) => {
  res.json(completedOrders);
});

app.post("/accepted-orders", (req, res) => {
  const order = req.body;
  acceptedOrders.push(order);
  res.status(201).json(order);
  sendUpdates();
});

app.post("/complete-order/:orderNumber", (req, res) => {
  const orderNumber = req.params.orderNumber;
  const orderIndex = acceptedOrders.findIndex(
    (order) => order.orderNumber === orderNumber
  );

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found" });
  }

  const [order] = acceptedOrders.splice(orderIndex, 1);
  completedOrders.push(order);
  res.json(order);
  sendUpdates();
});

app.post("/accept-order/:orderNumber", (req, res) => {
  const orderNumber = req.params.orderNumber;
  const orderIndex = completedOrders.findIndex(
    (order) => order.orderNumber === orderNumber
  );

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found" });
  }

  const [order] = completedOrders.splice(orderIndex, 1);
  acceptedOrders.push(order);
  res.json(order);
  sendUpdates();
});

app.delete("/completed-orders/:orderNumber", (req, res) => {
  const orderNumber = req.params.orderNumber;
  const orderIndex = completedOrders.findIndex(
    (order) => order.orderNumber === orderNumber
  );

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found" });
  }

  const [order] = completedOrders.splice(orderIndex, 1);
  res.json(order);
  sendUpdates();
});

app.delete("/accepted-orders/:orderNumber", (req, res) => {
  const orderNumber = req.params.orderNumber;
  const orderIndex = acceptedOrders.findIndex(
    (order) => order.orderNumber === orderNumber
  );

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found" });
  }

  const [order] = acceptedOrders.splice(orderIndex, 1);
  res.json(order);
  sendUpdates();
});

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
