import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import pool from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import ieRoutes from "./routes/ieRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import salesReturnRoutes from "./routes/salesReturnRoutes.js";
import stockWithdrawalRoutes from "./routes/stockWithdrawalRoutes.js";
import tellerRoutes from "./routes/tellerRoutes.js";
import managerPasswordRoutes from "./routes/managerPasswordRoutes.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import adminFeedbackRoutes from "./routes/adminFeedbackRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Stoka API is running.",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check error:", error.message);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

// Business authentication
app.use("/api/auth", authRoutes);

// Admin login
app.use("/api/admin/auth", adminAuthRoutes);

// Protected admin business-management endpoints
app.use("/api/admin", adminRoutes);

// Existing Stoka endpoints
app.use("/api/products", productRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/ie", ieRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/returns", salesReturnRoutes);
app.use("/api/withdrawals", stockWithdrawalRoutes);
app.use("/api/tellers", tellerRoutes);
app.use("/api/manager-passwords", managerPasswordRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin/feedback", adminFeedbackRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "API endpoint not found.",
  });
});

app.listen(PORT, () => {
  console.log(`Stoka API running at http://localhost:${PORT}`);
});