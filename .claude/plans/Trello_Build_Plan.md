# Trello Clone — Build Plan (Admin + User)

> Sinh từ `/build` (PM lens). Nguồn: [Trello_Modules_Plan.md](Trello_Modules_Plan.md), [RBAC.md](../references/RBAC.md), [auth-flow.md](../references/auth-flow.md).

---

## Output 1: PRD

### Problem Statement
Team cần công cụ quản lý công việc kiểu Kanban tự host, có phân quyền rõ ràng và trang quản trị hệ thống riêng. Trello SaaS không cho kiểm soát dữ liệu/hạ tầng nội bộ.

### Target Users
- **End user (B2C)**: cần board/list/card, kéo thả, cộng tác realtime.
- **Business/manager (WS Owner)**: quản lý workspace, member, billing.
- **System Admin/Ops**: quản lý user, audit, monitoring toàn hệ thống.
- **Dev team**: tự host, deploy Docker, tích hợp GitHub/Slack.

### User Stories (MVP)
| # | As a... | I want to... | So that... |
|---|---------|--------------|------------|
| 1 | user | đăng ký/login (email+OAuth) | truy cập an toàn |
| 2 | user | tạo workspace/board/list/card | tổ chức công việc |
| 3 | user | kéo thả card giữa list | cập nhật trạng thái nhanh |
| 4 | user | comment + mention + attach file | cộng tác trên card |
| 5 | member | thấy thay đổi realtime | không cần reload |
| 6 | ws_owner | mời + phân quyền member | kiểm soát truy cập |
| 7 | user | search/filter card | tìm việc nhanh |
| 8 | sys_admin | khoá/xoá user, gán role | quản trị hệ thống |
| 9 | sys_admin | xem audit log + monitoring | truy vết, đảm bảo an toàn |

### Acceptance Criteria (MVP)
- [ ] Login JWT (15m) + refresh cookie (7d) + Redis JTI blacklist, đúng auth-flow.md
- [ ] RBAC 2 tầng: `authorize(permission)` mọi mutation endpoint; super_admin bypass
- [ ] Board/List/Card CRUD + kéo thả lưu đúng vị trí (ordering bền vững)
- [ ] Comment/mention/attachment (MinIO) hoạt động
- [ ] Realtime qua WebSocket + Redis pub/sub (≤1s)
- [ ] Admin App tách riêng, route bảo vệ bằng system role + 2FA
- [ ] Audit log ghi cả ALLOW (nhạy cảm) lẫn DENY
- [ ] Toàn bộ chạy bằng Docker Compose; deploy theo tag rc → prod

### Out of Scope (v1)
- Automation/Butler, Calendar sync, Dashboard charts nâng cao
- Billing/subscription thật (chỉ schema + UI khung)
- Integration ngoài GitHub cơ bản (Slack/Jira/Teams sau)
- Mobile app, offline mode, Push notification
- Content moderation nâng cao, ABAC time-bound

---

## Output 2: Technical Plan

### Stack
- **Backend**: Node.js + Express + TypeScript, Socket.IO
- **Frontend**: React (User App), React (Admin App) — Vite
- **Landing**: Next.js (SSG/SSR, SEO)
- **DB**: PostgreSQL + Prisma ORM
- **Cache/Realtime**: Redis (session, perms cache, JTI blacklist, pub/sub)
- **Storage**: MinIO (S3 SDK)
- **Infra**: Docker Compose, Nginx reverse proxy
- **Key deps**: `jsonwebtoken`, `bcrypt`, `zod`, `@prisma/client`, `socket.io`, `minio`, `bullmq` (queue email/notif)

### Architecture Overview
Nginx định tuyến 3 domain → User App / Admin App / Landing, và `/api` → Node backend. Backend xác thực JWT, kiểm tra permission (cache Redis), đọc/ghi PG, phát realtime qua Socket.IO + Redis adapter, lưu file MinIO. Tất cả container hoá, deploy qua tag rc → prod.

### File & Folder Structure (mới)
```
Trello-Clone-Backend/
  src/
    config/        # env, db, redis, minio
    modules/
      auth/        # login, renew, logout, oauth, 2fa
      rbac/        # roles, permissions, authorize middleware
      users/ workspaces/ boards/ lists/ cards/
      checklists/ comments/ attachments/ labels/
      notifications/ search/
      admin/       # user-mgmt, audit, monitoring
    realtime/      # socket.io + redis adapter
    middleware/    # authenticate, authorize, errorHandler
    db/            # prisma schema, migrations, seed
  prisma/schema.prisma

Trello-Clone-Frontend/
  apps/user/       # React Vite - Trello UI
  apps/admin/      # React Vite - admin console
  apps/landing/    # Next.js
  packages/ui/     # shared components, usePermission hook

Trello-Clone-Infra/
  docker-compose.yml  nginx/  Makefile  .env.example
```

### Data Model (chính)
| Table | Fields (key) | Relations |
|---|---|---|
| users | id, email, password_hash, token_version, is_active, twofa_secret | → user_roles |
| roles | id, key, name, is_system | → role_permissions |
| permissions | id, key, resource, action | |
| role_permissions | role_id, permission_id | M-N |
| user_roles | user_id, role_id, tenant_id(workspace), expires_at | system + workspace scope |
| refresh_tokens | id, user_id, token_hash, jti, expires_at, used | → users |
| workspaces | id, name, owner_id, visibility | → boards |
| boards | id, workspace_id, name, background, visibility, archived | → lists |
| lists | id, board_id, name, position, archived | → cards |
| cards | id, list_id, title, desc, position, due_date, start_date, cover_url | → checklists/comments |
| card_members | card_id, user_id | M-N assignee |
| labels | id, board_id, name, color | → card_labels |
| checklists / checklist_items | card_id / checklist_id, text, done | |
| comments | id, card_id, author_id, body, edited_at | |
| attachments | id, card_id, key(MinIO), filename, size, mime | |
| activities | id, board_id, card_id, actor_id, action, metadata | activity log |
| notifications | id, user_id, type, payload, read | |
| access_audit | id, actor_id, target_id, action, metadata, ip | admin audit |

> `user_roles.tenant_id` = workspace_id cho tầng B; NULL cho system role tầng A. Khớp RBAC.md multi-tenant.

### API Endpoints (rút gọn)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | /api/auth/login | - | login → access(JSON)+refresh(cookie) |
| POST | /api/auth/renew | cookie | rotate refresh, reuse-detect |
| POST | /api/auth/logout / logout-all | JWT | blacklist jti / bump token_version |
| GET | /api/me | JWT | roles + permissions cho FE gate |
| CRUD | /api/workspaces, /boards, /lists, /cards | authorize(`*.*`) | core |
| PATCH | /api/cards/:id/move | authorize(cards.update) | kéo thả (list_id+position) |
| POST | /api/cards/:id/attachments | authorize(attachments.create) | MinIO presigned |
| GET | /api/search?q= | JWT | search card/board/member |
| GET | /api/admin/users | authorize(users.list) | admin |
| POST | /api/admin/users/:id/suspend | authorize(users.suspend) | admin + audit |
| POST | /api/admin/roles/assign | authorize(roles.assign) | + invalidate perms cache |
| GET | /api/admin/audit | authorize(system.view_audit_log) | filter+CSV |

### Key Decisions & Trade-offs
- **Prisma** thay TypeORM: migration + type-safety tốt, seed permission dễ. Trade-off: raw query phức tạp ít linh hoạt hơn.
- **Position = fractional indexing** cho kéo thả: chèn giữa không cần reindex cả list. Trade-off: thi thoảng rebalance.
- **Perms cache Redis TTL 5m + invalidate khi đổi role** (RBAC.md 7.4).
- **Access token in-memory, refresh httpOnly cookie** (auth-flow.md) — chống XSS, không dùng localStorage.
- **Admin App tách app riêng** + 2FA bắt buộc: giảm bề mặt tấn công.
- **Monorepo FE** (apps/*): share `usePermission`, UI; deploy độc lập.

---

## Output 3: Step-by-Step Build Guide

### Phase A: Setup & Foundation
- [ ] [M] Infra: docker-compose (PG, Redis, MinIO, Nginx) + Makefile (dev/prod/health) + .env.example
- [ ] [M] Backend skeleton: Express+TS, config db/redis/minio, errorHandler, healthcheck `/health`
- [ ] [L] Prisma schema (toàn bộ bảng trên) + migration + seed roles/permissions
- [ ] [M] Auth module: login/renew/logout/logout-all theo auth-flow.md + Redis JTI blacklist
- [ ] [M] RBAC: `authenticate` + `authorize(permission)` middleware + perms cache + `/api/me`
- [ ] [S] FE monorepo: apps/user, apps/admin, apps/landing + packages/ui (`usePermission`, axios 401 interceptor)

### Phase B: Core Feature (User App)
- [ ] [M] Workspace CRUD + invite + role assign (tenant scope)
- [ ] [M] Board CRUD + archive + visibility + member
- [ ] [M] List CRUD + position
- [ ] [L] Card CRUD + move (drag&drop, fractional position) + assignee/due
- [ ] [M] Checklist + Label
- [ ] [M] Comment + mention + Activity log
- [ ] [M] Attachment (MinIO presigned upload/download)
- [ ] [L] Realtime: Socket.IO + Redis adapter, board room, emit card/list/comment events
- [ ] [M] Notification (in-app + email queue BullMQ)
- [ ] [M] Search + Filter (card/board/member; label/assignee/due/status)
- [ ] [M] User App UI: board view kéo thả, card modal, login/OAuth

### Phase C: Admin App + Ship
- [ ] [M] Admin auth + 2FA bắt buộc + system-role route guard
- [ ] [M] User Management: list/search, suspend/delete, reset pass, assign role, impersonate (log)
- [ ] [M] Workspace Management: list toàn bộ, xem/xoá, chuyển owner, thống kê
- [ ] [M] Audit log UI: filter actor/action/date + CSV export
- [ ] [S] Monitoring: health các service, metrics cơ bản, user online
- [ ] [S] Landing Next.js: home/features/pricing + SEO meta + CTA → User App
- [ ] [M] Test matrix role×endpoint ≥80% (happy + 403+audit DENY)
- [ ] [S] Nginx 3 domain + TLS; deploy rc → Dev VPS smoke → tag stable → Prod

**Complexity**: S = <1h, M = 1-4h, L = 4h+

---

## Output 4: Handoff Prompt

```markdown
You are building a self-hosted Trello clone with separate User and Admin apps.

Context:
Team-collaboration Kanban tool. Users manage workspaces/boards/lists/cards with
drag&drop, comments, attachments, realtime sync. A separate Admin app manages
users, roles, audit log, monitoring. Self-hosted, fully Dockerized.

Stack: Node.js + Express + TS + Prisma (PostgreSQL), Redis, MinIO, Socket.IO.
Frontend monorepo: React User App, React Admin App, Next.js landing. Nginx + Docker Compose.
Repos: Trello-Clone-Backend, Trello-Clone-Frontend, Trello-Clone-Infra (currently empty).

Auth: follow .claude/references/auth-flow.md exactly — access token (JWT 15m) in
memory, refresh token httpOnly cookie (7d), Redis JTI blacklist, token_version, rotate+reuse-detect.

RBAC: follow .claude/references/RBAC.md — 2 tiers. Tier A system roles
(super_admin/admin/support/user) for Admin app; Tier B workspace/board roles via
user_roles.tenant_id. authorize(permission) middleware on EVERY mutation. Perms
cached in Redis TTL 5m, invalidate on role change. Audit both ALLOW(sensitive)+DENY.

Full module plan: .claude/plans/Trello_Modules_Plan.md

Start with this task:
In Trello-Clone-Infra, create docker-compose.yml with services: postgres, redis,
minio, nginx, api (backend), and a Makefile with targets dev/prod/health/migrate.
Add .env.example. Then in Trello-Clone-Backend scaffold Express+TS with /health
endpoint and Prisma connected to postgres. Verify `make dev` brings all services up
and `make health` returns {"status":"ok"}.

Do NOT:
- Build out-of-scope v1 items (Automation, Calendar sync, real Billing, mobile).
- Ask clarifying questions — the plan and references are complete. Start building.
```
