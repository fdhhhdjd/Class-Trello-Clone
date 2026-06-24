# Class-Trello-Clone

Self-hosted Trello clone, gồm 3 thành phần được hợp nhất vào một repo duy nhất để phục vụ CI/CD qua GitHub Packages.

## Cấu trúc dự án

```
.
├── Trello-Clone-Backend/    # API: Node.js (Express, ESM) + Prisma + PostgreSQL
├── Trello-Clone-Frontend/   # Monorepo npm workspaces: apps (user, admin, landing) + packages/ui
└── Trello-Clone-Infra/      # Docker Compose stack + monitoring (Prometheus/Grafana/Loki/Tempo)
```

### Trello-Clone-Backend
- Express + Prisma (PostgreSQL), ESM JavaScript.
- Redis, BullMQ (queue/worker cho email, nhắc việc), MinIO (lưu file/attachment).
- OpenTelemetry cho tracing/observability.
- Realtime qua Socket.IO.

### Trello-Clone-Frontend
- npm workspaces gồm:
  - `apps/user` — SPA chính cho người dùng (Vite).
  - `apps/admin` — SPA quản trị (Vite).
  - `apps/landing` — trang landing (Next.js).
  - `packages/ui` — thư viện UI/auth/permissions dùng chung giữa các app.

### Trello-Clone-Infra
- Docker Compose điều phối: frontend-user, frontend-admin, landing, api, postgres, redis, minio.
- Stack monitoring riêng (`docker-compose.monitoring.yml`): Prometheus, Grafana, Loki, Promtail, Tempo, Alertmanager.
- Nginx làm gateway/reverse proxy cho từng app tới API.

## Bắt đầu nhanh (dev)

```bash
cd Trello-Clone-Infra
cp .env.example .env
make dev       # build + start toàn bộ service
make health    # kiểm tra api + 3 frontend
```

| Service        | Port  | Mô tả |
|----------------|-------|-------|
| frontend-user  | 80    | SPA người dùng |
| frontend-admin | 8081  | SPA quản trị |
| landing        | 3000  | Trang landing (Next.js) |
| api            | 4000  | Backend API |
| minio          | 9000/9001 | S3 API / console |

## CI/CD

Repo được tổ chức để build/publish image hoặc package qua GitHub Actions + GitHub Packages cho từng thành phần (backend, frontend, infra).
