import { queueService } from "../../common/service/queue.service";
import { groqService } from "../../common/service/groq.service";
import { supabase } from "../../config/supabase";

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
          // No messages, wait a bit
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

      // Save to notification table (this is the "delivery")
      const { error } = await supabase.from("notifications").insert([
        {
          user_id: userId,
          title,
          message: body,
          type: type === "EXPIRY_WARNING" ? "warning" : "info",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      console.log(`✅ Notification delivered to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to process job ${job.msgid}:`, error);
      throw error; // Let the worker catch it to retry or stay in queue
    }
  }
}

export const notificationWorker = new NotificationWorker();
