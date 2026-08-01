import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import * as uploadController from "./upload.controller";

const router = Router();

// Configure multer to store files on disk temporarily in the system's temporary directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(os.tmpdir(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/jpg", "image/png"].includes(file.mimetype)),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const chatUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
      "video/mp4", "video/quicktime", "video/webm",
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    cb(null, allowed.has(file.mimetype));
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

router.post("/", upload.single("image"), uploadController.uploadImage);
router.post("/chat", chatUpload.single("file"), uploadController.uploadChatAttachment);

export default router;
