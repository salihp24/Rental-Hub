import { Joi, objectId, paginationQuerySchema } from "./joi.js";

const createConversationBodySchema = Joi.object({
  participantIds: Joi.array().items(objectId("participantId")).min(1).max(10).default([]),
  bookingId: objectId("bookingId").allow(null),
  productId: objectId("productId").allow(null),
  title: Joi.string().trim().max(120).allow("").default(""),
}).required();

const sendMessageBodySchema = Joi.object({
  text: Joi.string().trim().min(1).max(2000).required(),
}).required();

const sendOfferBodySchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
}).required();

const respondOfferBodySchema = Joi.object({
  action: Joi.string().valid("accepted", "rejected", "cancelled").required(),
}).required();

const conversationParamsSchema = Joi.object({
  conversationId: objectId("conversationId").required(),
});

const bookingConversationParamsSchema = Joi.object({
  bookingId: objectId("bookingId").required(),
});

const offerParamsSchema = Joi.object({
  conversationId: objectId("conversationId").required(),
  messageId: objectId("messageId").required(),
});

const chatListQuerySchema = paginationQuerySchema.keys({
  booking: objectId("booking"),
  product: objectId("product"),
});

export const chatValidation = {
  createConversation: { body: createConversationBodySchema },
  sendMessage: { body: sendMessageBodySchema },
  sendOffer: { body: sendOfferBodySchema },
  respondOffer: { body: respondOfferBodySchema },
  params: { params: conversationParamsSchema },
  offerParams: { params: offerParamsSchema },
  bookingParams: { params: bookingConversationParamsSchema },
  listQuery: { query: chatListQuerySchema },
};

export default chatValidation;
