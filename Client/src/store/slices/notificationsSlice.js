import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../lib/api";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await api.get("/notifications", { params });
      return {
        notifications: res.data?.data?.notifications || [],
        unreadCount: Number(res.data?.data?.unreadCount || 0),
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Failed to load notifications"
      );
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  "notifications/markNotificationRead",
  async (notificationId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/notifications/${notificationId}/read`);
      return {
        notification: res.data?.data?.notification || null,
        unreadCount: Number(res.data?.data?.unreadCount || 0),
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Failed to mark notification as read"
      );
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllNotificationsRead",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.post("/notifications/read-all");
      return {
        unreadCount: Number(res.data?.data?.unreadCount || 0),
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || err.message || "Failed to mark all notifications as read"
      );
    }
  }
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: {
    items: [],
    unreadCount: 0,
    status: "idle",
    error: null,
  },
  reducers: {
    resetNotifications(state) {
      state.items = [];
      state.unreadCount = 0;
      state.status = "idle";
      state.error = null;
    },
    receiveLiveNotification(state, action) {
      const payload = action.payload || {};
      const incoming = payload.notification;
      if (!incoming?._id) return;

      const existingIdx = state.items.findIndex((item) => item._id === incoming._id);
      if (existingIdx >= 0) {
        state.items[existingIdx] = incoming;
      } else {
        state.items = [incoming, ...state.items].slice(0, 50);
      }

      state.unreadCount = Number(payload.unreadCount ?? state.unreadCount);
    },
    applyNotificationUpdate(state, action) {
      const payload = action.payload || {};
      const updated = payload.notification;

      if (updated?._id) {
        state.items = state.items.map((item) =>
          item._id === updated._id ? updated : item
        );
      }

      if (typeof payload.unreadCount === "number") {
        state.unreadCount = payload.unreadCount;
      }
    },
    applyAllRead(state, action) {
      const payload = action.payload || {};
      state.items = state.items.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || new Date().toISOString(),
      }));
      state.unreadCount = Number(payload.unreadCount || 0);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload.notifications || [];
        state.unreadCount = Number(action.payload.unreadCount || 0);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to load notifications";
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const updated = action.payload?.notification;
        if (updated?._id) {
          state.items = state.items.map((item) =>
            item._id === updated._id ? updated : item
          );
        }
        state.unreadCount = Number(action.payload?.unreadCount || 0);
      })
      .addCase(markAllNotificationsRead.fulfilled, (state, action) => {
        state.items = state.items.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        }));
        state.unreadCount = Number(action.payload?.unreadCount || 0);
      });
  },
});

export const {
  resetNotifications,
  receiveLiveNotification,
  applyNotificationUpdate,
  applyAllRead,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
