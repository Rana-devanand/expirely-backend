import { Router } from "express";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import * as controller from "./vendor.controller";

const router = Router();
const auth = roleAuth(["ADMIN", "USER"]);
router.get("/flags", auth, controller.flags);
router.get("/nearby-stores", auth, controller.nearby);
router.get("/pinned-stores", auth, controller.pinnedStores);
router.post("/stores/:id/pin", auth, controller.pinStore);
router.delete("/stores/:id/pin", auth, controller.unpinStore);
router.get("/my-store/products", auth, controller.myStoreProducts);
router.put("/products/:id/publication", auth, controller.publishProduct);
router.get("/stores/:id", auth, controller.store);
router.post("/stores/:id/conversation", auth, controller.startConversation);
router.post("/onboarding", auth, controller.onboard);
export default router;
