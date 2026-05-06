import express from "express";

import {
  getAdminDashboardStats,
  getAdminHealth,
  listAdminAuditLogs,
  listAdminBookings,
  listAdminProducts,
  listAdminUsers,
  updateAdminBookingStatus,
  updateAdminProductFeatured,
  updateAdminProductStatus,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../../controllers/admin/adminController.js";
import isAdmin from "../../middleware/admin/isAdmin.js";
import protect from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import { adminValidation } from "../../validation/index.js";

const router = express.Router();

router.use(protect, isAdmin);

router.get("/health", getAdminHealth);
router.get("/stats", validate(adminValidation.statsQuery), getAdminDashboardStats);
router.get("/users", validate(adminValidation.listUsersQuery), listAdminUsers);
router.patch(
  "/users/:userId/status",
  validate({ ...adminValidation.userParams, ...adminValidation.updateUserStatus }),
  updateAdminUserStatus
);
router.patch(
  "/users/:userId/role",
  validate({ ...adminValidation.userParams, ...adminValidation.updateUserRole }),
  updateAdminUserRole
);
router.get("/products", validate(adminValidation.listProductsQuery), listAdminProducts);
router.patch(
  "/products/:productId/status",
  validate({ ...adminValidation.productParams, ...adminValidation.updateProductStatus }),
  updateAdminProductStatus
);
router.patch(
  "/products/:productId/featured",
  validate({ ...adminValidation.productParams, ...adminValidation.updateProductFeatured }),
  updateAdminProductFeatured
);
router.get("/bookings", validate(adminValidation.listBookingsQuery), listAdminBookings);
router.patch(
  "/bookings/:bookingId/status",
  validate({ ...adminValidation.bookingParams, ...adminValidation.updateBookingStatus }),
  updateAdminBookingStatus
);
router.get("/audit-logs", validate(adminValidation.listAuditLogsQuery), listAdminAuditLogs);

export default router;
