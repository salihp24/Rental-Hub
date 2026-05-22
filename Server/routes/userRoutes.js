// User auth routes. Joi validation runs before the controller handlers.
import express from "express";
import passport from "passport";

import validate from "../middleware/validate.js";
import protect from "../middleware/auth.js";
import { userValidation } from "../validation/index.js";
import {
  forgotPassword,
  getMe,
  googleAuthCallback,
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
  updateMe,
  updateOwnerProfile,
  updatePassword,
} from "../controllers/userController.js";

const router = express.Router();
const ensureGoogleStrategy = (req, res, next) => {
  if (!passport._strategy("google")) {
    return res.status(503).json({
      status: "fail",
      message:
        "Google auth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Server/.env and restart the server.",
    });
  }

  return next();
};

router.post("/register", validate(userValidation.register), registerUser);
router.post("/login", validate(userValidation.login), loginUser);
router.post("/forgot-password", validate(userValidation.forgotPassword), forgotPassword);
router.patch("/reset-password/:token", validate(userValidation.resetPassword), resetPassword);
router.get(
  "/google",
  ensureGoogleStrategy,
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);
router.get(
  "/google/callback",
  ensureGoogleStrategy,
  passport.authenticate("google", { session: false, failureRedirect: "/api/v1/users/google/failure" }),
  googleAuthCallback
);
router.get("/google/failure", (req, res) => {
  res.status(401).json({
    status: "fail",
    message: "Google authentication failed.",
  });
});
router.post("/logout", logoutUser);

router.use(protect);

router.get("/me", getMe);
router.patch("/me", validate(userValidation.updateProfile), updateMe);
router.patch(
  "/me/owner-profile",
  validate(userValidation.updateOwnerProfile),
  updateOwnerProfile
);
router.patch("/me/password", validate(userValidation.updatePassword), updatePassword);

export default router;
