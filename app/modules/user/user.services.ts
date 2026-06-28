import { supabase } from "../../config/supabase";
import { supabaseAdmin } from "../../common/service/supabase.admin";
import bcrypt from "bcryptjs";
import { createUserTokens } from "../../common/service/passport-jwt.service";
import { sendEmail, sendRawEmail } from "../../common/service/email.service";

const JWT_SECRET = process.env.JWT_SECRET || "your_fallback_secret";
const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UserService {
  async signUp(userData: any) {
    const { email, password, username } = userData;

    // 1. Check if user already exists in Supabase
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (existingUser) {
      throw new Error("User already exists");
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert into Supabase 'users' table
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email,
          username,
          password: hashedPassword,
          auth_provider: "local",
          role: "USER",
          status: "active",
          daily_reminder_enabled: false,
          daily_reminder_timezone: "UTC",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // 4. Generate Tokens using helper
    const authResult = createUserTokens(data);

    // Update with tokens (snake_case in DB)
    await supabase
      .from("users")
      .update({
        access_token: authResult.accessToken,
        refresh_token: authResult.refreshToken,
      })
      .eq("id", data.id);

    return authResult;
  }

  async login(credentials: any) {
    const { email, password } = credentials;

    // 1. Find user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      throw new Error("Invalid email or password");
    }

    // 2. Check if user is blocked
    if (user.status === "blocked") {
      throw new Error("Your account has been blocked. Please contact support.");
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // 4. Update last login and generate tokens
    const authResult = createUserTokens(user);

    await supabase
      .from("users")
      .update({
        last_login: new Date().toISOString(),
        access_token: authResult.accessToken,
        refresh_token: authResult.refreshToken,
      })
      .eq("id", user.id);

    return authResult;
  }

  async refreshToken(token: string) {
    // ... existing logic ...
    try {
      const { verifyToken, createUserTokens } =
        await import("../../common/service/passport-jwt.service");
      const decoded: any = verifyToken(token);

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", decoded.id)
        .eq("refresh_token", token)
        .single();

      if (error || !user) {
        throw new Error("Invalid refresh token or user not found");
      }

      const authResult = createUserTokens(user);

      await supabase
        .from("users")
        .update({
          access_token: authResult.accessToken,
          refresh_token: authResult.refreshToken,
        })
        .eq("id", user.id);

      return {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Invalid or expired refresh token",
      );
    }
  }

  async me(refreshToken: string) {
    // ... existing me logic ...
    try {
      const { verifyToken, createUserTokens } =
        await import("../../common/service/passport-jwt.service");
      const decoded: any = verifyToken(refreshToken);

      let { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", decoded.id)
        .eq("refresh_token", refreshToken)
        .single();

      if (error || !user) {
        throw new Error("Invalid session");
      }

      const authResult = createUserTokens(user);

      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          access_token: authResult.accessToken,
          refresh_token: authResult.refreshToken,
          last_login: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = updatedUser;

      const { password, access_token, refresh_token, ...userProfile } = user;

      return {
        user: userProfile,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
      };
    } catch (error) {
      throw new Error("Session expired or invalid");
    }
  }

  async socialLogin(payload: {
    provider: string;
    idToken: string;
    accessToken?: string;
  }) {
    const { provider, idToken } = payload;

    if (provider !== "google") {
      throw new Error("Unsupported provider");
    }

    try {
      const { OAuth2Client } = await import("google-auth-library");
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      console.log("GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID);
      console.log(
        "GOOGLE_ANDROID_CLIENT_ID",
        process.env.GOOGLE_ANDROID_CLIENT_ID,
      );

      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID;
      const GOOGLE_EXPO_CLIENT_ID =
        "891189343114-pc5039oehvbpg3hat2pg8ucc5sa94kff.apps.googleusercontent.com";

      console.log(
        "🔍 [SocialLogin] Verifying Token with audiences:",
        [
          GOOGLE_CLIENT_ID,
          GOOGLE_ANDROID_CLIENT_ID,
          GOOGLE_EXPO_CLIENT_ID,
        ].filter(Boolean),
      );

      const ticket = await client.verifyIdToken({
        idToken,
        audience: [
          GOOGLE_CLIENT_ID,
          GOOGLE_ANDROID_CLIENT_ID,
          GOOGLE_EXPO_CLIENT_ID,
        ].filter(Boolean) as string[],
      });
      console.log("✅ [SocialLogin] Token verified successfully");

      const payload = ticket.getPayload();
      console.log(
        "👤 [SocialLogin] Ticket Payload:",
        payload ? "Received" : "MISSING",
      );

      if (!payload || !payload.email) {
        throw new Error("Invalid Google token: Missing payload or email");
      }

      const { email, name, picture, sub: googleId } = payload;
      console.log(`🙋 [SocialLogin] User Attempt: ${email}`);

      // 1. Check if user exists
      let { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();
      console.log(
        "📂 [SocialLogin] Database lookup complete",
        error ? `Error: ${error.code}` : "User found",
      );

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!user) {
        // 2. Create new user if doesn't exist
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert([
            {
              email,
              username: name,
              avatar_url: picture,
              auth_provider: "google",
              google_id: googleId,
              role: "USER",
              status: "active",
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        user = newUser;
      } else {
        // 3. Update existing user's info if needed
        const { data: updatedUser, error: updateError } = await supabase
          .from("users")
          .update({
            username: name || user.username,
            avatar_url: picture || user.avatar_url,
            google_id: googleId || user.google_id,
            last_login: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        user = updatedUser;
      }

      const { createUserTokens } =
        await import("../../common/service/passport-jwt.service");
      const authResult = createUserTokens(user);

      await supabase
        .from("users")
        .update({
          access_token: authResult.accessToken,
          refresh_token: authResult.refreshToken,
        })
        .eq("id", user.id);

      const { password, access_token, refresh_token, ...userProfile } = user;

      return {
        user: userProfile,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
      };
    } catch (error: any) {
      console.error("Google login error:", error);
      throw new Error(error.message || "Google sign-in failed");
    }
  }

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, email, username, status, auth_provider, avatar_url, created_at, updated_at, role, daily_reminder_enabled, daily_reminder_time, daily_reminder_timezone, last_daily_reminder_sent_at",
      )
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data;
  }

  async logout(userId: string) {
    const { error } = await supabase
      .from("users")
      .update({
        access_token: null,
        refresh_token: null,
      })
      .eq("id", userId);

    if (error) throw error;
    return { success: true, message: "Logged out successfully" };
  }

  async updateProfile(userId: string, updateData: any) {
    const { username, email, avatar_url } = updateData;

    const { data, error } = await supabase
      .from("users")
      .update({
        username,
        email,
        avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select(
        "id, email, username, status, auth_provider, avatar_url, created_at, updated_at, role, daily_reminder_enabled, daily_reminder_time, daily_reminder_timezone, last_daily_reminder_sent_at",
      )
      .single();

    if (error) throw error;
    return data;
  }

  async changePassword(userId: string, passwordData: any) {
    const { currentPassword, newPassword } = passwordData;

    // 1. Get user with password
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("password")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      throw new Error("User not found");
    }

    // 2. Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // 3. Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 4. Update password
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password: hashedNewPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw updateError;
    return { success: true, message: "Password changed successfully" };
  }

  async getAllUsers() {
    const { data: users, error } = await supabase
      .from("users")
      .select(`
        id, 
        email, 
        username, 
        status, 
        created_at, 
        role,
        products:products(count)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return users.map((u: any) => ({
      id: u.id,
      name: u.username || 'N/A',
      email: u.email,
      joinDate: new Date(u.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      products: u.products?.[0]?.count || 0,
      status: u.status === 'active' ? 'Active' : 'Blocked'
    }));
  }

  async updateUserStatus(userId: string, status: "active" | "blocked") {
    const { error } = await supabase
      .from("users")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) throw error;
    return { success: true, message: `User status updated to ${status}` };
  }

  async deleteAccount(userId: string) {
    // 1. Delete user's products
    await supabase.from("products").delete().eq("user_id", userId);

    // 2. Delete user's notifications
    await supabase.from("notifications").delete().eq("user_id", userId);

    // 3. Delete user account
    const { error } = await supabase.from("users").delete().eq("id", userId);

    if (error) throw error;
    return { success: true, message: "Account deleted successfully" };
  }

  async saveFcmToken(userId: string, fcmToken: string) {
    const { error } = await supabase
      .from("users")
      .update({ fcm_token: fcmToken, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;
    return { success: true };
  }

  async getReminderSettings(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select(
        "daily_reminder_enabled, daily_reminder_time, daily_reminder_timezone, last_daily_reminder_sent_at",
      )
      .eq("id", userId)
      .single();

    if (error) throw error;

    return {
      dailyReminderEnabled: Boolean(data?.daily_reminder_enabled),
      dailyReminderTime: data?.daily_reminder_time || "20:00",
      timezone: data?.daily_reminder_timezone || "UTC",
      lastDailyReminderSentAt: data?.last_daily_reminder_sent_at || null,
    };
  }

  async updateReminderSettings(
    userId: string,
    settings: {
      dailyReminderEnabled?: boolean;
      dailyReminderTime?: string;
      timezone?: string;
    },
  ) {
    const {
      dailyReminderEnabled = false,
      dailyReminderTime = "20:00",
      timezone = "UTC",
    } = settings;

    if (typeof dailyReminderEnabled !== "boolean") {
      throw new Error("dailyReminderEnabled must be a boolean");
    }

    if (!REMINDER_TIME_PATTERN.test(dailyReminderTime)) {
      throw new Error("dailyReminderTime must use HH:mm format");
    }

    const safeTimezone =
      typeof timezone === "string" && timezone.trim().length > 0
        ? timezone.trim()
        : "UTC";

    const { data, error } = await supabase
      .from("users")
      .update({
        daily_reminder_enabled: dailyReminderEnabled,
        daily_reminder_time: dailyReminderTime,
        daily_reminder_timezone: safeTimezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select(
        "id, email, username, status, auth_provider, avatar_url, created_at, updated_at, role, daily_reminder_enabled, daily_reminder_time, daily_reminder_timezone, last_daily_reminder_sent_at",
      )
      .single();

    if (error) throw error;

    return data;
  }

  async forgotPassword(email: string) {
    // 1. Fetch user by email
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("id, username, email, auth_provider")
      .eq("email", email)
      .single();

    if (fetchError || !user) {
      throw new Error("User with this email does not exist");
    }

    if (user.auth_provider !== "local") {
      throw new Error(`This account uses ${user.auth_provider} social login. Please sign in using that instead.`);
    }

    // 2. Generate 6-digit verification code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins validity

    // 3. Save code in database
    const { error: updateError } = await supabase
      .from("users")
      .update({
        reset_code: resetCode,
        reset_expiry: resetExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // 4. Send email
    try {
      await sendEmail({
        to: user.email,
        subject: "Reset Your Expirely Password 🔒",
        template: "forgot-password",
        data: {
          username: user.username || "User",
          code: resetCode,
        },
      });
      console.log(`✉️ [ForgotPassword] Reset code sent successfully to ${email}`);
    } catch (emailErr: any) {
      console.error("❌ [ForgotPassword] Failed to send email:", emailErr.message);
      throw new Error("Failed to send reset code email. Please try again.");
    }

    return { success: true, message: "Reset verification code sent successfully!" };
  }

  async resetPassword(email: string, code: string, newPassword: any) {
    // 1. Get user with matching email and valid reset code
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("id, reset_code, reset_expiry")
      .eq("email", email)
      .single();

    if (fetchError || !user) {
      throw new Error("User not found");
    }

    if (!user.reset_code || user.reset_code !== code) {
      throw new Error("Invalid verification code");
    }

    const expiryTime = new Date(user.reset_expiry).getTime();
    if (Date.now() > expiryTime) {
      throw new Error("Verification code has expired");
    }

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Update password and clear reset fields
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        reset_code: null,
        reset_expiry: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);


    if (updateError) throw updateError;

    return { success: true, message: "Password reset successfully! You can now login with your new password." };
  }

  async sendFeedback(payload: {
    userId: string;
    username: string;
    email: string;
    features: string[];
    rating: number;
    message: string;
  }) {
    const { username, email, features, rating, message } = payload;
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const featureList = features.map((f) => `<li>${f}</li>`).join("");
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 28px 32px;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">📝 New User Feedback — Expirely</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">Someone shared their experience with the app</p>
        </div>
        <div style="padding: 28px 32px; background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px;">User</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Email</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Rating</td>
              <td style="padding: 8px 0; color: #f59e0b; font-size: 18px; letter-spacing: 2px;">${stars} (${rating}/5)</td>
            </tr>
          </table>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="color: #374151; font-weight: 600; margin: 0 0 8px; font-size: 13px;">Features Reviewed</p>
            <ul style="margin: 0; padding-left: 18px; color: #4b5563; font-size: 14px; line-height: 1.8;">
              ${featureList}
            </ul>
          </div>
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px 18px;">
            <p style="color: #374151; font-weight: 600; margin: 0 0 6px; font-size: 13px;">Message</p>
            <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.7;">${message || "<em>No message provided</em>"}</p>
          </div>
        </div>
        <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">Received from the <strong>Expirely</strong> mobile app • ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
        </div>
      </div>
    `;

    await sendRawEmail({
      to: process.env.ADMIN_EMAIL || process.env.EMAILS || "dev.cloudapp93@gmail.com",
      subject: `[Expirely Feedback] ${rating}⭐ from ${username}`,
      html,
    });

    console.log(`📬 [Feedback] Email sent from ${email} (${username}), rating: ${rating}/5`);
    return { success: true, message: "Thank you for your feedback!" };
  }

  async broadcastEmail(payload: { subject: string; content: string; recipients: string[] }) {
    const { subject, content, recipients } = payload;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration keys missing in Backend environment.");
    }

    const functionUrl = `${supabaseUrl}/functions/v1/broadcast-emails`;
    console.log(`🚀 Delegating email broadcast to Supabase Edge Function: ${functionUrl}`);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        subject,
        content,
        recipients,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Supabase Edge Function call failed: ${response.status} - ${errorText}`);
      throw new Error(`Edge Function execution failed: ${errorText}`);
    }

    const result = await response.json();
    return result;
  }

  async unsubscribeUser(email: string) {
    const { data, error } = await supabase
      .from("users")
      .update({ opt_out: true })
      .eq("email", email)
      .select();

    if (error) throw error;
    return { success: true, message: "Unsubscribed successfully." };
  }

  async saveLocation(userId: string, country: string, locality: string) {
    const { data, error } = await supabaseAdmin
      .from("user_locations")
      .upsert({
        user_id: userId,
        country,
        locality,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getLocation(userId: string) {
    const { data, error } = await supabaseAdmin
      .from("user_locations")
      .select("country, locality")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

export const userService = new UserService();
