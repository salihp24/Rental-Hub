// Joi schemas for user auth, profile updates, and user-related route params.
import { Joi, addressSchema, imageSchema, objectId, phoneSchema } from "./joi.js";

const avatarSchema = imageSchema;

const ownerProfileSchema = Joi.object({
  bio: Joi.string().trim().max(500).allow("").default(""),
  address: addressSchema.default(),
});

const ownerProfileUpdateSchema = Joi.object({
  bio: Joi.string().trim().max(500).allow(""),
  address: Joi.object({
    street: Joi.string().trim().max(150).allow(""),
    city: Joi.string().trim().max(80).allow(""),
    state: Joi.string().trim().max(80).allow(""),
    pincode: Joi.string().trim().max(20).allow(""),
  }).min(1),
}).min(1);

const registerBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(6).max(128).required(),
  phone: phoneSchema.allow(""),
});

const loginBodySchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(6).max(128).required(),
});

const updateProfileBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  email: Joi.string().trim().lowercase().email(),
  phone: phoneSchema.allow(""),
  avatar: avatarSchema,
  isActive: Joi.boolean(),
}).min(1);

const updateOwnerProfileBodySchema = Joi.object({
  ownerProfile: ownerProfileUpdateSchema.required(),
}).min(1);

const userIdParamsSchema = Joi.object({
  userId: objectId("userId").required(),
});

export const userValidation = {
  register: { body: registerBodySchema },
  login: { body: loginBodySchema },
  updateProfile: { body: updateProfileBodySchema },
  updateOwnerProfile: { body: updateOwnerProfileBodySchema },
  userIdParams: { params: userIdParamsSchema },
};

export default userValidation;
