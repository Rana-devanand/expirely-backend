import cron from "node-cron";
import { supabase } from "../../config/supabase";
import { queueService } from "./queue.service";

export class SchedulerService {
  init() {
    const cronOptions = { timezone: "Asia/Kolkata" };

    // 1. Morning Scan: 9 AM IST (Items expiring in 3 days)
    cron.schedule("0 9 * * *", () => {
      console.log("⏰ Running 9 AM Morning Scan...");
      this.scanExpiringItems(3);
    }, cronOptions);

    // 2. Afternoon Scan: 1 PM IST (Items expiring in 7 days)
    cron.schedule("0 13 * * *", () => {
      console.log("⏰ Running 1 PM Afternoon Scan...");
      this.scanExpiringItems(7);
    }, cronOptions);

    // 3. Evening Scan: 8 PM IST (Recap of items added today)
    cron.schedule("0 20 * * *", () => {
      console.log("⏰ Running 8 PM Evening Recap Scan...");
      this.scanNewItemsToday();
    }, cronOptions);

    console.log("✅ Scheduler Service Initialized (Timezone: Asia/Kolkata).");
  }

  private async scanExpiringItems(days: number) {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const dateString = targetDate.toISOString().split("T")[0];

      const { data: products, error } = await supabase
        .from("products")
        .select("*, users!inner(id, email)")
        .eq("expiry_date", dateString)
        .eq("is_consumed", false);

      if (error) throw error;

      if (products) {
        for (const product of products) {
          await queueService.send({
            type: "EXPIRY_WARNING",
            userId: product.user_id,
            days,
            product: {
              id: product.id,
              name: product.name,
              category: product.category,
            },
          });
        }
        console.log(
          `📦 Queued ${products.length} notifications for ${days}-day expiry.`,
        );
      }
    } catch (error) {
      console.error(`❌ Morning/Afternoon Scan Error (${days} days):`, error);
    }
  }

  private async scanNewItemsToday() {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Get all products created today grouped by user
      const { data: products, error } = await supabase
        .from("products")
        .select("user_id, name")
        .gte("created_at", today);

      if (error) throw error;

      if (products) {
        // Group by userId manually
        const userGroups: Record<string, any[]> = {};
        products.forEach((p: any) => {
          if (!userGroups[p.user_id]) userGroups[p.user_id] = [];
          userGroups[p.user_id].push(p);
        });

        for (const userId in userGroups) {
          await queueService.send({
            type: "DAILY_RECAP",
            userId,
            products: userGroups[userId],
          });
        }
        console.log(
          `📦 Queued daily recaps for ${Object.keys(userGroups).length} users.`,
        );
      }
    } catch (error) {
      console.error("❌ Evening Recap Scan Error:", error);
    }
  }

  // Helper to manually trigger for testing
  async triggerManualScan(type: "morning" | "afternoon" | "evening") {
    if (type === "morning") await this.scanExpiringItems(3);
    else if (type === "afternoon") await this.scanExpiringItems(7);
    else if (type === "evening") await this.scanNewItemsToday();
  }
}

export const schedulerService = new SchedulerService();
