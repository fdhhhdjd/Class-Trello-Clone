import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../observability/logger.js";

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
};

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid input",
      details: err.flatten().fieldErrors,
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  (req?.log || logger).error({ err }, "Unhandled error");
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
};

// Wrap async handlers so thrown errors reach errorHandler.
export const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
