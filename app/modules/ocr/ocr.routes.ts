import { Router } from "express";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { extractProduct, extractProductStream } from "./ocr.controller";

const router = Router();
router.use(roleAuth(["ADMIN", "USER"]));
router.post("/extract-product", extractProduct);
router.post("/extract-product-stream", extractProductStream);
export default router;
