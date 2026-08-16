import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { ocrExtractionService } from "./ocr.service";

export const extractProduct = asyncHandler(async (req: Request, res: Response) => {
  const { ocrText, timezone = "Asia/Kolkata" } = req.body || {};
  if (typeof ocrText !== "string" || !ocrText.trim()) {
    res.status(400).json({ success: false, message: "OCR text is required" });
    return;
  }
  if (ocrText.length > 20000) {
    res.status(413).json({ success: false, message: "OCR text is too large" });
    return;
  }
  const data = await ocrExtractionService.extractProduct(ocrText.trim(), String(timezone));
  res.status(200).json({ success: true, data });
});

export const extractProductStream = asyncHandler(async (req: Request, res: Response) => {
  const { ocrText, timezone = "Asia/Kolkata" } = req.body || {};
  if (typeof ocrText !== "string" || !ocrText.trim() || ocrText.length > 20000) {
    res.status(400).json({ success: false, message: "Valid OCR text is required" });
    return;
  }
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (event: string, payload: unknown) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  try {
    send("progress", { message: "Expirely started analyzing your images..." });
    const data = await ocrExtractionService.extractProduct(
      ocrText.trim(),
      String(timezone),
      (event) => send("update", event),
    );
    send("result", { success: true, data });
    send("done", { success: true });
  } catch (error) {
    send("error", { message: error instanceof Error ? error.message : "Product analysis failed" });
  } finally {
    res.end();
  }
});