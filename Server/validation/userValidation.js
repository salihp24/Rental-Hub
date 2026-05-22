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

const forgotPasswordBodySchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

const resetPasswordBodySchema = Joi.object({
  password: Joi.string().min(6).max(128).required(),
});

const resetPasswordParamsSchema = Joi.object({
  token: Joi.string().trim().hex().length(64).required(),
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

const updatePasswordBodySchema = Joi.object({
  currentPassword: Joi.string().min(6).max(128).required(),
  newPassword: Joi.string().min(6).max(128).required(),
});

const userIdParamsSchema = Joi.object({
  userId: objectId("userId").required(),
});

export const userValidation = {
  register: { body: registerBodySchema },
  login: { body: loginBodySchema },
  forgotPassword: { body: forgotPasswordBodySchema },
  resetPassword: { body: resetPasswordBodySchema, params: resetPasswordParamsSchema },
  updateProfile: { body: updateProfileBodySchema },
  updateOwnerProfile: { body: updateOwnerProfileBodySchema },
  updatePassword: { body: updatePasswordBodySchema },
  userIdParams: { params: userIdParamsSchema },
};

export default userValidation;
