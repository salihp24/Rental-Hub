import AppError from "../../utils/AppError.js";

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError("You are not logged in.", 401));
  }

  if (!req.user.hasRole("admin")) {
    return next(new AppError("Admin access required.", 403));
  }

  return next();
};

export default isAdmin;
