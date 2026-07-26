import cron from "node-cron";
import { supabase } from "../../config/supabase";
import { queueService } from "./queue.service";
import { sendPushNotification } from "./fcm.service";

const formatLocalParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

const addDaysToDateString = (dateString: string, days: number) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
};

export class SchedulerService {
  init(options: { enableQueueJobs?: boolean } = {}) {
    const cronOptions = { timezone: "Asia/Kolkata" };

    if (options.enableQueueJobs) {
      cron.schedule("0 9 * * *", () => {
        console.log("Running 9 AM Morning Scan...");
        this.scanExpiringItems(3);
      }, cronOptions);
      cron.schedule("0 13 * * *", () => {
        console.log("Running 1 PM Afternoon Scan...");
        this.scanExpiringItems(7);
      }, cronOptions);
      cron.schedule("0 20 * * *", () => {
        console.log("Running 8 PM Evening Recap Scan...");
        this.scanNewItemsToday();
      }, cronOptions);
    }

    // 4. Daily reminder scan: every 1 hour, using each user's own timezone + reminder time
    cron.schedule("0 * * * *", () => {
      void this.scanDueDailyReminders();
    });

    console.log(
      `Scheduler Service Initialized (Timezone: Asia/Kolkata, queue jobs: ${
        options.enableQueueJobs ? "enabled" : "disabled"
      }).`,
    );
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
          `Queued ${products.length} notifications for ${days}-day expiry.`,
        );
      }
    } catch (error) {
      console.error(`Morning/Afternoon Scan Error (${days} days):`, error);
    }
  }

  private async scanNewItemsToday() {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: products, error } = await supabase
        .from("products")
        .select("user_id, name")
        .gte("created_at", today);

      if (error) throw error;

      if (products) {
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
          `Queued daily recaps for ${Object.keys(userGroups).length} users.`,
        );
      }
    } catch (error) {
      console.error("Evening Recap Scan Error:", error);
    }
  }

  async scanDueDailyReminders() {
    try {
      const now = new Date();
      const { data: users, error } = await supabase
        .from("users")
        .select(
          "id, fcm_token, daily_reminder_enabled, daily_reminder_time, daily_reminder_timezone, last_daily_reminder_sent_at",
        )
        .eq("daily_reminder_enabled", true)
        .not("daily_reminder_time", "is", null);

      if (error) throw error;
      if (!users?.length) return;

      let sentCount = 0;

      for (const user of users) {
        const requestedTimeZone = user.daily_reminder_timezone || "UTC";
        let timeZone = requestedTimeZone;
        let nowLocal;
        try {
          nowLocal = formatLocalParts(now, timeZone);
        } catch {
          timeZone = "UTC";
          nowLocal = formatLocalParts(now, timeZone);
        }

        if (user.daily_reminder_time !== nowLocal.time) {
          continue;
        }

        if (user.last_daily_reminder_sent_at) {
          const lastSentLocal = formatLocalParts(
            new Date(user.last_daily_reminder_sent_at),
            timeZone,
          );
          if (lastSentLocal.date === nowLocal.date) {
            continue;
          }
        }

        const attentionUntilDate = addDaysToDateString(nowLocal.date, 3);
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id, name, expiry_date")
          .eq("user_id", user.id)
          .eq("is_consumed", false)
          .lte("expiry_date", attentionUntilDate)
          .order("expiry_date", { ascending: true })
          .limit(5);

        if (productsError) {
          console.error(
            `Daily reminder product scan failed for ${user.id}:`,
            productsError,
          );
          continue;
        }

        if (!products?.length) {
          continue;
        }

        const productNames = products.map((product: any) => product.name);
        const previewNames = productNames.slice(0, 2).join(" and ");
        const remainingCount =
          productNames.length - Math.min(productNames.length, 2);
        const title = "Today's reminder";
        const body =
          productNames.length === 1
            ? `1 item needs attention today: ${productNames[0]}.`
            : remainingCount > 0
              ? `${productNames.length} items need attention today: ${previewNames}, plus ${remainingCount} more.`
              : `${productNames.length} items need attention today: ${previewNames}.`;

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert([
            {
              user_id: user.id,
              title,
              message: body,
              type: "info",
              created_at: new Date().toISOString(),
            },
          ]);

        if (notificationError) {
          console.error(
            `Failed to save daily reminder for ${user.id}:`,
            notificationError,
          );
          continue;
        }

        if (user.fcm_token) {
          await sendPushNotification(user.fcm_token, title, body, {
            type: "DAILY_REMINDER",
            screen: "home",
            focus: "today-actions",
          });
        }

        await supabase
          .from("users")
          .update({
            last_daily_reminder_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        sentCount += 1;
      }

      if (sentCount > 0) {
        console.log(`Sent daily reminders to ${sentCount} users.`);
      }
    } catch (error) {
      console.error("Daily reminder scan failed:", error);
    }
  }

  async triggerManualScan(
    type: "morning" | "afternoon" | "evening" | "daily-reminders",
  ) {
    if (type === "morning") await this.scanExpiringItems(3);
    else if (type === "afternoon") await this.scanExpiringItems(7);
    else if (type === "evening") await this.scanNewItemsToday();
    else if (type === "daily-reminders") await this.scanDueDailyReminders();
  }
}

export const schedulerService = new SchedulerService();
