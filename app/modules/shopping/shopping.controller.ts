import { type Request, type Response } from "express";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { createResponse } from "../../common/helper/response.helper";
import * as shoppingService from "./shopping.service";

export const getShoppingList = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const result = await shoppingService.getAllShoppingList(userId);
    res.send(createResponse(result, "Shopping list fetched successfully"));
  }
);

export const createShoppingListItem = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const { name } = req.body;
    if (!name) throw createHttpError(400, "Item name is required");

    const result = await shoppingService.createShoppingListItem(userId, req.body);
    res.send(createResponse(result, "Shopping list item created successfully"));
  }
);

export const updateShoppingListItem = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const itemId = req.params.id as string;

    const result = await shoppingService.updateShoppingListItem(userId, itemId, req.body);
    res.send(createResponse(result, "Shopping list item updated successfully"));
  }
);

export const deleteShoppingListItem = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const itemId = req.params.id as string;

    const result = await shoppingService.deleteShoppingListItem(userId, itemId);
    res.send(createResponse(result, "Shopping list item deleted successfully"));
  }
);

export const clearCheckedItems = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const result = await shoppingService.clearCheckedShoppingItems(userId);
    res.send(createResponse(result, "Completed shopping list items cleared successfully"));
  }
);
