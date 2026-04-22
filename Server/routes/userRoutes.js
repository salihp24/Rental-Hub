// User auth routes. Joi validation runs before the controller handlers.
import express from "express";

import validate from "../middleware/validate.js";
import { userValidation } from "../validation/index.js";
import {
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/register", validate(userValidation.register), registerUser);
router.post("/login", validate(userValidation.login), loginUser);
router.post("/logout", logoutUser);

export default router;
