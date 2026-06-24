# Trello Clone — Infra

Docker Compose stack: 3 frontends, api, postgres, redis, minio.

> Dev VPS has only an IP (no DNS/TLS). Apps are routed by **host port**.

## Repo layout

All repos must be **siblings** in the same parent dir:

```
trello-clone/
├── Trello-Clone-Frontend/
├── Trello-Clone-Backend/
└── Trello-Clone-Infra/   # run compose from here
```

## Quick start

```bash
cp .env.example .env
make dev       # build + start all services
make health    # check api + all 3 frontends
```

## Services & Ports

| Service        | Host Port | Notes |
|----------------|-----------|-------|
| frontend-user  | 80        | user SPA; nginx proxies `/api/` + `/socket.io/` -> api |
| frontend-admin | 8081      | admin SPA; nginx proxies `/api/` + `/socket.io/` -> api |
| landing        | 3000      | Next.js standalone (no api proxy) |
| api            | 4000      | built from ../Trello-Clone-Backend |
| postgres       | (internal)| backend network only |
| redis          | (internal)| backend network only |
| minio          | 9000 / 9001 | S3 api / console (minioadmin/minioadmin) |

SPAs call same-origin `/api` and `/socket.io`; each app's nginx proxies them to
`http://api:4000` over the `backend` network. `createbuckets` runs once to
create the `trello` bucket.

## Make targets

- `make dev` — build + start (detached)
- `make down` — stop and remove
- `make prod` — placeholder; add prod override later
- `make migrate` — `prisma migrate deploy` inside api
- `make seed` — `npm run seed` inside api
- `make health` — check health endpoint
- `make logs` — follow logs

## Networks

- `frontend`: frontends + api (public-facing)
- `backend`: api + postgres + redis + minio + the two SPA nginx (so they reach `api:4000`)
