import { Router } from "express";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import * as householdController from "./household.controller";

const router = Router();

const auth = roleAuth(["ADMIN", "USER"]);

router.post("/", auth, householdController.createHousehold);
router.get("/me", auth, householdController.getMyHousehold);
router.post("/join", auth, householdController.joinHousehold);
router.delete("/leave", auth, householdController.leaveHousehold);
router.get("/members", auth, householdController.getMembers);
router.delete("/members/:memberId", auth, householdController.removeMember);

export default router;
