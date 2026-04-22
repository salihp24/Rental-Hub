// Shared Joi helpers and reusable schema fragments used across request validators.
import BaseJoi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const phonePattern = /^[0-9+\-\s()]{7,20}$/;
const pincodePattern = /^[0-9A-Za-z -]{4,12}$/;

const Joi = BaseJoi;

export const validationOptions = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
};

export const objectId = (label = "id") =>
  Joi.string()
    .trim()
    .pattern(objectIdPattern)
    .messages({
      "string.pattern.base": `${label} must be a valid MongoDB ObjectId`,
    });

export const imageSchema = Joi.object({
  url: Joi.string().trim().uri({ scheme: ["http", "https"] }).required(),
  publicId: Joi.string().trim().required(),
});

export const addressSchema = Joi.object({
  street: Joi.string().trim().max(150).allow("").default(""),
  city: Joi.string().trim().max(80).allow("").default(""),
  state: Joi.string().trim().max(80).allow("").default(""),
  pincode: Joi.string().trim().pattern(pincodePattern).allow("").default(""),
});

export const pricingSlabSchema = Joi.object({
  minDays: Joi.number().integer().min(1).required(),
  maxDays: Joi.number().integer().min(Joi.ref("minDays")).required(),
  discountPercent: Joi.number().min(0).max(100).required(),
});

export const phoneSchema = Joi.string()
  .trim()
  .pattern(phonePattern)
  .messages({
    "string.pattern.base": "phone must be a valid phone number",
  });

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim().max(100),
  search: Joi.string().trim().max(100),
});

export { Joi };
