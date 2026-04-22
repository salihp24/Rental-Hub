// Reusable Joi middleware for validating request body, params, and query.
import AppError from "../utils/AppError.js";
import { validationOptions } from "../validation/joi.js";

//store as array
const REQUEST_PARTS = ["body", "params", "query"];

//if we didnt specify where to validate, assume its body
const normaliseSchemas = (schemas) => {
  if (!schemas) {
    return {};
  }

  const isRequestMap = REQUEST_PARTS.some((part) => schemas[part]);
  return isRequestMap ? schemas : { body: schemas };
};

//formatting the response
const formatDetailMessage = (part, detail) => {
  const path = detail.path.length ? ` (${detail.path.join(".")})` : "";
  return `${part}${path}: ${detail.message.replace(/"/g, "")}`;
};

//takes schema, return  middleware, validate body-params-and quer, cleans the req, sends error
const validate = (schemas) => {
  const requestSchemas = normaliseSchemas(schemas);

  return (req, res, next) => {
    const messages = [];

    for (const part of REQUEST_PARTS) {
      const schema = requestSchemas[part];

      if (!schema) {
        continue;
      }

      const { error, value } = schema.validate(req[part], validationOptions);

      if (error) {
        messages.push(...error.details.map((detail) => formatDetailMessage(part, detail)));
        continue;
      }

      // Express 5 exposes some request properties (like req.query) as getters.
      // Mutate the existing object rather than reassigning the property.
        const target = req[part];
        if (target && typeof target === "object") {
          for (const key of Object.keys(target)) {
            delete target[key];
          }
          Object.assign(target, value);
        }
    }

    if (messages.length) {
      return next(new AppError(`Validation failed. ${messages.join(". ")}`, 400));
    }

    return next();
  };
};

export default validate;
