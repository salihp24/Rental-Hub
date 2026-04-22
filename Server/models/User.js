// User model: account details, roles, owner profile data, and auth helpers.
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    role: {
      type: [String],
      enum: ["renter", "owner", "admin"],
      default: ["renter"],
    },
    // Google OAuth
    googleId: {
      type: String,
      default: null,
    },
    isGoogleUser: {
      type: Boolean,
      default: false,
    },
    // Account status
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Owner profile (filled when user becomes an owner)
    ownerProfile: {
      bio: { type: String, default: "" },
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
      },
      idVerified: { type: Boolean, default: false },
    },
    // Ratings summary (updated when reviews are added)
    ratings: {
      asOwner: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 },
      },
      asRenter: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 },
      },
    },
    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
    // Timestamps for last login
    lastLogin: Date,
  },
  { timestamps: true }
);

// Hash password before saving.
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has a specific role
userSchema.methods.hasRole = function (role) {
  return this.role.includes(role);
};

// When user lists a product, add owner role automatically
userSchema.methods.addOwnerRole = async function () {
  if (!this.hasRole("owner")) {
    this.role.push("owner");
    await this.save();
  }
};

const User = mongoose.model("User", userSchema);
export default User;
