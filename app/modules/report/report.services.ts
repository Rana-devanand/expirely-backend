import { supabaseAdmin } from "../../common/service/supabase.admin";

export const reportService = {
  getStats: async () => {
    // 1. User Activity Stats
    const { count: totalUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true });
    const { count: activeUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true }).not("last_login", "is", null);
    
    // 2. Product Expiry Stats
    const now = new Date();
    const { count: expired } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true }).lt("expiry_date", now.toISOString());
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { count: expiringSoon } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true }).gte("expiry_date", now.toISOString()).lte("expiry_date", sevenDaysFromNow.toISOString());

    // 3. Notification Performance
    const { count: totalNotifs } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true });
    const { count: readNotifs } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true }).eq("is_read", true);

    return {
      users: { total: totalUsers || 0, active: activeUsers || 0, inactive: (totalUsers || 0) - (activeUsers || 0) },
      products: { total: expired || 0 + (expiringSoon || 0), expired: expired || 0, expiringSoon: expiringSoon || 0 },
      notifications: { total: totalNotifs || 0, read: readNotifs || 0, pending: (totalNotifs || 0) - (readNotifs || 0) }
    };
  }
};
