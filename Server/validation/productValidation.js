// Joi schemas for product payloads, patch requests, route params, and filters.
import {
  Joi,
  imageSchema,
  objectId,
  paginationQuerySchema,
  pricingSlabSchema,
} from "./joi.js";

const validatePricingSlabs = (slabs, helpers) => {
  if (!Array.isArray(slabs) || slabs.length === 0) return slabs;

  // Validate as a set (ordering/overlaps/bounds). We sort a copy so callers
  // don't need to pre-sort, but we still reject overlaps/duplicates.
  const sorted = [...slabs].sort((a, b) => (a.minDays ?? 0) - (b.minDays ?? 0));

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (typeof s?.maxDays === "number" && s.maxDays > 9999) {
      return helpers.error("any.custom", {
        message: `pricing.slabs[${i}].maxDays must be <= 9999`,
      });
    }

    if (i === 0) continue;
    const prev = sorted[i - 1];
    if (typeof prev?.maxDays === "number" && typeof s?.minDays === "number") {
      if (s.minDays <= prev.maxDays) {
        return helpers.error("any.custom", {
          message:
            "pricing.slabs ranges must not overlap (ensure each slab minDays is greater than the previous slab maxDays)",
        });
      }
    }
  }

  return slabs;
};

const pricingModeSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  rate: Joi.number().min(0).default(0),
});

const dailyPricingSchema = Joi.object({
  enabled: Joi.boolean().default(true),
  rate: Joi.number().min(0).required(),
});

const locationSchema = Joi.object({
  address: Joi.string().trim().max(200).allow("").default(""),
  city: Joi.string().trim().max(80).required(),
  state: Joi.string().trim().max(80).required(),
  pincode: Joi.string().trim().max(20).allow("").default(""),
  coordinates: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array()
      .ordered(
        Joi.number().min(-180).max(180).required(),
        Joi.number().min(-90).max(90).required()
      )
      .length(2)
      .default([0, 0]),
  }).default(),
});

const pricingSchema = Joi.object({
  hourly: pricingModeSchema.default(),
  daily: dailyPricingSchema.required(),
  weekly: pricingModeSchema.default(),
  slabs: Joi.array()
    .items(pricingSlabSchema)
    .custom(validatePricingSlabs, "pricing slabs validation")
    .messages({ "any.custom": "{{#message}}" })
    .default([]),
  deposit: Joi.number().min(0).default(0),
  currency: Joi.string().trim().uppercase().length(3).default("INR"),
});

const partialPricingModeSchema = Joi.object({
  enabled: Joi.boolean(),
  rate: Joi.number().min(0),
}).min(1);

const partialDailyPricingSchema = Joi.object({
  enabled: Joi.boolean(),
  rate: Joi.number().min(0),
}).min(1);

const partialLocationSchema = Joi.object({
  address: Joi.string().trim().max(200).allow(""),
  city: Joi.string().trim().max(80),
  state: Joi.string().trim().max(80),
  pincode: Joi.string().trim().max(20).allow(""),
  coordinates: Joi.object({
    type: Joi.string().valid("Point"),
    coordinates: Joi.array()
      .ordered(
        Joi.number().min(-180).max(180).required(),
        Joi.number().min(-90).max(90).required()
      )
      .length(2),
  }).min(1),
}).min(1);

const rentalRulesSchema = Joi.object({
  minRentalDays: Joi.number().integer().min(1).default(1),
  maxRentalDays: Joi.number().integer().min(Joi.ref("minRentalDays")).default(30),
  advanceBookingDays: Joi.number().integer().min(0).default(30),
  cancellationPolicy: Joi.string().valid("flexible", "moderate", "strict").default("moderate"),
});

const partialRentalRulesSchema = Joi.object({
  minRentalDays: Joi.number().integer().min(1),
  maxRentalDays: Joi.number().integer().min(1),
  advanceBookingDays: Joi.number().integer().min(0),
  cancellationPolicy: Joi.string().valid("flexible", "moderate", "strict"),
}).min(1);

const createProductBodySchema = Joi.object({
  category: objectId("category").required(),
  title: Joi.string().trim().min(3).max(100).required(),
  description: Joi.string().trim().min(10).max(2000).required(),
  images: Joi.array().items(imageSchema).min(1).default([]),
  attributes: Joi.object().unknown(true).default({}),
  pricing: pricingSchema.required(),
  location: locationSchema.required(),
  rentalRules: rentalRulesSchema.default(),
  condition: Joi.string().valid("new", "like_new", "good", "fair").required(),
  status: Joi.string().valid("active", "inactive", "under_review").default("active"),
  isFeatured: Joi.boolean(),
});

const updateProductBodySchema = Joi.object({
  category: objectId("category"),
  title: Joi.string().trim().min(3).max(100),
  description: Joi.string().trim().min(10).max(2000),
  images: Joi.array().items(imageSchema).min(1),
  attributes: Joi.object().unknown(true),
  pricing: Joi.object({
    hourly: partialPricingModeSchema,
    daily: partialDailyPricingSchema,
    weekly: partialPricingModeSchema,
    slabs: Joi.array()
      .items(pricingSlabSchema)
      .custom(validatePricingSlabs, "pricing slabs validation")
      .messages({ "any.custom": "{{#message}}" }),
    deposit: Joi.number().min(0),
    currency: Joi.string().trim().uppercase().length(3),
  }).min(1),
  location: partialLocationSchema,
  rentalRules: partialRentalRulesSchema,
  condition: Joi.string().valid("new", "like_new", "good", "fair"),
  status: Joi.string().valid("active", "inactive", "rented", "under_review"),
  isFeatured: Joi.boolean(),
}).min(1);

const productIdParamsSchema = Joi.object({
  productId: objectId("productId").required(),
});

const productIdentifierParamsSchema = Joi.object({
  productIdentifier: Joi.string().trim().min(1).required(),
});

const productListQuerySchema = paginationQuerySchema.keys({
  category: objectId("category"),
  owner: objectId("owner"),
  featured: Joi.boolean(),
  city: Joi.string().trim().max(80),
  state: Joi.string().trim().max(80),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  radiusKm: Joi.number().min(0.1).max(500).default(25),
  condition: Joi.string().valid("new", "like_new", "good", "fair"),
  status: Joi.string().valid("active", "inactive", "rented", "under_review"),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(Joi.ref("minPrice")),
  search: Joi.string().trim().max(100),
  sort: Joi.string().valid(
    "newest",
    "price_asc",
    "price_desc",
    "rating",
    "nearest",
    "featured",
    "trending"
  ),
}).pattern(
  /^attr_[a-zA-Z0-9_]+$/,
  Joi.alternatives().try(
    Joi.string().trim().max(100),
    Joi.number(),
    Joi.boolean()
  )
);

export const productValidation = {
  create: { body: createProductBodySchema },
  update: { body: updateProductBodySchema },
  params: { params: productIdParamsSchema },
  publicParams: { params: productIdentifierParamsSchema },
  listQuery: { query: productListQuerySchema },
};

export default productValidation;
