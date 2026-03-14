import { Router } from "express";
import * as reportController from "./report.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.use(roleAuth(["ADMIN"]));

router.get("/", reportController.getReports);
router.get("/export/:type/:format", reportController.downloadReport);

export default router;
