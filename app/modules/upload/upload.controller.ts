import { type Request, type Response } from "express";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import fs from "fs";
import { createResponse } from "../../common/helper/response.helper";
import * as uploadService from "./upload.service";

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  console.log(
    `[${new Date().toLocaleTimeString()}] 📸 Received upload request`,
  );

  if (!req.file) {
    console.warn("⚠️ No file in request");
    throw createHttpError(400, "No file uploaded");
  }

  console.log("📄 File received:", {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path,
  });

  try {
    const imageUrl = await uploadService.uploadToCloudinary(req.file);
    console.log("✅ Cloudinary upload successful:", imageUrl);

    // Clean up temporary file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.send(createResponse({ imageUrl }, "Image uploaded successfully"));
  } catch (error: any) {
    console.error("❌ Cloudinary upload failed:", error.message);

    // Clean up temporary file even on failure
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    throw createHttpError(400, error.message);
  }
});
