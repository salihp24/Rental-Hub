import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import {
  destroyCloudinaryAsset,
  uploadProductImageBuffer,
} from "../config/cloudinary.js";

export const uploadProductImages = asyncHandler(async (req, res, next) => {
  if (!req.files?.length) {
    return next(new AppError("Please upload at least one image.", 400));
  }

  const uploadedImages = [];

  try {
    for (const file of req.files) {
      const result = await uploadProductImageBuffer(file);

      uploadedImages.push({
        url: result.secure_url,
        publicId: result.public_id,
      });
    }
  } catch (error) {
    await Promise.allSettled(
      uploadedImages.map((image) => destroyCloudinaryAsset(image.publicId))
    );

    return next(new AppError("Could not upload images to Cloudinary.", 500));
  }

  res.status(201).json({
    status: "success",
    results: uploadedImages.length,
    data: { images: uploadedImages },
  });
});
