import mongoose from "mongoose";

const messageReadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

//represents one message in a conversation.
const messageSchema = new mongoose.Schema(
  {
    //Links message to a conversation
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    // Stores who sent the message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      //system-generated message
      enum: ["text", "system", "offer"],
      default: "text",
    },

    //Actual message content
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    offer: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: "INR",
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "cancelled"],
        default: "pending",
      },
      proposedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null,
      },
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },
      startDate: Date,
      endDate: Date,
      pricingUnit: {
        type: String,
        enum: ["hourly", "daily", "weekly"],
        default: "daily",
      },
      totalUnits: {
        type: Number,
        default: 0,
      },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      respondedAt: Date,
    },

    //Stores list of users who read the message
    readBy: [messageReadSchema],

    //Stores when message was edited
    editedAt: Date,

    //soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

//Latest messages first
messageSchema.index({ conversation: 1, createdAt: -1 });

//Speeds up queries by sender
messageSchema.index({ sender: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
