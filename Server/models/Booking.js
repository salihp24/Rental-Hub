// Booking model: stores rental period, pricing snapshot, status, and delivery info.
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Rental period
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    totalDays: {
      type: Number,
      required: true,
    },
    // Pricing snapshot at time of booking
    // We store this so if owner changes price later,
    // existing bookings are not affected
    pricingSnapshot: {
      baseRate: Number,       // daily rate at time of booking
      appliedSlab: {          // which slab was applied (if any)
        minDays: Number,
        maxDays: Number,
        discountPercent: Number,
      },
      subtotal: Number,       // baseRate × days (before discount)
      discountAmount: Number, // how much was saved
      rentalAmount: Number,   // after discount
      deposit: Number,        // security deposit
      platformFee: Number,    // our commission
      totalAmount: Number,    // rentalAmount + deposit + platformFee
      currency: { type: String, default: "INR" },
    },
    // Booking status flow:
    // pending → confirmed → active → completed
    //         → cancelled (from pending or confirmed)
    //         → rejected  (owner rejects)
    status: {
      type: String,
      enum: ["pending", "confirmed", "active", "completed", "cancelled", "rejected"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded", "partially_refunded"],
      default: "unpaid",
    },
    // Cancellation info
    cancellation: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: String,
      cancelledAt: Date,
      refundAmount: Number,
    },
    // Delivery preference
    deliveryType: {
      type: String,
      enum: ["pickup", "delivery"],
      default: "pickup",
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    // Notes from renter to owner
    renterNote: {
      type: String,
      maxlength: 500,
      default: "",
    },
    // Flags to track if reviews have been submitted
    reviewedByRenter: { type: Boolean, default: false },
    reviewedByOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bookingSchema.index({ renter: 1 });
bookingSchema.index({ owner: 1 });
bookingSchema.index({ product: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
