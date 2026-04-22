import jwt from "jsonwebtoken";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

export const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: COOKIE_MAX_AGE_MS,
});

export const sanitiseUser = (user) => {
  const userObject = user.toObject ? user.toObject() : { ...user };

  delete userObject.password;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;

  return userObject;
};

export const sendAuthResponse = (res, statusCode, user) => {
  const token = signToken(user._id);

  res.cookie("token", token, getCookieOptions());

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: sanitiseUser(user),
    },
  });
};
