import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

const { MONGODB_URI, CLIENT_ORIGIN, PORT = 4000 } = process.env;

export const app = express();
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(",").map((s) => s.trim()) : false }));
app.use(express.json({ limit: "5mb" }));

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "parteh-hq-api",
    db: MONGODB_URI ? DB_STATES[mongoose.connection.readyState] : "not configured",
  });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong on the server." });
});

async function start() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("MongoDB connected");
    } catch (e) {
      console.error("MongoDB connection failed:", e.message);
    }
  } else {
    console.warn("MONGODB_URI is not set. The API will run without a database.");
  }
  if (!CLIENT_ORIGIN) console.warn("CLIENT_ORIGIN is not set. Browsers on other origins will be blocked by CORS.");
  app.listen(PORT, () => console.log(`parteh-hq-api listening on port ${PORT}`));
}
if (process.env.NODE_ENV !== "test") start();
