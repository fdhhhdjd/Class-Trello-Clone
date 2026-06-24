import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from "prom-client";

export const register = new Registry();
register.setDefaultLabels({ service: "trello-api" });
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "In-flight HTTP requests",
  registers: [register],
});

// Low-cardinality route label: matched Express pattern, never the raw path with ids.
function routeLabel(req) {
  const base = req.baseUrl || "";
  const path = req.route?.path;
  if (!path) return base || "unknown";
  return `${base}${path === "/" ? "" : path}` || "unknown";
}

export function metricsMiddleware(req, res, next) {
  if (req.path === "/metrics") return next();
  const end = httpRequestDuration.startTimer({ method: req.method });
  httpRequestsInFlight.inc();
  res.on("finish", () => {
    const route = routeLabel(req);
    httpRequestsInFlight.dec();
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    end({ route });
  });
  next();
}

export async function metricsHandler(_req, res) {
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
}

// Optional domain metrics — import and use in service/cache layer.
export const cacheHits = new Counter({
  name: "app_cache_hits_total",
  help: "Cache hits",
  labelNames: ["feature"],
  registers: [register],
});
export const cacheMisses = new Counter({
  name: "app_cache_misses_total",
  help: "Cache misses",
  labelNames: ["feature"],
  registers: [register],
});
