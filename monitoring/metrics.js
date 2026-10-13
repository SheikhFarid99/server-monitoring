const client = require("prom-client");
const register = new client.Registry();

client.collectDefaultMetrics({
  register: register,
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const totalRequestCount = new client.Counter({
  name: "total_request",
  help: "Total Request",
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(totalRequestCount);

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  totalRequestCount,
};
