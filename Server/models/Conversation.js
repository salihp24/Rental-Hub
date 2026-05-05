import mongoose from "mongoose";


//stores individual data per user - chat status
const participantStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReadAt: Date,
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    //stores all user in the conversation 
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    //Stores individual chat status per user
    participantStates: [participantStateSchema],

    //Helps to avoid duplicate chats for same booking
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    //This chat is about THIS product
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    //who started
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    //custom name
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    //Quickly fetch last message details if needed
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    //Stores last message text directly
    lastMessageText: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    //last message sent
    lastMessageAt: Date,

    //if conversation is active
    isActive: {
      type: Boolean,
      default: true,
    },
    negotiation: {
      activeOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },
      acceptedOffer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },
      finalDailyRate: {
        type: Number,
        default: null,
      },
      finalRate: {
        type: Number,
        default: null,
      },
      finalPricingUnit: {
        type: String,
        enum: ["hourly", "daily", "weekly"],
        default: "daily",
      },
      currency: {
        type: String,
        default: "INR",
      },
      status: {
        type: String,
        enum: ["none", "pending", "accepted", "rejected"],
        default: "none",
      },
      updatedAt: Date,
    },
  },
  { timestamps: true }
);

//Creating index, otherwise  seach all documents - Mainly finding chats that a person involved
conversationSchema.index({ participants: 1 });

//Creates an index on booking - Ensures only one conversation per booking
conversationSchema.index(
  { booking: 1 },
  {
    unique: true,

    //Apply uniqueness ONLY when booking is a valid ObjectId - Ignore documents where booking is null
    partialFilterExpression: { booking: { $type: "objectId" } },
  }
);
// /Show newest books first
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
