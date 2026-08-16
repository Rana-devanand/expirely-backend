import { supabaseAdmin } from "../../common/service/supabase.admin";
import { generateProductReportPDF } from "../../common/service/pdf.service";
import { sendEmailWithAttachment } from "../../common/service/email.service";

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
  },

  sendUserReportEmail: async (userId: string) => {
    // 1. Get User
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("username, email")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new Error("User not found");
    }

    // 2. Get User's Products
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("user_id", userId);

    if (productsError) {
      throw new Error(productsError.message);
    }

    // Map rows to standard products
    const productsMapped = (products || []).map((row: any) => {
      return {
        name: row.name,
        category: row.category,
        expiryDate: row.expiry_date,
        qty: row.quantity,
        status: row.status
      };
    });

    // 3. Generate PDF Buffer
    const pdfBuffer = await generateProductReportPDF(user, productsMapped);

    // 4. Send Email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #10b981; margin-top: 0;">Expirely App - Product Inventory Report</h2>
        <p>Dear ${user.username},</p>
        <p>An administrator has generated a comprehensive PDF audit report of your product inventory.</p>
        <p>Please find the generated PDF document attached to this email.</p>
        <br/>
        <p style="color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-bottom: 0;">
          This is an automated system notification from Expirely App.
        </p>
      </div>
    `;

    const delivery = await sendEmailWithAttachment({
      to: user.email,
      subject: `Expirely Inventory Audit Report - ${new Date().toLocaleDateString()}`,
      html: emailHtml,
      attachments: [
        {
          filename: `expirely_report_${user.username.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }
      ]
    });
    
    return { success: true, email: user.email, delivery };
  }
};
