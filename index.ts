import "dotenv/config";
import express, { type Express, type Request, type Response } from "express";
import http from "http";
import cors from "cors";
import passport from "passport";
import morgan from "morgan";
import dns from "node:dns";

// Force IPv4 for consistency across environments
dns.setDefaultResultOrder("ipv4first");

import routes from "./app/routes";
import { errorHandler } from "./app/common/middleware/error-handler.middleware";
import { initPassport } from "./app/common/service/passport-jwt.service";
import { schedulerService } from "./app/common/service/scheduler.service";
import { notificationWorker } from "./app/modules/notification/notification.worker";
import { initFirebase } from "./app/common/service/fcm.service";

const app: Express = express();
const port = Number(process.env.PORT) || 5000;

// ── Standard Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));

// ── Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] 🛰️  ${req.method} ${req.url}`);
  next();
});

// ── App Initialization logic
const setupApp = () => {
  // Firebase Admin SDK Initialization
  initFirebase();

  // Passport Initialization
  initPassport();
  app.use(passport.initialize());

  if (process.env.NODE_ENV !== "production") {
    // Local dev: use node-cron + worker for convenience
    schedulerService.init();
    void notificationWorker.start();
  }
  // Production (Vercel): Cron jobs are handled via /api/cron/* routes
  // configured in vercel.json. No persistent process needed.

  // ── Routes
  app.use("/api", routes);

  // ── Root route
  app.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok", message: "Expirely Backend is running 🚀" });
  });

  // ── Error Handling
  app.use(errorHandler);
};

// Execute Setup
setupApp();

// ── Start Server (Local Only)
if (process.env.NODE_ENV !== "production") {
  const server = http.createServer(app);
  server.listen(port, "0.0.0.0", () => {
    console.log("-----------------------------------------");
    console.log(`✅ Server is running on port ${port}`);
    console.log(`🔗 Local: http://localhost:${port}`);
    console.log(`🌎 Network: http://10.248.57.83:${port}`);
    console.log("-----------------------------------------");
  });
}

export default app;
