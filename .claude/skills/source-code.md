# Source Code & Infra

Reference for repos and VPS access. Use when cloning, deploying, or SSH-ing into Dev/Prod.

---

## I. GitHub Source

| Repo | URL |
|------|-----|
| Frontend | `git@github.com:classfullstack/Trello-Clone-Frontend.git` |
| Backend | `https://github.com/classfullstack/Trello-Clone-Backend` |
| Infra | `https://github.com/classfullstack/Trello-Clone-Infra` |

---

## II. VPS & Domain

| Env | IP | User | Password |
|-----|-----|------|----------|
| Dev | `103.179.189.81` | `root` | `25SUrXx6fr4e7jwz` |
| Prod | `103.179.189.158` | `root` | `QJgKuFY6c14zKSau` |

**Prod domain:** `trello-clone.online`

```bash
ssh root@103.179.189.81    # Dev
ssh root@103.179.189.158   # Prod
```

> Secrets — do not commit to public repos. See [deploy-workflow.md](deploy-workflow.md) for the deploy flow.
