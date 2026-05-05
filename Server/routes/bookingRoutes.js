import express from "express";

import {
  cancelBooking,
  checkBookingAvailability,
  createRazorpayOrder,
  createBooking,
  getBooking,
  listMyBookings,
  verifyRazorpayPayment,
  updateBookingStatus,
} from "../controllers/bookingController.js";
import protect, { protectOptional } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { bookingValidation } from "../validation/index.js";

const router = express.Router();

// Checks if a product is available for selected dates
router.get(
  "/availability",
  protectOptional,
  validate(bookingValidation.availabilityQuery),
  checkBookingAvailability
);

router.use(protect);

router.get("/mine", validate(bookingValidation.listQuery), listMyBookings);
router.post("/", validate(bookingValidation.create), createBooking);
router.get("/:bookingId", validate(bookingValidation.params), getBooking);
router.patch(
  "/:bookingId/status",
  validate({ ...bookingValidation.params, ...bookingValidation.updateStatus }),
  updateBookingStatus
);
router.post(
  "/:bookingId/create-payment-order",
  validate(bookingValidation.params),
  createRazorpayOrder
);
router.post(
  "/:bookingId/verify-payment",
  validate({ ...bookingValidation.params, ...bookingValidation.verifyPayment }),
  verifyRazorpayPayment
);

// Cancels a booking - Handles: refund calculation, freeing blocked dates
router.post(
  "/:bookingId/cancel",
  validate({ ...bookingValidation.params, ...bookingValidation.cancel }),
  cancelBooking
);

export default router;
