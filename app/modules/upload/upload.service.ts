import cloudinary from "../../config/cloudinary";
import { Readable } from "stream";

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string = "products",
): Promise<string> => {
  // 1. Validation for file format (optional if multer handles it, but keep for safety)
  const allowedFormats = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowedFormats.includes(file.mimetype)) {
    throw new Error(
      "Invalid file format. Only JPG, JPEG, and PNG are allowed.",
    );
  }

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: "auto",
    });
    return result.secure_url;
  } catch (error: any) {
    throw new Error("Cloudinary upload failed: " + error.message);
  }
};
