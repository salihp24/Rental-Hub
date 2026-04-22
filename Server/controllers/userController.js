// User auth controller: register, login, and logout.
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getCookieOptions, sendAuthResponse } from "../utils/auth.js";

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
