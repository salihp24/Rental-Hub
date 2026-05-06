import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    entityType: {
      type: String,
      enum: ["user", "product", "booking"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ actor: 1, createdAt: -1 });
adminAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });

const AdminAuditLog = mongoose.model("AdminAuditLog", adminAuditLogSchema);

export default AdminAuditLog;
