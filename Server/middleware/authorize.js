import AppError from "../utils/AppError.js";

/**
 * After `protect`, restrict route to users that have any of the given roles.
 */
export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new AppError("You are not logged in.", 401));
    }

    const allowed = roles.some((role) => req.user.hasRole(role));
    if (!allowed) {
      return next(new AppError("You do not have permission to perform this action.", 403));
    }

    return next();
  };

export default restrictTo;
