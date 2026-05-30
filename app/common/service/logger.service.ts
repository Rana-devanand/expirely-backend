import { supabase } from "../../config/supabase";

export class LoggerService {
  /**
   * Log system activities into the system_logs table
   */
  async log(action: string, details: any, userId?: string) {
    try {
      console.log(`📝 [LoggerService] Logging action: "${action}" for user ${userId || "System"}`);
      const { error } = await supabase.from("system_logs").insert([
        {
          user_id: userId || null,
          action,
          details,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) {
        console.error("❌ [LoggerService] Failed to insert log:", error.message);
      }
    } catch (err: any) {
      console.error("❌ [LoggerService] Exception in log insert:", err.message);
    }
  }
}

export const loggerService = new LoggerService();
