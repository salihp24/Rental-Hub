import asyncHandler from "../utils/asyncHandler.js";
import {
  listMyNotificationsService,
  markAllNotificationsReadService,
  markNotificationReadService,
} from "../Services/notification.services.js";

const getIo = (req) => req.app.get("io") || null;

export const listMyNotifications = asyncHandler(async (req, res) => {
  const result = await listMyNotificationsService(req.user, req.query);

  res.status(200).json({
    status: "success",
    results: result.notifications.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    },
  });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const result = await markNotificationReadService(
    req.params.notificationId,
    req.user,
    getIo(req)
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsReadService(req.user, getIo(req));

  res.status(200).json({
    status: "success",
    data: result,
  });
});
