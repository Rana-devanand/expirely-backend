import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { dashboardService } from "./dashboard.services";

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getStats();
  res.json({
    success: true,
    data: stats
  });
});

export const getCharts = asyncHandler(async (req: Request, res: Response) => {
  const charts = await dashboardService.getCharts();
  res.json({
    success: true,
    data: charts
  });
});
