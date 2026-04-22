// Review model: stores post-booking feedback for products, owners, or renters.
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // What is being reviewed
    reviewType: {
      type: String,
      enum: ["product", "owner", "renter"],
      required: true,
    },
    // The target of the review
    // Could be a Product ID or User ID depending on reviewType
    targetProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      trim: true,
    },
    // Owner can reply to a product/renter review
    reply: {
      comment: { type: String, maxlength: 500 },
      repliedAt: Date,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One review per booking per reviewType per reviewer
reviewSchema.index(
  { booking: 1, reviewer: 1, reviewType: 1 },
  { unique: true }
);
reviewSchema.index({ targetProduct: 1 });
reviewSchema.index({ targetUser: 1 });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
