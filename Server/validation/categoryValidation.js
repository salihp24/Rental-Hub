// Joi schemas for category create/update requests and category queries.
import { Joi, objectId, paginationQuerySchema } from "./joi.js";

const categoryAttributeSchema = Joi.object({
  name: Joi.string().trim().max(50).required(),
  key: Joi.string().trim().lowercase().max(50).required(),
  type: Joi.string().valid("text", "number", "boolean", "select").default("text"),
  options: Joi.array().items(Joi.string().trim().max(50)).default([]),
  isFilterable: Joi.boolean().default(true),
  isRequired: Joi.boolean().default(false),
});

const optionalImageSchema = Joi.object({
  url: Joi.string().trim().allow("").default(""),
  publicId: Joi.string().trim().allow("").default(""),
});

const parentField = Joi.alternatives()
  .try(objectId("parent"), Joi.valid(null))
  .optional()
  .default(null);

const categoryBodyShape = {
  name: Joi.string().trim().min(2).max(50).required(),
  description: Joi.string().trim().max(500).allow("").default(""),
  image: optionalImageSchema.default({ url: "", publicId: "" }),
  slug: Joi.string().trim().lowercase().max(80).optional(),
  parent: parentField,
  attributes: Joi.array().items(categoryAttributeSchema).default([]),
  isActive: Joi.boolean(),
};

const createCategoryBodySchema = Joi.object(categoryBodyShape);
const updateCategoryBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  description: Joi.string().trim().max(500).allow(""),
  image: optionalImageSchema,
  slug: Joi.string().trim().lowercase().max(80),
  parent: Joi.alternatives().try(objectId("parent"), Joi.valid(null)),
  attributes: Joi.array().items(categoryAttributeSchema),
  isActive: Joi.boolean(),
}).min(1);

const categoryIdParamsSchema = Joi.object({
  categoryId: objectId("categoryId").required(),
});

const parentListFilter = Joi.alternatives()
  .try(objectId("parent"), Joi.string().lowercase().valid("null", "root"), Joi.valid(null))
  .optional();

const categoryListQuerySchema = paginationQuerySchema.keys({
  parent: parentListFilter,
  rootsOnly: Joi.boolean().default(false),
  isActive: Joi.boolean(),
});

const categoryTreeQuerySchema = Joi.object({}).unknown(true);

export const categoryValidation = {
  create: { body: createCategoryBodySchema },
  update: { body: updateCategoryBodySchema },
  params: { params: categoryIdParamsSchema },
  listQuery: { query: categoryListQuerySchema },
  treeQuery: { query: categoryTreeQuerySchema },
};

export default categoryValidation;
