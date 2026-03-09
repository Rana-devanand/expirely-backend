import { Router } from "express";
import * as dashboardController from "./dashboard.controller";

const router = Router();

router.get("/stats", dashboardController.getStats);
router.get("/charts", dashboardController.getCharts);

export default router;
