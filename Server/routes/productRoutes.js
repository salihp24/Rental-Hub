// Product routes. Authenticated users can create listings and become owners.
import express from "express";

import {
  createProduct,
  deleteProduct,
  getMyListings,
  getProduct,
  getProductPreview,
  getProductPricing,
  getProductSuggestions,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";
import protect from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { productValidation } from "../validation/index.js";

const router = express.Router();

// Public browse
router.get("/", validate(productValidation.listQuery), getProducts);
router.get("/suggestions", validate(productValidation.suggestionQuery), getProductSuggestions);

// Logged-in user views their own listings
router.get("/mine", protect, validate(productValidation.listQuery), getMyListings);
router.get("/preview/:productId", protect, validate(productValidation.params), getProductPreview);

//get single product
router.get("/:productIdentifier", validate(productValidation.publicParams), getProduct);

//get product pricing
router.get(
  "/:productId/pricing",
  validate(productValidation.params),
  getProductPricing
);

// Listing management
//Create
router.post("/", protect, validate(productValidation.create), createProduct);
//edit
router.patch(
  "/:productId",
  protect,
  validate({ ...productValidation.params, ...productValidation.update }),
  updateProduct
);
//delete
router.delete(
  "/:productId",
  protect,
  validate(productValidation.params),
  deleteProduct
);

export default router;
