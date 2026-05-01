import express from "express";

import protect from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  createConversation,
  getConversation,
  listMessages,
  listMyConversations,
  markConversationRead,
  respondToOffer,
  sendOffer,
  sendMessage,
} from "../controllers/chatController.js";
import { chatValidation } from "../validation/index.js";

const router = express.Router();

router.use(protect);

router.get("/", validate(chatValidation.listQuery), listMyConversations);
router.post("/", validate(chatValidation.createConversation), createConversation);
router.get("/:conversationId", validate(chatValidation.params), getConversation);
// Get messages of a conversation
router.get(
  "/:conversationId/messages",
  validate({ ...chatValidation.params, ...chatValidation.listQuery }),
  listMessages
);
router.post(
  "/:conversationId/messages",
  validate({ ...chatValidation.params, ...chatValidation.sendMessage }),
  sendMessage
);
router.post(
  "/:conversationId/offers",
  validate({ ...chatValidation.params, ...chatValidation.sendOffer }),
  sendOffer
);
router.post(
  "/:conversationId/offers/:messageId/respond",
  validate({ ...chatValidation.offerParams, ...chatValidation.respondOffer }),
  respondToOffer
);
router.post("/:conversationId/read", validate(chatValidation.params), markConversationRead);

export default router;
