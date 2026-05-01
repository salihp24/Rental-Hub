import asyncHandler from "../utils/asyncHandler.js";
import {
  cancelBookingService,
  createRazorpayOrderService,
  createBookingService,
  getBookingAvailabilityService,
  getBookingByIdService,
  listMyBookingsService,
  verifyRazorpayPaymentService,
  updateBookingStatusService,
} from "../Services/booking.services.js";

//Check if a product is available for given dates
export const checkBookingAvailability = asyncHandler(async (req, res) => {
  const result = await getBookingAvailabilityService({
    productId: req.query.product,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    pricingUnit: req.query.pricingUnit,
    user: req.user,
  });

  res.status(200).json({
    status: "success",
    data: {
      available: result.available,
      totalDays: result.totalDays,
      totalHours: result.totalHours,
      totalUnits: result.totalUnits,
      pricingUnit: result.pricingUnit,
      pricing: result.pricing,
      product: {
        _id: result.product._id,
        title: result.product.title,
      },
      conflicts: result.conflicts,
      negotiation: result.negotiation,
    },
  });
});


//Create a new booking
export const createBooking = asyncHandler(async (req, res) => {
  const booking = await createBookingService(req.body, req.user);

  res.status(201).json({
    status: "success",
    data: { booking },
  });
});

//Get all bookings of the logged-in user
export const listMyBookings = asyncHandler(async (req, res) => {
  const result = await listMyBookingsService(req.user._id, req.query);

  res.status(200).json({
    status: "success",
    results: result.bookings.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: { bookings: result.bookings },
  });
});

//Get a single booking by ID
export const getBooking = asyncHandler(async (req, res) => {
  const booking = await getBookingByIdService(req.params.bookingId, req.user);

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

//Update booking status (like confirm, reject, etc.)
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const booking = await updateBookingStatusService(
    req.params.bookingId,
    req.body,
    req.user
  );

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

//Cancel a booking
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await cancelBookingService(req.params.bookingId, req.body, req.user);

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const result = await createRazorpayOrderService(req.params.bookingId, req.user);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const booking = await verifyRazorpayPaymentService(req.params.bookingId, req.body, req.user);

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});
