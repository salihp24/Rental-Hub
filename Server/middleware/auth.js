// Auth middleware: resolves the logged-in user from cookie or bearer token.
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const getTokenFromRequest = (req) => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
};

export const protect = asyncHandler(async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError("You are not logged in. Please log in to continue.", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError("The user for this token no longer exists.", 401));
  }

  if (!currentUser.isActive) {
    return next(new AppError("This account is inactive.", 403));
  }

  req.user = currentUser;
  return next();
});

export const protectOptional = asyncHandler(async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);

    if (!currentUser || !currentUser.isActive) {
      req.user = null;
      return next();
    }

    req.user = currentUser;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
});

export default protect;
