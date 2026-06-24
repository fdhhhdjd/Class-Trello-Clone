# Deploy Workflow — Local → Dev → Prod

> "Code that doesn't run on Dev doesn't go to Prod."

Two separate environments: **Dev VPS** for smoke testing → confirm OK → **Prod VPS** goes live. For multi-app port rules, see [`multi-app-infra.md`](multi-app-infra.md).

---

## Flow Overview

```
LOCAL                   GITHUB              DEV VPS               PROD VPS
──────                  ──────              ───────               ────────
git commit
git tag vX.Y.Z-rc.N ──► push tag ──────► git checkout rc.N
                                           make dev
                                           smoke test
                                                │
                                           ✋ Approve
git tag vX.Y.Z ─────────────────────────────────────────────►  git checkout vX.Y.Z
git push tag                                                     make prod
                                                                 make health
```

---

## Phase 1 — Local: Commit + Tag Release Candidate

```bash
git status
git add -p
git commit -m "feat: short summary"

git tag v1.3.0-rc.1        # rc = release candidate, deploys to Dev
git push origin main
git push origin v1.3.0-rc.1
```

**Tag convention:**

| Tag | Target | Meaning |
|-----|--------|---------|
| `v1.3.0-rc.1` | Dev VPS | Release candidate — under test |
| `v1.3.0` | Prod VPS | Stable — approved for production |

---

## Phase 2 — Dev VPS: Smoke Test

```bash
ssh my-vps-dev
cd /opt/trello/Trello_Infra
git pull --tags
git checkout v1.3.0-rc.1

make dev       # docker compose up
make health    # smoke test
```

**Verification checklist:**
- [ ] DB migrations ran without error
- [ ] `GET /health` → `{"status":"ok"}`
- [ ] Login / logout flow works
- [ ] New feature behaves per spec
- [ ] No regression on existing features

> Dev data: seed/fake only. Never use production data on Dev.

---

## Phase 3 — Gate: Approve to Promote

After Dev QA passes, create the stable tag from the same commit:

```bash
# On local machine
git checkout v1.3.0-rc.1
git tag v1.3.0              # stable — no -rc suffix
git push origin v1.3.0
```

This tag is the manual approval gate. No stable tag = no prod deploy.

---

## Phase 4 — Prod VPS: Deploy Live

```bash
ssh my-vps-prod
cd /opt/trello/Trello_Infra
git pull --tags
git checkout v1.3.0

make prod      # pull images + migrate DB + restart containers
make health    # verify {"status":"ok"}
```

**What `make prod` does:**
1. `docker compose pull` — pull new images
2. `docker compose run migrate` — run pending DB migrations
3. `docker compose up -d` — restart api + nginx (zero-downtime where possible)

---

## Dev vs Prod Comparison

| Aspect | Dev VPS | Prod VPS |
|--------|---------|----------|
| Purpose | Test rc tags, QA, smoke test | Serve real users |
| Tag | `v1.3.0-rc.N` | `v1.3.0` (stable only) |
| Data | Seed / fake data | Real data with backups |
| Domain | ask owner (Dev VPS IP) | ask owner (Prod domain) |
| TLS | None (HTTP only) | Let's Encrypt via Cloudflare |
| Log level | `debug` | `info` |
| Backups | Not required | Daily, off-site |

---

## Step Summary

| Step | Where | Command | Purpose |
|------|-------|---------|---------|
| 1. Commit | Local | `git commit` | Save changes |
| 2. Tag rc | Local | `git tag v1.3.0-rc.1` | Mark release candidate |
| 3. Push | Local | `git push origin main --tags` | Upload to GitHub |
| 4. Deploy Dev | Dev VPS | `make dev` | Start test environment |
| 5. QA | Dev VPS | Manual + `make health` | Verify correctness |
| 6. Approve | Local | `git tag v1.3.0` | Gate — approve for prod |
| 7. Deploy Prod | Prod VPS | `make prod` | Ship to users |
| 8. Verify | Prod VPS | `make health` | Confirm healthy |
