// Joi schemas for creating reviews, replying, and filtering review lists.
import { Joi, objectId, paginationQuerySchema } from "./joi.js";

const createReviewBodySchema = Joi.object({
  booking: objectId("booking").required(),
  reviewType: Joi.string().valid("product", "owner", "renter").required(),
  targetProduct: objectId("targetProduct").when("reviewType", {
    is: "product",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  targetUser: objectId("targetUser").when("reviewType", {
    is: Joi.valid("owner", "renter"),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().trim().min(5).max(1000).required(),
});

const replyReviewBodySchema = Joi.object({
  comment: Joi.string().trim().min(2).max(500).required(),
}).required();

const reviewIdParamsSchema = Joi.object({
  reviewId: objectId("reviewId").required(),
});

const reviewListQuerySchema = paginationQuerySchema.keys({
  booking: objectId("booking"),
  targetProduct: objectId("targetProduct"),
  targetUser: objectId("targetUser"),
  reviewType: Joi.string().valid("product", "owner", "renter"),
  minRating: Joi.number().min(1).max(5),
});

export const reviewValidation = {
  create: { body: createReviewBodySchema },
  reply: { body: replyReviewBodySchema },
  params: { params: reviewIdParamsSchema },
  listQuery: { query: reviewListQuerySchema },
};

export default reviewValidation;
