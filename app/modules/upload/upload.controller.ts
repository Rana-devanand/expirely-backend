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

    res.send(createResponse({ imageUrl, sizeBytes: req.file.size }, "Image uploaded successfully"));
  } catch (error: any) {
    console.error("❌ Cloudinary upload failed:", error.message);

    // Clean up temporary file even on failure
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    throw createHttpError(400, error.message);
  }
});

export const uploadChatAttachment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw createHttpError(400, "Unsupported or missing attachment");
  if (req.file.mimetype.startsWith("video/") && req.file.size > 10 * 1024 * 1024) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    throw createHttpError(413, "Video must be 10 MB or smaller");
  }
  try {
    const fileUrl = await uploadService.uploadChatAttachment(req.file);
    res.send(createResponse({
      fileUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    }, "Attachment uploaded successfully"));
  } finally {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});
