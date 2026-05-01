// Product model: rental listing details, pricing rules, location, and availability.
import mongoose from "mongoose";

// Pricing slab: for a given day range, apply a discount.
// e.g. { minDays: 8, maxDays: 30, discountPercent: 20 }
// means: if renting for 8-30 days, 20% off the daily rate
const pricingSlabSchema = new mongoose.Schema(
  {
    minDays: { type: Number, required: true },
    maxDays: { type: Number, required: true }, // use 9999 for "and above"
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pricing: {
      hourly: {
        enabled: { type: Boolean, default: false },
        rate: { type: Number, default: 0 },
      },
      daily: {
        enabled: { type: Boolean, default: true },
        rate: { type: Number, required: true, min: 0 },
      },
      weekly: {
        enabled: { type: Boolean, default: false },
        rate: { type: Number, default: 0 },
      },
      slabs: [pricingSlabSchema],
      deposit: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    location: {
      address: { type: String, default: "" },
      city: { type: String, required: [true, "City is required"] },
      state: { type: String, required: [true, "State is required"] },
      pincode: { type: String, default: "" },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    blockedDates: [
      {
        startDate: Date,
        endDate: Date,
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
      },
    ],
    rentalRules: {
      minRentalDays: { type: Number, default: 1 },
      maxRentalDays: { type: Number, default: 30 },
      advanceBookingDays: { type: Number, default: 30 },
      cancellationPolicy: {
        type: String,
        enum: ["flexible", "moderate", "strict"],
        default: "moderate",
      },
    },
    condition: {
      type: String,
      enum: ["new", "like_new", "good", "fair"],
      required: [true, "Product condition is required"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "rented", "under_review"],
      default: "active",
    },
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    totalRentals: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

productSchema.index({ owner: 1 });
productSchema.index({ category: 1 });
productSchema.index({ "location.city": 1 });
productSchema.index({ "location.coordinates": "2dsphere" });
productSchema.index({ "pricing.daily.rate": 1 });
productSchema.index({ "ratings.average": -1 });
productSchema.index({ status: 1 });
productSchema.index(
  { title: "text", description: "text" },
  { weights: { title: 10, description: 5 } }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
