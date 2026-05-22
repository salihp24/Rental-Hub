// User auth controller: register, login, and logout.
import crypto from "crypto";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getCookieOptions, sanitiseUser, sendAuthResponse, signToken } from "../utils/auth.js";
import { sendEmail } from "../utils/email.js";

export const registerUser = asyncHandler(async (req, res, next) => {
  const existingUser = await User.findOne({ email: req.body.email });

  if (existingUser) {
    return next(new AppError("User with this email already exists.", 409));
  }

  const { role, ...userData } = req.body;
  const user = await User.create(userData);

  return sendAuthResponse(res, 201, user);
});

export const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  if (!user || !user.password) {
    return next(new AppError("Invalid email or password.", 401));
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return next(new AppError("Invalid email or password.", 401));
  }

  if (user.hasRole("admin")) {
    return next(new AppError("Please use the admin sign-in page.", 403));
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  return sendAuthResponse(res, 200, user);
});

export const logoutUser = async (req, res) => {
  res.cookie("token", "", {
    ...getCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully.",
  });
};

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      user: sanitiseUser(req.user),
    },
  });
});

export const updateMe = asyncHandler(async (req, res, next) => {
  if (req.body.email) {
    const existingUser = await User.findOne({
      email: req.body.email,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      return next(new AppError("User with this email already exists.", 409));
    }
  }

  const allowedFields = ["name", "email", "phone", "avatar"];
  const updates = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: sanitiseUser(user),
    },
  });
});

export const updateOwnerProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.ownerProfile = {
    ...user.ownerProfile?.toObject?.(),
    ...req.body.ownerProfile,
    address: {
      ...user.ownerProfile?.address?.toObject?.(),
      ...req.body.ownerProfile.address,
    },
  };

  if (!user.hasRole("owner")) {
    user.role.push("owner");
  }

  await user.save();

  res.status(200).json({
    status: "success",
    data: {
      user: sanitiseUser(user),
    },
  });
});

export const updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("+password");

  if (!user?.password) {
    return next(new AppError("This account does not have a password set.", 400));
  }

  const isPasswordValid = await user.comparePassword(req.body.currentPassword);

  if (!isPasswordValid) {
    return next(new AppError("Current password is incorrect.", 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  return sendAuthResponse(res, 200, user);
});

export const googleAuthCallback = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Google authentication failed.", 401));
  }

  const token = signToken(req.user._id);
  res.cookie("token", token, getCookieOptions());

  const clientUrl = process.env.CLIENT_URL?.trim() || "http://localhost:5173";
  const redirectUrl = `${clientUrl.replace(/\/+$/, "")}/auth/google/callback`;
  return res.redirect(302, redirectUrl);
});

export const forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(200).json({
      status: "success",
      message: "If an account exists for this email, a reset link has been sent.",
    });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const clientUrl = process.env.CLIENT_URL?.trim() || "http://localhost:5173";
  const resetUrl = `${clientUrl.replace(/\/+$/, "")}/reset-password/${resetToken}`;

  const subject = "Reset your Rental Hub password";
  const text = `You requested a password reset. Use this link within 10 minutes: ${resetUrl}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px">Reset your password</h2>
      <p style="margin:0 0 12px">We received a request to reset your Rental Hub password.</p>
      <p style="margin:0 0 18px">
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
          Reset Password
        </a>
      </p>
      <p style="margin:0 0 6px">This link will expire in 10 minutes.</p>
      <p style="margin:0">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({ to: user.email, subject, text, html });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Failed to send reset email. Please try again.", 500));
  }

  return res.status(200).json({
    status: "success",
    message: "If an account exists for this email, a reset link has been sent.",
  });
});

export const resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select("+password");

  if (!user) {
    return next(new AppError("Reset token is invalid or has expired.", 400));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.lastLogin = new Date();
  await user.save();

  return sendAuthResponse(res, 200, user);
});
