import { Router } from "express";
import * as recurringController from "./recurring.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.get("/", roleAuth(["ADMIN", "USER"]), recurringController.getTemplates);
router.post("/", roleAuth(["ADMIN", "USER"]), recurringController.createTemplate);
router.patch("/:id", roleAuth(["ADMIN", "USER"]), recurringController.updateTemplate);
router.delete("/:id", roleAuth(["ADMIN", "USER"]), recurringController.deleteTemplate);
router.post("/:id/add", roleAuth(["ADMIN", "USER"]), recurringController.addProductFromTemplate);

export default router;
