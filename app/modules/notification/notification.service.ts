import { supabase } from "../../config/supabase";
import { groqService } from "../../common/service/groq.service";

export class NotificationService {
  async createNotification(
    userId: string,
    action: string,
    data: any,
    type: "info" | "success" | "warning" | "error" = "info",
  ) {
    try {
      // 1. Generate message using Groq AI
      const aiResponse = await groqService.generateNotificationMessage(
        action,
        data,
      );

      // 2. Save to Supabase
      const { error } = await supabase.from("notifications").insert([
        {
          user_id: userId,
          title: aiResponse.title,
          message: aiResponse.body,
          type,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Failed to create notification:", error);
      // Even if AI fails, we should have a fallback handled by GroqService
    }
  }

  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  async markAsRead(notificationId: string, userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
  }

  async generateExpiryMessages(productName: string, category: string) {
    return await groqService.generateExpiryAlertMessages(productName, category);
  }

  async getAllNotifications() {
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        *,
        users:user_id (username)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    return data.map(row => ({
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      target: row.users?.username || 'System',
      created_at: row.created_at,
      status: row.is_read ? 'Read' : 'Unread'
    }));
  }
}

export const notificationService = new NotificationService();
