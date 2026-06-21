import { Request, Response } from "express";
import { userService } from "./user.services";
import { notificationService } from "../notification/notification.service";
import { loggerService } from "../../common/service/logger.service";
import { sendPushNotification } from "../../common/service/fcm.service";
import { supabase } from "../../config/supabase";

async function notifyAdminsOfUserEvent(eventTitle: string, eventMessage: string, details: any) {
  try {
    const { data: admins } = await supabase
      .from("users")
      .select("id, fcm_token")
      .eq("role", "ADMIN");

    if (admins && admins.length > 0) {
      console.log(`📣 [AdminNotifier] Sending push to ${admins.length} admins...`);
      for (const admin of admins) {
        if (admin.fcm_token) {
          await sendPushNotification(
            admin.fcm_token,
            eventTitle,
            eventMessage,
            {
              type: "ADMIN_ALERT",
              action: details.action,
              details: JSON.stringify(details),
            }
          );
        }
      }
    }
  } catch (err: any) {
    console.error("❌ [AdminNotifier] Exception in notifyAdminsOfUserEvent:", err.message);
  }
}


export class UserController {
  async signUp(req: Request, res: Response) {
    try {
      const result = await userService.signUp(req.body);
      
      const user = result.user;
      if (user && user.id) {
        await loggerService.log("USER_SIGNUP", { email: user.email, username: user.username }, user.id);
        
        await notifyAdminsOfUserEvent(
          "New User Registered! 🎉",
          `${user.username || user.email} just created an account.`,
          { userId: user.id, email: user.email, username: user.username, action: "SIGNUP" }
        );
      }

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Something went wrong during signup",
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await userService.login(req.body);
      
      const user = result.user;
      if (user && user.id) {
        await loggerService.log("USER_LOGIN_LOCAL", { email: user.email, username: user.username }, user.id);
        
        await notifyAdminsOfUserEvent(
          "User Logged In! 🔑",
          `${user.username || user.email} logged in via local credentials.`,
          { userId: user.id, email: user.email, username: user.username, action: "LOGIN_LOCAL" }
        );
      }

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || "Invalid credentials",
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const profile = await userService.getProfile(userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "Profile not found",
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new Error("Refresh token is required");
      }
      const result = await userService.refreshToken(refreshToken);
      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || "Invalid refresh token",
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const result = await userService.logout(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Logout failed",
      });
    }
  }

  async me(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new Error("Refresh token is required");
      }
      const result = await userService.me(refreshToken);
      res.status(200).json({
        success: true,
        message: "Session restored",
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || "Session expired",
      });
    }
  }

  async socialLogin(req: Request, res: Response) {
    try {
      const result = await userService.socialLogin(req.body);
      
      const user = result.user;
      if (user && user.id) {
        const provider = req.body.provider || "google";
        await loggerService.log("USER_LOGIN_SOCIAL", { email: user.email, username: user.username, provider }, user.id);
        
        await notifyAdminsOfUserEvent(
          "User Social Login! 🌐",
          `${user.username || user.email} logged in via ${provider.toUpperCase()}.`,
          { userId: user.id, email: user.email, username: user.username, provider, action: "LOGIN_SOCIAL" }
        );
      }

      res.status(200).json({
        success: true,
        message: `Logged in with ${req.body.provider || "social provider"}`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Social login failed",
      });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const result = await userService.updateProfile(userId, req.body);

      // Trigger notification
      await notificationService.createNotification(
        userId,
        "UPDATE_PROFILE",
        { username: result.username },
        "success",
      );

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update profile",
      });
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const result = await userService.changePassword(userId, req.body);

      // Trigger notification
      await notificationService.createNotification(
        userId,
        "CHANGE_PASSWORD",
        {},
        "success",
      );

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to change password",
      });
    }
  }

  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await userService.getAllUsers();
      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch users",
      });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!id || !status) {
        throw new Error("User ID and status are required");
      }
      const result = await userService.updateUserStatus(id as string, status);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update user status",
      });
    }
  }
  async deleteAccount(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) throw new Error("User not authenticated");

      const result = await userService.deleteAccount(userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete account",
      });
    }
  }

  async updateFcmToken(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) throw new Error("User not authenticated");

      const { fcmToken } = req.body;
      if (!fcmToken) throw new Error("fcmToken is required");

      await userService.saveFcmToken(userId, fcmToken);

      res.status(200).json({
        success: true,
        message: "FCM token updated successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update FCM token",
      });
    }
  }

  async getReminderSettings(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) throw new Error("User not authenticated");

      const settings = await userService.getReminderSettings(userId);

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to load reminder settings",
      });
    }
  }

  async updateReminderSettings(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) throw new Error("User not authenticated");

      const settings = await userService.updateReminderSettings(userId, req.body);

      res.status(200).json({
        success: true,
        message: "Reminder settings updated successfully",
        data: settings,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update reminder settings",
      });
    }
  }

  async getSystemLogs(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || user.role !== "ADMIN") {
        throw new Error("Unauthorized access. Admin role required.");
      }

      const { data: logs, error } = await supabase
        .from("system_logs")
        .select("*, users:user_id(username, email)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to fetch system logs",
      });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) throw new Error("Email is required");
      const result = await userService.forgotPassword(email);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to trigger password reset",
      });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        throw new Error("Email, code, and newPassword are required");
      }
      const result = await userService.resetPassword(email, code, newPassword);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to reset password",
      });
    }
  }

  async sendFeedback(req: Request, res: Response) {
    try {
      const userId = (req.user as any).id as string;
      const userEmail = (req.user as any).email as string;
      const { username, features, rating, message } = req.body;
      if (!features || !Array.isArray(features) || features.length === 0) {
        throw new Error("Please select at least one feature");
      }
      if (!rating || rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
      const result = await userService.sendFeedback({
        userId,
        username: username || "User",
        email: userEmail,
        features,
        rating: Number(rating),
        message: message || "",
      });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to send feedback",
      });
    }
  }
}

export const userController = new UserController();
