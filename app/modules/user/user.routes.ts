import { Router } from "express";
import { userController } from "./user.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.post("/signup", userController.signUp);
router.post("/login", userController.login);
router.post("/refresh", userController.refresh);
router.post("/me", userController.me);
router.post("/social-login", userController.socialLogin);
router.get("/", roleAuth(["ADMIN"]), userController.getAllUsers);
router.put("/:id/status", roleAuth(["ADMIN"]), userController.updateStatus);
router.post("/logout", roleAuth(["ADMIN", "USER"]), userController.logout);
router.get("/profile", roleAuth(["ADMIN", "USER"]), userController.getProfile);
router.put(
  "/profile",
  roleAuth(["ADMIN", "USER"]),
  userController.updateProfile,
);
router.put(
  "/change-password",
  roleAuth(["ADMIN", "USER"]),
  userController.changePassword,
);
router.post(
  "/fcm-token",
  roleAuth(["ADMIN", "USER"]),
  userController.updateFcmToken,
);

export default router;
