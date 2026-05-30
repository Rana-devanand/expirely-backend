import { Router } from "express";
import * as aiController from "./ai.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

// Require authenticated user for all AI routes to populate req.user
router.use(roleAuth(["ADMIN", "USER"]));

router.get("/storage-tips", aiController.getStorageTips);
router.get("/health-insight", aiController.getHealthInsight);
router.post("/scan-receipt", aiController.scanReceipt);
router.get("/meal-plan", aiController.getMealPlan);
router.post("/generate-recipe", aiController.getRecipe);

export default router;
