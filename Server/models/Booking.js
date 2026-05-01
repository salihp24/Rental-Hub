// Booking model: stores rental period, pricing snapshot, status, and delivery info.
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
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
    pricingUnit: {
      type: String,
      enum: ["hourly", "daily", "weekly"],
      default: "daily",
    },
    totalDays: {
      type: Number,
      required: true,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    totalUnits: {
      type: Number,
      required: true,
    },
    // Pricing snapshot at time of booking
    // We store this so if owner changes price later,
    // existing bookings are not affected
    pricingSnapshot: {
      baseRate: Number,       // daily rate at time of booking
      negotiatedRate: Number, // accepted negotiated daily rate for this booking
      isNegotiated: { type: Boolean, default: false },
      negotiatedFromOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },
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
      pricingUnit: {
        type: String,
        enum: ["hourly", "daily", "weekly"],
        default: "daily",
      },
      totalUnits: Number,
      unitLabel: String,
    },
    // Booking status flow:
    // pending → confirmed → active → completed
    //         → cancelled (from pending or confirmed)
    //         → rejected  (owner rejects)
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "active",
        "return_requested",
        "completed",
        "cancelled",
        "rejected",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded", "partially_refunded"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["dummy", "razorpay"],
      default: "razorpay",
    },
    paymentDetails: {
      reference: {
        type: String,
        default: "",
      },
      razorpayOrderId: {
        type: String,
        default: "",
      },
      razorpayPaymentId: {
        type: String,
        default: "",
      },
      razorpaySignature: {
        type: String,
        default: "",
      },
      confirmedAt: Date,
      notes: {
        type: String,
        default: "",
      },
      refundId: {
        type: String,
        default: "",
      },
      refundStatus: {
        type: String,
        default: "",
      },
      refundAmount: {
        type: Number,
        default: 0,
      },
      refundedAt: Date,
    },
    // Cancellation info
    cancellation: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: String,
      cancelledAt: Date,
      refundAmount: Number,
    },
    returnFlow: {
      requestedAt: Date,
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      confirmedAt: Date,
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
bookingSchema.index({ orderCode: 1 }, { unique: true });
bookingSchema.index({ status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
