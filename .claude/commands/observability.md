# /observability — Metrics · Logs · Traces · SLO (stack-agnostic)

> *"You can't fix what you can't see. Measure user pain, not server vanity."*

**Trigger**: User muốn thêm observability/monitoring vào bất kỳ dự án nào (web, API, mobile backend, batch, microservices) — không phụ thuộc ngôn ngữ hay hạ tầng.

**Khác với [`monitoring.md`](monitoring.md)**: file đó là setup cụ thể (Prometheus + Grafana + Telegram trên VPS Docker, Go/Gin). File này là **tầng tư duy + chuẩn**: 3 pillars, RED/USE, SLI/SLO/error-budget, multi-window burn alert, distributed tracing, structured logging — chọn rồi map xuống `monitoring.md` để thực thi.

---

## 0 — Hỏi trước khi làm (Discovery)

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| Q1 | Stack backend? (Go/Node/Python/Java/...) | Chọn client lib + middleware snippet |
| Q2 | Runtime? (Docker Compose / K8s / serverless / bare metal) | Scrape config: static vs service discovery |
| Q3 | Cần pillar nào? (metrics / logs / traces — chọn ≥1) | Scope việc. Metrics gần như luôn bắt buộc |
| Q4 | Đã có Prometheus/Grafana chưa? | Có → chỉ thêm `/metrics` + dashboard. Chưa → dùng `monitoring.md` dựng stack |
| Q5 | SLO target? (vd 99.9% availability, p95 < 500ms) | Quyết định error budget + burn-rate alert |
| Q6 | Alert đi đâu? (Telegram / Slack / PagerDuty / email) | Cấu hình receiver |

> Không đoán. Q1 + Q2 sai → toàn bộ snippet sai.

---

## 1 — Ba trụ cột (3 Pillars)

```
            ┌──────────── OBSERVABILITY ────────────┐
   METRICS              LOGS                 TRACES
   (cái gì sai)      (tại sao sai)       (sai ở đâu trong chuỗi)
   số, rẻ, alert     text, ngữ cảnh      span, cross-service
   Prometheus        Loki/ELK            Jaeger/Tempo (OTel)
```

| Pillar | Trả lời câu hỏi | Cost | Bắt đầu từ |
|--------|-----------------|------|------------|
| **Metrics** | "Có vấn đề không? Mức độ?" | Rẻ nhất | Luôn làm đầu tiên |
| **Logs** | "Chuyện gì đã xảy ra?" | Trung bình | Khi cần debug chi tiết |
| **Traces** | "Chậm/lỗi ở service nào?" | Đắt (sampling) | Khi có ≥3 service gọi nhau |

**Thứ tự triển khai**: Metrics → Logs có cấu trúc → Traces. Đừng làm traces trước khi có metrics.

---

## 2 — Đo cái gì: RED + USE

**RED Method — cho service (request-driven):**
- **R**ate — request/giây
- **E**rrors — tỉ lệ lỗi (5xx / tổng)
- **D**uration — latency p50/p95/p99

**USE Method — cho resource (CPU/RAM/disk/queue):**
- **U**tilization — % thời gian bận
- **S**aturation — độ dài hàng đợi / wait time
- **E**rrors — số lỗi

> Golden Signals của Google = RED + Saturation. Mỗi service mới: đảm bảo có đủ 4 chỉ số (rate, error, latency, saturation) trước khi ship.

---

## 3 — Instrument `/metrics` (chọn theo Q1)

Mọi service expose endpoint `/metrics` (Prometheus text format). 3 metric tối thiểu:
`http_requests_total` (counter), `http_request_duration_seconds` (histogram), `*_in_flight` (gauge).

**Go (Gin)** → đã có sẵn trong [`monitoring.md`](monitoring.md) Step 1. Dùng lại.

**Node (Express + prom-client):**
```js
import { Counter, Histogram, Gauge, register } from 'prom-client'
import 'prom-client/lib/defaultMetrics' // process/runtime metrics

const reqTotal = new Counter({ name: 'http_requests_total', help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] })
const reqDur = new Histogram({ name: 'http_request_duration_seconds', help: 'Request duration',
  labelNames: ['method', 'route'], buckets: [.005,.01,.025,.05,.1,.25,.5,1,2.5,5,10] })
const inFlight = new Gauge({ name: 'http_requests_in_flight', help: 'In-flight requests' })

export function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next()
  const end = reqDur.startTimer({ method: req.method })
  inFlight.inc()
  res.on('finish', () => {
    const route = req.route?.path || 'unknown'
    inFlight.dec()
    reqTotal.inc({ method: req.method, route, status_code: res.statusCode })
    end({ route })
  })
  next()
}
// app.use(metricsMiddleware)
// app.get('/metrics', async (_, res) => res.type(register.contentType).send(await register.metrics()))
```

**Python (FastAPI + prometheus_client):**
```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
import time

REQ = Counter('http_requests_total', 'Total requests', ['method','route','status_code'])
DUR = Histogram('http_request_duration_seconds', 'Duration', ['method','route'],
                buckets=(.005,.01,.025,.05,.1,.25,.5,1,2.5,5,10))
INFLIGHT = Gauge('http_requests_in_flight', 'In-flight')

@app.middleware("http")
async def metrics_mw(request, call_next):
    if request.url.path == "/metrics":
        return await call_next(request)
    INFLIGHT.inc(); start = time.perf_counter()
    resp = await call_next(request)
    route = request.scope.get("route").path if request.scope.get("route") else "unknown"
    INFLIGHT.dec()
    REQ.labels(request.method, route, resp.status_code).inc()
    DUR.labels(request.method, route).observe(time.perf_counter() - start)
    return resp

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

**Rules chung mọi ngôn ngữ:**
1. Đặt tên `prefix_name_unit` — vd `http_request_duration_seconds`, KHÔNG `requestTimeMs`.
2. Histogram cho latency (để tính quantile server-side), KHÔNG gauge.
3. Cardinality thấp: KHÔNG nhét `user_id`, `request_id`, raw path (`/user/123`) vào label → nổ memory. Dùng route template (`/user/:id`).
4. `/metrics` phải bị chặn ra Internet (nginx `deny all` — xem `monitoring.md` Step 5).

---

## 4 — SLI → SLO → Error Budget

```
SLA  (hợp đồng với khách — có penalty)
 └─ SLO  (mục tiêu nội bộ, vd 99.9%)
     └─ SLI  (số đo thực tế, vd success_rate hiện tại)
```

**SLI phổ biến (PromQL, dùng window dài 28d/30d):**
```promql
# Availability SLI = good / total
sum(rate(http_requests_total{status!~"5.."}[28d])) / sum(rate(http_requests_total[28d]))

# Latency SLI = % request nhanh hơn 500ms
sum(rate(http_request_duration_seconds_bucket{le="0.5"}[28d]))
/ sum(rate(http_request_duration_seconds_count[28d]))
```

**Bảng SLO → downtime cho phép:**

| SLO % | Downtime/tháng | Downtime/năm | Dùng cho |
|-------|----------------|--------------|----------|
| 99%    | 7.2 giờ   | 3.65 ngày | batch, internal tool |
| 99.9%  | 43.2 phút | 8.76 giờ  | API thường, web app |
| 99.95% | 21.6 phút | 4.38 giờ  | core business |
| 99.99% | 4.32 phút | 52.6 phút | payment, auth |

**Error Budget = 1 − SLO.** SLO 99.9% → budget 0.1% = 43.2 phút/tháng được phép lỗi.

**Error Budget Policy (gắn vào quy trình release):**

| Budget còn lại | Hành động |
|----------------|-----------|
| 100–50% | Ship bình thường, tốc độ tối đa |
| 50–10%  | Hoãn change rủi ro cao, review kỹ |
| 10–0%   | Freeze feature non-critical, ưu tiên fix |
| ≤ 0%    | Feature freeze hoàn toàn, chỉ làm reliability |

> Tier dịch vụ: critical 99.95% / essential 99.9% / standard 99.5% / best-effort 99%. Đừng đặt 99.99% cho mọi thứ — mỗi "9" tăng thêm chi phí gấp bội.

---

## 5 — Alert: Multi-Window Multi-Burn-Rate (chuẩn Google SRE)

Đừng alert "error > 5%". Alert theo **tốc độ đốt budget** — bắt sự cố lớn nhanh, bỏ qua nhiễu nhỏ.

**Recording rules (tính burn rate nhiều cửa sổ):**
```yaml
groups:
  - name: slo_burn
    interval: 30s
    rules:
      - record: slo:burn_rate_5m
        expr: (1 - (sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m])))) / (1 - 0.999)
      - record: slo:burn_rate_1h
        expr: (1 - (sum(rate(http_requests_total{status!~"5.."}[1h])) / sum(rate(http_requests_total[1h])))) / (1 - 0.999)
      - record: slo:burn_rate_30m
        expr: (1 - (sum(rate(http_requests_total{status!~"5.."}[30m])) / sum(rate(http_requests_total[30m])))) / (1 - 0.999)
      - record: slo:burn_rate_6h
        expr: (1 - (sum(rate(http_requests_total{status!~"5.."}[6h])) / sum(rate(http_requests_total[6h])))) / (1 - 0.999)
```

**Alert rules (2 cửa sổ AND nhau để chống false positive):**
```yaml
groups:
  - name: slo_alerts
    rules:
      # Fast burn — đốt 2% budget trong 1h → PAGE ngay
      - alert: ErrorBudgetFastBurn
        expr: slo:burn_rate_1h > 14.4 and slo:burn_rate_5m > 14.4
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Đốt error budget 14.4x — sự cố lớn"
          runbook: "https://runbooks.example.com/fast-burn"

      # Slow burn — đốt 5–10% budget trong 6h → TICKET
      - alert: ErrorBudgetSlowBurn
        expr: slo:burn_rate_6h > 6 and slo:burn_rate_30m > 6
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: "Đốt error budget 6x — rò rỉ chậm"

      - alert: ErrorBudgetExhausted
        expr: (slo:burn_rate_1h) < 0   # thay bằng error_budget_remaining < 0 nếu có
        for: 5m
        labels: { severity: critical }
```

| Loại | Burn rate | Cửa sổ | Đốt budget | Hành động |
|------|-----------|--------|------------|-----------|
| Fast | 14.4x | 1h + 5m | 2% trong 1h | Page (gọi người) |
| Slow | 6x | 6h + 30m | 5% trong 6h | Ticket |

> Mỗi alert critical PHẢI có `runbook` link. Alert không có runbook = đánh thức người lúc 3h sáng mà không biết làm gì.

---

## 6 — Structured Logging (Pillar 2)

Log JSON một dòng, có `trace_id` để nối với traces. KHÔNG log `printf` plain text.

```python
# JSON log tối thiểu — mọi ngôn ngữ map tương tự
{
  "@timestamp": "2026-06-17T10:30:00Z",
  "level": "ERROR",
  "service": "api", "version": "1.3.0", "env": "production",
  "message": "payment failed",
  "trace_id": "4bf92f3577b34da6...",   # nối sang Jaeger/Tempo
  "user_id_hash": "ab12...",            # hash, KHÔNG plaintext PII
  "error": { "type": "TimeoutError", "stack": "..." }
}
```

**Rules:**
1. Log level đúng: `debug` (dev) / `info` (prod) / `warn` / `error`. Prod KHÔNG bật debug.
2. Mỗi log error kèm `trace_id` + `error.type` + `stack`.
3. KHÔNG log secret/password/token/PII thô → hash hoặc redact.
4. Aggregation: Loki (nhẹ, hợp Grafana) hoặc ELK (mạnh, nặng). Dev nhỏ → Loki.
5. Rate-limit log spam (1 lỗi lặp 10k lần/phút → sample, đừng ghi hết).

---

## 7 — Distributed Tracing (Pillar 3 — chỉ khi ≥3 service)

Dùng **OpenTelemetry** (chuẩn vendor-neutral) → export sang Jaeger hoặc Tempo.

```js
// OTel Node — auto-instrument, export Jaeger
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  serviceName: 'api',
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_ENDPOINT }),
  instrumentations: [getNodeAutoInstrumentations()],
})
sdk.start()
```

**Rules:**
1. **Sampling 1–10%** ở prod — 100% trace = nổ chi phí + overhead.
2. **Propagate context** qua MỌI ranh giới service (HTTP header `traceparent`). Thiếu 1 hop → đứt trace.
3. Tag span: `user_id`, `request_id`, `db.query` (đã sanitize). KHÔNG tag giá trị secret.
4. Overhead trace phải < 1% CPU. Đo trước khi bật toàn bộ.
5. Nối log ↔ trace bằng `trace_id` (Section 6) → click từ Grafana sang Jaeger.

---

## 8 — Dashboard (Grafana)

Phân tầng thông tin: **số to (stat) → xu hướng (time series) → chi tiết (table/heatmap)**.

| Dashboard | Panel chính | Grafana ID (import) |
|-----------|-------------|---------------------|
| Node/Host | CPU, RAM, disk, network | 1860 (Node Exporter Full) |
| API (RED) | rate, error %, p50/p95/p99 latency | custom (xem `monitoring.md`) |
| PostgreSQL | QPS, connections, replication lag | 9628 |
| Redis | hit rate, evictions, memory | 11835 |
| SLO | compliance %, budget remaining gauge, burn-rate trend | custom |

> Dùng template variable `${datasource}` + `$service` để 1 dashboard chạy đa môi trường (dev/prod). Xem `monitoring.md` Step 4 cho script add variable.

---

## 9 — Checklist trước khi ship

```
Metrics
- [ ] /metrics trả http_requests_total + _duration_seconds + _in_flight
- [ ] /metrics bị chặn ra Internet (nginx deny all → 403)
- [ ] Label cardinality thấp (KHÔNG có user_id/raw-path trong label)
- [ ] Prometheus thấy target UP

SLO
- [ ] SLO target được chốt với owner (vd 99.9% / p95 500ms)
- [ ] Recording rules burn_rate (5m/30m/1h/6h) chạy
- [ ] Multi-window burn alert: fast (page) + slow (ticket)
- [ ] Mỗi alert critical có runbook link
- [ ] Error budget policy gắn vào quy trình release

Logs (nếu chọn)
- [ ] Log JSON structured, có trace_id
- [ ] Prod log level = info, KHÔNG có PII/secret

Traces (nếu ≥3 service)
- [ ] OTel context propagate qua mọi hop
- [ ] Sampling 1–10% ở prod
- [ ] trace_id nối được log ↔ Jaeger

Dashboard + Alert
- [ ] RED dashboard cho mỗi service
- [ ] SLO dashboard (compliance + budget + burn)
- [ ] Alert đến đúng kênh (test message thật)
- [ ] Prod thresholds nghiêm hơn dev
```

---

## Anti-patterns ❌

- Đo CPU/RAM (vanity) mà KHÔNG đo error rate + latency (user pain) → mù với sự cố thật.
- Nhét `user_id`/`request_id`/raw path vào Prometheus label → cardinality explosion, OOM.
- Alert "CPU > 80%" thay vì alert theo SLO burn rate → noise, alert fatigue, page nhầm.
- Alert critical không kèm runbook → người trực không biết xử lý.
- Bật tracing sampling 100% ở prod → nổ chi phí + overhead.
- Đứt context propagation giữa service → trace gãy, vô dụng.
- Gauge cho latency thay vì histogram → không tính được p95/p99 server-side.
- Log plain text không trace_id → không nối được metrics ↔ logs ↔ traces.
- Đặt SLO 99.99% cho mọi service "cho chắc" → tốn kém vô lý, không ai đạt nổi.
- Làm traces/logs trước khi có metrics cơ bản → ngược thứ tự, lãng phí.
- Expose Grafana/Prometheus UI ra Internet không auth → rò rỉ toàn bộ metric nội bộ.

---

## Khi nào chạy /observability

- Trước khi mở public traffic / chạy quảng cáo lớn.
- Khi service thứ 3 gọi nhau (cần traces).
- Khi có sự cố mà "không biết tại sao chậm".
- Khi muốn ký SLA với khách → cần SLO + error budget trước.
- Sau đó: dùng [`monitoring.md`](monitoring.md) để dựng stack Prometheus + Grafana + Telegram cụ thể.
