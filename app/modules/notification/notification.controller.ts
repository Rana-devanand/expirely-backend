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
}

export const notificationController = new NotificationController();
