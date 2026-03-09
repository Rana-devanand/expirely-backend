import { Router } from "express";
import { notificationController } from "./notification.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.get(
  "/",
  roleAuth(["ADMIN", "USER"]),
  notificationController.getNotifications,
);
router.put(
  "/all-read",
  roleAuth(["ADMIN", "USER"]),
  notificationController.markAllAsRead,
);
router.put(
  "/:id/read",
  roleAuth(["ADMIN", "USER"]),
  notificationController.markAsRead,
);
router.post(
  "/generate-expiry-messages",
  roleAuth(["ADMIN", "USER"]),
  notificationController.generateExpiryMessages,
);
router.post(
  "/trigger-scan",
  roleAuth(["ADMIN"]),
  notificationController.triggerScan,
);

router.get(
  "/admin",
  roleAuth(["ADMIN"]),
  notificationController.getAllNotifications,
);
router.post(
  "/admin/send",
  roleAuth(["ADMIN"]),
  notificationController.adminSendNotification,
);

export default router;
