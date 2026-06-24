# SSH + GitHub + VPS Deploy (DEV & PROD)

Generate production-grade instructions and commands to configure SSH + GitHub + VPS deploy for DEV and PROD environments.

---

## STEP 0 — DETERMINE CONTEXT (ask this FIRST)

Before collecting any other information, ask the owner which scenario applies:

| Scenario | Description | Questions needed |
|----------|-------------|-----------------|
| **A. Existing Dev VPS** | Dev VPS already configured, SSH key exists, only deploying a new app | 3 questions (GitHub + app name) |
| **B. New Dev VPS** | Brand new VPS, SSH not configured, no key yet | 8 questions (full setup) |
| **C. Prod VPS only** | Deploy to prod only (dev already done) | 4 questions (prod info + GitHub) |

---

## STEP 0A — FAST PATH: Existing Dev VPS

> Use this path when the owner already has a configured Dev VPS with SSH key access.
> Skip steps A (keygen), B (ssh config), D (install key), F (harden SSH) — they are already done.

Only collect these 3 values:

| # | Variable | Question |
|---|---|---|
| 1 | `GITHUB_OWNER` | GitHub username or organization? |
| 2 | `GITHUB_REPO` | Repository name? |
| 3 | `APP_NAME_DEV` | App name for this project on Dev VPS? (used for folder path + Docker) |

Then confirm the existing SSH alias works:
```bash
ssh my-vps-dev "echo connected"
```

If it works → jump directly to **Step I (Port Conflict Check)** → **Step K (Clone)** → **Step M (Deploy)**.

If it fails → fall back to Step 0B (full setup).

---

## STEP 0B — FULL SETUP: New VPS or First-Time Setup

> Use this path when the VPS is brand new or SSH has never been configured.

Collect all 8 values:

| # | Variable | Question to ask owner |
|---|---|---|
| 1 | `DEV_VPS_IP` | What is the IP address of the DEV VPS? |
| 2 | `DEV_DEPLOY_USER` | What is the deploy username on the DEV VPS? |
| 3 | `PROD_VPS_IP` | What is the IP address of the PROD VPS? |
| 4 | `PROD_DEPLOY_USER` | What is the deploy username on the PROD VPS? |
| 5 | `GITHUB_OWNER` | What is the GitHub username or organization name? |
| 6 | `GITHUB_REPO` | What is the GitHub repository name? |
| 7 | `APP_NAME_DEV` | What is the app name on the DEV VPS? (used for PM2/Docker/path) |
| 8 | `APP_NAME_PROD` | What is the app name on the PROD VPS? (used for PM2/Docker/path) |

---

## GOALS

1. Local machine generates an SSH key — access VPS without entering a password each time.
2. Public key correctly configured for GitHub via SSH.
3. 2 separate VPS instances (DEV + PROD), both accept deploys directly from local via SSH.
4. Security required: key-only SSH access, password login disabled, root login disabled.

---

## OUTPUT FORMAT

Output must include all of the following sections:

- **A.** Proposed architecture
- **B.** Commands to run on LOCAL machine
- **C.** Commands to run on DEV VPS
- **D.** Commands to run on PROD VPS
- **E.** Config file contents to create/edit
- **F.** How to safely test before disabling password login
- **G.** Hardening checklist
- **H.** Sample deploy scripts

---

## STEP-BY-STEP DETAILS

### A. GENERATE SSH KEY — run on LOCAL

```bash
# Generate key
ssh-keygen -t ed25519 -C "my-vps-deploy" -f ~/.ssh/id_ed25519_vps_deploy

# View public key
cat ~/.ssh/id_ed25519_vps_deploy.pub
```

> If a passphrase is set, show how to add it to `ssh-agent` to avoid re-entering it every time.

---

### B. CONFIGURE `~/.ssh/config` — on LOCAL

```
# DEV
Host my-vps-dev
  HostName     [ASK OWNER: DEV_VPS_IP]
  User         [ASK OWNER: DEV_DEPLOY_USER]
  Port         22
  IdentityFile ~/.ssh/id_ed25519_vps_deploy
  IdentitiesOnly yes

# PROD
Host my-vps-prod
  HostName     [ASK OWNER: PROD_VPS_IP]
  User         [ASK OWNER: PROD_DEPLOY_USER]
  Port         22
  IdentityFile ~/.ssh/id_ed25519_vps_deploy
  IdentitiesOnly yes

# GitHub
Host github.com
  HostName     github.com
  User         git
  IdentityFile ~/.ssh/id_ed25519_vps_deploy
  IdentitiesOnly yes
```

---

### C. ADD PUBLIC KEY TO GITHUB

1. Copy the contents of `~/.ssh/id_ed25519_vps_deploy.pub`
2. Go to **GitHub → Settings → SSH and GPG keys → New SSH key**
3. Paste and save
4. Test the connection:

```bash
ssh -T git@github.com
```

> If using the same key for both **authentication** and **signing**, upload each separately to the correct section.

---

### D. INSTALL PUBLIC KEY ON DEV VPS — run on DEV VPS

```bash
# Copy key from local (run on LOCAL)
ssh-copy-id -i ~/.ssh/id_ed25519_vps_deploy.pub [ASK OWNER: DEV_DEPLOY_USER]@[ASK OWNER: DEV_VPS_IP]

# Or manually on DEV VPS
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # paste public key content here
chmod 600 ~/.ssh/authorized_keys
```

> Create a dedicated deploy user — never deploy as `root`.

---

### E. INSTALL PUBLIC KEY ON PROD VPS — run on PROD VPS

```bash
# Copy key from local (run on LOCAL)
ssh-copy-id -i ~/.ssh/id_ed25519_vps_deploy.pub [ASK OWNER: PROD_DEPLOY_USER]@[ASK OWNER: PROD_VPS_IP]

# Or manually on PROD VPS
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # paste public key content here
chmod 600 ~/.ssh/authorized_keys
```

---

### F. HARDEN SSH — run on BOTH VPS

Must check and update **all** of the following (not just the main file):
- `/etc/ssh/sshd_config`
- `/etc/ssh/sshd_config.d/*.conf`

**Required configuration:**

```
PermitRootLogin              no
PasswordAuthentication       no
PubkeyAuthentication         yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitEmptyPasswords         no
```

**Additional recommended options:**

```
AuthenticationMethods publickey
AllowUsers [ASK OWNER: DEV_DEPLOY_USER]    # DEV VPS only
AllowUsers [ASK OWNER: PROD_DEPLOY_USER]   # PROD VPS only
```

**After editing:**

```bash
sudo sshd -t                                          # validate config first
sudo systemctl restart ssh || sudo systemctl restart sshd
```

---

### G. SAFE TEST BEFORE DISABLING PASSWORD LOGIN

> **IMPORTANT:** Do not close the current SSH session before testing.

```bash
# Open a NEW terminal and test each VPS
ssh my-vps-dev
ssh my-vps-prod
```

Only disable password login after confirming **both VPS accept key-based login**.

---

### H. SAFE ROLLBACK (if configuration breaks)

```bash
# Backup BEFORE editing
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo cp -r /etc/ssh/sshd_config.d/ /etc/ssh/sshd_config.d.bak/

# Validate after editing (required)
sudo sshd -t

# If broken — restore from the still-open SSH session
sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config
sudo systemctl restart ssh
```

---

### I. PORT CONFLICT CHECK — run BEFORE cloning on DEV VPS

> **MANDATORY:** The Dev VPS is shared across multiple projects. Before deploying a new app, you MUST verify that its ports do not conflict with existing services.

**Step 1 — Check what is currently running on the Dev VPS:**

```bash
ssh my-vps-dev "sudo ss -tlnp | grep -E ':(8080|8082|8083|8084|3000|3002|3003|3004|5432|5433|5434|5435|6379|6380|6381|6382)'"
```

Or check all listening ports at once:

```bash
ssh my-vps-dev "sudo ss -tlnp"
```

**Step 2 — Review the Port Registry in `.claude/references/multi-app-infra.md`:**

| App | API port | Frontend port | DB port | Redis port |
|-----|----------|---------------|---------|------------|
| TaskFlow | 8080 | 3000 | 5432 | 6379 |
| App 2 | 8082 | 3002 | 5434 | 6381 |
| App 3 | 8083 | 3003 | 5435 | 6382 |
| App 4 | 8084 | 3004 | 5436 | 6383 |

**Step 3 — Pick the next unused port set. Never reuse a port from the table above.**

**Step 4 — Update the Port Registry in `multi-app-infra.md` with the new app's ports before proceeding.**

**Step 5 — Confirm no Docker containers are occupying the chosen ports:**

```bash
ssh my-vps-dev "docker ps --format 'table {{.Names}}\t{{.Ports}}'"
```

> If any port conflict is found — stop. Choose different ports. Do NOT proceed until all ports are free.

---

### K. CLONE REPO ON DEV VPS

```bash
git clone git@github.com:[ASK OWNER: GITHUB_OWNER]/[ASK OWNER: GITHUB_REPO].git \
  /var/www/[ASK OWNER: APP_NAME_DEV]
```

| Parameter | DEV value |
|-----------|-----------|
| Directory | `/var/www/[ASK OWNER: APP_NAME_DEV]` |
| Branch | `develop` or `dev` |
| PM2 name | `[ASK OWNER: APP_NAME_DEV]` |
| Domain | `dev.example.com` |

---

### L. CLONE REPO ON PROD VPS

```bash
git clone git@github.com:[ASK OWNER: GITHUB_OWNER]/[ASK OWNER: GITHUB_REPO].git \
  /var/www/[ASK OWNER: APP_NAME_PROD]
```

| Parameter | PROD value |
|-----------|------------|
| Directory | `/var/www/[ASK OWNER: APP_NAME_PROD]` |
| Branch | `main` or `master` |
| PM2 name | `[ASK OWNER: APP_NAME_PROD]` |
| Domain | `example.com` |

---

### M. DEPLOY SCRIPT — DEV VPS

**Option 1: PM2**

```bash
#!/usr/bin/env bash
set -e
cd /var/www/[ASK OWNER: APP_NAME_DEV]
git pull origin develop
npm ci
npm run build
pm2 restart [ASK OWNER: APP_NAME_DEV]
```

**Option 2: Docker**

```bash
#!/usr/bin/env bash
set -e
cd /var/www/[ASK OWNER: APP_NAME_DEV]
git pull origin develop
docker compose up -d --build
```

---

### N. DEPLOY SCRIPT — PROD VPS

**Option 1: PM2**

```bash
#!/usr/bin/env bash
set -e
cd /var/www/[ASK OWNER: APP_NAME_PROD]
git pull origin main
npm ci
npm run build
pm2 restart [ASK OWNER: APP_NAME_PROD]
```

**Option 2: Docker**

```bash
#!/usr/bin/env bash
set -e
cd /var/www/[ASK OWNER: APP_NAME_PROD]
git pull origin main
docker compose up -d --build
```

---

## MANDATORY SECURITY CHECKLIST

- [ ] Never commit the private key to the repo
- [ ] Never copy the private key to the VPS (only the public key goes in `authorized_keys`)
- [ ] File permissions: `~/.ssh` = `700`, `authorized_keys` = `600`
- [ ] Never deploy as `root` — use a dedicated deploy user per environment
- [ ] GitHub Actions: use a separate deploy key (read-only if appropriate)
- [ ] For higher security, use separate keys per environment:
  ```
  ~/.ssh/id_ed25519_vps_dev
  ~/.ssh/id_ed25519_vps_prod
  ```
