import { Router } from "express";
import * as usageController from "./usage.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.use(roleAuth(["ADMIN", "USER"]));

router.get("/usage-summary", usageController.getUsageSummary);

export default router;
