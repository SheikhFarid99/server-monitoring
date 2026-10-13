const { AddLog } = require("../monitoring/logger");
const AppError = require("../utils/appError");

const errorHandler = (err, req, res, next) => {
  const statusCode = (err instanceof AppError && err.statusCode) || 500;
  const message = statusCode === 500 ? "Internal server error" : err.message;
  const errors = err instanceof AppError ? err.errors : {};

  AddLog.error(
    {
      ...errors,
    },
    message,
  );

  res.status(statusCode).json({
    status: "error",
    message,
    errors,
  });
};
module.exports = errorHandler;
