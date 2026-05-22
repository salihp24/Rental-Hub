import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Booking from "../models/Booking.js";
import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import { buildUniqueProductSlug } from "../utils/Slug.js";
import { computePricing } from "../utils/Pricing.js";
import { getSubtreeCategoryIds } from "../utils/categoryTree.js";
import { destroyCloudinaryAsset } from "../config/cloudinary.js";
import { assertCloudinaryImages, isCloudinaryImageUrl } from "../utils/cloudinaryImage.js";

// CREATE PRODUCT
export const createProductService = async (data, user) => {
  if (user.ownerProfile?.activitySuspended) {
    throw new AppError("Owner activity is suspended. You cannot create new listings right now.", 403);
  }
  // Find the selected category first.
  // We only need minimal fields here to validate whether listing is allowed.
  const category = await Category.findById(data.category).select("_id isActive");

  // Stop if the category does not exist.
  if (!category) throw new AppError("Category not found.", 404);

  // Prevent creating products under inactive categories.
  if (!category.isActive)
    throw new AppError("Cannot list in inactive category.", 400);

  if (!assertCloudinaryImages(data.images)) {
    throw new AppError("Product images must be uploaded to Cloudinary before listing.", 400);
  }

  // Create the product with the request payload.
  // We also set the current user as owner and generate a unique slug.
  const isAdmin = user.hasRole("admin");
  const requestedStatus = data.status;
  const safeStatus = isAdmin
    ? requestedStatus || "active"
    : "under_review";

  const product = await Product.create({
    ...data,
    status: safeStatus,
    isFeatured: isAdmin ? Boolean(data.isFeatured) : false,
    moderation: {
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: "",
      rejectionReason: "",
    },
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
    featured,
    city,
    district,
    state,
    lat,
    lng,
    radiusKm = 25,
    condition,
    status,
    minPrice,
    maxPrice,
    search,
    sort = "newest",
    page = 1,
    limit = 10,
    ...dynamicFilters
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
  if (featured !== undefined) filter.isFeatured = featured;

  // Case-insensitive partial matching for location fields.
  if (city) filter["location.city"] = { $regex: city, $options: "i" };
  if (state) filter["location.state"] = { $regex: state, $options: "i" };
  if (lat != null && lng != null) {
    filter["location.coordinates"] = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)],
        },
        $maxDistance: Number(radiusKm) * 1000,
      },
    };
  }

  // Match condition such as new / good / fair.
  if (condition) filter.condition = condition;

  // Public browse must never expose non-active listings.
  // Admin moderation and owner listing management have dedicated protected routes.
  filter.status = "active";

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

  for (const [key, rawValue] of Object.entries(dynamicFilters)) {
    if (!key.startsWith("attr_")) continue;
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;

    const attributeKey = key.slice(5);
    if (!attributeKey) continue;

    if (typeof rawValue === "boolean") {
      filter[`attributes.${attributeKey}`] = rawValue;
      continue;
    }

    if (typeof rawValue === "number") {
      filter[`attributes.${attributeKey}`] = rawValue;
      continue;
    }

    const normalizedValue = String(rawValue).trim();
    if (!normalizedValue) continue;

    if (normalizedValue === "true" || normalizedValue === "false") {
      filter[`attributes.${attributeKey}`] = normalizedValue === "true";
      continue;
    }

    const numericValue = Number(normalizedValue);
    if (!Number.isNaN(numericValue) && normalizedValue === String(numericValue)) {
      filter[`attributes.${attributeKey}`] = numericValue;
      continue;
    }

    filter[`attributes.${attributeKey}`] = {
      $regex: `^${normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    };
  }

  // Supported sort options for browsing.
  const sortMap = {
    price_asc: { "pricing.daily.rate": 1 },
    price_desc: { "pricing.daily.rate": -1 },
    rating: { "ratings.average": -1 },
    featured: { isFeatured: -1, "ratings.average": -1, totalRentals: -1, createdAt: -1 },
    trending: { totalRentals: -1, "ratings.average": -1, createdAt: -1 },
    newest: { createdAt: -1 },
  };

  // Convert page and limit into the number of documents to skip.
  const skip = (Number(page) - 1) * Number(limit);

  const escapedDistrict =
    typeof district === "string" && district.trim()
      ? district.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "";
  const shouldPrioritizeDistrict = Boolean(escapedDistrict) && sort !== "nearest";

  if (shouldPrioritizeDistrict) {
    const baseSort = sortMap[sort] || sortMap.newest;
    const districtRegex = new RegExp(escapedDistrict, "i");

    const [prioritizedIds, total] = await Promise.all([
      Product.aggregate([
        { $match: filter },
        {
          $addFields: {
            _districtPriority: {
              $cond: [
                {
                  $or: [
                    { $regexMatch: { input: { $ifNull: ["$location.city", ""] }, regex: districtRegex } },
                    { $regexMatch: { input: { $ifNull: ["$location.address", ""] }, regex: districtRegex } },
                  ],
                },
                0,
                1,
              ],
            },
          },
        },
        { $sort: { _districtPriority: 1, ...baseSort } },
        { $skip: skip },
        { $limit: Number(limit) },
        { $project: { _id: 1 } },
      ]),
      Product.countDocuments(filter),
    ]);

    const orderedIds = prioritizedIds.map((item) => String(item._id));
    const hydratedProducts = await Product.find({
      _id: { $in: prioritizedIds.map((item) => item._id) },
    })
      .select("-blockedDates -__v")
      .populate("category", "name slug parent level")
      .populate("owner", "name avatar ratings.asOwner");

    const orderLookup = new Map(orderedIds.map((id, index) => [id, index]));
    const products = hydratedProducts.sort(
      (a, b) => (orderLookup.get(String(a._id)) ?? 0) - (orderLookup.get(String(b._id)) ?? 0)
    );

    return { products, total, page, limit };
  }

  // Fetch matching products and total count in parallel.
  // This helps the UI show both the current page and pagination info.
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("-blockedDates -__v")
      .populate("category", "name slug parent level")
      .populate("owner", "name avatar ratings.asOwner")
      .sort(sort === "nearest" ? undefined : sortMap[sort] || sortMap.newest)
      .skip(skip)
      .limit(Number(limit)),

    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
};

export const getProductSuggestionsService = async (query) => {
  const { search, district, city, limit = 6 } = query;
  const normalizedSearch = String(search || "").trim();

  if (!normalizedSearch) {
    return { suggestions: [] };
  }

  const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escapedSearch, "i");
  const escapedDistrict =
    typeof district === "string" && district.trim()
      ? district.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "";
  const escapedCity =
    typeof city === "string" && city.trim()
      ? city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "";
  const districtRegex = escapedDistrict ? new RegExp(escapedDistrict, "i") : null;
  const cityRegex = escapedCity ? new RegExp(escapedCity, "i") : null;

  const locationPriorityBranches = [];
  if (districtRegex) {
    locationPriorityBranches.push({
      case: {
        $or: [
          { $regexMatch: { input: { $ifNull: ["$location.city", ""] }, regex: districtRegex } },
          { $regexMatch: { input: { $ifNull: ["$location.address", ""] }, regex: districtRegex } },
        ],
      },
      then: 0,
    });
  }
  if (cityRegex) {
    locationPriorityBranches.push({
      case: { $regexMatch: { input: { $ifNull: ["$location.city", ""] }, regex: cityRegex } },
      then: 1,
    });
  }

  const suggestions = await Product.aggregate([
    {
      $match: {
        status: "active",
        $or: [{ title: { $regex: searchRegex } }, { description: { $regex: searchRegex } }],
      },
    },
    {
      $addFields: {
        _locationPriority: locationPriorityBranches.length
          ? { $switch: { branches: locationPriorityBranches, default: 2 } }
          : 0,
        _titleStartsWith: {
          $cond: [{ $regexMatch: { input: "$title", regex: new RegExp(`^${escapedSearch}`, "i") } }, 0, 1],
        },
      },
    },
    { $sort: { _locationPriority: 1, _titleStartsWith: 1, totalRentals: -1, createdAt: -1 } },
    { $limit: Number(limit) },
    {
      $project: {
        _id: 1,
        slug: 1,
        title: 1,
        "location.city": 1,
        "location.state": 1,
        "pricing.daily.rate": 1,
        "pricing.currency": 1,
        images: { $slice: ["$images", 1] },
      },
    },
  ]);

  return { suggestions };
};

// GET SINGLE PRODUCT
export const getProductByIdentifierService = async (identifier) => {
  // Fetch one product with related category and owner details.
  const finder = mongoose.isValidObjectId(identifier)
    ? { $or: [{ _id: identifier }, { slug: identifier }] }
    : { slug: identifier };

  const product = await Product.findOne({
    ...finder,
    status: "active",
  })
    .select("-__v")
    .populate("category", "name slug attributes parent ancestors level")
    .populate("owner", "name avatar phone ownerProfile ratings.asOwner createdAt");

  // If the id is valid but no document exists, return 404.
  if (!product) throw new AppError("Product not found.", 404);

  return product;
};

export const getProductPreviewService = async (productId, user) => {
  const product = await Product.findById(productId)
    .select("-__v")
    .populate("category", "name slug attributes parent ancestors level")
    .populate("owner", "name avatar phone ownerProfile ratings.asOwner createdAt");

  if (!product) throw new AppError("Product not found.", 404);

  const isOwner = product.owner?._id?.equals?.(user._id) || String(product.owner?._id) === String(user._id);
  const isAdmin = user?.hasRole?.("admin");

  if (!isOwner && !isAdmin) {
    throw new AppError("Not allowed to preview this product.", 403);
  }

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

  if (isOwner && !isAdmin && user.ownerProfile?.activitySuspended) {
    throw new AppError("Owner activity is suspended. Listing updates are temporarily disabled.", 403);
  }

  if (!isAdmin) {
    if (Object.prototype.hasOwnProperty.call(data, "status")) {
      throw new AppError("Only admins can change product status.", 403);
    }
    if (Object.prototype.hasOwnProperty.call(data, "isFeatured")) {
      throw new AppError("Only admins can change featured status.", 403);
    }
    if (Object.prototype.hasOwnProperty.call(data, "moderation")) {
      throw new AppError("Only admins can update moderation fields.", 403);
    }
  }

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

  if (Array.isArray(data.images) && !assertCloudinaryImages(data.images)) {
    throw new AppError("Product images must use Cloudinary URLs.", 400);
  }

  if (Array.isArray(data.images)) {
    const nextPublicIds = new Set(
      data.images.map((image) => image?.publicId).filter(Boolean)
    );
    const removedPublicIds = product.images
      .map((image) => image?.publicId)
      .filter((publicId) => publicId && !nextPublicIds.has(publicId));

    if (removedPublicIds.length) {
      await Promise.allSettled(
        removedPublicIds.map((publicId) => destroyCloudinaryAsset(publicId))
      );
    }
  }

  // Apply the update and keep Mongoose validation enabled.
  const mutableData = { ...data };

  if (!isAdmin) {
    const nonStatusFields = Object.keys(mutableData).filter((key) => key !== "status");
    if (product.status === "active" && nonStatusFields.length > 0) {
      mutableData.status = "under_review";
      mutableData.moderation = {
        ...product.moderation?.toObject?.(),
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: "",
        rejectionReason: "",
      };
    }
  }

  return await Product.findByIdAndUpdate(productId, mutableData, {
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

  if (isOwner && !isAdmin && user.ownerProfile?.activitySuspended) {
    throw new AppError("Owner activity is suspended. Listing deletion is temporarily disabled.", 403);
  }

  // Do not allow deletion when booking lifecycle is still in progress.
  // Terminal statuses (completed/cancelled/rejected) are safe for deletion.
  const hasOpenBookings = await Booking.exists({
    product: product._id,
    status: {
      $in: ["pending", "confirmed", "active", "return_requested"],
    },
  });
  if (hasOpenBookings) {
    throw new AppError(
      "Cannot delete this listing while it has active or pending bookings.",
      400
    );
  }

  const imagePublicIds = product.images
    .filter((image) => isCloudinaryImageUrl(image?.url))
    .map((image) => image?.publicId)
    .filter(Boolean);

  if (imagePublicIds.length) {
    await Promise.allSettled(
      imagePublicIds.map((publicId) => destroyCloudinaryAsset(publicId))
    );
  }

  // Remove the document from the database.
  await product.deleteOne();
};

// PRICING
export const getProductPricingService = async (productId, quantity, pricingUnit = "daily") => {
  const totalUnits = Number(quantity || 0);
  if (!totalUnits || totalUnits < 1) {
    throw new AppError("Invalid pricing quantity.", 400);
  }

  // Fetch only the fields needed for price calculation.
  const product = await Product.findById(productId).select(
    "pricing rentalRules status title"
  );

  if (!product) throw new AppError("Product not found.", 404);

  // Only active products can be priced for booking.
  if (product.status !== "active")
    throw new AppError("Not available.", 400);

  // Enforce the product's booking rules before calculating totals.
  if (pricingUnit === "daily" && totalUnits < product.rentalRules.minRentalDays)
    throw new AppError("Below minimum days.", 400);

  if (pricingUnit === "daily" && totalUnits > product.rentalRules.maxRentalDays)
    throw new AppError("Above maximum days.", 400);

  if (pricingUnit === "hourly" && !product.pricing?.hourly?.enabled) {
    throw new AppError("Hourly pricing is not enabled for this product.", 400);
  }

  if (pricingUnit === "weekly" && !product.pricing?.weekly?.enabled) {
    throw new AppError("Weekly pricing is not enabled for this product.", 400);
  }

  return {
    product,
    // Utility returns the pricing breakdown:
    // base price, slab discounts, totals, etc.
    breakdown: computePricing(product.pricing, totalUnits, { pricingUnit }),
    quantity: totalUnits,
    pricingUnit,
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
