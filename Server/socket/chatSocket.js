import { Server } from "socket.io";

import { authenticateSocketUser } from "./auth.js";
import {
  ensureSocketConversationAccessService,
  markConversationReadService,
  sendMessageService,
} from "../Services/chat.services.js";

export const registerChatSocket = (httpServer, allowedOrigins) => {
  // Creating Socket Server
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });
  // This runs before any socket connects. - Verifies JWT - Fetches user - Attaches user to socket.user
  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocketUser(socket);
      socket.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  });

  // Runs when a user successfully connects.
  io.on("connection", (socket) => {
    // Each user gets a private room
    const userId = String(socket.user._id);
    socket.join(`user:${userId}`);
    // User wants to join a chat
    socket.on("chat:join", async (payload = {}, ack) => {
      try {
        // Checks Conversation exists - User has permission
        const conversation = await ensureSocketConversationAccessService(
          payload.conversationId,
          socket.user
        );
        socket.join(`conversation:${conversation._id}`);
        // response
        ack?.({
          ok: true,
          conversationId: String(conversation._id),
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: error.message,
        });
      }
    });
    // Leave conversation
    socket.on("chat:leave", async (payload = {}, ack) => {
      if (payload.conversationId) {
        // Leave room
        socket.leave(`conversation:${payload.conversationId}`);
      }
      ack?.({ ok: true });
    });
    // Send message
    socket.on("chat:message:send", async (payload = {}, ack) => {
      try {
        const result = await sendMessageService(
          payload.conversationId,
          { text: payload.text },
          socket.user,
          io
        );
        ack?.({
          ok: true,
          message: result.message,
          conversation: result.conversation,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: error.message,
        });
      }
    });
// Mark coversation as read
    socket.on("chat:conversation:read", async (payload = {}, ack) => {
      try {
        const conversation = await markConversationReadService(
          payload.conversationId,
          socket.user,
          io
        );
        ack?.({
          ok: true,
          conversation,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: error.message,
        });
      }
    });
  });

  return io;
};

export default registerChatSocket;
