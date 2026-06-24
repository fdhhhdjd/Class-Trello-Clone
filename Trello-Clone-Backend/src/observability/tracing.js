// OpenTelemetry bootstrap. MUST load before any instrumented lib (express, http,
// ioredis, pg) — wired via `node --import ./src/observability/tracing.js`.
// No-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset, so local dev stays clean.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME || "trello-api",
      [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION || "0.0.0",
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.on("SIGTERM", () => sdk.shutdown().catch(() => {}));
}
