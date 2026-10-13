const express = require("express");
const app = express();
const morgan = require("morgan");
const AppError = require("./utils/appError");

const {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  totalRequestCount,
} = require("./monitoring/metrics");
const errorHandler = require("./middlewares/errorHandler");
const { AddLog } = require("./monitoring/logger");

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000_000;

    const route = req.route?.path || "unknown";

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    totalRequestCount.inc();
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
});

app.use(express.json({ limit: "1mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", register.contentType);
  let mtx = await register.metrics();
  res.send(mtx);
});

app.get("/", (req, res) => {
  return res.status(200).json({ status: true, message: "Server is running" });
});

app.get("/error", (req, res) => {
  throw new AppError("User not found", 400, { message: "User not found" });
});

app.get("/warning", (req, res) => {
  AddLog.warn("Save new file without delete old file");
  return res
    .status(200)
    .json({ status: true, message: "Save new file without delete old file" });
});

app.get("/info", (req, res) => {
  AddLog.info("Payment success");
  return res.status(200).json({ status: true, message: "Payment success" });
});

app.use((req, res, next) => {
  next(
    new AppError(`This api not found`, 404, { message: "This url not found" }),
  );
});

app.use(errorHandler);

process.on("uncaughtException", (err) => {
  AddLog.fatal(
    {
      ...err,
    },
    "Uncaught Exception",
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  AddLog.error(
    {
      ...reason,
    },
    "Unhandled Rejection",
  );
  process.exit(1);
});

module.exports = { app };
