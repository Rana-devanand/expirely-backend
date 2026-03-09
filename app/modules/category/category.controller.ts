import { type Request, type Response } from "express";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { createResponse } from "../../common/helper/response.helper";
import * as categoryService from "./category.service";
import { notificationService } from "../notification/notification.service";

export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const result = await categoryService.createCategory(userId, req.body);

    // Trigger notification
    await notificationService.createNotification(
      userId,
      "ADD_CATEGORY",
      { categoryName: result.name },
      "success",
    );

    res.send(createResponse(result, "Category created successfully"));
  },
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const categoryId = req.params.id as string;
    const result = await categoryService.updateCategory(
      userId,
      categoryId,
      req.body,
    );
    res.send(createResponse(result, "Category updated successfully"));
  },
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const categoryId = req.params.id as string;

    const existing = await categoryService.getCategoryById(userId, categoryId);
    if (!existing) throw createHttpError(404, "Category not found");

    const result = await categoryService.deleteCategory(userId, categoryId);
    res.send(createResponse(result, "Category deleted successfully"));
  },
);

export const getCategoryById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const categoryId = req.params.id as string;
    const result = await categoryService.getCategoryById(userId, categoryId);
    if (!result) throw createHttpError(404, "Category not found");

    res.send(createResponse(result));
  },
);

export const getAllCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const result = await categoryService.getAllCategories(userId);
    res.send(createResponse(result));
  },
);
