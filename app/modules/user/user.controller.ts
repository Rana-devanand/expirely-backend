import { Request, Response } from "express";
import { userService } from "./user.services";
import { notificationService } from "../notification/notification.service";

export class UserController {
  async signUp(req: Request, res: Response) {
    try {
      const result = await userService.signUp(req.body);
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
}

export const userController = new UserController();
