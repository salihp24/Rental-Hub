import jwt from "jsonwebtoken";

import User from "../models/User.js";
import AppError from "../utils/AppError.js";

// extracts the JWT token from cookies.
const parseCookieToken = (cookieHeader = "") => {
  const cookies = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === "token") {
      return rest.join("=");
    }
  }

  return null;
};

// tries 3 different ways to get the token from the socket request.
export const getSocketToken = (socket) => {
  // usually sent from frontend like:
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;
  // From Authorization Header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // If token is stored in cookies, it extracts using previous function
  return parseCookieToken(socket.handshake.headers?.cookie || "");
};

// Get token - verify JWT - Find user in db - check is active - return user
export const authenticateSocketUser = async (socket) => {
  const token = getSocketToken(socket);
  if (!token) {
    throw new AppError("Socket authentication failed: missing token.", 401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError("Socket authentication failed: user not found.", 401);
  }

  if (!user.isActive) {
    throw new AppError("Socket authentication failed: account inactive.", 403);
  }

  return user;
};


// Socket connects
// Get token from:
// auth OR header OR cookies
// Verify token
// Get user from DB
// Check if user is active
// If everything is OK → return user
// Else → throw error