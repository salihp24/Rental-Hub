import multer from "multer";

import AppError from "../utils/AppError.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const imageFileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new AppError("Only JPG, PNG, WEBP, and GIF images are allowed.", 400));
  }

  return cb(null, true);
};

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

export const handleMulterError = (err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Each image must be 5MB or smaller.", 400));
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return next(new AppError("You can upload up to 5 images at a time.", 400));
    }

    return next(new AppError(err.message, 400));
  }

  return next(err);
};
