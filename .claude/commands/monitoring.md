# /monitoring — Prometheus + Grafana Monitoring Setup

> **Trigger**: User muốn thêm monitoring stack vào một project.
> **Stack**: Prometheus + Grafana + Node Exporter + exporters tương ứng.
> **Pattern**: Prometheus trên cùng VPS với app — Grafana trên dev VPS, query prod qua Nginx auth proxy.

---

## Architecture Decision (hỏi trước)

```
Option A — Single VPS (dev/staging):
  Prometheus + Grafana + exporters → cùng docker-compose với app
  Access: http://<vps-ip>:3000

Option B — Split (prod):
  Prod VPS: Prometheus + exporters (internal)
            Nginx /prom-proxy/ → Prometheus (basic auth)
  Dev VPS:  Grafana → query Prod Prometheus qua https://<domain>/prom-proxy/
```

Prod luôn dùng Option B — không expose Grafana trên prod.

---

## Step 1 — Backend: Expose `/metrics`

**Go + Gin:**

```bash
go get github.com/prometheus/client_golang@latest
```

**`internal/middlewares/prometheusMetrics.go`:**

```go
package middlewares

import (
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "http_requests_total",
    }, []string{"method", "path", "status_code"})

    httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "http_request_duration_seconds",
        Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
    }, []string{"method", "path"})

    httpRequestsInFlight = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "http_requests_in_flight",
    })
)

func normalizePath(path string) string {
    if path == "" { return "unknown" }
    return strings.TrimPrefix(path, "/api")
}

func PrometheusMetrics() gin.HandlerFunc {
    return func(c *gin.Context) {
        if c.Request.URL.Path == "/metrics" { c.Next(); return }
        path := normalizePath(c.FullPath())
        start := time.Now()
        httpRequestsInFlight.Inc()
        c.Next()
        httpRequestsInFlight.Dec()
        httpRequestsTotal.WithLabelValues(c.Request.Method, path, strconv.Itoa(c.Writer.Status())).Inc()
        httpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(time.Since(start).Seconds())
    }
}
```

**`internal/routers/router.go`:**

```go
import "github.com/prometheus/client_golang/prometheus/promhttp"

r.Use(middlewares.PrometheusMetrics())
r.GET("/metrics", gin.WrapH(promhttp.Handler()))
```

**Custom cache metrics — `internal/metrics/cache.go`:**

```go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    CacheHits = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "app_cache_hits_total",
    }, []string{"feature"})

    CacheMisses = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "app_cache_misses_total",
    }, []string{"feature"})
)
```

Wire vào service layer:
```go
// Cache hit
metrics.CacheHits.WithLabelValues("flags").Inc()
// Cache miss
metrics.CacheMisses.WithLabelValues("flags").Inc()
```

---

## Step 2 — Docker Compose Services

**Option A (dev/staging) — thêm vào `docker-compose.yml`:**

```yaml
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: <app>-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - /opt/<app>/monitoring/prometheus:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'
    networks: [<app>-net]
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.4.2
    container_name: <app>-grafana
    volumes:
      - /opt/<app>/monitoring/grafana:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_AUTH_ANONYMOUS_ENABLED: "false"
    ports: ["${GRAFANA_PORT:-3000}:3000"]
    networks: [<app>-net]
    restart: unless-stopped
    depends_on: [prometheus]

  node_exporter:
    image: prom/node-exporter:v1.7.0
    container_name: <app>-node-exporter
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks: [<app>-net]
    restart: unless-stopped

  postgres_exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    environment:
      DATA_SOURCE_NAME: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?sslmode=disable
    networks: [<app>-net]
    restart: unless-stopped

  redis_exporter:
    image: oliver006/redis_exporter:v1.58.0
    environment:
      REDIS_ADDR: redis://redis:6379
    networks: [<app>-net]
    restart: unless-stopped
```

**Option B (prod) — `docker-compose.prod.yml` (NO grafana):**

```yaml
  # Same as above but WITHOUT grafana service
  # Add prom_auth volume to nginx:
  nginx:
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/prom_auth:/etc/nginx/prom_auth:ro  # ← add this
```

---

## Step 3 — Prometheus Config

**`monitoring/prometheus.yml`:**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: <app>_api
    static_configs:
      - targets: ['api:8080']    # service name in docker-compose
    metrics_path: /metrics

  - job_name: node
    static_configs:
      - targets: ['node_exporter:9100']

  - job_name: postgres
    static_configs:
      - targets: ['postgres_exporter:9187']

  - job_name: redis
    static_configs:
      - targets: ['redis_exporter:9121']

  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']
```

---

## Step 4 — Grafana Provisioning

**`monitoring/grafana/provisioning/datasources/prometheus.yml`:**

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**`monitoring/grafana/provisioning/dashboards/dashboards.yml`:**

```yaml
apiVersion: 1
providers:
  - name: <App>
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /etc/grafana/provisioning/dashboards
```

**Dashboard JSONs recommended:**

| Dashboard | Grafana ID | Download |
|---|---|---|
| Node Exporter Full | 1860 | `curl -sL "https://grafana.com/api/dashboards/1860/revisions/latest/download" -o node-exporter.json` |
| PostgreSQL | 9628 | `curl -sL "https://grafana.com/api/dashboards/9628/revisions/latest/download" -o postgres.json` |
| Redis (custom Grafana 10.4) | — | Write from scratch (see diary monitoring spec) |
| Go API (custom) | — | Write from scratch |

> **Important:** Community dashboards use `${ds_prometheus}` variable. Replace with actual datasource UID or add `${datasource}` variable.

**Add multi-env datasource variable to dashboards:**

```python
# Quick script to add ${datasource} variable to all dashboard JSONs
import json, re, glob

for path in glob.glob("monitoring/grafana/provisioning/dashboards/*.json"):
    with open(path) as f: d = json.load(f)
    # Add variable
    t = d.setdefault("templating", {"list": []})
    t["list"] = [v for v in t.get("list", []) if v.get("name") != "datasource"]
    t["list"].insert(0, {"name": "datasource", "type": "datasource",
        "pluginId": "prometheus", "label": "🌍 Environment",
        "query": "prometheus", "refresh": 1})
    # Replace hardcoded UID
    content = re.sub(r'"uid":\s*"[A-Z0-9]{16,}"', '"uid": "${datasource}"', json.dumps(d))
    with open(path, 'w') as f: f.write(content)
```

---

## Step 5 — Nginx Changes

**Block `/metrics` + expose Grafana (dev):**

```nginx
# In main server block
location = /metrics {
    deny all;
    return 403;
}

# Grafana subdomain (dev only)
server {
    listen 80;
    server_name <app>-grafana.<domain>;
    location / {
        proxy_pass http://grafana:3000;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Prod — Prometheus auth proxy:**

```nginx
# In HTTPS server block
location = /metrics { deny all; return 403; }

location /prom-proxy/ {
    auth_basic           "Prometheus";
    auth_basic_user_file /etc/nginx/prom_auth;
    rewrite ^/prom-proxy/(.*)$ /$1 break;
    set $upstream_prom prometheus:9090;
    proxy_pass http://$upstream_prom;
    proxy_set_header Host $host;
}
```

**Create htpasswd file:**

```bash
apt-get install -y apache2-utils
htpasswd -cb /path/to/nginx/prom_auth prom_user <strong-password>
```

---

## Step 6 — Add Prod Prometheus Datasource to Dev Grafana

```bash
curl -u admin:<grafana_password> -X POST http://<dev-grafana>:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prod Prometheus",
    "type": "prometheus",
    "access": "proxy",
    "url": "https://<domain>/prom-proxy/",
    "basicAuth": true,
    "basicAuthUser": "prom_user",
    "secureJsonData": {"basicAuthPassword": "<prom_password>"},
    "isDefault": false
  }'
```

---

## Step 7 — Host-path Directories

```bash
# Dev VPS
mkdir -p /opt/<app>/monitoring/prometheus /opt/<app>/monitoring/grafana
chown -R 65534:65534 /opt/<app>/monitoring/prometheus   # nobody (prometheus)
chown -R 472:472 /opt/<app>/monitoring/grafana           # grafana user

# Prod VPS (no grafana dir needed)
mkdir -p /opt/<app>/monitoring/prometheus
chown -R 65534:65534 /opt/<app>/monitoring/prometheus
```

---

## Step 8 — Telegram Alerting

**Create contact point:**

```bash
curl -u admin:<grafana_password> -X POST http://<grafana>:3000/api/v1/provisioning/contact-points \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Telegram — <App> Alerts",
    "type": "telegram",
    "settings": {
      "bottoken": "<bot_token>",
      "chatid": "<chat_id>",
      "message": "{{ if eq .Status \"firing\" }}🚨{{ else }}✅{{ end }} [{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}\n\n{{ range .Alerts }}📌 {{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}"
    },
    "disableResolveMessage": false
  }'
```

**6 essential alert rules:**

| Alert | Condition | Severity | For |
|---|---|---|---|
| API High Error Rate | 5xx > 5% (dev) / 2% (prod) | critical | 5m / 3m |
| RAM Critical | RAM > 90% (dev) / 85% (prod) | critical | 2m |
| Disk Critical | Disk / > 90% | critical | 1m |
| CPU Critical | CPU > 90% | critical | 2m |
| Redis Eviction | evicted_keys rate > 0 | critical | 1m |
| RAM Warning | RAM > 80% (dev) / 75% (prod) | warning | 5m |

---

## Step 9 — UFW / Firewall

```bash
# Allow Grafana port (dev only — not prod)
ufw-docker allow <app>-grafana 3000

# Allow Prometheus auth proxy through nginx (already on 80/443)
# No extra port needed — /prom-proxy/ goes through nginx

# Dev: allow port 80 for subdomain routing
ufw allow 80/tcp
```

---

## Checklist Before Ship

```
Backend
- [ ] /metrics returns http_requests_total, go_goroutines
- [ ] /metrics returns 403 when hit via domain (Nginx block)

Infrastructure
- [ ] Prometheus all targets UP: api, node, postgres, redis, prometheus
- [ ] Grafana accessible and dashboards load data
- [ ] Dashboard has 🌍 Environment dropdown (${datasource} variable)
- [ ] GRAFANA_PASSWORD not committed to git
- [ ] Host-path volumes in place (not named volumes)

Alerting
- [ ] Telegram bot responds to /start
- [ ] Contact point test message delivered
- [ ] 6 alert rules active (check Grafana → Alerting → Alert rules)
- [ ] Notification policy routes to correct contact point

Multi-env (prod)
- [ ] Prod Prometheus datasource added to Grafana
- [ ] /prom-proxy/ accessible with auth: curl -u prom_user:<pw> https://<domain>/prom-proxy/api/v1/query?query=up
- [ ] Separate Telegram bot for prod alerts
- [ ] Prod alert thresholds stricter than dev
```

---

## Anti-patterns

- Expose Prometheus UI publicly — use `/prom-proxy/` with basic auth only
- Run Grafana on prod VPS — adds RAM overhead, no benefit vs dev Grafana
- Named Docker volumes for Prometheus/Grafana data — will be wiped by `docker compose down`
- Same Telegram bot for dev + prod — dev noise will drown out prod alerts
- Hardcode Prometheus datasource UID in dashboard JSON — use `${datasource}` variable
