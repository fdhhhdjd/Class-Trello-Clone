import pino from "pino";
import { trace } from "@opentelemetry/api";
import { env } from "../config/env.js";

// Structured JSON logs. Each line carries trace_id (when a span is active) so logs
// link to traces in Grafana (Loki -> Tempo). Never log secrets/PII in plaintext.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "trello-api", env: env.NODE_ENV, version: env.SERVICE_VERSION },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    return { trace_id: traceId, span_id: spanId };
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "*.password",
      "*.token",
    ],
    censor: "[redacted]",
  },
});
