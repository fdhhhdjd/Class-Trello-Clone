# Monitoring stack

Metrics (Prometheus) · Logs (Loki) · Traces (Tempo) · Dashboards + Alerts (Grafana/Alertmanager → Telegram).
SLO: API availability **99.9%**, p95 **< 500ms**.

## Deploy

```bash
# 1. Append observability vars to the live .env
cat .env.monitoring.example >> .env   # then edit real values

# 2. Fill Telegram secrets into alertmanager.yml (mounted read-only)
sed -i "s/__TELEGRAM_BOT_TOKEN__/$TELEGRAM_BOT_TOKEN/; s/__TELEGRAM_CHAT_ID__/$TELEGRAM_CHAT_ID/" monitoring/alertmanager.yml

# 3. Bring up app + monitoring together (one project = shared network)
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# 4. Restart api so it picks up OTEL_EXPORTER_OTLP_ENDPOINT (tracing on)
docker compose up -d --force-recreate api
```

## Access Grafana (no public exposure — per /harden)

Grafana is bound to `127.0.0.1:3001`. Reach it via SSH tunnel:

```bash
ssh -L 3001:localhost:3001 my-vps-prod   # then open http://localhost:3001
```

Login: `admin` / `$GRAFANA_PASSWORD`. Datasources (Prometheus/Loki/Tempo) and the
"Trello API — RED + SLO" dashboard are auto-provisioned.

## Verify

```bash
# Targets all UP
curl -s localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"' | sort | uniq -c   # inside prometheus net
docker exec trello-prometheus wget -qO- http://api:4000/metrics | head    # api exposes metrics
# Telegram: trigger a test alert or stop api -> ApiDown should fire within ~1m
```

## Extra dashboards (import by ID in Grafana)

- Node Exporter Full — `1860`
- PostgreSQL — `9628`
- Redis — `11835`

## Notes

- `/metrics` is internal-only (api host port 4000 is blocked at the firewall by
  ufw-docker; no nginx route exposes it). Keep it that way.
- Loki/Tempo retention = 7 days, Prometheus = 15 days. Tune per disk.
- Prod: use a **separate** Telegram bot from dev so dev noise doesn't drown prod pages.
