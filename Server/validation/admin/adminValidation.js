import { Joi } from "../joi.js";
import { objectId, paginationQuerySchema } from "../joi.js";

const statsQuerySchema = Joi.object({
  days: Joi.number().integer().min(7).max(90).valid(7, 30, 90).default(30),
});


const listUsersQuerySchema = paginationQuerySchema.keys({
  role: Joi.string().valid("renter", "owner", "admin"),
  isActive: Joi.boolean(),
  sort: Joi.string()
    .valid("createdAt", "-createdAt", "name", "-name", "email", "-email", "isActive", "-isActive"),
});

// for routes that have userId in the URL
const userParamsSchema = Joi.object({
  userId: objectId("userId").required(),
});

const updateUserStatusBodySchema = Joi.object({
  isActive: Joi.boolean().required(),
}).required();

const updateUserRoleBodySchema = Joi.object({
  role: Joi.array()
    .items(Joi.string().valid("renter", "owner", "admin"))
    .min(1)
    .unique()
    .required(),
}).required();

const updateOwnerActivityBodySchema = Joi.object({
  suspended: Joi.boolean().required(),
  reason: Joi.when("suspended", {
    is: true,
    then: Joi.string().trim().min(10).max(500).required(),
    otherwise: Joi.string().trim().max(500).allow(""),
  }),
}).required();

const productParamsSchema = Joi.object({
  productId: objectId("productId").required(),
});

const listProductsQuerySchema = paginationQuerySchema.keys({
  owner: objectId("owner"),
  category: objectId("category"),
  status: Joi.string().valid("active", "inactive", "rented", "under_review"),
  city: Joi.string().trim().max(80),
  state: Joi.string().trim().max(80),
  sort: Joi.string().valid("createdAt", "-createdAt", "status", "-status", "title", "-title"),
});

const updateProductStatusBodySchema = Joi.object({
  status: Joi.string().valid("active", "inactive", "under_review").required(),
  reviewNote: Joi.string().trim().max(500).allow(""),
  rejectionReason: Joi.when("status", {
    is: "inactive",
    then: Joi.string().trim().min(5).max(500).required(),
    otherwise: Joi.string().trim().max(500).allow(""),
  }),
}).required();

const updateProductFeaturedBodySchema = Joi.object({
  isFeatured: Joi.boolean().required(),
}).required();

const bookingParamsSchema = Joi.object({
  bookingId: objectId("bookingId").required(),
});

const listBookingsQuerySchema = paginationQuerySchema.keys({
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
  renter: objectId("renter"),
  owner: objectId("owner"),
  product: objectId("product"),
  orderCode: Joi.string().trim().max(30),
  startDateFrom: Joi.date().iso(),
  startDateTo: Joi.date().iso(),
  endDateFrom: Joi.date().iso(),
  endDateTo: Joi.date().iso(),
  createdFrom: Joi.date().iso(),
  createdTo: Joi.date().iso(),
  sort: Joi.string().valid(
    "createdAt",
    "-createdAt",
    "startDate",
    "-startDate",
    "endDate",
    "-endDate",
    "status",
    "-status"
  ),
});

const updateBookingStatusBodySchema = Joi.object({
  status: Joi.string()
    .valid("cancelled", "rejected")
    .required(),
  reason: Joi.string().trim().min(10).max(500).required(),
}).required();

const listAuditLogsQuerySchema = paginationQuerySchema.keys({
  entityType: Joi.string().valid("user", "product", "booking"),
  action: Joi.string().trim().max(80),
  actor: objectId("actor"),
  sort: Joi.string().valid("createdAt", "-createdAt", "action", "-action"),
});

const financeQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(90).default(7),
});

export const adminValidation = {
  statsQuery: { query: statsQuerySchema },
  listUsersQuery: { query: listUsersQuerySchema },
  userParams: { params: userParamsSchema },
  updateUserStatus: { body: updateUserStatusBodySchema },
  updateUserRole: { body: updateUserRoleBodySchema },
  updateOwnerActivity: { body: updateOwnerActivityBodySchema },
  productParams: { params: productParamsSchema },
  listProductsQuery: { query: listProductsQuerySchema },
  updateProductStatus: { body: updateProductStatusBodySchema },
  updateProductFeatured: { body: updateProductFeaturedBodySchema },
  bookingParams: { params: bookingParamsSchema },
  listBookingsQuery: { query: listBookingsQuerySchema },
  updateBookingStatus: { body: updateBookingStatusBodySchema },
  listAuditLogsQuery: { query: listAuditLogsQuerySchema },
  financeQuery: { query: financeQuerySchema },
};

export default adminValidation;
