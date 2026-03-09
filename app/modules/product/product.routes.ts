import { Router } from "express";
import * as productController from "./product.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

// Require authenticated user for all product routes
router.get("/admin", roleAuth(["ADMIN"]), productController.getAdminProducts);

router.use(roleAuth(["ADMIN", "USER"]));

router.post("/", productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

router.get("/barcode/:code", productController.fetchByBarcode);
router.post("/extract-dates", productController.extractDatesFromImage);

export default router;
