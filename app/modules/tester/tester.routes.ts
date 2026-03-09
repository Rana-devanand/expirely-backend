import express from "express";
import * as testerController from "./tester.controller";

import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = express.Router();

router.post("/", testerController.registerTester);
router.get("/", roleAuth(["ADMIN"]), testerController.getTesters);

export default router;
