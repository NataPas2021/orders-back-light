import express from "express";
import morgan from "morgan";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Получение текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Настройка CORS
const corsOptions = {
  origin: "http://example.com", // Замени на нужный домен
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(morgan("tiny"));
app.use(cors(corsOptions));
app.use(express.json());

let acceptedOrders = [];
let completedOrders = [];

// Получить все принятые заказы
app.get("/accepted-orders", (req, res) => {
  res.json(acceptedOrders);
});

// Получить все выполненные заказы
app.get("/completed-orders", (req, res) => {
  res.json(completedOrders);
});

// Добавить новый принятый заказ
app.post("/accepted-orders", (req, res) => {
  const order = req.body;
  acceptedOrders.push(order);
  res.status(201).json(order);
});

// Переместить заказ из принятых в выполненные
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
});

// Удалить заказ из выполненных
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
});

// Удалить заказ из принятых
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
});

// Функция для обработки нового заказа из JSON файла
const handleNewOrderFile = (filePath) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}:`, err);
      return;
    }

    try {
      const order = JSON.parse(data);
      acceptedOrders.push(order);
      console.log(`Order added from file ${filePath}`);

      // Удаление файла после обработки
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting file ${filePath}:`, err);
        }
      });
    } catch (err) {
      console.error(`Error parsing JSON from file ${filePath}:`, err);
    }
  });
};

// Настройка наблюдателя за файлами с помощью fs.watch
const watchDirectory = path.join(__dirname, "/");
fs.watch(watchDirectory, (eventType, filename) => {
  if (eventType === "rename" && filename.endsWith(".json")) {
    const filePath = path.join(watchDirectory, filename);
    if (fs.existsSync(filePath)) {
      console.log(`File ${filename} has been added`);
      handleNewOrderFile(filePath);
    }
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
