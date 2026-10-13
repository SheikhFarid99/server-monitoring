const pino = require("pino");

const isDev = process.env.NODE_ENV !== "production";

console.log(process.env.NODE_ENV);
const AddLog = pino({
  level: process.env.LOG_LEVEL || "debug",

  base: {
    service: "my-api",
    environment: process.env.NODE_ENV || "development",
  },

  mixin() {
    return { loggedAt: new Date().toISOString() };
  },

  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});

module.exports = { AddLog };
