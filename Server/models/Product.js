// Product model: rental listing details, pricing rules, location, and availability.
import mongoose from "mongoose";

// Pricing slab: for a given day range, apply a discount
// e.g. { minDays: 8, maxDays: 30, discountPercent: 20 }
// means: if renting for 8–30 days, 20% off the daily rate
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
    // Dynamic attributes based on category
    // e.g. { brand: "Samsung", model: "Galaxy S23", condition: "Good" }
    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Pricing
    pricing: {
      // Owner sets which modes are available
      hourly: {
        enabled: { type: Boolean, default: false },
        rate: { type: Number, default: 0 }, // price per hour
      },
      daily: {
        enabled: { type: Boolean, default: true },
        rate: { type: Number, required: true, min: 0 }, // base price per day
      },
      weekly: {
        enabled: { type: Boolean, default: false },
        rate: { type: Number, default: 0 }, // flat price per week (optional override)
      },
      // Tiered slabs for multi-day rentals
      // Sorted by minDays ascending
      // If no slab matches, full daily rate applies
      slabs: [pricingSlabSchema],
      // Security deposit (refundable)
      deposit: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    // Location
    location: {
      address: { type: String, default: "" },
      city: { type: String, required: [true, "City is required"] },
      state: { type: String, required: [true, "State is required"] },
      pincode: { type: String, default: "" },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
    },
    // Availability: list of blocked date ranges
    // When a booking is confirmed, we push to this array
    blockedDates: [
      {
        startDate: Date,
        endDate: Date,
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
      },
    ],
    // Rental rules set by owner
    rentalRules: {
      minRentalDays: { type: Number, default: 1 },
      maxRentalDays: { type: Number, default: 30 },
      advanceBookingDays: { type: Number, default: 30 }, // how far ahead can be booked
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
    // Ratings summary (updated when reviews come in)
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

// Indexes for search and filtering
productSchema.index({ owner: 1 });
productSchema.index({ category: 1 });
productSchema.index({ "location.city": 1 });
productSchema.index({ "location.coordinates": "2dsphere" });
productSchema.index({ "pricing.daily.rate": 1 });
productSchema.index({ "ratings.average": -1 });
productSchema.index({ status: 1 });
// Text index for search
productSchema.index(
  { title: "text", description: "text" },
  { weights: { title: 10, description: 5 } }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
