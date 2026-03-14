import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { reportService } from "./report.services";
import { createResponse } from "../../common/helper/response.helper";

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.getStats();
  res.send(createResponse(result));
});

export const downloadReport = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as string;
  const format = req.params.format as string;
  
  if (format === "csv") {
    const csvData = await reportService.generateCSV(type);
    if (!csvData) {
      res.status(404);
      throw new Error("No data found for this report");
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${type}_report_${Date.now()}.csv`);
    res.status(200).send(csvData);
  } else {
    res.status(400);
    throw new Error("Unsupported format. Use CSV for now.");
  }
});
