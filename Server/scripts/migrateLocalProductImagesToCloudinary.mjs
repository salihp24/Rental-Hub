import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import { v2 as cloudinary } from "cloudinary";
import { isCloudinaryImageUrl } from "../utils/cloudinaryImage.js";

dotenv.config({ path: path.resolve(process.cwd(), "Server", ".env") });

const requiredEnvVars = [
  "MONGO_URI",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsRoot = path.resolve(process.cwd(), "Server", "uploads");

const buildCloudinaryPublicId = (filename) => {
  const base = path.parse(filename).name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

  return `migrated-${base || "image"}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};

const resolveLocalPathFromUrl = (imageUrl) => {
  try {
    const parsed = new URL(imageUrl);
    const cleaned = parsed.pathname.replace(/^\/+/, "");
    return path.resolve(process.cwd(), "Server", cleaned.replace(/^uploads[\\/]/, "uploads/"));
  } catch {
    return null;
  }
};

await mongoose.connect(process.env.MONGO_URI);

const products = await Product.find({
  "images.url": { $regex: "localhost:5000/uploads/" },
}).select("title images");

let migratedCount = 0;
let skippedCount = 0;

for (const product of products) {
  let changed = false;

  for (const image of product.images) {
    if (isCloudinaryImageUrl(image.url)) {
      continue;
    }

    const localPath = resolveLocalPathFromUrl(image.url);
    if (!localPath || !localPath.startsWith(uploadsRoot) || !fs.existsSync(localPath)) {
      console.warn(`Skipping missing local file for product "${product.title}": ${image.url}`);
      skippedCount += 1;
      continue;
    }

    const result = await cloudinary.uploader.upload(localPath, {
      folder: "rental-hub/products",
      public_id: buildCloudinaryPublicId(path.basename(localPath)),
      resource_type: "image",
    });

    image.url = result.secure_url;
    image.publicId = result.public_id;
    changed = true;
    migratedCount += 1;
  }

  if (changed) {
    await product.save();
  }
}

await mongoose.disconnect();

console.log(
  JSON.stringify(
    {
      status: "done",
      migratedCount,
      skippedCount,
      productsChecked: products.length,
    },
    null,
    2
  )
);
