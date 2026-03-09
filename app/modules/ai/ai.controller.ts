import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { aiService } from "./ai.service";

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
  res
    .status(200)
    .json({ success: true, data: result, message: "Meal plan generated" });
});
