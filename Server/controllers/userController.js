// User auth controller: register, login, and logout.
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getCookieOptions, sanitiseUser, sendAuthResponse } from "../utils/auth.js";

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

  const allowedFields = ["name", "email", "phone", "avatar", "isActive"];
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
