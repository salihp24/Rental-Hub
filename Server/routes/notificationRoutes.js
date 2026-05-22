import express from "express";

import protect from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { notificationValidation } from "../validation/index.js";

const router = express.Router();

router.use(protect);

router.get("/", validate(notificationValidation.listQuery), listMyNotifications);
router.post("/read-all", markAllNotificationsRead);
router.post(
  "/:notificationId/read",
  validate(notificationValidation.params),
  markNotificationRead
);

export default router;
