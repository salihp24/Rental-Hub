// Central Express error middleware for app, MongoDB, JWT, and Joi errors.
import AppError from "../utils/AppError.js";

const handleCastErrorDB = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const duplicateEntry = err.keyValue ? Object.entries(err.keyValue)[0] : null;

  if (duplicateEntry) {
    const [field, value] = duplicateEntry;
    return new AppError(
      `Duplicate field value for ${field}: ${value}. Please use another value.`,
      400
    );
  }

  const fallbackValue = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = fallbackValue
    ? `Duplicate field value: ${fallbackValue}. Please use another value.`
    : "Duplicate field value. Please use another value.";

  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input data: ${errors.join(". ")}`, 400);
};

const handleJoiValidationError = (err) => {
  const errors = (err.details || []).map((detail) =>
    detail.message.replace(/"/g, "")
  );
  return new AppError(`Invalid input data: ${errors.join(". ")}`, 400);
};

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired. Please log in again.", 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error("ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong.",
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message, errmsg: err.errmsg, keyValue: err.keyValue };
    if (err.name === "CastError") error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === "ValidationError") error = handleValidationErrorDB(error);
    if (err.isJoi) error = handleJoiValidationError(err);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();
    sendErrorProd(error, res);
  }
};

export default errorHandler;
