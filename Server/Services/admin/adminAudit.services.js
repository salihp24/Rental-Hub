import AdminAuditLog from "../../models/AdminAuditLog.js";

// creates/saves a new audit log.
export const createAdminAuditLogService = async ({
  actorId,
  entityType,
  entityId,
  action,
  before = null,
  after = null,
  meta = null,
}) =>
  AdminAuditLog.create({
    actor: actorId,
    entityType,
    entityId,
    action,
    before,
    after,
    meta,
  });

export const listAdminAuditLogsService = async (query = {}) => {
  const { page = 1, limit = 10, entityType, action, actor, sort } = query;
  const filter = {};

  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;
  if (actor) filter.actor = actor;

  const skip = (Number(page) - 1) * Number(limit);
  const sortBy = sort || "-createdAt";

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .populate("actor", "name email role")
      .sort(sortBy)
      .skip(skip)
      .limit(Number(limit)),
    AdminAuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};
