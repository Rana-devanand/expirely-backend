import { type Request, type Response } from "express";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { createResponse } from "../../common/helper/response.helper";
import * as productService from "./product.service";
import { notificationService } from "../notification/notification.service";

export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const result = await productService.createProduct(userId, req.body);

    // Trigger notification with more detail
    await notificationService.createNotification(
      userId,
      "ADD_PRODUCT",
      {
        productName: result.name,
        category: result.category,
        qty: result.qty,
        expiryDate: result.expiryDate,
      },
      "success",
    );

    res.send(createResponse(result, "Product created successfully"));
  },
);

export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const productId = req.params.id as string;
    const result = await productService.updateProduct(
      userId,
      productId,
      req.body,
    );

    // Trigger notification
    const isConsumedToggle = req.body.is_consumed !== undefined;
    const action = isConsumedToggle
      ? req.body.is_consumed
        ? "MARK_CONSUMED"
        : "MARK_ACTIVE"
      : "UPDATE_PRODUCT";

    await notificationService.createNotification(
      userId,
      action,
      {
        productName: result.name,
        category: result.category,
        qty: result.qty,
        expiryDate: result.expiryDate,
        isConsumed: result.is_consumed,
      },
      isConsumedToggle ? "success" : "info",
    );

    res.send(createResponse(result, "Product updated successfully"));
  },
);

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const productId = req.params.id as string;

    const existing = await productService.getProductById(userId, productId);
    if (!existing) throw createHttpError(404, "Product not found");

    const result = await productService.deleteProduct(userId, productId);

    // Trigger notification
    await notificationService.createNotification(
      userId,
      "DELETE_PRODUCT",
      { productName: existing.name },
      "error",
    );

    res.send(createResponse(result, "Product deleted successfully"));
  },
);

export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const productId = req.params.id as string;
    const result = await productService.getProductById(userId, productId);

    if (!result) throw createHttpError(404, "Product not found");

    res.send(createResponse(result));
  },
);

export const getAllProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const result = await productService.getAllProducts(userId);
    res.send(createResponse(result));
  },
);

export const fetchByBarcode = asyncHandler(
  async (req: Request, res: Response) => {
    const code = req.params.code as string;
    const result = await productService.fetchByBarcode(code);
    if (!result) throw createHttpError(404, "Product not found in database");
    res.send(createResponse(result));
  },
);

export const extractDatesFromImage = asyncHandler(
  async (req: Request, res: Response) => {
    const image = req.body.image as string;
    if (!image) throw createHttpError(400, "Image data is required");
    const result = await productService.extractDatesFromImage(image);
    res.send(createResponse(result));
  },
);
export const getAdminProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await productService.getAllAdminProducts();
    res.send(createResponse(result));
  },
);
