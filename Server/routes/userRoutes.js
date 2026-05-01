// User auth routes. Joi validation runs before the controller handlers.
import express from "express";

import validate from "../middleware/validate.js";
import protect from "../middleware/auth.js";
import { userValidation } from "../validation/index.js";
import {
  getMe,
  loginUser,
  logoutUser,
  registerUser,
  updateMe,
  updateOwnerProfile,
  updatePassword,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/register", validate(userValidation.register), registerUser);
router.post("/login", validate(userValidation.login), loginUser);
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
