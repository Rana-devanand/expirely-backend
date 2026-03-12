import { Router, type Request, type Response } from "express";
import { schedulerService } from "../../common/service/scheduler.service";

const router = Router();

/**
 * SECURITY: These routes should only be called by Vercel Cron.
 * Vercel sends an Authorization header with the CRON_SECRET.
 */
const verifyCronSecret = (req: Request, res: Response): boolean => {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is set (local dev), allow all
  if (!cronSecret) return true;

  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  return true;
};

// ── 9 AM IST — Items expiring in 3 days
router.get("/morning-scan", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("⏰ [CRON] Running Morning Scan (3-day expiry)...");
    await schedulerService.triggerManualScan("morning");
    res
      .status(200)
      .json({ success: true, message: "Morning scan completed." });
  } catch (error: any) {
    console.error("❌ [CRON] Morning scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── 1 PM IST — Items expiring in 7 days
router.get("/afternoon-scan", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("⏰ [CRON] Running Afternoon Scan (7-day expiry)...");
    await schedulerService.triggerManualScan("afternoon");
    res
      .status(200)
      .json({ success: true, message: "Afternoon scan completed." });
  } catch (error: any) {
    console.error("❌ [CRON] Afternoon scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── 8 PM IST — Daily recap
router.get("/evening-scan", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  try {
    console.log("⏰ [CRON] Running Evening Recap Scan...");
    await schedulerService.triggerManualScan("evening");
    res
      .status(200)
      .json({ success: true, message: "Evening scan completed." });
  } catch (error: any) {
    console.error("❌ [CRON] Evening scan failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
