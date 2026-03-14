import { supabaseAdmin } from "../../common/service/supabase.admin";

export const reportService = {
  getStats: async () => {
    // 1. User Activity Stats
    const { count: totalUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true });
    
    // Total logins in last 30 days as a proxy for "active"
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: activeUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true }).gte("last_login", thirtyDaysAgo.toISOString());
    
    // 2. Product Expiry Stats
    const now = new Date();
    const { count: totalProducts } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true });
    const { count: expired } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true }).lt("expiry_date", now.toISOString());
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { count: expiringSoon } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true }).gte("expiry_date", now.toISOString()).lte("expiry_date", sevenDaysFromNow.toISOString());

    // 3. Notification Performance
    const { count: totalNotifs } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true });
    const { count: readNotifs } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true }).eq("is_read", true);

    return {
      users: { 
        total: totalUsers || 0, 
        active: activeUsers || 0, 
        inactive: Math.max(0, (totalUsers || 0) - (activeUsers || 0)) 
      },
      products: { 
        total: totalProducts || 0, 
        expired: expired || 0, 
        soon: expiringSoon || 0 
      },
      notifications: { 
        total: totalNotifs || 0, 
        read: readNotifs || 0, 
        pending: Math.max(0, (totalNotifs || 0) - (readNotifs || 0)) 
      }
    };
  },

  generateCSV: async (type: string) => {
    let data: any[] = [];
    let headers: string[] = [];

    if (type === "users") {
      const { data: users, error } = await supabaseAdmin.from("users").select("id, username, email, role, last_login, created_at");
      if (error) {
        console.error("Export Error (users):", error);
        return null;
      }
      data = users || [];
      headers = ["ID", "Username", "Email", "Role", "Last Login", "Created At"];
    } else if (type === "products") {
      // Removed 'brand' as it doesn't exist in the schema
      const { data: products, error } = await supabaseAdmin.from("products").select("id, name, expiry_date, quantity, category, created_at");
      if (error) {
        console.error("Export Error (products):", error);
        return null;
      }
      data = products || [];
      headers = ["ID", "Name", "Expiry Date", "Quantity", "Category", "Created At"];
    } else if (type === "notifications") {
      const { data: notifs, error } = await supabaseAdmin.from("notifications").select("id, title, message, is_read, created_at");
      if (error) {
        console.error("Export Error (notifications):", error);
        return null;
      }
      data = notifs || [];
      headers = ["ID", "Title", "Message", "Read Status", "Created At"];
    }

    if (data.length === 0) return null;

    const csvContent = [
      headers.join(","),
      ...data.map(row => Object.values(row).map(val => `"${val}"`).join(","))
    ].join("\n");

    return csvContent;
  }
};
