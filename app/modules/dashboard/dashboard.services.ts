import { supabaseAdmin } from "../../common/service/supabase.admin";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dashboardService = {
  getStats: async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Helper for percentage change
    const getChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
    };

    // --- USERS ---
    const { count: totalUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true });
    
    const { count: newUsersThisMonth } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());
    const { count: newUsersLastMonth } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true })
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString());
    
    const userChange = getChange(newUsersThisMonth || 0, newUsersLastMonth || 0);

    // --- ACTIVE USERS ---
    const { count: activeUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true })
      .gte("last_login", thirtyDaysAgo.toISOString());
    const { count: activeUsersPrev } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true })
      .gte("last_login", sixtyDaysAgo.toISOString())
      .lt("last_login", thirtyDaysAgo.toISOString());
    
    const activeChange = getChange(activeUsers || 0, activeUsersPrev || 0);

    // --- PRODUCTS ---
    const { count: totalProducts } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true });
    
    const { count: productsThisMonth } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());
    const { count: productsLastMonth } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true })
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString());
    
    const productChange = getChange(productsThisMonth || 0, productsLastMonth || 0);

    // --- EXPIRING ---
    const { count: expiringSoon } = await supabaseAdmin.from("products").select("*", { count: "exact", head: true })
      .gte("expiry_date", now.toISOString())
      .lte("expiry_date", sevenDaysFromNow.toISOString());
    
    // --- NOTIFICATIONS ---
    const { count: notificationsSent } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true });
    
    const { count: notifsThisMonth } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());
    const { count: notifsLastMonth } = await supabaseAdmin.from("notifications").select("*", { count: "exact", head: true })
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString());
    
    const notificationChange = getChange(notifsThisMonth || 0, notifsLastMonth || 0);

    return {
      totalUsers: totalUsers || 0,
      userChange,
      activeUsers: activeUsers || 0,
      activeChange,
      totalProducts: totalProducts || 0,
      productChange,
      expiringSoon: expiringSoon || 0,
      notificationsSent: notificationsSent || 0,
      notificationChange
    };
  },

  getCharts: async () => {
    // Category Breakdown (Real Data)
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("category_id, categories(name, color)");

    const categoryMap: { [key: string]: { name: string, value: number, color: string } } = {};
    products?.forEach((p: any) => {
      const name = p.categories?.name || 'Uncategorized';
      const color = p.categories?.color || '#94a3b8';
      if (!categoryMap[name]) {
        categoryMap[name] = { name, value: 0, color };
      }
      categoryMap[name].value++;
    });

    const categoryData = Object.values(categoryMap);

    // Dynamic Growth Data (Last 8 Months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const userGrowth = [];
    const productTrends = [];

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthName = months[d.getMonth()];

      // Cumulative user count up to end of this month
      const { count: uCount } = await supabaseAdmin
        .from("users")
        .select("*", { count: "exact", head: true })
        .lt("created_at", nextD.toISOString());

      // Products added specifically in this month
      const { count: pCount } = await supabaseAdmin
        .from("products")
        .select("*", { count: "exact", head: true })
        .gte("created_at", d.toISOString())
        .lt("created_at", nextD.toISOString());

      userGrowth.push({ name: monthName, users: uCount || 0 });
      productTrends.push({ name: monthName, added: pCount || 0 });
    }

    // Real Notification Activity (Last 7 Days)
    const notificationActivity = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);
      const dayName = days[d.getDay()];

      const { count: sent } = await supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .gte("created_at", d.toISOString().split('T')[0])
        .lt("created_at", nextD.toISOString().split('T')[0]);

      const { count: read } = await supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", true)
        .gte("created_at", d.toISOString().split('T')[0])
        .lt("created_at", nextD.toISOString().split('T')[0]);

      notificationActivity.push({ name: dayName, sent: sent || 0, read: read || 0 });
    }

    return {
      categoryData,
      userGrowth,
      productTrends,
      notificationActivity
    };
  }
};
