import Booking from "../models/Booking.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import { computePricing } from "../utils/Pricing.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getAcceptedNegotiationForBookingService } from "./chat.services.js";

// Used to calculate number of days between dates
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;
// Defines what related data to include: product details - renter info - owner info - cancellation info
const BOOKING_POPULATE = [
  { path: "product", select: "title slug images pricing.daily pricing.currency location.city location.state rentalRules" },
  { path: "renter", select: "name email avatar" },
  { path: "owner", select: "name email avatar" },
  { path: "cancellation.cancelledBy", select: "name email" },
];
// Converts date → UTC (removes time) - Avoid timezone issues - Ensures consistent booking dates
const toUtcDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid booking date.", 400);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid booking date.", 400);
  }

  return date;
};

// Calculates total booking days
const dayDiff = (startDate, endDate) =>
  Math.round((endDate.getTime() - startDate.getTime()) / DAY_IN_MS);

const hourDiff = (startDate, endDate) =>
  +((endDate.getTime() - startDate.getTime()) / HOUR_IN_MS).toFixed(2);

const normalizeBookingWindow = (startDate, endDate, pricingUnit = "daily") => {
  if (pricingUnit === "hourly") {
    return {
      start: toDateTime(startDate),
      end: toDateTime(endDate),
    };
  }

  return {
    start: toUtcDateOnly(startDate),
    end: toUtcDateOnly(endDate),
  };
};

const getBookingDuration = (startDate, endDate, pricingUnit = "daily") => {
  const totalHours = pricingUnit === "hourly" ? hourDiff(startDate, endDate) : dayDiff(startDate, endDate) * 24;
  const totalDays = pricingUnit === "hourly" ? +(totalHours / 24).toFixed(2) : dayDiff(startDate, endDate);
  const totalUnits =
    pricingUnit === "hourly"
      ? totalHours
      : pricingUnit === "weekly"
        ? Math.ceil(totalDays / 7)
        : totalDays;

  return {
    totalHours,
    totalDays,
    totalUnits,
  };
};

const hydrateLegacyBookingFields = (booking) => {
  if (!booking) return booking;

  const pricingUnit = booking.pricingUnit || booking.pricingSnapshot?.pricingUnit || "daily";
  booking.pricingUnit = pricingUnit;

  const startDate = toDateTime(booking.startDate);
  const endDate = toDateTime(booking.endDate);
  const duration = getBookingDuration(startDate, endDate, pricingUnit);

  if (booking.totalDays == null) {
    booking.totalDays = duration.totalDays;
  }

  if (booking.totalHours == null) {
    booking.totalHours = duration.totalHours;
  }

  if (booking.totalUnits == null) {
    booking.totalUnits = duration.totalUnits;
  }

  if (booking.pricingSnapshot) {
    if (!booking.pricingSnapshot.pricingUnit) {
      booking.pricingSnapshot.pricingUnit = pricingUnit;
    }

    if (booking.pricingSnapshot.totalUnits == null) {
      booking.pricingSnapshot.totalUnits = booking.totalUnits;
    }

    if (!booking.pricingSnapshot.unitLabel) {
      booking.pricingSnapshot.unitLabel =
        pricingUnit === "hourly" ? "hour" : pricingUnit === "weekly" ? "week" : "day";
    }
  }

  return booking;
};

// Checks if two date ranges overlap - Prevents double booking
const rangesOverlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

// Generates unique booking ID
const buildOrderCode = () =>
  `RH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

let razorpayClient;

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new AppError("Razorpay is not configured on the server.", 500);
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return {
    client: razorpayClient,
    keyId,
    keySecret,
  };
};

const issueRazorpayRefund = async (booking, amount) => {
  const refundAmount = Number(amount || 0);
  if (refundAmount <= 0) return null;

  const paymentId = booking.paymentDetails?.razorpayPaymentId;
  if (!paymentId) {
    throw new AppError("Cannot refund this booking because no Razorpay payment id is stored.", 400);
  }

  const { client } = getRazorpayClient();
  const refund = await client.payments.refund(paymentId, {
    amount: Math.round(refundAmount * 100),
    notes: {
      bookingId: String(booking._id),
      orderCode: booking.orderCode,
    },
  });

  return refund;
};


// Access Control Functions

// Only - renter, owner, admin can view booking
const ensureBookingAccess = (booking, user) => {
  const isRenter = booking.renter.equals(user._id);
  const isOwner = booking.owner.equals(user._id);
  const isAdmin = user.hasRole("admin");

  if (!isRenter && !isOwner && !isAdmin) {
    throw new AppError("Not allowed to access this booking.", 403);
  }
};

// Only owner/admin can: change booking status
const ensureOwnerAccess = (booking, user) => {
  const isOwner = booking.owner.equals(user._id);
  const isAdmin = user.hasRole("admin");

  if (!isOwner && !isAdmin) {
    throw new AppError("Only the owner can update this booking status.", 403);
  }
};

// Only renter/admin can: confirm payment
const ensureRenterAccess = (booking, user) => {
  const isRenter = booking.renter.equals(user._id);
  const isAdmin = user.hasRole("admin");

  if (!isRenter && !isAdmin) {
    throw new AppError("Only the renter can confirm payment for this booking.", 403);
  }
};

const isOwnerOrAdmin = (booking, user) => {
  const isOwner = booking?.owner?.equals?.(user._id) || String(booking?.owner) === String(user?._id);
  const isAdmin = user.hasRole("admin");

  return isOwner || isAdmin;
};

const isRenterOrAdmin = (booking, user) => {
  const isRenter = booking?.renter?.equals?.(user._id) || String(booking?.renter) === String(user?._id);
  const isAdmin = user.hasRole("admin");

  return isRenter || isAdmin;
};

const buildListFilter = (userId, query) => {
  const { as = "renter", status, paymentStatus, product } = query;
  const filter = {};

  if (as === "owner") {
    filter.owner = userId;
  } else if (as === "all") {
    filter.$or = [{ renter: userId }, { owner: userId }];
  } else {
    filter.renter = userId;
  }

  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (product) filter.product = product;

  return filter;
};


// Availability Logic

// Checks if selected dates clash with: existing bookings
const getConflictingBlocks = (product, startDate, endDate, excludeBookingId = null) =>
  (product.blockedDates || []).filter((block) => {
    if (!block?.startDate || !block?.endDate) return false;
    if (excludeBookingId && String(block.bookingId) === String(excludeBookingId)) return false;

    return rangesOverlap(
      startDate,
      endDate,
      toDateTime(block.startDate),
      toDateTime(block.endDate)
    );
  });

  // Blocks dates after booking confirmed
const addBlockedRange = async (productId, bookingId, startDate, endDate) => {
  await Product.updateOne(
    { _id: productId },
    {
      $addToSet: {
        blockedDates: {
          startDate,
          endDate,
          bookingId,
        },
      },
    }
  );
};

// Frees dates when: booking cancelled, rejected
const removeBlockedRange = async (productId, bookingId) => {
  await Product.updateOne(
    { _id: productId },
    {
      $pull: {
        blockedDates: { bookingId },
      },
    }
  );
};

// Booking Validation

// Validation like - minimum 1 day, not in past, within advance booking limit - Within min/max rental days
const validateBookingWindow = (product, startDate, endDate, pricingUnit = "daily") => {
  const { totalDays, totalHours, totalUnits } = getBookingDuration(
    startDate,
    endDate,
    pricingUnit
  );

  if (pricingUnit === "hourly") {
    if (totalHours < 1) {
      throw new AppError("Hourly booking must be at least 1 hour.", 400);
    }

    if (!product.pricing?.hourly?.enabled) {
      throw new AppError("Hourly pricing is not enabled for this product.", 400);
    }
  } else if (totalDays < 1) {
    throw new AppError("Booking must be at least 1 day.", 400);
  }

  if (pricingUnit === "weekly" && !product.pricing?.weekly?.enabled) {
    throw new AppError("Weekly pricing is not enabled for this product.", 400);
  }

  const now = pricingUnit === "hourly" ? new Date() : toUtcDateOnly(new Date());
  if (startDate < now) {
    throw new AppError("Booking start date cannot be in the past.", 400);
  }

  const advanceDays =
    pricingUnit === "hourly"
      ? +((startDate.getTime() - now.getTime()) / DAY_IN_MS).toFixed(2)
      : dayDiff(now, startDate);

  if (advanceDays > (product.rentalRules?.advanceBookingDays ?? 30)) {
    throw new AppError("Booking start date exceeds the allowed advance booking window.", 400);
  }

  const minRentalDays = product.rentalRules?.minRentalDays ?? 1;
  const maxRentalDays = product.rentalRules?.maxRentalDays ?? 30;

  if (pricingUnit === "hourly") {
    if (totalHours < minRentalDays * 24) {
      throw new AppError("Booking is below the product minimum rental duration.", 400);
    }

    if (totalHours > maxRentalDays * 24) {
      throw new AppError("Booking exceeds the product maximum rental duration.", 400);
    }
  } else {
    if (totalDays < minRentalDays) {
      throw new AppError("Booking is below the product minimum rental days.", 400);
    }

    if (totalDays > maxRentalDays) {
      throw new AppError("Booking exceeds the product maximum rental days.", 400);
    }
  }

  return {
    totalDays,
    totalHours,
    totalUnits,
  };
};


// Refund Logic

// Policy-based: flexible → 100%, moderate → 50%, strict → 0%
const getRefundRate = (policy = "moderate", status = "pending") => {
  if (status === "pending") return 1;

  if (policy === "flexible") return 1;
  if (policy === "moderate") return 0.5;
  return 0;
};

// Calculates refund based on: payment status, cancellation policy
const calculateRefundAmount = (booking, product, statusOverride = booking.status) => {
  if (booking.paymentStatus !== "paid") {
    return 0;
  }

  const totalAmount = Number(booking.pricingSnapshot?.totalAmount || 0);
  const rate = getRefundRate(product?.rentalRules?.cancellationPolicy, statusOverride);

  return +(totalAmount * rate).toFixed(2);
};


// Main Services


const populateBookingById = (bookingId) =>
  Booking.findById(bookingId).populate(BOOKING_POPULATE);

const autoInitiateReturnIfOverdue = async (booking) => {
  if (!booking || booking.status !== "active") {
    return booking;
  }

  const bookingEnd = toDateTime(booking.endDate);
  if (bookingEnd > new Date()) {
    return booking;
  }

  booking.status = "return_requested";
  booking.returnFlow = {
    ...booking.returnFlow,
    requestedAt: booking.returnFlow?.requestedAt || new Date(),
    requestedBy: booking.returnFlow?.requestedBy || null,
  };

  await booking.save();
  return booking;
};

const autoInitiateReturnsForFilter = async (baseFilter = {}) => {
  await Booking.updateMany(
    {
      ...baseFilter,
      status: "active",
      endDate: { $lte: new Date() },
    },
    {
      $set: {
        status: "return_requested",
        "returnFlow.requestedAt": new Date(),
        "returnFlow.requestedBy": null,
      },
    }
  );
};

// Checks if a product is available for selected dates
export const getBookingAvailabilityService = async ({
  productId,
  startDate,
  endDate,
  pricingUnit = "daily",
  user = null,
}) => {
  const product = await Product.findById(productId).select(
    "title status owner pricing rentalRules blockedDates"
  );

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  if (product.status !== "active") {
    throw new AppError("This product is not currently available for booking.", 400);
  }

  const { start, end } = normalizeBookingWindow(startDate, endDate, pricingUnit);
  const duration = validateBookingWindow(product, start, end, pricingUnit);
  const conflicts = getConflictingBlocks(product, start, end);
  const acceptedNegotiation =
    user?._id && !product.owner.equals(user._id)
      ? await getAcceptedNegotiationForBookingService({
          productId: product._id,
          renterId: user._id,
          ownerId: product.owner,
          startDate: start,
          endDate: end,
          pricingUnit,
        })
      : null;

  return {
    product,
    available: conflicts.length === 0,
    totalDays: duration.totalDays,
    totalHours: duration.totalHours,
    totalUnits: duration.totalUnits,
    pricingUnit,
    conflicts,
    pricing: computePricing(product.pricing, duration.totalUnits, {
      baseRateOverride: acceptedNegotiation?.amount,
      currencyOverride: acceptedNegotiation?.currency,
      pricingUnit,
    }),
    negotiation: acceptedNegotiation,
  };
};

// Creates a booking
// Validate product - Prevent self-booking - Validate dates - Check conflicts - Create booking
export const createBookingService = async (payload, renter) => {
  const product = await Product.findById(payload.product).select(
    "title owner status pricing rentalRules blockedDates"
  );

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  if (product.status !== "active") {
    throw new AppError("This product is not available for booking.", 400);
  }

  if (product.owner.equals(renter._id)) {
    throw new AppError("You cannot book your own product.", 400);
  }

  const pricingUnit = payload.pricingUnit || "daily";
  const { start, end } = normalizeBookingWindow(payload.startDate, payload.endDate, pricingUnit);
  const duration = validateBookingWindow(product, start, end, pricingUnit);

  const conflicts = getConflictingBlocks(product, start, end);
  if (conflicts.length) {
    throw new AppError("The selected dates are not available for this product.", 409);
  }

  const acceptedNegotiation = await getAcceptedNegotiationForBookingService({
    productId: product._id,
    renterId: renter._id,
    ownerId: product.owner,
    startDate: start,
    endDate: end,
    pricingUnit,
  });

  const pricingSnapshot = computePricing(product.pricing, duration.totalUnits, {
    baseRateOverride: acceptedNegotiation?.amount,
    currencyOverride: acceptedNegotiation?.currency,
    pricingUnit,
  });

  const booking = await Booking.create({
    orderCode: buildOrderCode(),
    product: product._id,
    renter: renter._id,
    owner: product.owner,
    startDate: start,
    endDate: end,
    pricingUnit,
    totalDays: duration.totalDays,
    totalHours: duration.totalHours,
    totalUnits: duration.totalUnits,
    pricingSnapshot,
    paymentStatus: "unpaid",
    paymentMethod: "razorpay",
    deliveryType: payload.deliveryType,
    deliveryAddress: payload.deliveryAddress,
    renterNote: payload.renterNote,
  });

  return populateBookingById(booking._id);
};

// Returns bookings for user
export const listMyBookingsService = async (userId, query) => {
  const { page = 1, limit = 10 } = query;
  const filter = buildListFilter(userId, query);
  const skip = (Number(page) - 1) * Number(limit);

  await autoInitiateReturnsForFilter(
    filter.$or
      ? { $or: filter.$or }
      : filter.owner
        ? { owner: filter.owner }
        : { renter: filter.renter }
  );

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate(BOOKING_POPULATE)
      .sort({ createdAt: -1 })
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

// Fetch single booking
export const getBookingByIdService = async (bookingId, user) => {
  const rawBooking = await Booking.findById(bookingId);

  if (!rawBooking) {
    throw new AppError("Booking not found.", 404);
  }

  ensureBookingAccess(rawBooking, user);
  await autoInitiateReturnIfOverdue(rawBooking);

  const booking = await populateBookingById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found.", 404);
  }

  return booking;
};

export const createRazorpayOrderService = async (bookingId, user) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found.", 404);
  }

  ensureRenterAccess(booking, user);

  if (booking.status !== "confirmed") {
    throw new AppError("Payment can only be completed after the owner approves the booking.", 400);
  }

  if (booking.paymentStatus === "paid") {
    throw new AppError("Payment has already been completed for this booking.", 400);
  }

  const { client, keyId } = getRazorpayClient();
  const amountInPaise = Math.round(Number(booking.pricingSnapshot?.totalAmount || 0) * 100);

  if (amountInPaise <= 0) {
    throw new AppError("Booking total is invalid for payment.", 400);
  }

  const order = await client.orders.create({
    amount: amountInPaise,
    currency: booking.pricingSnapshot?.currency || "INR",
    receipt: booking.orderCode,
    notes: {
      bookingId: String(booking._id),
      orderCode: booking.orderCode,
      renterId: String(booking.renter),
      ownerId: String(booking.owner),
    },
  });

  booking.paymentMethod = "razorpay";
  booking.paymentDetails = {
    ...booking.paymentDetails,
    razorpayOrderId: order.id,
    notes: "Razorpay order created.",
  };

  await booking.save();

  return {
    booking: await populateBookingById(booking._id),
    razorpay: {
      keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      name: "Rental Hub",
      description: `Booking payment for ${booking.orderCode}`,
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone || "",
      },
      notes: order.notes || {},
    },
  };
};

export const verifyRazorpayPaymentService = async (bookingId, payload, user) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found.", 404);
  }

  ensureRenterAccess(booking, user);

  if (booking.status !== "confirmed") {
    throw new AppError("Payment can only be verified after the owner approves the booking.", 400);
  }

  if (booking.paymentStatus === "paid") {
    throw new AppError("Payment has already been completed for this booking.", 400);
  }

  if (
    booking.paymentDetails?.razorpayOrderId &&
    booking.paymentDetails.razorpayOrderId !== payload.razorpay_order_id
  ) {
    throw new AppError("Payment order does not match this booking.", 400);
  }

  const { keySecret } = getRazorpayClient();
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== payload.razorpay_signature) {
    throw new AppError("Invalid Razorpay payment signature.", 400);
  }

  booking.paymentStatus = "paid";
  booking.paymentMethod = "razorpay";
  booking.paymentDetails = {
    ...booking.paymentDetails,
    reference: payload.razorpay_payment_id,
    razorpayOrderId: payload.razorpay_order_id,
    razorpayPaymentId: payload.razorpay_payment_id,
    razorpaySignature: payload.razorpay_signature,
    confirmedAt: new Date(),
    notes: "Razorpay payment verified.",
  };

  await booking.save();

  return populateBookingById(booking._id);
};

// Handles booking lifecycle
// pending → confirmed / rejected / cancelled  
// confirmed → active / cancelled  
// active → completed  
export const updateBookingStatusService = async (bookingId, payload, user) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found.", 404);
  }

  if (!booking.owner || !booking.renter || !booking.product) {
    throw new AppError(
      "Booking data is incomplete (owner/renter/product missing). Please repair this booking record first.",
      400
    );
  }

  hydrateLegacyBookingFields(booking);
  await autoInitiateReturnIfOverdue(booking);

  const currentStatus = booking.status;
  const nextStatus = payload.status;
  const allowedTransitions = {
    pending: ["confirmed", "rejected", "cancelled"],
    confirmed: ["active", "cancelled"],
    active: ["return_requested"],
    return_requested: ["completed"],
    completed: [],
    cancelled: [],
    rejected: [],
  };

  if (currentStatus === nextStatus) {
    if (payload.paymentStatus) {
      booking.paymentStatus = payload.paymentStatus;
      await booking.save();
      return populateBookingById(booking._id);
    }

    throw new AppError("Booking is already in that status.", 400);
  }

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    throw new AppError(
      `Cannot change booking status from ${currentStatus} to ${nextStatus}.`,
      400
    );
  }

  if (nextStatus === "return_requested") {
    if (!isRenterOrAdmin(booking, user)) {
      throw new AppError("Only the renter can request a return for this booking.", 403);
    }
  } else if (!isOwnerOrAdmin(booking, user)) {
    throw new AppError("Only the owner can update this booking status.", 403);
  }

  const product = await Product.findById(booking.product).select(
    "blockedDates rentalRules totalRentals"
  );

  if (!product) {
    throw new AppError("Product not found for this booking.", 404);
  }

  if (nextStatus === "confirmed") {
    const conflicts = getConflictingBlocks(
      product,
      toDateTime(booking.startDate),
      toDateTime(booking.endDate),
      booking._id
    );

    if (conflicts.length) {
      throw new AppError("This booking can no longer be confirmed because the dates are unavailable.", 409);
    }

    await addBlockedRange(booking.product, booking._id, booking.startDate, booking.endDate);
  }

  if (nextStatus === "active" && booking.paymentStatus !== "paid") {
    throw new AppError("The rental can only be marked active after payment is completed.", 400);
  }

  if (nextStatus === "rejected") {
    let refund = null;
    if (booking.paymentStatus === "paid") {
      refund = await issueRazorpayRefund(
        booking,
        Number(booking.pricingSnapshot?.totalAmount || 0)
      );
    }

    booking.cancellation = {
      cancelledBy: user._id,
      reason: payload.reason || "Rejected by owner.",
      cancelledAt: new Date(),
      refundAmount: Number(booking.pricingSnapshot?.totalAmount || 0),
    };
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
      booking.paymentDetails = {
        ...booking.paymentDetails,
        refundId: refund?.id || booking.paymentDetails?.refundId || "",
        refundStatus: refund?.status || "processed",
        refundAmount: Number(booking.pricingSnapshot?.totalAmount || 0),
        refundedAt: new Date(),
      };
    }
    await removeBlockedRange(booking.product, booking._id);
  }

  if (nextStatus === "cancelled") {
    const refundAmount = calculateRefundAmount(booking, product, currentStatus);
    let refund = null;
    if (booking.paymentStatus === "paid" && refundAmount > 0) {
      refund = await issueRazorpayRefund(booking, refundAmount);
    }

    booking.cancellation = {
      cancelledBy: user._id,
      reason: payload.reason || "Cancelled by owner.",
      cancelledAt: new Date(),
      refundAmount,
    };
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = refundAmount > 0 ? "partially_refunded" : "paid";
      if (refundAmount === Number(booking.pricingSnapshot?.totalAmount || 0)) {
        booking.paymentStatus = "refunded";
      }
      if (refundAmount > 0) {
        booking.paymentDetails = {
          ...booking.paymentDetails,
          refundId: refund?.id || booking.paymentDetails?.refundId || "",
          refundStatus: refund?.status || "processed",
          refundAmount,
          refundedAt: new Date(),
        };
      }
    }
    await removeBlockedRange(booking.product, booking._id);
  }

  if (nextStatus === "completed") {
    if (!booking.returnFlow?.requestedAt) {
      throw new AppError("The return must be requested before it can be confirmed.", 400);
    }

    booking.returnFlow = {
      ...booking.returnFlow,
      confirmedAt: new Date(),
      confirmedBy: user._id,
    };
    await removeBlockedRange(booking.product, booking._id);
    await Product.updateOne({ _id: booking.product }, { $inc: { totalRentals: 1 } });
  }

  if (nextStatus === "return_requested") {
    booking.returnFlow = {
      ...booking.returnFlow,
      requestedAt: new Date(),
      requestedBy: user._id,
    };
  }

  booking.status = nextStatus;

  if (payload.paymentStatus) {
    booking.paymentStatus = payload.paymentStatus;
  }

  await booking.save();
  return populateBookingById(booking._id);
};

// Allows renter/owner/admin to cancel
export const cancelBookingService = async (bookingId, payload, user) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found.", 404);
  }

  ensureBookingAccess(booking, user);

  const isRenter = booking.renter.equals(user._id);
  const isOwner = booking.owner.equals(user._id);
  const isAdmin = user.hasRole("admin");

  if (!["pending", "confirmed"].includes(booking.status)) {
    throw new AppError("Only pending or confirmed bookings can be cancelled.", 400);
  }

  if (!isRenter && !isOwner && !isAdmin) {
    throw new AppError("Not allowed to cancel this booking.", 403);
  }

  const product = await Product.findById(booking.product).select("rentalRules");
  const refundAmount = calculateRefundAmount(booking, product, booking.status);
  let refund = null;
  if (booking.paymentStatus === "paid" && refundAmount > 0) {
    refund = await issueRazorpayRefund(booking, refundAmount);
  }

  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy: user._id,
    reason: payload.reason,
    cancelledAt: new Date(),
    refundAmount,
  };

  if (booking.paymentStatus === "paid") {
    booking.paymentStatus = refundAmount > 0 ? "partially_refunded" : "paid";
    if (refundAmount === Number(booking.pricingSnapshot?.totalAmount || 0)) {
      booking.paymentStatus = "refunded";
    }
    if (refundAmount > 0) {
      booking.paymentDetails = {
        ...booking.paymentDetails,
        refundId: refund?.id || booking.paymentDetails?.refundId || "",
        refundStatus: refund?.status || "processed",
        refundAmount,
        refundedAt: new Date(),
      };
    }
  }

  await booking.save();
  await removeBlockedRange(booking.product, booking._id);

  return populateBookingById(booking._id);
};
