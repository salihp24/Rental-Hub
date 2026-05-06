import asyncHandler from "../../utils/asyncHandler.js";
import {
  getAdminDashboardStatsService,
  getAdminHealthService,
  listAdminBookingsService,
  listAdminAuditLogsSummaryService,
  listAdminProductsService,
  listAdminUsersService,
  updateAdminBookingStatusService,
  updateAdminProductStatusService,
  updateAdminProductFeaturedService,
  updateAdminUserRoleService,
  updateAdminUserStatusService,
} from "../../Services/admin/admin.services.js";


//just for checking health
export const getAdminHealth = asyncHandler(async (req, res) => {
  const health = await getAdminHealthService();

  res.status(200).json({
    status: "success",
    data: {
      admin: health,
    },
  });
});


//dashboard stats 
export const getAdminDashboardStats = asyncHandler(async (req, res) => {
  const stats = await getAdminDashboardStatsService();

  res.status(200).json({
    status: "success",
    data: {
      stats,
    },
  });
});

// List users
export const listAdminUsers = asyncHandler(async (req, res) => {
  const result = await listAdminUsersService(req.query);

  res.status(200).json({
    status: "success",
    results: result.users.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      users: result.users,
    },
  });
});

export const updateAdminUserStatus = asyncHandler(async (req, res) => {
  const user = await updateAdminUserStatusService({
    adminUser: req.user,
    targetUserId: req.params.userId,
    isActive: req.body.isActive,
  });

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

export const updateAdminUserRole = asyncHandler(async (req, res) => {
  const user = await updateAdminUserRoleService({
    adminUser: req.user,
    targetUserId: req.params.userId,
    role: req.body.role,
  });

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

export const listAdminProducts = asyncHandler(async (req, res) => {
  const result = await listAdminProductsService(req.query);

  res.status(200).json({
    status: "success",
    results: result.products.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      products: result.products,
    },
  });
});

export const updateAdminProductStatus = asyncHandler(async (req, res) => {
  const product = await updateAdminProductStatusService({
    productId: req.params.productId,
    status: req.body.status,
    reviewNote: req.body.reviewNote,
    rejectionReason: req.body.rejectionReason,
    adminUser: req.user,
  });

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

export const updateAdminProductFeatured = asyncHandler(async (req, res) => {
  const product = await updateAdminProductFeaturedService({
    productId: req.params.productId,
    isFeatured: req.body.isFeatured,
    adminUser: req.user,
  });

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

export const listAdminBookings = asyncHandler(async (req, res) => {
  const result = await listAdminBookingsService(req.query);

  res.status(200).json({
    status: "success",
    results: result.bookings.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      bookings: result.bookings,
    },
  });
});

export const updateAdminBookingStatus = asyncHandler(async (req, res) => {
  const booking = await updateAdminBookingStatusService({
    bookingId: req.params.bookingId,
    payload: req.body,
    adminUser: req.user,
  });

  res.status(200).json({
    status: "success",
    data: {
      booking,
    },
  });
});

export const listAdminAuditLogs = asyncHandler(async (req, res) => {
  const result = await listAdminAuditLogsSummaryService(req.query);

  res.status(200).json({
    status: "success",
    results: result.logs.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      logs: result.logs,
    },
  });
});
