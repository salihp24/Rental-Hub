import { v2 as cloudinary } from "cloudinary";

import AppError from "../utils/AppError.js";

let isConfigured = false;

const requiredEnvVars = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const ensureCloudinaryConfig = () => {
  const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingVars.length) {
    throw new AppError(
      `Cloudinary is not configured. Missing: ${missingVars.join(", ")}`,
      500
    );
  }

  if (!isConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    isConfigured = true;
  }

  return cloudinary;
};

const buildImagePublicId = (filename = "image") => {
  const dotIndex = filename.lastIndexOf(".");
  const nameWithoutExt = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const safeBase = nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

  return `${safeBase || "image"}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};

export const uploadProductImageBuffer = (file) => {
  const client = ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: "rental-hub/products",
        public_id: buildImagePublicId(file.originalname),
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};

export const destroyCloudinaryAsset = async (publicId) => {
  if (!publicId) return;

  const client = ensureCloudinaryConfig();
  await client.uploader.destroy(publicId, { resource_type: "image" });
};

