import Product from "../models/Product.js";
import Category from "../models/Category.js";
import AppError from "../utils/AppError.js";
import { buildUniqueProductSlug } from "../utils/slug.js";
import { computePricing } from "../utils/Pricing.js";
import { getSubtreeCategoryIds } from "../utils/categoryTree.js";

// CREATE PRODUCT
export const createProductService = async (data, user) => {
  // Find the selected category first.
  // We only need minimal fields here to validate whether listing is allowed.
  const category = await Category.findById(data.category).select("_id isActive");

  // Stop if the category does not exist.
  if (!category) throw new AppError("Category not found.", 404);

  // Prevent creating products under inactive categories.
  if (!category.isActive)
    throw new AppError("Cannot list in inactive category.", 400);

  // Create the product with the request payload.
  // We also set the current user as owner and generate a unique slug.
  const product = await Product.create({
    ...data,
    owner: user._id,
    // Generates a URL-friendly unique string.
    // Example: "iPhone 15 Pro" -> "iphone-15-pro"
    slug: await buildUniqueProductSlug(data.title),
  });

  // If the user lists a product for the first time, add the owner role.
  await user.addOwnerRole();

  return product;
};

// GET PRODUCTS
export const getProductsService = async (query) => {
  // Read all possible filters, sorting, and pagination values from the request.
  const {
    category,
    owner,
    city,
    state,
    condition,
    status,
    minPrice,
    maxPrice,
    search,
    sort = "newest",
    page = 1,
    limit = 10,
  } = query;

  // Build the MongoDB filter step by step.
  const filter = {};

  if (category) {
    // Include the selected category and all of its child categories.
    // Example: choosing "Electronics" can include mobiles, cameras, etc.
    const subtreeIds = await getSubtreeCategoryIds(category);
    filter.category = { $in: subtreeIds };
  }

  // Filter products by owner if that query is provided.
  if (owner) filter.owner = owner;

  // Case-insensitive partial matching for location fields.
  if (city) filter["location.city"] = { $regex: city, $options: "i" };
  if (state) filter["location.state"] = { $regex: state, $options: "i" };

  // Match condition such as new / good / fair.
  if (condition) filter.condition = condition;

  // Default to only active listings unless another status is explicitly requested.
  filter.status = status || "active";

  if (minPrice || maxPrice) {
    // Build a range filter for the product's daily price.
    filter["pricing.daily.rate"] = {};
    if (minPrice) filter["pricing.daily.rate"].$gte = Number(minPrice);
    if (maxPrice) filter["pricing.daily.rate"].$lte = Number(maxPrice);
  }

  if (search) {
    // Use MongoDB text search over indexed text fields like title and description.
    filter.$text = { $search: search };
  }

  // Supported sort options for browsing.
  const sortMap = {
    price_asc: { "pricing.daily.rate": 1 },
    price_desc: { "pricing.daily.rate": -1 },
    rating: { "ratings.average": -1 },
    newest: { createdAt: -1 },
  };

  // Convert page and limit into the number of documents to skip.
  const skip = (Number(page) - 1) * Number(limit);

  // Fetch matching products and total count in parallel.
  // This helps the UI show both the current page and pagination info.
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("-blockedDates -__v")
      .populate("category", "name slug parent level")
      .populate("owner", "name avatar ratings.asOwner")
      .sort(sortMap[sort] || sortMap.newest)
      .skip(skip)
      .limit(Number(limit)),

    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
};

// GET SINGLE PRODUCT
export const getProductByIdService = async (productId) => {
  // Fetch one product with related category and owner details.
  const product = await Product.findById(productId)
    .select("-__v")
    .populate("category", "name slug attributes parent ancestors level")
    .populate("owner", "name avatar phone ownerProfile ratings.asOwner createdAt");

  // If the id is valid but no document exists, return 404.
  if (!product) throw new AppError("Product not found.", 404);

  return product;
};

// UPDATE PRODUCT
export const updateProductService = async (productId, data, user) => {
  // Load the current product first so we can validate permissions and changes.
  const product = await Product.findById(productId);

  if (!product) throw new AppError("Product not found.", 404);

  // Only the owner or an admin is allowed to edit the product.
  const isOwner = product.owner.equals(user._id);
  const isAdmin = user.hasRole("admin");

  if (!isOwner && !isAdmin)
    throw new AppError("Not allowed to update.", 403);

  if (data.title && data.title !== product.title) {
    // If title changes, generate a fresh slug.
    // Passing the current product id avoids treating its own slug as duplicate.
    data.slug = await buildUniqueProductSlug(data.title, product._id);
  }

  if (data.category && !product.category.equals(data.category)) {
    // If the user changes category, validate the new one before updating.
    const category = await Category.findById(data.category).select("_id isActive");

    if (!category) throw new AppError("Category not found.", 404);
    if (!category.isActive)
      throw new AppError("Inactive category.", 400);
  }

  // Apply the update and keep Mongoose validation enabled.
  return await Product.findByIdAndUpdate(productId, data, {
    new: true,
    runValidators: true,
  }).select("-__v");
};

// DELETE PRODUCT
export const deleteProductService = async (productId, user) => {
  // Find the product before deleting so we can check ownership and status.
  const product = await Product.findById(productId);

  if (!product) throw new AppError("Product not found.", 404);

  // Only the owner or an admin can delete the product.
  const isOwner = product.owner.equals(user._id);
  const isAdmin = user.hasRole("admin");

  if (!isOwner && !isAdmin)
    throw new AppError("Not allowed to delete.", 403);

  // Do not allow deletion while the item is currently rented.
  if (product.status === "rented")
    throw new AppError("Currently rented.", 400);

  // Remove the document from the database.
  await product.deleteOne();
};

// PRICING
export const getProductPricingService = async (productId, days) => {
  // Rental pricing must be calculated for at least 1 day.
  if (!days || days < 1)
    throw new AppError("Invalid days.", 400);

  // Fetch only the fields needed for price calculation.
  const product = await Product.findById(productId).select(
    "pricing rentalRules status title"
  );

  if (!product) throw new AppError("Product not found.", 404);

  // Only active products can be priced for booking.
  if (product.status !== "active")
    throw new AppError("Not available.", 400);

  // Enforce the product's booking rules before calculating totals.
  if (days < product.rentalRules.minRentalDays)
    throw new AppError("Below minimum days.", 400);

  if (days > product.rentalRules.maxRentalDays)
    throw new AppError("Above maximum days.", 400);

  return {
    product,
    // Utility returns the pricing breakdown:
    // base price, slab discounts, totals, etc.
    breakdown: computePricing(product.pricing, days),
    days,
  };
};

// MY LISTINGS
export const getMyListingsService = async (userId, query) => {
  // Read optional status filter and pagination values.
  const { status, page = 1, limit = 10 } = query;

  // Always scope this query to the logged-in user's own products.
  const filter = { owner: userId };
  if (status) filter.status = status;

  // Pagination offset.
  const skip = (page - 1) * limit;

  // Fetch the owner's products and total count together.
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("-blockedDates -__v")
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),

    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
};
