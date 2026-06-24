# /traceid-debug — One traceId Across 4 Observability Tools

> "Silent failures lose the chance to stay silent when every signal is tied together by a single thread: the traceId."

Activate: when investigating a production incident, debugging by traceId, or doing daily monitoring across the Sentry + Loki + Tempo + Prometheus/Grafana stack.

---

## 1. Four Tools, One Thread

Each tool does one job, but all are linked by a shared `traceId`.

| Tool | Role | Answers |
|------|------|---------|
| **Sentry** | Errors | "What broke?" — exception, source-map-resolved stack trace, root cause, traceId |
| **Loki** | Logs | "What happened around this request?" — filter by traceId |
| **Tempo** | Traces | "Which step was slow or failed?" — span waterfall: middleware, DB query, outbound API |
| **Prometheus + Grafana** | Metrics | "Is the system healthy, and where is it trending?" — throughput, error rate, p95 latency, CPU/RAM |

The key idea: all four share the same `traceId`. Start in Sentry → jump to Loki for logs → move to Tempo for the trace → conclude the root cause in minutes.

---

## 2. Access Points — Who Lives Where

- **Grafana** — `http://<vps-ip>:3000` — logs + traces + metrics. Sign in with the admin account.
- **Sentry** — org `that-nails-tech`. Separate projects: backend (`node-express`), frontend (`javascript-react`).
- **Health checks** — `/health` (liveness) and `/health/ready` (DB + Redis + Minio). Always check after every deploy.

The `traceId` is carried via the `X-Request-ID` header from the frontend, then appears in logs (Loki), spans (Tempo), and as a tag in Sentry.

---

## 3. What You Reach For Most

1. **Sentry — most used.** Reports errors automatically, no one has to watch. Tells you what broke, on which line (resolved to `.ts` via source maps), the root cause, and the traceId. The entry point for most investigations.
2. **Grafana → Loki (logs).** When Sentry lacks context, or the failure is not an exception (4xx, odd behavior). Filter by traceId to read the request's full log stream.
3. **Grafana → Prometheus (metrics).** Daily glance: throughput, error rate, p95 latency, CPU/RAM. Where you catch incidents before users report them.
4. **Grafana → Tempo (traces).** When you need to know which step was slow or failed. Open a trace → read the span waterfall.

**Quick rule of thumb:**
1. Error → Sentry
2. Logs for one request → Loki
3. Slow → Tempo
4. Health / trends → Prometheus

---

## 4. Standard Debug Flow

Assume a user reports a failure and hands you `traceId = abc123...`

**Step 1 — Sentry (what broke).** Find the traceId in Sentry. Read the message + stack trace (resolved to `.ts`, with line number and snippet) + root cause. Check the `release` tag to know which deploy the error belongs to.

**Step 2 — Loki (what happened around the request).** Grafana → Explore → Loki. Filter by traceId to see the request's log sequence: method/path, status, business logs, error lines.

**Step 3 — Tempo (which step was slow or failed).** From the Loki panel, click the traceId field → "Tempo" to jump straight to the trace. Read the waterfall: which span took time, which span has `status = error`.

**Step 4 — Conclude and fix.** Cross-reference all three: Sentry (the line of code) + Loki (the context) + Tempo (the timing) → root cause. Fix the code and deploy.

---

## 5. Daily Monitoring — Proactive, Not Reactive

**Every day (5 minutes):**
- Sentry: skim new issues, prioritize right after each deploy. Enable Alerts to notify via Slack/Telegram.
- Grafana: watch four signals — error rate, p95 latency, CPU/RAM, container restarts.

**After every deploy:**
- Compare error rate between the old and new release. A spike → suspect the deploy you just shipped.
- Verify `/health/ready` returns 200 (DB / Redis / Minio all reachable).

**Periodic (weekly):**
- Review slow queries in Tempo to find indexes worth optimizing.
- Scan `warn`-level logs in Loki for emerging issues.
