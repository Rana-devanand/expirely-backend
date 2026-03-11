import { supabase } from "../../config/supabase";
import bcrypt from "bcryptjs";
import { createUserTokens } from "../../common/service/passport-jwt.service";

const JWT_SECRET = process.env.JWT_SECRET || "your_fallback_secret";

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
        "id, email, username, status, auth_provider, avatar_url, created_at, updated_at, role",
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
        "id, email, username, status, auth_provider, avatar_url, created_at, updated_at, role",
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

  async saveFcmToken(userId: string, fcmToken: string) {
    const { error } = await supabase
      .from("users")
      .update({ fcm_token: fcmToken, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;
    return { success: true };
  }
}

export const userService = new UserService();
