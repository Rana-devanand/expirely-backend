import { queueService } from "../../common/service/queue.service";
import { groqService } from "../../common/service/groq.service";
import { supabase } from "../../config/supabase";
import { sendPushNotification } from "../../common/service/fcm.service";

export class NotificationWorker {
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("🚀 Notification Worker started...");

    while (this.isRunning) {
      try {
        const message = await queueService.read();

        if (message) {
          await this.processMessage(message);
          await queueService.archive(message.msgid);
        } else {
          // No messages, wait 5 seconds before polling again
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error("❌ Worker Error:", error);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  stop() {
    this.isRunning = false;
  }

  private async processMessage(job: any) {
    const { userId, type, product, products, days } = job.message;
    console.log(`🛠️ Processing ${type} for user ${userId}...`);

    let title = "";
    let body = "";

    try {
      // ── 1. Generate notification content via Groq AI ──
      if (type === "EXPIRY_WARNING") {
        const messages = await groqService.generateExpiryAlertMessages(
          product.name,
          product.category || "General",
        );
        const stage = days === 7 ? "sevenDays" : "threeDays";
        title = messages[stage].title;
        body = messages[stage].body;
      } else if (type === "DAILY_RECAP") {
        const recap = await groqService.generateDailyRecap(products);
        title = recap.title;
        body = recap.body;
      }

      // ── 2. Save to Supabase notifications table ──
      const { error: dbError } = await supabase.from("notifications").insert([
        {
          user_id: userId,
          title,
          message: body,
          type: type === "EXPIRY_WARNING" ? "warning" : "info",
          created_at: new Date().toISOString(),
        },
      ]);

      if (dbError) throw dbError;
      console.log(`✅ Notification saved to DB for user ${userId}`);

      // ── 3. Fetch user's FCM token & send push notification ──
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("fcm_token")
        .eq("id", userId)
        .single();

      if (userError) {
        console.warn(`⚠️ Could not fetch user ${userId} for FCM: ${userError.message}`);
      } else if (userData?.fcm_token) {
        const pushData: Record<string, string> = {
          type,
          userId,
          ...(product && { productId: product.id, productName: product.name }),
        };

        await sendPushNotification(userData.fcm_token, title, body, pushData);
      } else {
        console.log(`ℹ️ User ${userId} has no FCM token — skipping push.`);
      }
    } catch (error) {
      console.error(`❌ Failed to process job ${job.msgid}:`, error);
      throw error;
    }
  }
}

export const notificationWorker = new NotificationWorker();
