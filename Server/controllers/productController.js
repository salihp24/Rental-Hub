import asyncHandler from "../utils/asyncHandler.js";
import {
  createProductService,
  getProductsService,
  getProductByIdentifierService,
  updateProductService,
  deleteProductService,
  getProductPricingService,
  getMyListingsService,
} from "../Services/product.services.js";

// CREATE
export const createProduct = asyncHandler(async (req, res) => {
  const product = await createProductService(req.body, req.user);

  res.status(201).json({
    status: "success",
    data: { product },
  });
});

// GET ALL
export const getProducts = asyncHandler(async (req, res) => {
  const result = await getProductsService(req.query);

  res.status(200).json({
    status: "success",
    results: result.products.length,
    pagination: {
      total: result.total,
      page: Number(result.page),
      pages: Math.ceil(result.total / result.limit),
      limit: Number(result.limit),
    },
    data: { products: result.products },
  });
});

// GET ONE
export const getProduct = asyncHandler(async (req, res) => {
  const product = await getProductByIdentifierService(req.params.productIdentifier);

  res.status(200).json({
    status: "success",
    data: { product },
  });
});

// UPDATE
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await updateProductService(
    req.params.productId,
    req.body,
    req.user
  );

  res.status(200).json({
    status: "success",
    data: { product },
  });
});

// DELETE
export const deleteProduct = asyncHandler(async (req, res) => {
  await deleteProductService(req.params.productId, req.user);

  res.status(200).json({
    status: "success",
    message: "Product deleted successfully",
  });
});

// PRICING
export const getProductPricing = asyncHandler(async (req, res) => {
  const pricingUnit = req.query.pricingUnit || "daily";
  const quantity =
    pricingUnit === "hourly"
      ? parseFloat(req.query.hours)
      : pricingUnit === "weekly"
        ? parseFloat(req.query.weeks)
        : parseInt(req.query.days);

  const result = await getProductPricingService(
    req.params.productId,
    quantity,
    pricingUnit
  );

  res.status(200).json({
    status: "success",
    data: {
      productId: result.product._id,
      title: result.product.title,
      totalUnits: result.quantity,
      pricingUnit: result.pricingUnit,
      pricing: result.breakdown,
    },
  });
});

// MY LISTINGS
export const getMyListings = asyncHandler(async (req, res) => {
  const result = await getMyListingsService(req.user._id, req.query);

  res.status(200).json({
    status: "success",
    results: result.products.length,
    pagination: {
      total: result.total,
      page: Number(result.page),
      pages: Math.ceil(result.total / result.limit),
      limit: Number(result.limit),
    },
    data: { products: result.products },
  });
});
