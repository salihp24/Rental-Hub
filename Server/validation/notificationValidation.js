import { Joi, objectId, paginationQuerySchema } from "./joi.js";

export const notificationValidation = {
  listQuery: {
    query: paginationQuerySchema,
  },
  params: {
    params: Joi.object({
      notificationId: objectId("notificationId").required(),
    }),
  },
};
