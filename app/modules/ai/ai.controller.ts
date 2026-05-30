import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { aiService } from "./ai.service";
import { loggerService } from "../../common/service/logger.service";

export const getStorageTips = asyncHandler(
  async (req: Request, res: Response) => {
    const { productName } = req.query;
    if (!productName) {
      res
        .status(400)
        .json({ success: false, message: "Product name is required" });
      return;
    }
    const tips = await aiService.getStorageTips(productName as string);
    
    // Log activity
    const userId = (req.user as any)?.id;
    await loggerService.log("AI_STORAGE_TIPS", { productName }, userId);

    res.status(200).json({ success: true, data: tips });
  },
);

export const getRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { ingredients } = req.body;
  if (!ingredients || !Array.isArray(ingredients)) {
    res
      .status(400)
      .json({ success: false, message: "Ingredients array is required" });
    return;
  }
  const recipe = await aiService.getRecipe(ingredients);

  // Log activity
  const userId = (req.user as any)?.id;
  await loggerService.log("AI_GENERATE_RECIPE", { ingredients }, userId);

  res.status(200).json({ success: true, data: recipe });
});

export const getHealthInsight = asyncHandler(
  async (req: Request, res: Response) => {
    const { productName, category } = req.query;
    if (!productName) {
      res
        .status(400)
        .json({ success: false, message: "Product name is required" });
      return;
    }
    const insight = await aiService.getHealthInsight(
      productName as string,
      (category as string) || "General",
    );

    // Log activity
    const userId = (req.user as any)?.id;
    await loggerService.log("AI_HEALTH_INSIGHT", { productName, category }, userId);

    res.status(200).json({ success: true, data: insight });
  },
);

export const scanReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { image } = req.body;
  if (!image) {
    res
      .status(400)
      .json({ success: false, message: "Receipt image is required" });
    return;
  }
  const result = await aiService.scanReceipt(image);

  // Log activity
  const userId = (req.user as any)?.id;
  await loggerService.log("AI_SCAN_RECEIPT", {}, userId);

  res.status(200).json({
    success: true,
    data: result,
    message: "Receipt scanned successfully",
  });
});

export const getMealPlan = asyncHandler(async (req: Request, res: Response) => {
  const { products } = req.query;
  const productList = typeof products === "string" ? products.split(",") : [];
  const result = await aiService.getMealPlan(productList);

  // Log activity
  const userId = (req.user as any)?.id;
  await loggerService.log("AI_MEAL_PLAN", { products: productList }, userId);

  res
    .status(200)
    .json({ success: true, data: result, message: "Meal plan generated" });
});
