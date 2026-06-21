import { type Request, type Response } from "express";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { createResponse } from "../../common/helper/response.helper";
import * as usageService from "./usage.service";

export const logUsageEvent = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const productId = req.params.id as string;
    const { type } = req.body;

    if (!type) {
      throw createHttpError(400, "Usage type is required");
    }

    const result = await usageService.logUsageEvent(userId, productId, req.body);
    res.send(createResponse(result, "Product usage event logged successfully"));
  }
);

export const getProductUsageEvents = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;
    const productId = req.params.id as string;

    const result = await usageService.getProductUsageEvents(userId, productId);
    res.send(createResponse(result, "Product usage events fetched successfully"));
  }
);

export const getUsageSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req.user as any).id as string;

    const result = await usageService.getUsageSummary(userId);
    res.send(createResponse(result, "Usage analytics summary fetched successfully"));
  }
);
