import asyncHandler from "../utils/asyncHandler.js";
import {
  createConversationService,
  getConversationByIdService,
  listConversationMessagesService,
  listMyConversationsService,
  markConversationReadService,
  respondToOfferService,
  sendOfferService,
  sendMessageService,
} from "../Services/chat.services.js";

//Gets Socket.IO instance from Express app
const getIo = (req) => req.app.get("io") || null;

// Gets all conversations for logged-in user
export const listMyConversations = asyncHandler(async (req, res) => {
  const result = await listMyConversationsService(req.user, req.query);

  res.status(200).json({
    status: "success",
    results: result.conversations.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      conversations: result.conversations,
    },
  });
});

// Creates a new chat
export const createConversation = asyncHandler(async (req, res) => {
  const conversation = await createConversationService(req.body, req.user);

  res.status(201).json({
    status: "success",
    data: { conversation },
  });
});

// Fetch single conversation
export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await getConversationByIdService(req.params.conversationId, req.user);

  res.status(200).json({
    status: "success",
    data: { conversation },
  });
});

// Get messages of a conversation
export const listMessages = asyncHandler(async (req, res) => {
  const result = await listConversationMessagesService(
    req.params.conversationId,
    req.user,
    req.query
  );

  res.status(200).json({
    status: "success",
    results: result.messages.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: {
      messages: result.messages,
    },
  });
});

// Sends a message in a conversation
export const sendMessage = asyncHandler(async (req, res) => {
  const result = await sendMessageService(
    req.params.conversationId,
    req.body,
    req.user,
    getIo(req)
  );

  res.status(201).json({
    status: "success",
    data: result,
  });
});

export const sendOffer = asyncHandler(async (req, res) => {
  const result = await sendOfferService(
    req.params.conversationId,
    req.body,
    req.user,
    getIo(req)
  );

  res.status(201).json({
    status: "success",
    data: result,
  });
});

export const respondToOffer = asyncHandler(async (req, res) => {
  const result = await respondToOfferService(
    req.params.conversationId,
    req.params.messageId,
    req.body,
    req.user,
    getIo(req)
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
});

// Marks chat as read
export const markConversationRead = asyncHandler(async (req, res) => {
  const conversation = await markConversationReadService(
    req.params.conversationId,
    req.user,
    getIo(req)
  );

  res.status(200).json({
    status: "success",
    data: { conversation },
  });
});
