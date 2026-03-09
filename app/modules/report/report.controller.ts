import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { reportService } from "./report.services";
import { createResponse } from "../../common/helper/response.helper";

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getStats();
  res.send(createResponse(result));
});
