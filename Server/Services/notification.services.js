import Notification from "../models/Notification.js";
import AppError from "../utils/AppError.js";

const toNotificationDto = (notification) => ({
  _id: notification._id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  data: notification.data || {},
  isRead: Boolean(notification.isRead),
  readAt: notification.readAt || null,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

export const createAndEmitNotification = async ({
  io = null,
  userId,
  type,
  title,
  body = "",
  data = {},
  dedupe = null,
}) => {
  if (!userId) return null;

  let notification = null;

  if (dedupe?.enabled && dedupe?.key) {
    notification = await Notification.findOne({
      user: userId,
      type,
      isRead: false,
      "data.dedupeKey": dedupe.key,
    });
  }

  if (notification) {
    const currentCount = Number(notification?.data?.messageCount || 1);
    const nextCount = currentCount + 1;
    const actorLabel = dedupe?.actorLabel || "Someone";

    notification.title = nextCount > 1 ? "New messages" : title;
    notification.body =
      nextCount > 1
        ? `${actorLabel} sent you ${nextCount} messages.`
        : body;
    notification.data = {
      ...(notification.data || {}),
      ...(data || {}),
      dedupeKey: dedupe.key,
      messageCount: nextCount,
    };
    await notification.save();
  } else {
    notification = await Notification.create({
      user: userId,
      type,
      title,
      body,
      data: dedupe?.enabled
        ? {
            ...(data || {}),
            dedupeKey: dedupe.key,
            messageCount: 1,
          }
        : data,
    });
  }

  const unreadCount = await Notification.countDocuments({
    user: userId,
    isRead: false,
  });

  const payload = {
    notification: toNotificationDto(notification),
    unreadCount,
  };

  if (io) {
    io.to(`user:${String(userId)}`).emit("notification:new", payload);
  }

  return payload;
};

export const listMyNotificationsService = async (user, query = {}) => {
  const { page = 1, limit = 20 } = query;
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const filter = { user: user._id };

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);

  return {
    notifications: notifications.map(toNotificationDto),
    unreadCount,
    total,
    page: safePage,
    limit: safeLimit,
  };
};

export const markNotificationReadService = async (notificationId, user, io = null) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    user: user._id,
  });

  if (!notification) {
    throw new AppError("Notification not found.", 404);
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  const unreadCount = await Notification.countDocuments({
    user: user._id,
    isRead: false,
  });

  const payload = {
    notification: toNotificationDto(notification),
    unreadCount,
  };

  if (io) {
    io.to(`user:${String(user._id)}`).emit("notification:updated", payload);
  }

  return payload;
};

export const markAllNotificationsReadService = async (user, io = null) => {
  const now = new Date();

  await Notification.updateMany(
    { user: user._id, isRead: false },
    {
      $set: {
        isRead: true,
        readAt: now,
      },
    }
  );

  const unreadCount = 0;

  if (io) {
    io.to(`user:${String(user._id)}`).emit("notification:all-read", {
      unreadCount,
    });
  }

  return { unreadCount };
};
