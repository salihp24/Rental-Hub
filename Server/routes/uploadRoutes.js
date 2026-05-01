import express from "express";

import { uploadProductImages } from "../controllers/uploadController.js";
import protect from "../middleware/auth.js";
import { handleMulterError, productImageUpload } from "../middleware/upload.js";

const router = express.Router();

router.post(
  "/products",
  protect,
  (req, res, next) => {
    productImageUpload.array("images", 5)(req, res, (err) => {
      handleMulterError(err, req, res, next);
    });
  },
  uploadProductImages
);

export default router;

