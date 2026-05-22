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
export const getAdminDashboardStatsService = async (query = {}) => {
  const now = new Date();
  const daysInput = Number(query.days || 30);
  const days = [7, 30, 90].includes(daysInput) ? daysInput : 30;
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
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

  const bookingsInRange = await Booking.find({
    createdAt: { $gte: rangeStart },
  }).select(
    "createdAt status paymentStatus pricingSnapshot.totalAmount pricingSnapshot.platformFee paymentDetails.refundAmount cancellation.refundAmount product"
  );

  const usersCreatedInRange = await User.find({
    createdAt: { $gte: rangeStart },
  }).select("createdAt");

  const usersActiveInRange = await User.find({
    lastLogin: { $gte: rangeStart },
  }).select("lastLogin");

  const trendMap = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(rangeStart);
    d.setDate(rangeStart.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, {
      date: key,
      revenue: 0,
      bookings: 0,
      users: 0,
      activeUsers: 0,
    });
  }

  const bookingStatusCounts = new Map();
  let grossVolume = 0;
  let platformRevenue = 0;
  let refundedPlatformFee = 0;
  let revenueBookingCount = 0;
  let refundCount = 0;
  let approvedCount = 0;

  for (const booking of bookingsInRange) {
    const key = new Date(booking.createdAt).toISOString().slice(0, 10);
    const entry = trendMap.get(key);
    if (entry) entry.bookings += 1;

    bookingStatusCounts.set(
      booking.status,
      (bookingStatusCounts.get(booking.status) || 0) + 1
    );

    const totalAmount = Number(booking.pricingSnapshot?.totalAmount || 0);
    const platformFee = Number(booking.pricingSnapshot?.platformFee || 0);
    const refundAmount = Number(
      booking.paymentDetails?.refundAmount || booking.cancellation?.refundAmount || 0
    );

    const isRevenueBooking = ["paid", "refunded", "partially_refunded"].includes(
      booking.paymentStatus
    );

    if (["confirmed", "active", "return_requested", "completed"].includes(booking.status)) {
      approvedCount += 1;
    }

    if (["refunded", "partially_refunded"].includes(booking.paymentStatus)) {
      refundCount += 1;
    }

    if (isRevenueBooking) {
      revenueBookingCount += 1;
      grossVolume += totalAmount;
      platformRevenue += platformFee;

      let bookingRefundedPlatformFee = 0;
      if (refundAmount > 0 && totalAmount > 0 && platformFee > 0) {
        bookingRefundedPlatformFee = platformFee * Math.min(refundAmount / totalAmount, 1);
        refundedPlatformFee += bookingRefundedPlatformFee;
      }

      if (entry) {
        entry.revenue += totalAmount;
      }
    }
  }

  for (const user of usersCreatedInRange) {
    const key = new Date(user.createdAt).toISOString().slice(0, 10);
    const entry = trendMap.get(key);
    if (entry) entry.users += 1;
  }

  for (const user of usersActiveInRange) {
    if (!user.lastLogin) continue;
    const key = new Date(user.lastLogin).toISOString().slice(0, 10);
    const entry = trendMap.get(key);
    if (entry) entry.activeUsers += 1;
  }

  const topCategoriesRaw = await Booking.aggregate([
    { $match: { createdAt: { $gte: rangeStart } } },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productDoc",
      },
    },
    { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: "categories",
        localField: "productDoc.category",
        foreignField: "_id",
        as: "categoryDoc",
      },
    },
    { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$productDoc.category",
        name: { $first: "$categoryDoc.name" },
        bookings: { $sum: 1 },
        revenue: { $sum: { $ifNull: ["$pricingSnapshot.totalAmount", 0] } },
      },
    },
    { $sort: { bookings: -1, revenue: -1 } },
    { $limit: 5 },
  ]);

  const totalRangeBookings = bookingsInRange.length;
  const paidBookings = bookingsInRange.filter((b) => b.paymentStatus === "paid").length;
  const netPlatformRevenue = platformRevenue - refundedPlatformFee;
  const bookingApprovalRate =
    totalRangeBookings > 0 ? (approvedCount / totalRangeBookings) * 100 : 0;
  const refundRate = totalRangeBookings > 0 ? (refundCount / totalRangeBookings) * 100 : 0;
  const avgBookingValue = revenueBookingCount > 0 ? grossVolume / revenueBookingCount : 0;

  const funnel = [
    { stage: "Total bookings", count: totalRangeBookings },
    { stage: "Approved", count: approvedCount },
    { stage: "Paid", count: paidBookings },
    { stage: "Completed", count: bookingsInRange.filter((b) => b.status === "completed").length },
  ].map((item, index, list) => {
    if (index === 0) return { ...item, rate: 100 };
    const base = list[0].count || 1;
    return { ...item, rate: (item.count / base) * 100 };
  });

  const bookingsByStatus = [
    "pending",
    "confirmed",
    "active",
    "return_requested",
    "completed",
    "cancelled",
    "rejected",
  ].map((status) => ({
    status,
    count: bookingStatusCounts.get(status) || 0,
  }));

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
    analytics: {
      days,
      startDate: rangeStart.toISOString(),
      endDate: now.toISOString(),
      kpis: {
        grossVolume: +grossVolume.toFixed(2),
        netPlatformRevenue: +netPlatformRevenue.toFixed(2),
        bookingApprovalRate: +bookingApprovalRate.toFixed(2),
        refundRate: +refundRate.toFixed(2),
        avgBookingValue: +avgBookingValue.toFixed(2),
        totalBookings: totalRangeBookings,
        paidBookings,
      },
      trends: Array.from(trendMap.values()).map((point) => ({
        ...point,
        revenue: +point.revenue.toFixed(2),
      })),
      bookingsByStatus,
      topCategories: topCategoriesRaw.map((item) => ({
        name: item.name || "Uncategorized",
        bookings: item.bookings || 0,
        revenue: +(item.revenue || 0).toFixed(2),
      })),
      funnel: funnel.map((item) => ({
        ...item,
        rate: +item.rate.toFixed(2),
      })),
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

export const updateAdminOwnerActivityService = async ({
  adminUser,
  targetUserId,
  suspended,
  reason = "",
}) => {
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError("User not found.", 404);
  }

  if (!targetUser.hasRole("owner")) {
    throw new AppError("Owner suspension can only be applied to users with owner role.", 400);
  }

  const before = {
    activitySuspended: Boolean(targetUser.ownerProfile?.activitySuspended),
    suspensionReason: targetUser.ownerProfile?.suspensionReason || "",
  };

  targetUser.ownerProfile = {
    ...targetUser.ownerProfile?.toObject?.(),
    activitySuspended: Boolean(suspended),
    suspensionReason: suspended ? reason.trim() : "",
    suspendedAt: suspended ? new Date() : null,
    suspendedBy: suspended ? adminUser._id : null,
  };

  await targetUser.save({ validateBeforeSave: false });

  await createAdminAuditLogService({
    actorId: adminUser._id,
    entityType: "user",
    entityId: targetUser._id,
    action: suspended ? "owner.activity.suspended" : "owner.activity.unsuspended",
    before,
    after: {
      activitySuspended: Boolean(targetUser.ownerProfile?.activitySuspended),
      suspensionReason: targetUser.ownerProfile?.suspensionReason || "",
    },
    meta: {
      targetUserEmail: targetUser.email,
      reason: reason || "",
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

  const allowedAdminOverrides = ["cancelled", "rejected"];
  if (!allowedAdminOverrides.includes(payload.status)) {
    throw new AppError("Admin can only set booking status to cancelled or rejected.", 400);
  }

  if (!payload.reason || String(payload.reason).trim().length < 10) {
    throw new AppError("A detailed reason (at least 10 characters) is required for admin overrides.", 400);
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

// Finance Dashboard - summary - receives query data from the API
export const getAdminFinanceSummaryService = async (query = {}) => {

  // Validate days
  const rawDays = Number(query.days || 7);
  const days = Number.isFinite(rawDays)
    ? Math.min(Math.max(rawDays, 1), 90)
    : 7;

    // Create start date
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (days - 1));
// Fetch booking
  const bookings = await Booking.find({
    createdAt: { $gte: startDate },
  }).select("createdAt paymentStatus pricingSnapshot paymentDetails cancellation");

// Initialize total values - store final values
  let grossVolume = 0;
  let platformRevenue = 0;
  let refundedAmount = 0;
  let refundedPlatformFee = 0;

  let paidCount = 0;
  let unpaidCount = 0;
  let refundedCount = 0;
  let partialRefundCount = 0;

  // revenue status - unpaid bookings are not counted as revenue
  const revenueStatuses = ["paid", "refunded", "partially_refunded"];

  // used to prepare daily finance data for chart/report.
  const trendMap = new Map(); 

// creates one empty record for every day
  for (let i = 0; i < days; i += 1) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);

    const key = day.toISOString().slice(0, 10);
// Even if there are no bookings on a day, that day will still appear with 0
    trendMap.set(key, {
      date: key,
      grossVolume: 0,
      platformRevenue: 0,
      refundedAmount: 0,
      refundedPlatformFee: 0,
      netPlatformRevenue: 0,
      bookings: 0,
      paidBookings: 0,
    });
  }

  // Loop through all bookings
  for (const booking of bookings) {

    // Get total booking amount
    const totalAmount = Number(booking.pricingSnapshot?.totalAmount || 0);
    const platformFee = Number(booking.pricingSnapshot?.platformFee || 0);

    // Get refund amount
    const refundAmount = Number(
      booking.paymentDetails?.refundAmount ||
        booking.cancellation?.refundAmount ||
        0
    );

    // Count payment statuses
    const paymentStatus = booking.paymentStatus;

    if (paymentStatus === "paid") paidCount += 1;
    if (paymentStatus === "unpaid") unpaidCount += 1;
    if (paymentStatus === "refunded") refundedCount += 1;
    if (paymentStatus === "partially_refunded") partialRefundCount += 1;

    // unpaid bookings are counted in booking count, but not in revenue
    const isRevenueBooking = revenueStatuses.includes(paymentStatus);

    // Calculate refunded platform fee
    let bookingRefundedPlatformFee = 0;

    // Check whether booking should count as revenue - true only for: paid, refunded, partially_refunded - adds revenue totals only if payment status is valid.
    if (isRevenueBooking) {
      grossVolume += totalAmount;
      platformRevenue += platformFee;
      refundedAmount += refundAmount;

      if (refundAmount > 0 && totalAmount > 0 && platformFee > 0) {
        const refundRatio = Math.min(refundAmount / totalAmount, 1);
        bookingRefundedPlatformFee = platformFee * refundRatio;
        refundedPlatformFee += bookingRefundedPlatformFee;
      }
    }

    // Add data to daily trend - This gets the date of the booking
    const key = new Date(booking.createdAt).toISOString().slice(0, 10);
    const item = trendMap.get(key);

    // Updates daily trend
    if (item) {
      // Counts all booking
      item.bookings += 1;

      if (isRevenueBooking) {
        item.grossVolume += totalAmount;
        item.platformRevenue += platformFee;
        item.refundedAmount += refundAmount;
        item.refundedPlatformFee += bookingRefundedPlatformFee;

        if (paymentStatus === "paid") {
          item.paidBookings += 1;
        }
      }
    }
  }

  // This gets the date of the booking - final actual platform earning after refund adjustment
  const netPlatformRevenue = platformRevenue - refundedPlatformFee;

  return {
    days,
    currency: "INR",

    totals: {
      grossVolume: +grossVolume.toFixed(2),
      platformRevenue: +platformRevenue.toFixed(2),
      refundedAmount: +refundedAmount.toFixed(2),
      refundedPlatformFee: +refundedPlatformFee.toFixed(2),
      netPlatformRevenue: +netPlatformRevenue.toFixed(2),
    },

    paymentStatusBreakdown: {
      paid: paidCount,
      unpaid: unpaidCount,
      refunded: refundedCount,
      partially_refunded: partialRefundCount,
    },

    trend: Array.from(trendMap.values()).map((item) => {
      const itemNetPlatformRevenue =
        item.platformRevenue - item.refundedPlatformFee;

      return {
        ...item,
        grossVolume: +item.grossVolume.toFixed(2),
        platformRevenue: +item.platformRevenue.toFixed(2),
        refundedAmount: +item.refundedAmount.toFixed(2),
        refundedPlatformFee: +item.refundedPlatformFee.toFixed(2),
        netPlatformRevenue: +itemNetPlatformRevenue.toFixed(2),
      };
    }),
  };
};
