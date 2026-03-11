import express from "express";
import path from "path";
import userRoutes from "./modules/user/user.routes";
import categoryRoutes from "./modules/category/category.routes";
import productRoutes from "./modules/product/product.routes";
import uploadRoutes from "./modules/upload/upload.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import aiRoutes from "./modules/ai/ai.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import testerRoutes from "./modules/tester/tester.routes";
import reportRoutes from "./modules/report/report.routes";

// routes
const router = express.Router();

router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/upload", uploadRoutes);
router.use("/ai", aiRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/tester", testerRoutes);
router.use("/reports", reportRoutes);

export default router;
