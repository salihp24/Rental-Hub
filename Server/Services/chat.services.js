import Booking from "../models/Booking.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { computePricing } from "../utils/Pricing.js";

//What extra data should be fetched along with conversation/message - Instead of just userId we get → name, email, avatar
const CONVERSATION_POPULATE = [
  { path: "participants", select: "name email avatar role" },
  { path: "createdBy", select: "name email avatar" },
  { path: "booking", select: "orderCode status startDate endDate paymentStatus totalDays renter owner product pricingSnapshot" },
  { path: "product", select: "title slug images location.city location.state owner pricing" },
  { path: "lastMessage", populate: { path: "sender", select: "name email avatar" } },
  { path: "participantStates.user", select: "name email avatar" },
  { path: "negotiation.activeOffer", populate: { path: "sender", select: "name email avatar" } },
  { path: "negotiation.acceptedOffer", populate: { path: "sender", select: "name email avatar" } },
];

const MESSAGE_POPULATE = [{ path: "sender", select: "name email avatar role" }];

//Removes duplicate user IDs - in case
const dedupeObjectIds = (values = []) => [
  ...new Set(values.filter(Boolean).map((value) => String(value))),
];

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

//Is this user part of the conversation?
const isParticipant = (conversation, userId) =>
  conversation.participants.some((participantId) => toIdString(participantId) === String(userId));

//Security check: Admin → allowed - Participant → allowed
const ensureConversationAccess = (conversation, user) => {
  if (user.hasRole("admin")) return;

  if (!isParticipant(conversation, user._id)) {
    throw new AppError("You do not have access to this conversation.", 403);
  }
};

const getOrCreateParticipantStates = (participantIds) =>
  participantIds.map((participantId) => ({
    user: participantId,
    unreadCount: 0,
    lastReadAt: null,
  }));

//Every participant has a state - No mismatch between participants & states
const syncParticipantStates = (conversation) => {
  const currentMap = new Map(
    (conversation.participantStates || []).map((state) => [String(state.user), state])
  );

  conversation.participantStates = conversation.participants.map((participantId) => {
    const existing = currentMap.get(String(participantId));
    return (
      existing || {
        user: participantId,
        unreadCount: 0,
        lastReadAt: null,
      }
    );
  });
};

//When a message is sent: Sender → unread = 0, Others → unread +1
const touchUnreadCounts = (conversation, senderId) => {
  syncParticipantStates(conversation);

  for (const state of conversation.participantStates) {
    if (String(state.user) === String(senderId)) {
      state.unreadCount = 0;
      state.lastReadAt = new Date();
      continue;
    }

    state.unreadCount = Number(state.unreadCount || 0) + 1;
  }
};

//user open chat - unread 0, lastread now
const markConversationReadState = (conversation, userId) => {
  syncParticipantStates(conversation);

  const state = conversation.participantStates.find(
    (item) => String(item.user) === String(userId)
  );
  if (state) {
    state.unreadCount = 0;
    state.lastReadAt = new Date();
  }
};

//Returns simplified conversation for UI: last message, unread count, participants
const buildConversationSummary = (conversation, viewerId) => {
  const participantState = (conversation.participantStates || []).find(
    (state) => String(state.user?._id || state.user) === String(viewerId)
  );

  return {
    _id: conversation._id,
    title: conversation.title,
    participants: conversation.participants,
    booking: conversation.booking,
    product: conversation.product,
    lastMessage: conversation.lastMessage,
    lastMessageText: conversation.lastMessageText,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: participantState?.unreadCount || 0,
    isActive: conversation.isActive,
    negotiation: conversation.negotiation || null,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
  };
};

const populateConversationById = (conversationId) =>
  Conversation.findById(conversationId).populate(CONVERSATION_POPULATE);

const populateMessageById = (messageId) =>
  Message.findById(messageId).populate(MESSAGE_POPULATE);

const ensureUsersExist = async (userIds) => {
  const count = await User.countDocuments({ _id: { $in: userIds }, isActive: true });
  if (count !== userIds.length) {
    throw new AppError("One or more chat participants were not found.", 404);
  }
};

//Sends real-time update to each user via Socket.IO
const emitConversationUpdate = (io, conversation) => {
  for (const participant of conversation.participants) {
    io.to(`user:${participant._id || participant}`).emit("chat:conversation:updated", {
      conversation: buildConversationSummary(conversation, participant._id || participant),
    });
  }
};

const buildOfferText = (amount, currency) =>
  `Price proposal: ${currency} ${Number(amount).toFixed(2)}.`;

const UNIT_LABEL = {
  hourly: "hour",
  daily: "day",
  weekly: "week",
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toUtcDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid offer date.", 400);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid offer date.", 400);
  }

  return date;
};

const dayDiff = (startDate, endDate) =>
  Math.round((endDate.getTime() - startDate.getTime()) / DAY_IN_MS);

const hourDiff = (startDate, endDate) =>
  +((endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000)).toFixed(2);

const normalizeOfferWindow = (startDate, endDate, pricingUnit = "daily") => {
  if (pricingUnit === "hourly") {
    return { start: toDateTime(startDate), end: toDateTime(endDate) };
  }
  return { start: toUtcDateOnly(startDate), end: toUtcDateOnly(endDate) };
};

const getOfferTotalUnits = (startDate, endDate, pricingUnit = "daily") => {
  const totalDays = pricingUnit === "hourly" ? +(hourDiff(startDate, endDate) / 24).toFixed(2) : dayDiff(startDate, endDate);
  const totalHours = pricingUnit === "hourly" ? hourDiff(startDate, endDate) : totalDays * 24;
  if (pricingUnit === "hourly") return totalHours;
  if (pricingUnit === "weekly") return Math.ceil(totalDays / 7);
  return totalDays;
};

const ensureNegotiationConversation = (conversation) => {
  if (!conversation.product) {
    throw new AppError("Negotiation is only available when a product is linked to the conversation.", 400);
  }

  if (
    conversation.booking &&
    !["pending", "confirmed"].includes(conversation.booking.status)
  ) {
    throw new AppError("Negotiation is no longer available for this booking.", 400);
  }

  if (conversation.booking?.paymentStatus === "paid") {
    throw new AppError("Negotiation is not available after payment is completed.", 400);
  }
};

const getConversationOwnerId = (conversation) =>
  String(
    conversation.booking?.owner?._id ||
      conversation.booking?.owner ||
      conversation.product?.owner?._id ||
      conversation.product?.owner ||
      ""
  );

const getConversationCounterpartyId = (conversation, userId) =>
  conversation.participants.find((participantId) => toIdString(participantId) !== String(userId));

const emitMessageAndConversation = async (io, conversationId, messageId) => {
  const [populatedConversation, populatedMessage] = await Promise.all([
    populateConversationById(conversationId),
    populateMessageById(messageId),
  ]);

  if (io && populatedConversation && populatedMessage) {
    io.to(`conversation:${conversationId}`).emit("chat:message", {
      conversationId: String(conversationId),
      message: populatedMessage,
    });
    emitConversationUpdate(io, populatedConversation);
  }

  return {
    conversation: populatedConversation,
    message: populatedMessage,
  };
};

//Gets all conversations for a user - Pagination (page, limit) - Filters: booking, product, Sorted by latest activity
export const listMyConversationsService = async (user, query = {}) => {
  const { page = 1, limit = 20, booking, product } = query;
  const filter = {};

  if (!user.hasRole("admin")) {
    filter.participants = user._id;
  }
  if (booking) filter.booking = booking;
  if (product) filter.product = product;

  const skip = (Number(page) - 1) * Number(limit);

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .populate(CONVERSATION_POPULATE)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Conversation.countDocuments(filter),
  ]);

  return {
    conversations: conversations.map((conversation) =>
      buildConversationSummary(conversation, user._id)
    ),
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

//Creates a new chat
export const createConversationService = async (payload, user) => {
  //Booking chat - Prevents duplicates - Only renter/owner/admin allowed - Only ONE conversation per booking
  //Normal chat - Requires at least 2 users - Validates users exist - Optional product link
  if (payload.bookingId) {
    const booking = await Booking.findById(payload.bookingId).select("renter owner product");

    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    const allowed =
      user.hasRole("admin") ||
      String(booking.renter) === String(user._id) ||
      String(booking.owner) === String(user._id);

    if (!allowed) {
      throw new AppError("You cannot start a chat for this booking.", 403);
    }

    const existingConversation = await Conversation.findOne({ booking: booking._id }).populate(
      CONVERSATION_POPULATE
    );
    if (existingConversation) {
      return existingConversation;
    }

    const conversation = await Conversation.create({
      participants: [booking.renter, booking.owner],
      participantStates: getOrCreateParticipantStates([booking.renter, booking.owner]),
      booking: booking._id,
      product: booking.product || payload.productId || null,
      createdBy: user._id,
      title: payload.title || "",
    });

    return populateConversationById(conversation._id);
  }

  let participantIds = dedupeObjectIds([user._id, ...(payload.participantIds || [])]);
  if (payload.productId) {
    const product = await Product.findById(payload.productId).select("_id owner");
    if (!product) {
      throw new AppError("Product not found.", 404);
    }

    if (String(product.owner) === String(user._id)) {
      throw new AppError("You cannot start a product chat with yourself.", 400);
    }

    participantIds = dedupeObjectIds([user._id, product.owner]);
  }

  if (participantIds.length < 2) {
    throw new AppError("A conversation needs at least two participants.", 400);
  }

  await ensureUsersExist(participantIds);

  const conversation = await Conversation.create({
    participants: participantIds,
    participantStates: getOrCreateParticipantStates(participantIds),
    product: payload.productId || null,
    createdBy: user._id,
    title: payload.title || "",
  });

  return populateConversationById(conversation._id);
};

//Fetch one conversation - Also checks access
export const getConversationByIdService = async (conversationId, user) => {
  const conversation = await populateConversationById(conversationId);

  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);
  return conversation;
};

//Get messages of a conversation - Pagination - Sorted newest → reversed for UI
export const listConversationMessagesService = async (conversationId, user, query = {}) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);

  const { page = 1, limit = 50 } = query;
  const skip = (Number(page) - 1) * Number(limit);

  const [messages, total] = await Promise.all([
    Message.find({ conversation: conversation._id })
      .populate(MESSAGE_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Message.countDocuments({ conversation: conversation._id }),
  ]);

  return {
    messages: messages.reverse(),
    total,
    page: Number(page),
    limit: Number(limit),
  };
};

//Validate conversation - Exists? - User allowed?
export const sendMessageService = async (conversationId, payload, user, io = null) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);

  try {
    //Create message - sender - text - readBy (sender already read it)
    const message = await Message.create({
      conversation: conversation._id,
      sender: user._id,
      type: "text",
      text: payload.text,
      readBy: [{ user: user._id, readAt: new Date() }],
    });

    // update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageText = payload.text;
    conversation.lastMessageAt = message.createdAt;

    //Update unread counts
    touchUnreadCounts(conversation, user._id);
    await conversation.save();
    // populate data
    const [populatedConversation, populatedMessage] = await Promise.all([
      populateConversationById(conversation._id),
      populateMessageById(message._id),
    ]);

    if (io && populatedConversation && populatedMessage) {
      //Sends message instantly to users
      io.to(`conversation:${conversation._id}`).emit("chat:message", {
        conversationId: String(conversation._id),
        message: populatedMessage,
      });
      emitConversationUpdate(io, populatedConversation);
    }

    return {
      conversation: populatedConversation,
      message: populatedMessage,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || "Could not send message.", 500);
  }
};

export const sendOfferService = async (conversationId, payload, user, io = null) => {
  const conversation = await Conversation.findById(conversationId).populate(CONVERSATION_POPULATE);
  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);
  ensureNegotiationConversation(conversation);

  if (String(user._id) === getConversationOwnerId(conversation)) {
    throw new AppError("Only the renter can start a price proposal.", 403);
  }

  const currentOfferId = conversation.negotiation?.activeOffer;
  if (currentOfferId) {
    const currentOffer = await Message.findById(currentOfferId);
    if (currentOffer?.offer?.status === "pending") {
      throw new AppError("There is already a pending price proposal in this conversation.", 400);
    }
  }

  const currency = conversation.product?.pricing?.currency || "INR";
  const pricingUnit = payload.pricingUnit || conversation.booking?.pricingUnit || "daily";
  if (!conversation.booking && (!payload.startDate || !payload.endDate)) {
    throw new AppError("startDate and endDate are required for product-level negotiation offers.", 400);
  }
  const offerWindow = conversation.booking
    ? normalizeOfferWindow(
        conversation.booking.startDate,
        conversation.booking.endDate,
        conversation.booking.pricingUnit || "daily"
      )
    : normalizeOfferWindow(payload.startDate, payload.endDate, pricingUnit);
  const totalUnits = conversation.booking
    ? Number(conversation.booking.totalUnits || 0)
    : getOfferTotalUnits(offerWindow.start, offerWindow.end, pricingUnit);

  const message = await Message.create({
    conversation: conversation._id,
    sender: user._id,
    type: "offer",
    text: buildOfferText(payload.amount, currency),
    offer: {
      amount: payload.amount,
      currency,
      status: "pending",
      proposedBy: user._id,
      booking: conversation.booking?._id || null,
      product: conversation.product?._id || null,
      startDate: offerWindow.start,
      endDate: offerWindow.end,
      pricingUnit,
      totalUnits,
    },
    readBy: [{ user: user._id, readAt: new Date() }],
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageText = `Offered ${currency} ${Number(payload.amount).toFixed(2)} per ${UNIT_LABEL[pricingUnit] || "unit"}`;
  conversation.lastMessageAt = message.createdAt;
  conversation.negotiation = {
    ...(conversation.negotiation || {}),
    activeOffer: message._id,
    acceptedOffer: conversation.negotiation?.acceptedOffer || null,
    finalDailyRate: conversation.negotiation?.finalDailyRate ?? null,
    currency,
    status: "pending",
    updatedAt: new Date(),
  };

  touchUnreadCounts(conversation, user._id);
  await conversation.save();

  return emitMessageAndConversation(io, conversation._id, message._id);
};

export const respondToOfferService = async (
  conversationId,
  messageId,
  payload,
  user,
  io = null
) => {
  const conversation = await Conversation.findById(conversationId).populate(CONVERSATION_POPULATE);
  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);
  ensureNegotiationConversation(conversation);

  const offerMessage = await Message.findOne({
    _id: messageId,
    conversation: conversation._id,
    type: "offer",
  });

  if (!offerMessage) {
    throw new AppError("Offer not found.", 404);
  }

  if (offerMessage.offer?.status !== "pending") {
    throw new AppError("This offer has already been finalized.", 400);
  }

  const ownerId = getConversationOwnerId(conversation);
  const renterId = String(getConversationCounterpartyId(conversation, ownerId) || "");
  const currentUserId = String(user._id);
  const action = payload.action;

  if (action === "accepted" || action === "rejected") {
    if (currentUserId !== ownerId) {
      throw new AppError("Only the product owner can accept or reject a price proposal.", 403);
    }
  }

  if (action === "cancelled") {
    if (currentUserId !== renterId && currentUserId !== String(offerMessage.offer?.proposedBy)) {
      throw new AppError("Only the renter can cancel this price proposal.", 403);
    }
  }

  offerMessage.offer.status = action;
  offerMessage.offer.respondedBy = user._id;
  offerMessage.offer.respondedAt = new Date();

  const currency = offerMessage.offer.currency || conversation.product?.pricing?.currency || "INR";
  const amount = Number(offerMessage.offer.amount || 0);
  const pricingUnit = offerMessage.offer.pricingUnit || conversation.booking?.pricingUnit || "daily";
  const totalUnits =
    Number(offerMessage.offer.totalUnits || 0) ||
    Number(conversation.booking?.totalUnits || conversation.booking?.totalDays || 0);

  if (action === "accepted") {
    if (
      conversation.booking?._id &&
      (conversation.booking.pricingUnit || "daily") !== pricingUnit
    ) {
      throw new AppError("Offer pricing unit does not match the booking pricing unit.", 400);
    }

    offerMessage.text = `Price proposal accepted: ${currency} ${amount.toFixed(2)} per ${pricingUnit}.`;
    conversation.negotiation = {
      ...(conversation.negotiation || {}),
      activeOffer: null,
      acceptedOffer: offerMessage._id,
      finalRate: amount,
      finalPricingUnit: pricingUnit,
      finalDailyRate: amount,
      currency,
      status: "accepted",
      updatedAt: new Date(),
    };
    conversation.lastMessageText = `Accepted ${currency} ${amount.toFixed(2)} per ${pricingUnit}`;

    if (conversation.booking?._id) {
      const [booking, product] = await Promise.all([
        Booking.findById(conversation.booking._id),
        Product.findById(conversation.product?._id).select("pricing"),
      ]);

      if (!booking || !product) {
        throw new AppError("Could not apply negotiated price to the booking.", 404);
      }

      booking.pricingSnapshot = {
        ...computePricing(product.pricing, totalUnits, {
          baseRateOverride: amount,
          currencyOverride: currency,
          pricingUnit,
        }),
        negotiatedRate: amount,
        isNegotiated: true,
        negotiatedFromOffer: offerMessage._id,
      };

      await booking.save();
    }
  } else if (action === "rejected") {
    offerMessage.text = `Price proposal rejected: ${currency} ${amount.toFixed(2)} per ${pricingUnit}.`;
    conversation.negotiation = {
      ...(conversation.negotiation || {}),
      activeOffer: null,
      status: conversation.negotiation?.acceptedOffer ? "accepted" : "rejected",
      updatedAt: new Date(),
    };
    conversation.lastMessageText = `Rejected ${currency} ${amount.toFixed(2)} per ${pricingUnit}`;
  } else {
    offerMessage.text = `Price proposal cancelled: ${currency} ${amount.toFixed(2)} per ${pricingUnit}.`;
    conversation.negotiation = {
      ...(conversation.negotiation || {}),
      activeOffer: null,
      status: conversation.negotiation?.acceptedOffer ? "accepted" : "none",
      updatedAt: new Date(),
    };
    conversation.lastMessageText = `Cancelled ${currency} ${amount.toFixed(2)} per ${pricingUnit}`;
  }

  await offerMessage.save();

  conversation.lastMessage = offerMessage._id;
  conversation.lastMessageAt = new Date();
  touchUnreadCounts(conversation, user._id);
  await conversation.save();

  return emitMessageAndConversation(io, conversation._id, offerMessage._id);
};

export const getAcceptedNegotiationForBookingService = async ({
  productId,
  renterId,
  ownerId,
  bookingId = null,
  startDate = null,
  endDate = null,
  pricingUnit = "daily",
}) => {
  const conversations = await Conversation.find({
    product: productId,
    participants: { $all: [renterId, ownerId] },
  }).select("_id");

  if (!conversations.length) {
    return null;
  }

  const query = {
    conversation: { $in: conversations.map((conversation) => conversation._id) },
    type: "offer",
    "offer.status": "accepted",
    "offer.product": productId,
    "offer.pricingUnit": pricingUnit,
  };

  if (bookingId) {
    query["offer.booking"] = bookingId;
  } else if (startDate && endDate) {
    const normalized = normalizeOfferWindow(startDate, endDate, pricingUnit);
    query["offer.startDate"] = normalized.start;
    query["offer.endDate"] = normalized.end;
  }

  const acceptedOffer = await Message.findOne(query).sort({ "offer.respondedAt": -1 });

  if (!acceptedOffer?.offer?.amount) {
    return null;
  }

  return {
    conversationId: acceptedOffer.conversation,
    amount: Number(acceptedOffer.offer.amount),
    currency: acceptedOffer.offer.currency || "INR",
    acceptedOfferId: acceptedOffer._id,
    pricingUnit: acceptedOffer.offer.pricingUnit || pricingUnit,
    bookingId: acceptedOffer.offer.booking || null,
    startDate: acceptedOffer.offer.startDate || null,
    endDate: acceptedOffer.offer.endDate || null,
  };
};

// When user opens chat: Set unread = 0 - Update lastReadAt - Emit real-time update
export const markConversationReadService = async (conversationId, user, io = null) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);

  markConversationReadState(conversation, user._id);
  await conversation.save();

  const populatedConversation = await populateConversationById(conversation._id);

  if (io && populatedConversation) {
    io.to(`conversation:${conversation._id}`).emit("chat:conversation:read", {
      conversationId: String(conversation._id),
      userId: String(user._id),
      readAt: new Date().toISOString(),
    });
    emitConversationUpdate(io, populatedConversation);
  }

  return populatedConversation;
};

//Used for Socket.IO connection - Ensures user is allowed to join room
export const ensureSocketConversationAccessService = async (conversationId, user) => {
  const conversation = await Conversation.findById(conversationId).select("participants");

  if (!conversation) {
    throw new AppError("Conversation not found.", 404);
  }

  ensureConversationAccess(conversation, user);
  return conversation;
};


// When user sends message:
// Message created
// Conversation updated
// Unread counts updated

// Socket emits:
// new message
// updated conversation
// When user opens chat:
// unreadCount → 0
// lastReadAt updated
// Socket notifies others
