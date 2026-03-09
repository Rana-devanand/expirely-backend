import { Router } from "express";
import * as categoryController from "./category.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

// Require authenticated user for all category routes
router.use(roleAuth(["ADMIN", "USER"]));

router.post("/", categoryController.createCategory);
router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

export default router;
