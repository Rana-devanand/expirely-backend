import { Router } from "express";
import * as aiController from "./ai.controller";

const router = Router();

router.get("/storage-tips", aiController.getStorageTips);
router.get("/health-insight", aiController.getHealthInsight);
router.post("/scan-receipt", aiController.scanReceipt);
router.get("/meal-plan", aiController.getMealPlan);
router.post("/generate-recipe", aiController.getRecipe);

export default router;
