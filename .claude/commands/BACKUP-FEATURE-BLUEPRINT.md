# Backup Feature Blueprint — Portable Reference

Document để **tái sử dụng backup feature** cho web app bất kỳ. Stack mặc định:
**Go + React + Docker + Postgres + MinIO/S3**. Có thể adapt sang stack khác
(xem section 11 Discovery Questionnaire).

> Output cuối: 1 admin page `/admin/backup` với 4 tab (Kết nối · Cấu hình · Lịch
> sử · Hướng dẫn) cho phép admin setup OAuth → schedule cron → backup tự động
> lên Google Drive (hoặc S3/Azure/...) qua rclone.

---

## 1. Architecture tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│  Admin Browser                                                       │
│   /admin/backup ─ 4 tabs ─ React (Backup.jsx)                       │
└──────────────────┬──────────────────────────────┬───────────────────┘
                   │ REST                         │ OAuth popup
                   ▼                              ▼
┌──────────────────────────────────────┐   ┌──────────────────┐
│  API container (Go)                   │   │  Google OAuth    │
│   ┌────────────────────────────────┐ │   │  - Consent       │
│   │ Handlers /backup/*             │ │   │  - Drive scope   │
│   │ Service: orchestrate + OAuth  │ │   └────────┬─────────┘
│   │ Scheduler: goroutine cron 60s │ │            │ redirect
│   │ Tools: pg_dump · mc · tar     │ │   ┌────────▼─────────┐
│   │        · rclone               │◀┼───┤  Callback PUBLIC │
│   └────────┬───────────────────────┘ │   └──────────────────┘
└────────────┼─────────────────────────┘
             │
   ┌─────────┴─────────┬──────────────────┐
   ▼                   ▼                  ▼
┌──────────┐    ┌──────────┐       ┌──────────────┐
│ Postgres │    │  MinIO   │       │ Google Drive │
│ (DB)     │    │ (uploads)│       │  (remote)    │
└──────────┘    └──────────┘       └──────────────┘
                                          ▲
                                          │ rclone copy
                                   ┌──────┴───────┐
                                   │ rclone.conf  │
                                   │ (named volume│
                                   │  persistent) │
                                   └──────────────┘
```

**Core principles:**
1. **Singleton settings** trong DB (1 row id='global'), không cần multi-tenant
2. **History rows** mỗi lần backup, lưu status + log_tail 4KB để debug khi fail
3. **OAuth Web flow** trong UI thay vì SSH `rclone config`
4. **Goroutine scheduler** chạy in-process (không cần separate cron container)
5. **Tools shell** (pg_dump, mc, tar, rclone) gọi qua `os/exec`, không reimplement
6. **Named volumes** cho rclone.conf + staging tmp → survive container rebuild

---

## 2. Database schema (PostgreSQL)

### Bảng 1: `backup_settings` (singleton)

```sql
CREATE TABLE backup_settings (
    id                   TEXT PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
    enabled              BOOLEAN NOT NULL DEFAULT false,
    cron_expr            VARCHAR(50) NOT NULL DEFAULT '0 2 * * *',
    retention_count      INT NOT NULL DEFAULT 30 CHECK (retention_count >= 1),
    scope_db             BOOLEAN NOT NULL DEFAULT true,
    scope_uploads        BOOLEAN NOT NULL DEFAULT true,
    scope_configs        BOOLEAN NOT NULL DEFAULT true,
    rclone_remote        VARCHAR(50) NOT NULL DEFAULT 'gdrive',
    remote_folder        VARCHAR(200) NOT NULL DEFAULT 'app-backups',
    -- OAuth Web flow
    gdrive_client_id     VARCHAR(200) NOT NULL DEFAULT '',
    gdrive_client_secret VARCHAR(200) NOT NULL DEFAULT '',
    gdrive_account_email VARCHAR(200) NOT NULL DEFAULT '',
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by           UUID
);
INSERT INTO backup_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
```

### Bảng 2: `backup_runs` (history)

```sql
CREATE TABLE backup_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            VARCHAR(20) NOT NULL CHECK (kind IN ('manual', 'scheduled')),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
    scope_db        BOOLEAN NOT NULL DEFAULT false,
    scope_uploads   BOOLEAN NOT NULL DEFAULT false,
    scope_configs   BOOLEAN NOT NULL DEFAULT false,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    remote_path     VARCHAR(500) NOT NULL DEFAULT '',
    error           TEXT NOT NULL DEFAULT '',
    log_tail        TEXT NOT NULL DEFAULT '',  -- last 4KB stdout/stderr
    triggered_by    UUID                        -- NULL = scheduled
);
CREATE INDEX idx_backup_runs_started_at ON backup_runs(started_at DESC);
CREATE INDEX idx_backup_runs_status ON backup_runs(status) WHERE status IN ('pending', 'running');
```

---

## 3. Backend (Go) — 5 files

### 3.1 Model `internal/models/backup.go`

```go
type BackupSettings struct {
    ID                 string    `db:"id"                   json:"id"`
    Enabled            bool      `db:"enabled"              json:"enabled"`
    CronExpr           string    `db:"cron_expr"            json:"cronExpr"`
    RetentionCount     int       `db:"retention_count"      json:"retentionCount"`
    ScopeDB            bool      `db:"scope_db"             json:"scopeDb"`
    ScopeUploads       bool      `db:"scope_uploads"        json:"scopeUploads"`
    ScopeConfigs       bool      `db:"scope_configs"        json:"scopeConfigs"`
    RcloneRemote       string    `db:"rclone_remote"        json:"rcloneRemote"`
    RemoteFolder       string    `db:"remote_folder"        json:"remoteFolder"`
    GdriveClientID     string    `db:"gdrive_client_id"     json:"gdriveClientId"`
    GdriveClientSecret string    `db:"gdrive_client_secret" json:"gdriveClientSecret,omitempty"`
    GdriveAccountEmail string    `db:"gdrive_account_email" json:"gdriveAccountEmail"`
    UpdatedAt          time.Time `db:"updated_at"           json:"updatedAt"`
    UpdatedBy          *string   `db:"updated_by"           json:"updatedBy,omitempty"`
}

type BackupRun struct {
    ID           string     `db:"id"            json:"id"`
    Kind         string     `db:"kind"          json:"kind"`
    Status       string     `db:"status"        json:"status"`
    ScopeDB      bool       `db:"scope_db"      json:"scopeDb"`
    ScopeUploads bool       `db:"scope_uploads" json:"scopeUploads"`
    ScopeConfigs bool       `db:"scope_configs" json:"scopeConfigs"`
    StartedAt    time.Time  `db:"started_at"    json:"startedAt"`
    FinishedAt   *time.Time `db:"finished_at"   json:"finishedAt,omitempty"`
    SizeBytes    int64      `db:"size_bytes"    json:"sizeBytes"`
    RemotePath   string     `db:"remote_path"   json:"remotePath"`
    Error        string     `db:"error"         json:"error"`
    LogTail      string     `db:"log_tail"      json:"logTail"`
    TriggeredBy  *string    `db:"triggered_by"  json:"triggeredBy,omitempty"`
}
```

### 3.2 Repo `internal/repository/backup.go`

Methods cần có:
- `GetBackupSettings(ctx) (*BackupSettings, error)`
- `UpdateBackupSettings(ctx, *BackupSettings, updatedBy *string) (*BackupSettings, error)` — không touch OAuth cols
- `UpdateGdriveCreds(ctx, clientID, clientSecret string) (*BackupSettings, error)` — riêng cho OAuth setup
- `UpdateGdriveAccount(ctx, email string) (*BackupSettings, error)` — riêng sau OAuth thành công
- `CreateBackupRun(ctx, kind string, scopes... bool, triggeredBy *string) (*BackupRun, error)` — status='pending'
- `UpdateBackupRunStatus(ctx, id, status, err, remotePath, logTail string, size int64, finished bool) error`
- `ListBackupRuns(ctx, limit int) ([]BackupRun, error)` — order by started_at DESC
- `GetBackupRun(ctx, id) (*BackupRun, error)`
- `DeleteBackupRun(ctx, id) error`
- `HasRunningBackup(ctx) (bool, error)` — chặn double-trigger

### 3.3 Service `internal/service/backup.go` — Orchestration

**Pseudocode:**
```
func RunBackup(ctx, runID, settings):
    create staging /tmp/backups/{timestamp}/
    update run → 'running'

    if settings.ScopeDB:
        pg_dump --clean --if-exists $DATABASE_URL | gzip > db.sql.gz

    if settings.ScopeUploads:
        for each bucket (list theo project, vd avatars/uploads/docs/...):
            mc mirror local/$bucket $stage/uploads/$bucket
        tar -czf uploads.tar.gz uploads/
        rm -rf uploads/   # giảm size trước rclone

    if settings.ScopeConfigs:
        if /infra-snapshot exists:
            tar -czf configs.tar.gz --exclude='.git' --exclude='node_modules' /infra-snapshot

    rclone copy $stage gdrive:app-backups/{timestamp}/

    if settings.RetentionCount > 0:
        rclone lsf gdrive:app-backups → sort desc → purge folder > N

    update run → 'success' (or 'failed' với error message)
    cleanup /tmp/backups/{timestamp}/
```

**Key implementation details:**
- Wrap context với timeout 60min
- Capture combined stdout+stderr → log buffer, save last 4KB vào `log_tail` cột
- mc cần env `MC_HOST_local=http://user:pass@host:port` (no persistent config)
- rclone retention: folder name dạng `YYYYMMDD-HHMMSS` sort lexicographic = sort time
- `rclone size --json` để lấy size sau upload (best-effort)
- `defer cleanup tmp dir + update final status` để đảm bảo row không kẹt 'running'

### 3.4 Service OAuth `internal/service/backup_oauth.go`

Dùng `golang.org/x/oauth2` + `golang.org/x/oauth2/google`:

```go
const gdriveScope = "https://www.googleapis.com/auth/drive"

func BuildOAuthURL(ctx, userID, clientID, clientSecret, redirectURL string) (string, error):
    state = random 32 hex chars
    redis.Set("backup_oauth_state:"+state, userID, 10min)
    cfg = &oauth2.Config{ClientID, ClientSecret, RedirectURL, Scopes: [drive, userinfo.email], Endpoint: google.Endpoint}
    return cfg.AuthCodeURL(state, AccessTypeOffline, "prompt=consent")

func ExchangeAndStoreOAuth(ctx, code, clientID, clientSecret, redirectURL, remoteName string) (email string, error):
    cfg.Exchange(ctx, code) → tok
    email = fetch https://www.googleapis.com/oauth2/v2/userinfo (Bearer tok.AccessToken)
    tokJSON = {"access_token":..., "token_type":"Bearer", "refresh_token":..., "expiry":...}
    exec.Command("rclone", "config", "create", remoteName, "drive",
        "client_id", clientID, "client_secret", clientSecret,
        "scope", "drive", "token", tokJSON, "--non-interactive")
    return email
```

**Gotchas:**
- `prompt=consent` ép Google luôn trả refresh_token mới (default chỉ trả lần đầu)
- State Redis one-time (GetDel) chống CSRF + replay
- Email fetch best-effort, fail = "" không block flow
- `rclone config create` overwrite remote nếu đã có (cho phép đổi tài khoản)

### 3.5 Service Scheduler `internal/service/backup_scheduler.go`

```go
func StartBackupScheduler(ctx) func() (stop):
    c = cron.New(WithLocation(<timezone-từ-config>))   // vd Asia/Ho_Chi_Minh, UTC, Europe/London
    var curExpr, curActive
    var entryID

    reload = func():
        settings = repo.GetBackupSettings()
        if settings.Enabled == curActive && settings.CronExpr == curExpr: return
        if entryID != 0: c.Remove(entryID)
        if !settings.Enabled: return
        entryID = c.AddFunc(settings.CronExpr, func():
            if repo.HasRunningBackup(): return  // skip overlap
            run = repo.CreateBackupRun('scheduled', ...)
            go RunBackup(ctx, run.ID, settings)
        )
        curActive, curExpr = settings.Enabled, settings.CronExpr

    reload()
    c.Start()
    go { every 60s: reload() }
    return stop
```

**Gọi từ main.go:**
```go
stopScheduler := svc.StartBackupScheduler(context.Background())
defer stopScheduler()
```

### 3.6 Handlers + Routes

Endpoints (staff-only trừ callback PUBLIC):
- `GET    /backup/settings`            → list config
- `PUT    /backup/settings`            → update non-OAuth fields
- `POST   /backup/run`                 → trigger manual (409 nếu busy)
- `GET    /backup/runs?limit=N`        → history list
- `GET    /backup/runs/:id`            → detail
- `DELETE /backup/runs/:id`            → xoá history row
- `GET    /backup/rclone-status`       → check rclone installed + list remotes
- `PUT    /backup/gdrive/creds`        → admin paste client_id/secret
- `GET    /backup/gdrive/oauth/start`  → return Google authURL + redirectURL
- `POST   /backup/gdrive/disconnect`   → rclone config delete + clear email
- `GET    /public/backup/oauth/callback` → **PUBLIC** (Google không kèm Bearer)

**Callback returns HTML** với `window.opener.postMessage(...)` + auto close.

### 3.7 RBAC integration

```sql
-- migration: add 'backup' feature cho mọi role hiện có
INSERT INTO rbac_permissions (role, feature, allowed)
SELECT DISTINCT r.role, 'backup', (r.role = 'super_admin')
FROM (SELECT DISTINCT role FROM rbac_permissions) r
WHERE NOT EXISTS (SELECT 1 FROM rbac_permissions p WHERE p.role = r.role AND p.feature = 'backup');
```

Handler gate:
```go
func requireBackupAccess(c) bool {
    role := c.GetString("role")
    if role == "super_admin" return true
    return service.CheckPermission(ctx, repo, redis, role, "backup")
}
```

---

## 4. Infrastructure

### 4.1 Dockerfile (API container) — add tools

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget \
        postgresql16-client \
        rclone \
        tar gzip

# mc binary (alpine repo missing) — tải official static
RUN wget -qO /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc && \
    chmod +x /usr/local/bin/mc

RUN mkdir -p /root/.config/rclone /tmp/backups
# Chạy root để rclone đọc /root/.config/rclone volume
```

### 4.2 docker-compose.yml — 3 volumes

```yaml
services:
  api:
    volumes:
      - rclone-config:/root/.config/rclone     # named volume = OAuth token persistent
      - backup-tmp:/tmp/backups                 # named volume = staging
      - ../infra-dir:/infra-snapshot:ro         # bind mount = configs scope

volumes:
  rclone-config:
    name: app-rclone-config
  backup-tmp:
    name: app-backup-tmp
```

**Critical:** `--force-recreate` khi update compose nếu volumes mới chưa active.

### 4.3 Env vars cần thiết trong API container

- `DATABASE_URL` (postgres://...) — cho pg_dump
- `MINIO_ADDR`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — cho mc mirror
- Bucket names (list từ env hoặc hardcode tùy project)

---

## 5. Frontend (React) — 1 page, 4 tabs

### 5.1 API client

```js
export const backupApi = {
  getSettings:    () => api.get('/backup/settings').then(unwrap),
  updateSettings: (body) => api.put('/backup/settings', body).then(unwrap),
  runNow:         () => api.post('/backup/run').then(unwrap),
  listRuns:       (limit = 7) => api.get('/backup/runs', { params: { limit } }).then(unwrap),
  getRun:         (id) => api.get(`/backup/runs/${id}`).then(unwrap),
  deleteRun:      (id) => api.delete(`/backup/runs/${id}`).then(unwrap),
  rcloneStatus:   () => api.get('/backup/rclone-status').then(unwrap),
  updateGdriveCreds: (body) => api.put('/backup/gdrive/creds', body).then(unwrap),
  gdriveOauthStart:  () => api.get('/backup/gdrive/oauth/start').then(unwrap),
  gdriveDisconnect:  () => api.post('/backup/gdrive/disconnect'),
}
```

### 5.2 Page structure

```
<Page>
  <Header />
  <SummaryBar> -- 4 cards: connection · last run · auto schedule · "Backup ngay" button
  <StickyTabsNav> -- 4 tabs với badge (!/●/N)
  {tab === 'connect'} → <GdriveConnectSection>
  {tab === 'config'}  → <ConfigForm + SchedulePicker + ScopeRows + AdvancedSettings + StickySaveBar>
  {tab === 'history'} → <HistoryList + LoadMoreButton>
  {tab === 'guide'}   → <SetupGuide + BestPractices>
</Page>
```

### 5.3 Key React patterns

**Tab deep-link via URL ?tab=**
```js
const [activeTab, setActiveTab] = useState(() => {
  const t = new URLSearchParams(window.location.search).get('tab')
  return ['connect','config','history','guide'].includes(t) ? t : null
})
useEffect(() => {
  const sp = new URLSearchParams(window.location.search)
  if (activeTab) sp.set('tab', activeTab); else sp.delete('tab')
  window.history.replaceState(null, '', `${pathname}?${sp}`)
}, [activeTab])
```

**OAuth popup + postMessage listener**
```js
const login = async () => {
  const { authUrl } = await backupApi.gdriveOauthStart()
  const w = 560, h = 720
  const x = (screen.width - w) / 2, y = (screen.height - h) / 2
  window.open(authUrl, 'gdrive-oauth', `width=${w},height=${h},left=${x},top=${y}`)
}
useEffect(() => {
  const onMsg = (e) => {
    if (e.data?.type !== 'backup-oauth-result') return
    e.data.ok ? toast.success(`Connected: ${e.data.msg}`) : toast.error(e.data.msg)
    reload()
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}, [])
```

**SchedulePicker — cron expression → friendly UI**
```js
function parseSchedule(cron):  // → { mode, minute, hour, dayOfWeek, dayOfMonth, hours }
function buildCron(mode, params): // → cron string
function describeSchedule(state): // → human "Hằng ngày lúc 02:00"
// 5 modes: hourly, daily, weekly, monthly, custom
```

**Polling khi có active run**
```js
useEffect(() => {
  if (!hasActiveRun) return
  const id = setInterval(() => backupApi.listRuns(historyLimit).then(setRuns), 5000)
  return () => clearInterval(id)
}, [hasActiveRun, historyLimit])
```

**Load more pagination để giảm DB pressure**
- Initial fetch limit = 7 (không phải 50)
- Button "Xem thêm 7 record" → `historyLimit += 7` → refetch
- Show button khi `runs.length >= historyLimit` (suspect còn data)

**Setup guide checkbox progress**
```js
const [done, setDone] = useState(() => JSON.parse(localStorage.getItem('backup-setup-done') || '{}'))
const toggle = (id) => {
  const next = {...done, [id]: !done[id]}
  setDone(next)
  localStorage.setItem('backup-setup-done', JSON.stringify(next))
}
```

---

## 6. OAuth setup steps (admin manual)

1. Tạo Google Cloud project (https://console.cloud.google.com/projectcreate)
2. Enable Google Drive API (console.cloud.google.com/apis/library/drive.googleapis.com)
3. OAuth consent screen → User type **External** → app name + emails → Save
4. Audience tab → Test users → add email Gmail dùng backup
5. Data Access (Scopes) → Add scope `https://www.googleapis.com/auth/drive` (manual add nếu list không hiện)
6. Credentials → Create OAuth client ID → Type **Web application** → Authorized redirect URI = `https://<host>/api/v1/public/backup/oauth/callback` → Create
7. Copy Client ID + Secret → paste vào UI → Save
8. Bấm "Đăng nhập Google" → popup → tick checkbox Drive → Allow

**Common errors:**
- `403 access_denied` → email chưa add Test users
- `ACCESS_TOKEN_SCOPE_INSUFFICIENT` → quên tick Drive checkbox lúc consent
- Token expire 7 ngày trong Testing mode → Publish app để vĩnh viễn
- `Google chưa xác minh ứng dụng` → bấm "Tiếp tục" (an toàn cho owner)

---

## 7. Operational procedures

### Restore từ backup

```bash
# 1. Tải folder timestamp từ Drive
rclone copy gdrive:app-backups/20260529-021500 ./restore/

# 2. Restore DB
gunzip -c restore/db.sql.gz | docker exec -i db-container psql -U user -d dbname

# 3. Restore uploads
cd restore && tar -xzf uploads.tar.gz
mc mirror uploads/avatars local/avatars
mc mirror uploads/payment local/payment
# ... cho mỗi bucket

# 4. Restore configs
tar -xzf restore/configs.tar.gz -C /path/to/infra-dir

# 5. Restart
docker compose up -d --force-recreate
```

### Verify backup định kỳ

- Mỗi tháng: tải 1 folder, thử giải nén, kiểm sha256 nếu strict
- Mỗi quý: restore vào DB test, run smoke test
- "Backup không test = backup không tồn tại"

### Security

- Folder Drive backup phải **Private**
- Tài khoản Google bật **2FA**
- `configs.tar.gz` chứa `.env` (DB password, JWT secret) → nguy hiểm nếu Drive bị compromise
- Optional: thêm bước `gpg encrypt` trước rclone copy

---

## 8. Checklist setup cho hệ thống mới

- [ ] Migration: 3 sql (settings, runs, rbac feature)
- [ ] Model + Repo (10 methods)
- [ ] Service: backup orchestration + OAuth + scheduler
- [ ] Handlers: 11 endpoints + route registration
- [ ] Auth gate: `requireXxxAccess` helper
- [ ] Dockerfile: thêm rclone + mc + pg_dump + tar
- [ ] docker-compose: 3 volumes + bind mount infra-dir
- [ ] Env: DATABASE_URL + MINIO_* phải có
- [ ] main.go: `StartBackupScheduler` lúc boot
- [ ] FE: 1 page với 4 tabs + 6 components
- [ ] FE: API client wrapper
- [ ] Route: register backup page với RBAC feature gate
- [ ] Sidebar nav: thêm entry với feature='backup'
- [ ] Build + deploy + force-recreate api container
- [ ] OAuth setup trong GCP Console (8 bước manual)
- [ ] Test: backup ngay, check Drive folder có file
- [ ] Test: restore script trên env test

---

## 9. Trade-offs đã chọn

| Decision | Alternative | Lý do chọn |
|---|---|---|
| OAuth Web flow trong UI | SSH rclone config | Admin không cần SSH/dev skill |
| In-process scheduler goroutine | Separate cron container | Đỡ container, share rclone token |
| Named volume rclone-config | Bind mount /root/.config/rclone | Survive force-recreate, không phải mkdir host |
| Singleton settings row | Per-tenant rows | App single-tenant, đỡ phức tạp |
| Log_tail 4KB | Full log | Hiển thị nhanh trong UI debug |
| `mc mirror` bucket-by-bucket | tar trực tiếp volume MinIO | Mount data volume từ container khác phức tạp |
| rclone built-in client_id | Workspace verified app | Free, đủ cho single-org backup |
| Testing mode chấp nhận warning | Submit verify | Tiết kiệm 2 tuần wait |
| Retention rclone-side (purge) | DB-side | Không cần GET danh sách rồi delete riêng |
| FE polling 5s khi active | WebSocket / SSE | Đơn giản, đủ realtime cho backup vài phút |
| Load more 7/lần | Infinite scroll | Tránh fetch 50 mỗi load page |
| Tab deep-link replaceState | pushState | Back button không spam |

---

## 10. File structure khuyến nghị

```
backend/
├── migrations/
│   ├── NNN_backup_settings_runs.{up,down}.sql   # bảng schema
│   ├── NNN_backup_oauth_creds.{up,down}.sql     # 3 cột OAuth
│   └── NNN_rbac_backup.{up,down}.sql            # rbac feature entry
├── internal/
│   ├── config/features.go              # add "backup" entry vào RBAC feature list
│   ├── models/backup.go                # BackupSettings + BackupRun struct
│   ├── repository/backup.go            # 10 methods CRUD
│   ├── service/
│   │   ├── backup.go                   # orchestration (pg_dump + mc + tar + rclone)
│   │   ├── backup_oauth.go             # OAuth Web flow (x/oauth2)
│   │   └── backup_scheduler.go         # goroutine cron (robfig/cron/v3)
│   ├── handlers/backup.go              # 11 endpoints + requireBackupAccess gate
│   └── router/router.go                # register routes (callback PUBLIC)
├── cmd/api/main.go                     # StartBackupScheduler khi boot
├── Dockerfile                          # add rclone + mc + pg_dump + tar
└── go.mod                              # golang.org/x/oauth2 + robfig/cron/v3

infra/
├── docker-compose.yml                  # 3 volumes (rclone-config + backup-tmp + infra-snapshot)
└── docs/BACKUP-SETUP.md                # admin OAuth setup guide

web/src/
├── api/endpoints.js                    # backupApi wrapper
├── pages/admin/Backup.jsx              # main page (~750 lines, 4 tabs)
├── routes/index.jsx                    # register + feature gate (RBAC)
└── components/shared/AdminLayout.jsx   # sidebar nav entry
```

> Đổi tên thư mục (`backend/`, `web/`, `infra/`) theo convention project đích.
> Số migration (`NNN`) theo migration tool đang dùng (golang-migrate sequential
> int, Flyway `V<n>__`...).

Estimated effort:
- **2-3 ngày** full-time nếu stack match (Go + React + Postgres + MinIO + Docker Compose) và dev đã quen.
- **1-2 tuần** nếu phải adapt nhiều (DB managed RDS, K8s, multi-replica leader election, Vault secrets, compliance gpg).
- **3-4 tuần** nếu add encryption at rest + verification submission + monitoring + alerting.

---

## 11. Discovery Questionnaire — khảo sát hệ thống đích

Mỗi hệ thống mỗi khác. Trước khi paste blueprint, **phải khảo sát đáp án các câu
dưới đây**. Mỗi câu kèm impact: blueprint cần sửa chỗ nào.

### A. Persistence layer

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| A1 | DB engine? (Postgres / MySQL / MariaDB / SQLite / MongoDB) | Tool dump khác: `pg_dump` vs `mysqldump` vs `mongodump`. Connection string format. Sequence/auto-increment khác. |
| A2 | DB version cụ thể? | Image client phải match (vd `postgresql16-client` cho PG 16, `mysql-client:8` cho MySQL 8). |
| A3 | DB chạy trên container cùng stack hay managed (RDS/Cloud SQL)? | Managed → dump qua network với IAM token, không pg_dump local. |
| A4 | DB size hiện tại + tăng trưởng tháng? | Quyết định retention, frequency, có cần incremental backup (pgBackRest) hay full dump đủ. |
| A5 | Có replica read-only không? | Dump nên hit replica để không ảnh hưởng prod write. |
| A6 | Có schema sensitive (PII, payment)? | Cần GDPR-style hash before dump? Có regulation cấm export ra GDrive? |

### B. File storage / uploads

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| B1 | Storage gì? (MinIO / S3 / GCS / Azure Blob / local disk / NFS) | `mc` chỉ cho MinIO/S3. S3 native → `aws s3 sync`. Local disk → bind mount + tar. |
| B2 | Bao nhiêu bucket? Names hardcoded hay từ env? | Hardcode list trong code vs đọc từ config. |
| B3 | Tổng size uploads hiện tại? | > 10 GB → cần chunk upload, không tar to 1 file. |
| B4 | Có CDN cache (CloudFlare R2, CloudFront) không? | Có thể skip uploads backup vì CDN giữ origin copy. |
| B5 | Upload có versioning bật không? | Bật → backup chỉ cần lưu version IDs, không phải full file. |

### C. Container / runtime

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| C1 | Docker Compose / Kubernetes / bare metal / serverless? | K8s → ConfigMap, Job, không phải bind mount. Serverless không có persistent storage. |
| C2 | API chạy non-root user không? | Có → pg_dump/rclone có thể không có quyền ghi `/root/.config/rclone`. Phải đổi user hoặc chown volume. |
| C3 | Multi-replica không? (HA) | Multiple instance → scheduler chỉ chạy 1 replica (leader election với Redis lock). |
| C4 | CI/CD restart container tần suất nào? | Restart thường → token rclone phải ở persistent volume, không container fs. |
| C5 | Cron container có sẵn chưa? | Có → tích hợp scheduler vào cron container thay vì spawn goroutine trong API. |

### D. Auth + permissions

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| D1 | RBAC system có sẵn? Tên role? | Adapt `requireBackupAccess` với tên role thực (admin / staff / owner / super_user). |
| D2 | Có concept "super admin" full bypass không? | Quyết định gate logic (bypass nếu super OR check matrix). |
| D3 | JWT trong header hay cookie? | OAuth callback có thể auth qua cookie (browser session) thay vì verify state. |
| D4 | Có audit log system không? | Backup trigger / config change cần log lại ai làm. |

### E. Env / secrets management

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| E1 | Env trong `.env` file hay Vault / Secrets Manager / K8s Secret? | Vault → không thể tar bind mount, phải dump vault content qua API. |
| E2 | Có file config riêng (yml / json) ngoài env không? | Cần liệt kê đầy đủ để scope=configs bao quát. |
| E3 | Encryption key trong env hay file riêng? | File riêng phải include trong scope=configs hoặc encrypt riêng. |
| E4 | Có rotate secrets định kỳ không? | Backup cũ có thể chứa secret outdated → mark expiry, không restore nguyên xi. |

### F. Backup target (remote)

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| F1 | GDrive / S3 / Azure / Backblaze / OneDrive / R2? | rclone support hầu hết, OAuth Web flow chỉ cần cho GDrive/OneDrive. S3 dùng access key đơn giản hơn. |
| F2 | Có Google Workspace để dùng Internal user type không? | Có → skip Test users + verification. |
| F3 | Region compliance (data residency)? | EU data không được lưu US server → chọn region phù hợp. |
| F4 | Encryption at rest yêu cầu? | Bật rclone crypt remote hoặc gpg trước upload. |
| F5 | Quota / cost ngân sách? | 15GB GDrive free, S3 $0.023/GB/month — choose theo budget. |

### G. UI / Frontend stack

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| G1 | React / Vue / Angular / Svelte? | Pattern OAuth popup + postMessage giống nhau, chỉ syntax khác. |
| G2 | UI library có Card/Dialog/Input sẵn? | Có → tái dùng. Không → build từ Tailwind cơ bản. |
| G3 | Routing có deep-link query param support? | Đã có hooks (useSearchParams) hay phải vanilla history.replaceState. |
| G4 | i18n (multi-language)? | String trong blueprint phải qua i18n key, không hardcode VI. |
| G5 | Theme dark mode support? | Class `dark:` chỉ work với Tailwind config phù hợp. |

### H. Operational

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| H1 | Có monitoring (Prometheus/Grafana/Datadog) không? | Expose metric `backup_last_success_timestamp`, `backup_duration_seconds`. |
| H2 | Alert kênh nào? (Slack/Telegram/Email/PagerDuty) | Send notification khi backup fail 2 lần liên tiếp. |
| H3 | SLA recovery time / point objective (RTO/RPO)? | RPO 1h → cron mỗi 1h. RTO 30min → cần restore script automation. |
| H4 | Disaster recovery test có lịch không? | Bắt buộc nên có quarterly drill, blueprint chỉ provide structure. |
| H5 | Compliance (SOC2/ISO/PCI/HIPAA)? | Backup phải có encryption + access log + immutable storage. |

### I. Deploy / DevOps

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| I1 | Git workflow? (git pull SSH / ArgoCD / Spinnaker) | Manual SSH → blueprint OK. GitOps → migration phải qua merge PR. |
| I2 | Migration tool? (golang-migrate / Flyway / Liquibase / Alembic) | Sửa SQL syntax cho tool đúng (golang-migrate uses `up`/`down` postfix, Flyway dùng `V<n>__`). |
| I3 | Có blue/green hoặc canary deploy không? | Scheduler chỉ run 1 instance → cần leader election hoặc disable trên green. |
| I4 | Build pipeline có cache layer Dockerfile không? | Add tools (rclone, mc) trong layer riêng để không invalidate cache nhiều. |

---

## 12. Adaptation checklist (per target system)

Cho mỗi câu trả lời khác mặc định blueprint (Go + React + Postgres + MinIO +
Docker Compose), sửa các chỗ tương ứng:

```
[ ] A1 DB engine                → service/backup.go pg_dump command
[ ] A3 DB managed?              → connection string + IAM auth
[ ] B1 Storage type             → mc vs aws-cli vs tar
[ ] B2 Bucket list source       → hardcode vs env-driven
[ ] C1 Runtime                  → docker-compose vs K8s manifest
[ ] C2 Non-root user            → Dockerfile USER + chown volume
[ ] C3 Multi-replica            → Redis lock leader election trong scheduler
[ ] D1 Role names               → requireBackupAccess role string
[ ] D2 Super admin pattern      → bypass logic
[ ] E1 Secrets in Vault         → service.go scope=configs path
[ ] F1 Remote type              → rclone remote name (gdrive vs s3 vs azure)
[ ] F2 Workspace Internal       → skip Test users step trong UI guide
[ ] F4 Encryption required      → add gpg encrypt step service.go
[ ] G1 FE framework             → port Backup.jsx pattern sang Vue/Angular
[ ] G2 UI library               → swap Card/Input/Button component
[ ] H1 Monitoring               → expose Prometheus metrics
[ ] H2 Alert channel            → call webhook khi run.status=failed
[ ] I2 Migration tool           → adapt SQL file naming convention
```

---

## 13. Reusable interview prompt

Khi adapt cho hệ thống mới, hỏi PM/Tech Lead các câu trên theo nhóm A-I. **Đừng
giả định**. Câu trả lời có thể đảo lộn toàn bộ design (vd DB managed RDS với IAM
auth → service code khác hẳn, không pg_dump nữa).

Template ngắn để gửi:

> Em đang định build feature backup auto-schedule lên cloud storage (Google
> Drive / S3 / Azure) cho admin panel. Trước khi code, em cần khảo sát hệ thống
> mình:
> - DB engine + version + có dùng managed service (RDS/Cloud SQL)?
> - Storage uploads (MinIO/S3/disk)?
> - Runtime (Docker Compose / K8s)?
> - RBAC role names + super admin pattern?
> - Backup target muốn (Drive/S3/...)?
> - Có compliance (PII/payment/HIPAA) không?
> - Có monitoring + alert sẵn không?
> - Deploy workflow (manual SSH / GitOps)?
>
> Em cần đáp án 8 câu trên trước khi estimate effort + design schema.
