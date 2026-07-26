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
import { initializeCommunitySocket } from "./app/modules/community/community.socket";

const app: Express = express();
const port = Number(process.env.PORT) || 5000;
const isVercelRuntime = Boolean(process.env.VERCEL);
const isRenderRuntime = Boolean(process.env.RENDER);

const usesSupabaseDirectDatabaseUrl = () => {
  try {
    const hostname = new URL(
      process.env.SUPABASE_CONNECTION_STRING || "",
    ).hostname;
    return hostname.startsWith("db.") && hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
};

// ── Standard Middlewares
app.use(cors({ origin: "*" }));
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

  if (!isVercelRuntime) {
    // Persistent runtimes (local/Render/Railway) can safely run workers.
    const directDatabaseBlocked =
      isRenderRuntime && usesSupabaseDirectDatabaseUrl();
    const enableNotificationQueue =
      process.env.ENABLE_NOTIFICATION_QUEUE === "true" &&
      !directDatabaseBlocked;
    schedulerService.init({ enableQueueJobs: enableNotificationQueue });
    if (enableNotificationQueue) {
      void notificationWorker.start();
    } else {
      console.log(
        directDatabaseBlocked
          ? "Notification queue worker disabled: Render cannot use the IPv6-only Supabase direct database URL. Configure the Session Pooler URL."
          : "Notification queue worker disabled. Set ENABLE_NOTIFICATION_QUEUE=true after configuring a Supabase Session Pooler URL.",
      );
    }
  }

  // ── Routes
  app.use("/api", routes);

  // Express 5 no longer accepts bare "*" suffixes in string routes.
  // Register the fallback only in production; locally Socket.IO owns this path.
  if (isVercelRuntime) {
    app.all(/^\/socket\.io(?:\/.*)?$/, (_req: Request, res: Response) => {
      res.status(200).json({
        status: "info",
        message: "Socket.IO server is not active on serverless environment.",
      });
    });
  }

  // ── Root route
  app.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok", message: "Expirely Backend is running 🚀" });
  });

  // ── Error Handling
  app.use(errorHandler);
};

// Execute Setup
setupApp();

// Persistent hosts such as Render need a listening HTTP server. Vercel imports
// the Express app as a serverless handler and must not call listen().
if (!isVercelRuntime) {
  const server = http.createServer(app);
  initializeCommunitySocket(server);
  server.listen(port, "0.0.0.0", () => {
    console.log("-----------------------------------------");
    console.log(`✅ Server is running on port ${port}`);
    console.log(`🔗 Local: http://localhost:${port}`);
    console.log(`🌎 Network: http://10.248.57.83:${port}`);
    console.log("-----------------------------------------");
  });
}

export default app;
