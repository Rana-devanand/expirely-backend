import { Router } from "express";
import * as shoppingController from "./shopping.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

// Require authenticated user for all shopping list routes
router.use(roleAuth(["ADMIN", "USER"]));

router.get("/", shoppingController.getShoppingList);
router.post("/", shoppingController.createShoppingListItem);
router.post("/clear-checked", shoppingController.clearCheckedItems);
router.put("/:id", shoppingController.updateShoppingListItem);
router.delete("/:id", shoppingController.deleteShoppingListItem);

export default router;
