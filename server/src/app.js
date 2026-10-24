import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { documentsRouter } from "./routes/documents.js";
import { settingsRouter } from "./routes/settings.js";
import { backupRouter } from "./routes/backup.js";

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

/** config: { jwtSecret, inviteCode, clientOrigin, authRateMax, dbConfigured } */
export function createApp(config) {
  const app = express();
  app.locals.config = config;
  app.set("trust proxy", 1); // behind Render's proxy, so rate limits see the real IP
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin ? config.clientOrigin.split(",").map((s) => s.trim()) : false }));
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "parteh-hq-api", db: config.dbConfigured === false ? "not configured" : DB_STATES[mongoose.connection.readyState] });
  });

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.authRateMax ?? 20, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many attempts. Try again in a few minutes." },
  });
  app.use("/api", authRouter(limiter));
  app.use("/api/projects", requireAuth, projectsRouter);
  app.use("/api/documents", requireAuth, documentsRouter);
  app.use("/api/settings", requireAuth, settingsRouter);
  app.use("/api/backup", requireAuth, backupRouter);

  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}
