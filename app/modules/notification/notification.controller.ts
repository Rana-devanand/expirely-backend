import { Request, Response } from "express";
import { notificationService } from "./notification.service";

export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) throw new Error("User not authenticated");

      const notifications = await notificationService.getNotifications(userId);
      res.status(200).json({
        success: true,
        data: notifications,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to fetch notifications",
      });
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      const { id } = req.params;
      if (!userId) throw new Error("User not authenticated");

      await notificationService.markAsRead(id as string, userId);
      res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to mark as read",
      });
    }
  }

  async markAllAsRead(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) throw new Error("User not authenticated");

      await notificationService.markAllAsRead(userId);
      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to mark all as read",
      });
    }
  }

  async generateExpiryMessages(req: Request, res: Response) {
    try {
      const { productName, category } = req.body;
      if (!productName) throw new Error("Product name is required");

      const messages = await notificationService.generateExpiryMessages(
        productName,
        category || "Other",
      );
      res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to generate AI messages",
      });
    }
  }

  async triggerScan(req: Request, res: Response) {
    try {
      const { type } = req.body; // 'morning', 'afternoon', or 'evening'
      const {
        schedulerService,
      } = require("../../common/service/scheduler.service");

      await schedulerService.triggerManualScan(type);

      res.status(200).json({
        success: true,
        message: `Manual ${type} scan triggered successfully.`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to trigger scan",
      });
    }
  }

  async getAllNotifications(req: Request, res: Response) {
    try {
      const notifications = await notificationService.getAllNotifications();
      res.status(200).json({
        success: true,
        data: notifications,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to fetch all notifications",
      });
    }
  }

  async adminSendNotification(req: Request, res: Response) {
    try {
      const { target, message, type } = req.body;
      
      if (target === 'All Users') {
        const { data: users } = await require("../../common/service/supabase.admin").supabaseAdmin.from("users").select("id");
        if (users) {
          for (const user of users) {
             const { error } = await require("../../config/supabase").supabase.from("notifications").insert([{
               user_id: user.id,
               title: "Admin Broadcast",
               message,
               type: type || 'info'
             }]);
             if (error) console.error("Broadcast failed for user:", user.id, error);
          }
        }
      } else {
        const { data: userData } = await require("../../common/service/supabase.admin").supabaseAdmin.from("users").select("id").eq("username", target).single();
        if (userData) {
           await require("../../config/supabase").supabase.from("notifications").insert([{
             user_id: userData.id,
             title: "Admin Message",
             message,
             type: type || 'info'
           }]);
        }
      }

      res.status(200).json({
        success: true,
        message: "Notification sent successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to send notification",
      });
    }
  }

  async broadcastPushNotification(req: Request, res: Response) {
    try {
      const { title, body, data, recipients } = req.body;
      if (!title || !body) {
        throw new Error("Title and body are required");
      }

      const { supabaseAdmin } = require("../../common/service/supabase.admin");
      const { sendPushNotification } = require("../../common/service/fcm.service");
      const { loggerService } = require("../../common/service/logger.service");

      // 1. Fetch users who have FCM tokens, optionally filtering by selected emails
      let query = supabaseAdmin
        .from("users")
        .select("id, username, email, fcm_token")
        .not("fcm_token", "is", null);

      if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        query = query.in("email", recipients);
      }

      const { data: users, error: dbError } = await query;

      if (dbError) throw dbError;

      const validUsers = (users || []).filter((u: any) => u.fcm_token && u.fcm_token.trim() !== "");

      if (validUsers.length === 0) {
        return res.status(200).json({
          success: true,
          sentCount: 0,
          failCount: 0,
          totalCount: 0,
          message: "No target users have registered FCM tokens.",
        });
      }

      let successCount = 0;
      let failCount = 0;

      // 2. Loop and send push notification to each user
      for (const user of validUsers) {
        const success = await sendPushNotification(user.fcm_token, title, body, data);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // 3. Log the administrative broadcast in system_logs
      const targetLabel = recipients && Array.isArray(recipients) && recipients.length > 0
        ? `${validUsers.length} Selected Users`
        : "All Users";

      await loggerService.log(
        "ADMIN_PUSH_BROADCAST",
        {
          title,
          body,
          target: targetLabel,
          sentCount: successCount,
          failCount: failCount,
          totalCount: validUsers.length,
        },
        (req.user as any)?.id || null
      );

      res.status(200).json({
        success: true,
        sentCount: successCount,
        failCount: failCount,
        totalCount: validUsers.length,
        message: `Push broadcast complete: ${successCount} successfully sent, ${failCount} failed.`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to broadcast push notification",
      });
    }
  }

  async getBroadcastPushLogs(req: Request, res: Response) {
    try {
      const { supabaseAdmin } = require("../../common/service/supabase.admin");
      const { data: logs, error } = await supabaseAdmin
        .from("system_logs")
        .select("id, details, created_at, user_id")
        .eq("action", "ADMIN_PUSH_BROADCAST")
        .order("created_at", { ascending: false });

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: logs || [],
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to fetch push broadcast logs",
      });
    }
  }

  async generatePushNotification(req: Request, res: Response) {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        throw new Error("Prompt is required");
      }

      const { groqService } = require("../../common/service/groq.service");
      const result = await groqService.generatePushNotification(prompt);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to generate push notification suggestions",
      });
    }
  }
}

export const notificationController = new NotificationController();
