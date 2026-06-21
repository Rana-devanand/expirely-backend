import { Router, type Request, type Response } from "express";
import { schedulerService } from "../../common/service/scheduler.service";

const router = Router();

/**
 * SECURITY: These routes should only be called by Vercel Cron.
 * Vercel sends an Authorization header with the CRON_SECRET.
 */
const verifyCronSecret = (req: Request, res: Response): boolean => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return true;

  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  return true;
};

router.get("/morning-scan", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("[CRON] Running Morning Scan (3-day expiry)...");
    await schedulerService.triggerManualScan("morning");
    res
      .status(200)
      .json({ success: true, message: "Morning scan completed." });
  } catch (error: any) {
    console.error("[CRON] Morning scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/afternoon-scan", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("[CRON] Running Afternoon Scan (7-day expiry)...");
    await schedulerService.triggerManualScan("afternoon");
    res
      .status(200)
      .json({ success: true, message: "Afternoon scan completed." });
  } catch (error: any) {
    console.error("[CRON] Afternoon scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/evening-scan", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("[CRON] Running Evening Recap Scan...");
    await schedulerService.triggerManualScan("evening");
    res
      .status(200)
      .json({ success: true, message: "Evening scan completed." });
  } catch (error: any) {
    console.error("[CRON] Evening scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/daily-reminders", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("[CRON] Running Daily Reminder Scan...");
    await schedulerService.triggerManualScan("daily-reminders");
    res
      .status(200)
      .json({ success: true, message: "Daily reminder scan completed." });
  } catch (error: any) {
    console.error("[CRON] Daily reminder scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/send-push", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    const { fcmToken, title, body, data } = req.body;
    if (!fcmToken || !title || !body) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const { sendPushNotification } = require("../../common/service/fcm.service");
    const success = await sendPushNotification(fcmToken, title, body, data);
    res.status(200).json({
      success,
      message: success ? "Push sent successfully." : "Push failed.",
    });
  } catch (error: any) {
    console.error("[CRON] Send push failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
