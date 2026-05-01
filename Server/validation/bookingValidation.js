// Joi schemas for booking payloads, params, and list filters.
import { Joi, addressSchema, objectId, paginationQuerySchema } from "./joi.js";

const createBookingBodySchema = Joi.object({
  product: objectId("product").required(),
  pricingUnit: Joi.string().valid("hourly", "daily", "weekly").default("daily"),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
  deliveryType: Joi.string().valid("pickup", "delivery").default("pickup"),
  deliveryAddress: addressSchema.when("deliveryType", {
    is: "delivery",
    then: Joi.object({
      street: Joi.string().trim().max(150).required(),
      city: Joi.string().trim().max(80).required(),
      state: Joi.string().trim().max(80).required(),
      pincode: Joi.string().trim().max(20).required(),
    }).required(),
    otherwise: Joi.any().strip(),
  }),
  renterNote: Joi.string().trim().max(500).allow("").default(""),
});

const updateBookingStatusBodySchema = Joi.object({
  status: Joi.string()
    .valid(
      "pending",
      "confirmed",
      "active",
      "return_requested",
      "completed",
      "cancelled",
      "rejected"
    )
    .required(),
  paymentStatus: Joi.string().valid("unpaid", "paid", "refunded", "partially_refunded"),
  reason: Joi.string().trim().min(5).max(500),
}).required();

const cancelBookingBodySchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required(),
}).required();

const verifyRazorpayPaymentBodySchema = Joi.object({
  razorpay_order_id: Joi.string().trim().required(),
  razorpay_payment_id: Joi.string().trim().required(),
  razorpay_signature: Joi.string().trim().required(),
}).required();

const bookingIdParamsSchema = Joi.object({
  bookingId: objectId("bookingId").required(),
});

const bookingListQuerySchema = paginationQuerySchema.keys({
  as: Joi.string().valid("renter", "owner", "all").default("renter"),
  renter: objectId("renter"),
  owner: objectId("owner"),
  product: objectId("product"),
  status: Joi.string().valid(
    "pending",
    "confirmed",
    "active",
    "return_requested",
    "completed",
    "cancelled",
    "rejected"
  ),
  paymentStatus: Joi.string().valid("unpaid", "paid", "refunded", "partially_refunded"),
});

const bookingAvailabilityQuerySchema = Joi.object({
  product: objectId("product").required(),
  pricingUnit: Joi.string().valid("hourly", "daily", "weekly").default("daily"),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
});

export const bookingValidation = {
  availabilityQuery: { query: bookingAvailabilityQuerySchema },
  create: { body: createBookingBodySchema },
  updateStatus: { body: updateBookingStatusBodySchema },
  cancel: { body: cancelBookingBodySchema },
  verifyPayment: { body: verifyRazorpayPaymentBodySchema },
  params: { params: bookingIdParamsSchema },
  listQuery: { query: bookingListQuerySchema },
};

export default bookingValidation;
