import Booking from "../../models/Booking.js";
import Conversation from "../../models/Conversation.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import AppError from "../../utils/AppError.js";
import { createAdminAuditLogService, listAdminAuditLogsService } from "./adminAudit.services.js";

//remove unwanted fields
import { sanitiseUser } from "../../utils/auth.js";
import { updateBookingStatusService } from "../booking.services.js";


//just health check 
export const getAdminHealthService = async () => {
  return {
    ok: true,
    service: "admin",
    timestamp: new Date().toISOString(),
  };
};

//Admin dashboard stats
export const getAdminDashboardStatsService = async () => {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [totalUsers, activeUsers, totalProducts, activeProducts, featuredProducts, productsUnderReview, totalBookings, totalConversations, bookingsPending, bookingsActive, bookingsCompleted, newUsers7d, newProducts7d, newBookings7d] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      Product.countDocuments({}),
      Product.countDocuments({ status: "active" }),
      Product.countDocuments({ isFeatured: true }),
      Product.countDocuments({ status: "under_review" }),
      Booking.countDocuments({}),
      Conversation.countDocuments({}),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "active" }),
      Booking.countDocuments({ status: "completed" }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      Product.countDocuments({ createdAt: { $gte: last7Days } }),
      Booking.countDocuments({ createdAt: { $gte: last7Days } }),
    ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    products: {
      total: totalProducts,
      active: activeProducts,
      featured: featuredProducts,
      underReview: productsUnderReview,
    },
    bookings: {
      total: totalBookings,
      pending: bookingsPending,
      active: bookingsActive,
      completed: bookingsCompleted,
    },
    chat: {
      conversations: totalConversations,
    },
    growth: {
      users7d: newUsers7d,
      products7d: newProducts7d,
      bookings7d: newBookings7d,
    },
  };
};


//List users  - Pagination, search, role filter, active/inactive filter, sorting
export const listAdminUsersService = async (query = {}) => {
  const { page = 1, limit = 10, search, role, isActive, sort } = query;
  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (typeof isActive === "boolean") {
    filter.isActive = isActive;
  }
// For search user by name, email, phone
  if (search) {
    filter.$or = [
      // regex for partial match
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
// If no sort is provided, newest users come first
  const skip = (Number(page) - 1) * Number(limit);
  const sortBy = sort || "-createdAt";

  // Fetch total users based on filter, count total matching users
  const [users, total] = await Promise.all([
    User.find(filter).sort(sortBy).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map((user) => sanitiseUser(user)),
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

// For activate or deactivate a user
export const updateAdminUserStatusService = async ({ adminUser, targetUserId, isActive }) => {
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError("User not found.", 404);
  }

  // For safety - Prevent Admin From Deactivating Own Account
  if (String(targetUser._id) === String(adminUser._id) && isActive === false) {
    throw new AppError("You cannot deactivate your own account.", 400);
  }
// Prevent Deactivating Last Active Admin
  if (targetUser.hasRole("admin") && targetUser.isActive && isActive === false) {
    const activeAdminCount = await User.countDocuments({
      role: "admin",
      isActive: true,
    });

    if (activeAdminCount <= 1) {
      throw new AppError("You cannot deactivate the last active admin.", 400);
    }
  }

  // This updates the user's active status.
  const before = {
    isActive: targetUser.isActive,
    role: targetUser.role,
  };

  targetUser.isActive = isActive;
  await targetUser.save({ validateBeforeSave: false });

  await createAdminAuditLogService({
    actorId: adminUser._id,
    entityType: "user",
    entityId: targetUser._id,
    action: "user.status.updated",
    before,
    after: {
      isActive: targetUser.isActive,
      role: targetUser.role,
    },
    meta: {
      targetUserEmail: targetUser.email,
    },
  });

  return sanitiseUser(targetUser);
};

export const updateAdminUserRoleService = async ({ adminUser, targetUserId, role }) => {
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError("User not found.", 404);
  }

  const before = {
    role: targetUser.role,
    isActive: targetUser.isActive,
  };

  if (String(targetUser._id) === String(adminUser._id) && !role.includes("admin")) {
    throw new AppError("You cannot remove your own admin role.", 400);
  }

  if (targetUser.hasRole("admin") && !role.includes("admin")) {
    const activeAdminCount = await User.countDocuments({
      role: "admin",
      isActive: true,
    });
    if (targetUser.isActive && activeAdminCount <= 1) {
      throw new AppError("You cannot remove admin role from the last active admin.", 400);
    }
  }

  targetUser.role = role;
  await targetUser.save({ validateBeforeSave: false });

  await createAdminAuditLogService({
    actorId: adminUser._id,
    entityType: "user",
    entityId: targetUser._id,
    action: "user.role.updated",
    before,
    after: {
      role: targetUser.role,
      isActive: targetUser.isActive,
    },
    meta: {
      targetUserEmail: targetUser.email,
    },
  });

  return sanitiseUser(targetUser);
};

// Lists products in admin side 
export const listAdminProductsService = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    owner,
    category,
    city,
    state,
    sort,
  } = query;

  // used for MongoDB query
  const filter = {};

  if (status) filter.status = status;
  if (owner) filter.owner = owner;
  if (category) filter.category = category;
  if (city) filter["location.city"] = { $regex: city, $options: "i" };
  if (state) filter["location.state"] = { $regex: state, $options: "i" };
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const sortBy = sort || "-createdAt";

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("-blockedDates -__v")
      .populate("owner", "name email phone isActive role")
      .populate("category", "name slug")
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

// allows admin to change product status
export const updateAdminProductStatusService = async ({
  productId,
  status,
  reviewNote,
  rejectionReason,
  adminUser,
}) => {
  const product = await Product.findById(productId).populate("owner", "name email");

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  const before = {
    status: product.status,
    moderation: product.moderation || null,
  };
  product.status = status;
  product.moderation = {
    ...product.moderation?.toObject?.(),
    reviewedBy: adminUser._id,
    reviewedAt: new Date(),
    reviewNote: reviewNote || "",
    rejectionReason: status === "inactive" ? rejectionReason || "" : "",
  };
  await product.save();

  await createAdminAuditLogService({
    actorId: adminUser._id,
    entityType: "product",
    entityId: product._id,
    action: "product.status.updated",
    before,
    after: {
      status: product.status,
      moderation: product.moderation || null,
    },
    meta: {
      productTitle: product.title,
      ownerEmail: product.owner?.email || "",
      reviewNote: reviewNote || "",
      rejectionReason: status === "inactive" ? rejectionReason || "" : "",
    },
  });

  return product;
};

export const updateAdminProductFeaturedService = async ({ productId, isFeatured, adminUser }) => {
  const product = await Product.findById(productId).populate("owner", "name email");

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  const before = { isFeatured: product.isFeatured };
  product.isFeatured = isFeatured;
  await product.save();

  await createAdminAuditLogService({
    actorId: adminUser._id,
    entityType: "product",
    entityId: product._id,
    action: "product.featured.updated",
    before,
    after: { isFeatured: product.isFeatured },
    meta: {
      productTitle: product.title,
      ownerEmail: product.owner?.email || "",
    },
  });

  return product;
};

// used to show bookings in the admin panel
export const listAdminBookingsService = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    paymentStatus,
    renter,
    owner,
    product,
    orderCode,
    startDateFrom,
    startDateTo,
    endDateFrom,
    endDateTo,
    createdFrom,
    createdTo,
    sort,
  } = query;
  const filter = {};

  // conditions are added only if query values are present.
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (renter) filter.renter = renter;
  if (owner) filter.owner = owner;
  if (product) filter.product = product;
  if (orderCode) filter.orderCode = { $regex: orderCode, $options: "i" };
  if (startDateFrom || startDateTo) {
    filter.startDate = {};
    if (startDateFrom) filter.startDate.$gte = new Date(startDateFrom);
    if (startDateTo) filter.startDate.$lte = new Date(startDateTo);
  }
  if (endDateFrom || endDateTo) {
    filter.endDate = {};
    if (endDateFrom) filter.endDate.$gte = new Date(endDateFrom);
    if (endDateTo) filter.endDate.$lte = new Date(endDateTo);
  }
  if (createdFrom || createdTo) {
    filter.createdAt = {};
    if (createdFrom) filter.createdAt.$gte = new Date(createdFrom);
    if (createdTo) filter.createdAt.$lte = new Date(createdTo);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortBy = sort || "-createdAt";

  // Fetch bookings and total count
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("product", "title slug images")
      .populate("renter", "name email avatar")
      .populate("owner", "name email avatar")
      .populate("cancellation.cancelledBy", "name email")
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit)),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

// Lets admin update booking status by reusing existing booking update logic.
export const updateAdminBookingStatusService = async ({ bookingId, payload, adminUser }) =>
{
  const booking = await Booking.findById(bookingId).select(
    "status paymentStatus orderCode renter owner product"
  );

  if (!booking) {
    throw new AppError("Booking not found.", 404);
  }

  const before = {
    status: booking.status,
    paymentStatus: booking.paymentStatus,
  };

  const updatedBooking = await updateBookingStatusService(bookingId, payload, adminUser);

  await createAdminAuditLogService({
    actorId: adminUser._id,
    entityType: "booking",
    entityId: booking._id,
    action: "booking.status.updated",
    before,
    after: {
      status: updatedBooking.status,
      paymentStatus: updatedBooking.paymentStatus,
    },
    meta: {
      orderCode: updatedBooking.orderCode,
      reason: payload.reason || "",
    },
  });

  return updatedBooking;
};

export const listAdminAuditLogsSummaryService = async (query = {}) =>
  listAdminAuditLogsService(query);
