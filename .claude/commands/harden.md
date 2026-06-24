---
description: Hardening checklist VPS — 5 mandatory rules before going prod (SSH key, firewall, fail2ban, non-root app, reverse proxy). Each item has CHECK + FIX + VERIFY.
---

# /harden — VPS Hardening

> *"Code sạch tới mấy mà server hở thì cũng bằng 0."*

Phạm vi: VPS server (Ubuntu, `root@<your-server>`). KHÔNG đụng app code — chỉ chỉnh OS + nginx + docker.

Quy tắc khi chạy:
1. Mỗi nguyên tắc → CHECK trước, FIX sau, VERIFY cuối.
2. Mỗi thay đổi SSH/firewall → **giữ 1 session SSH cũ mở** phòng lock chính mình.
3. Backup file config trước khi sửa (`cp /etc/X /etc/X.bak-$(date +%F)`).

---

## 1️⃣ SSH key + tắt password / root login

**WHY:** Password brute-force là attack vector #1 trên VPS public. Key authentication + tắt root direct chặn 99% bot.

**CHECK** (gì đang bật):
```bash
ssh my-vps 'grep -rh -E "(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null'
```

> ⚠️ **DỪNG nếu server chỉ có user `root`** — phải tạo deploy user + verify login được TRƯỚC khi touch SSH config. Nếu lock out, phải dùng web console của VPS provider để recover (không có shortcut nào khác).

**PRE-FIX — tạo deploy user (bắt buộc nếu chưa có):**
```bash
# Chạy trên VPS, thay 'deploy' bằng tên user bạn muốn
ssh my-vps 'adduser --disabled-password --gecos "" deploy && \
  mkdir -p /home/deploy/.ssh && \
  cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys && \
  chown -R deploy:deploy /home/deploy/.ssh && \
  chmod 700 /home/deploy/.ssh && \
  chmod 600 /home/deploy/.ssh/authorized_keys && \
  usermod -aG sudo deploy'

# Verify login được bằng user mới TỪ TERMINAL KHÁC trước khi tiếp tục:
ssh -i ~/.ssh/<your-key> deploy@<vps-ip> "whoami"
# Phải in ra "deploy" — nếu không vào được thì DỪNG, không làm bước tiếp theo.

# Sau khi verify OK, cập nhật ~/.ssh/config trên máy local để dùng deploy user:
# Host my-vps
#   User deploy   ← đổi từ root sang deploy
#   ...
# Test alias mới: ssh my-vps "whoami"  — phải in ra "deploy"
```

**FIX (chỉ làm sau khi verify deploy user login OK):**
```bash
# Xóa file stale từ cloud-init nếu có conflict:
ssh my-vps 'ls /etc/ssh/sshd_config.d/'
# Nếu thấy file nào có PermitRootLogin yes → xóa: rm /etc/ssh/sshd_config.d/<file>

# Patch 50-cloud-init.conf nếu có (override PasswordAuthentication):
ssh my-vps 'grep -l "PasswordAuthentication yes" /etc/ssh/sshd_config.d/*.conf 2>/dev/null | \
  xargs -I{} sed -i "s/PasswordAuthentication yes/PasswordAuthentication no/" {}'

# Chỉ dùng prohibit-password (KHÔNG dùng no) — root vẫn vào bằng key được,
# tránh lock out chính mình nếu deploy user có vấn đề.
ssh my-vps 'cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak-$(date +%F) && \
  sed -i "s/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/" /etc/ssh/sshd_config && \
  sed -i "s/^#*PasswordAuthentication.*/PasswordAuthentication no/" /etc/ssh/sshd_config && \
  sed -i "s/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/" /etc/ssh/sshd_config && \
  sshd -t && systemctl reload ssh'
# Dùng "systemctl reload ssh" (Ubuntu) — KHÔNG dùng "reload sshd" (service không tồn tại trên Ubuntu 22+)
```

**VERIFY — ngay sau reload, từ terminal MỚI:**
```bash
# Test root vẫn vào được bằng key:
ssh -i ~/.ssh/<your-key> root@<vps-ip> "echo root-ok"

# Test password bị từ chối:
ssh -o PreferredAuthentications=password root@<vps-ip> "echo loged" 2>&1 | tail -2
# Phải báo "Permission denied (publickey)" — không có prompt password nữa.
```

`prohibit-password` = root vẫn vào được bằng KEY (đỡ phải lock chính mình ngay), chỉ chặn password. Khi đã:
1. Dùng deploy user quen rồi (đã cập nhật `~/.ssh/config` sang deploy user)
2. Deploy scripts không còn dùng `root` nữa

...thì mới đổi tiếp sang `PermitRootLogin no` để khóa hẳn root SSH.

> 💡 **Sau khi có deploy user:** thêm ngay vào group `docker` (xem Section 6) để user có thể chạy `docker` / `docker compose` mà không cần `sudo`. Nếu bỏ qua bước này, mọi deploy command đều cần root hoặc sudo password.

---

## 2️⃣ Firewall — chỉ mở 22, 80, 443

**WHY:** Mỗi port hở thừa = 1 attack surface. Postgres (5432), Redis (6379), MinIO (9000) phải binding `127.0.0.1` hoặc network docker, KHÔNG expose Internet.

**CHECK** (port đang lắng nghe ra Internet):
```bash
ssh my-vps 'ss -tlnp | grep -v "127.0.0.1\|::1" | sort -k4'
# Chỉ được phép thấy :22 :80 :443. Bất cứ port nào khác (5432, 9000, 8080...) là LEAK.
```

**FIX (ufw):**
```bash
ssh my-vps 'ufw default deny incoming && ufw default allow outgoing && \
  ufw allow 22/tcp && ufw allow 443/tcp && \
  ufw --force enable'
# Port 80: chỉ mở nếu không dùng Cloudflare. Prod sau Cloudflare → chỉ cần 443.
```

Nếu thấy postgres/redis expose: sửa `docker-compose.yml` — đổi `ports: ["5432:5432"]` thành `ports: ["127.0.0.1:5432:5432"]` hoặc bỏ hẳn `ports:` (chỉ dùng network nội bộ). Restart service sau khi sửa.

> ⚠️ **Docker bypass UFW** — `ufw enable` không đủ! Docker tự thêm iptables rules vào `DOCKER` chain, đi thẳng qua `INPUT` chain mà UFW quản lý. Phải cài thêm `ufw-docker` để vá lỗ hổng này.

**FIX (ufw-docker — bắt buộc nếu dùng Docker):**
```bash
# Cài ufw-docker
ssh my-vps 'sudo wget -O /usr/local/bin/ufw-docker \
  https://github.com/chaifeng/ufw-docker/raw/master/ufw-docker && \
  sudo chmod +x /usr/local/bin/ufw-docker && \
  sudo ufw-docker install && \
  sudo systemctl restart ufw'

# Chỉ allow đúng container nginx ra internet (không allow db/redis/api):
ssh my-vps 'sudo ufw-docker allow <nginx-container-name> 80'
ssh my-vps 'sudo ufw-docker allow <nginx-container-name> 443'
# Tìm tên container: docker ps --format "{{.Names}}" | grep nginx
```

**VERIFY:**
```bash
ssh my-vps 'ufw status numbered && ufw-docker status'
# Từ máy khác — test port nội bộ phải bị block:
curl -sI -m 5 http://<vps-ip>:5432   # → timeout = OK
curl -sI -m 5 http://<vps-ip>:6379   # → timeout = OK
curl -sI -m 5 http://<vps-ip>:8080   # → timeout = OK (nếu api không phải nginx)
# Qua nginx phải OK:
curl -sI https://<your-domain.com>/api/health
```

---

## 3️⃣ Fail2ban — auto-ban brute force

**WHY:** SSH key đã rất an toàn nhưng bot vẫn quét log spam → fail2ban tự ban IP để giảm noise + chặn các vector khác (nginx 401/404 flood).

**CHECK:**
```bash
ssh my-vps 'systemctl is-active fail2ban 2>&1; fail2ban-client status 2>&1 | head -10'
```

**FIX:**
```bash
ssh my-vps 'apt-get update -q && apt-get install -y fail2ban && \
  cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = 22
backend = systemd

[nginx-botsearch]
enabled = true
logpath = /var/log/nginx/access.log
EOF
  systemctl enable --now fail2ban && fail2ban-client status sshd'
```

**VERIFY:**
```bash
ssh my-vps 'fail2ban-client status sshd; tail -20 /var/log/fail2ban.log'
# Phải thấy "Currently banned" tăng dần theo thời gian (bot scan SSH liên tục).
```

---

## 4️⃣ App KHÔNG chạy quyền root

**WHY:** Container bị exploit → attacker có quyền user trong container. Nếu user đó là root → bind-mount escape sang host khả thi.

**CHECK** (mỗi container chạy user gì):
```bash
ssh my-vps 'for c in $(docker ps --format "{{.Names}}"); do \
  echo -n "$c: "; docker inspect $c --format "{{.Config.User}}"; done'
# Trống "" hoặc "root"/"0" = chạy root. Tên user hoặc UID > 0 = OK.
```

**FIX** (trong `<your-app>/Dockerfile`):
```dockerfile
# Thêm trước CMD/ENTRYPOINT:
RUN addgroup -S app && adduser -S -G app app
USER app
```

Postgres + MinIO image official đã chạy non-root sẵn. Nginx official chạy root cho port 80 (cần thiết). Chỉ cần lo `api` + `cron` + custom services.

Bonus: chạy docker daemon rootless (`dockerd-rootless-setuptool.sh install`) nếu muốn paranoid mode. Tradeoff: 1 số volume mount + network config khác. **Không khuyến khích retrofit prod** — chỉ khi xây mới.

**VERIFY** (sau khi rebuild):
```bash
ssh my-vps 'docker exec <app-api-container> whoami'
# Phải in ra "app", không phải "root".
```

---

## 5️⃣ Reverse proxy nginx — KHÔNG expose port app

**WHY:** App tự handle SSL/HTTP/2/compression dở hơn nginx và lộ port nội bộ. Nginx còn rate-limit + cache + access log tập trung.

**CHECK** (api có expose port không):
```bash
ssh my-vps 'docker ps --format "{{.Names}}\t{{.Ports}}" | grep -v "127.0.0.1\|0.0.0.0:80\|0.0.0.0:443"'
# Chỉ nginx được phép có 0.0.0.0:80/443. api/db... phải KHÔNG có port mapping ra 0.0.0.0.
```

**FIX** (trong `docker-compose.prod.yml` cho service api):
```yaml
api:
  # ports: ["8080:8080"]    # ❌ XOÁ
  expose: ["8080"]            # ✅ chỉ network nội bộ docker
```

Nginx upstream `proxy_pass http://api:8080;` đã có sẵn — không expose host port app nào.

**VERIFY:**
```bash
# Từ Internet curl trực tiếp port 8080 phải fail:
curl -sI -m 5 http://<your-domain.com>:8080/health
# → "Connection refused" hoặc timeout = OK.
# Qua nginx phải 200:
curl -sI https://<your-domain.com>/api/v1/health
```

---

## 6️⃣ Docker group — deploy user không cần sudo docker

**WHY:** Sau khi tạo deploy user (Section 1), user đó mặc định không có quyền chạy `docker`. Nếu không thêm vào group `docker`, mọi `docker compose build/up` đều cần `sudo` — yêu cầu password hoặc NOPASSWD sudoers. Thêm vào group `docker` là cách sạch nhất: không cần sudo, không cần NOPASSWD, deploy script chạy trực tiếp.

> ⚠️ **Security note:** Group `docker` = quyền root host de facto (có thể mount `/` vào container). Chỉ thêm user deploy đáng tin cậy. Không thêm user thường/untrusted.

**CHECK** (deploy user đã trong group docker chưa):
```bash
ssh my-vps 'groups <deploy-user>'
# Nếu thấy "docker" trong danh sách → đã OK.
# Nếu không thấy → cần thêm.

# Kiểm tra thực tế có chạy docker được không:
ssh my-vps 'docker ps' 2>&1 | head -3
# "permission denied while trying to connect to the Docker daemon socket" → chưa có quyền
```

**FIX:**
```bash
# Thêm deploy user vào group docker (chạy bằng root):
ssh -i ~/.ssh/<root-key> root@<vps-ip> 'usermod -aG docker <deploy-user> && groups <deploy-user>'
# Kết quả phải thấy: <deploy-user> : <deploy-user> sudo users docker

# Fix .git ownership nếu repo được clone bằng root (deploy user không git pull được):
ssh -i ~/.ssh/<root-key> root@<vps-ip> '
  chown -R <deploy-user>:docker /opt/<app>/<repo>/.git
  chmod -R g+w /opt/<app>/<repo>/.git
'
# Áp dụng cho tất cả repos: backend, frontend, infra, admin
```

**VERIFY — từ session MỚI (group change chỉ có hiệu lực ở session mới):**
```bash
# Mở terminal mới, SSH bằng deploy user:
ssh my-vps 'docker ps --format "table {{.Names}}\t{{.Status}}"'
# Phải thấy danh sách container, không có "permission denied"

# Verify git pull hoạt động:
ssh my-vps 'git -C /opt/<app>/<repo> fetch --tags --dry-run 2>&1'
# Không có "Permission denied" → OK

# Verify docker compose build hoạt động:
ssh my-vps 'docker compose -f /opt/<app>/infra/docker-compose.yml ps' 2>&1 | head -5
```

**Tại sao cần session mới:**
Group membership được đọc lúc login. Session hiện tại vẫn dùng group cũ cho đến khi logout/login lại. Không cần reboot server — chỉ cần `exit` rồi SSH lại.

---

## Quick audit 1 dòng

Chạy nguyên block để check trạng thái 6 mục:
```bash
ssh my-vps 'echo "=== 1. SSH ===" && grep -rh -E "^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null; \
  echo; echo "=== 2. UFW ==="; ufw status | head; ufw-docker status 2>/dev/null | head -5; \
  echo; echo "=== 3. Fail2ban ==="; systemctl is-active fail2ban; fail2ban-client status 2>&1 | head -5; \
  echo; echo "=== 4. Container user ==="; for c in $(docker ps --format "{{.Names}}"); do printf "%-20s %s\n" "$c" "$(docker inspect $c --format "{{.Config.User}}")"; done; \
  echo; echo "=== 5. Port leak ==="; ss -tlnp | grep -v "127.0.0.1\|::1" | awk "{print \$4}" | sort -u; \
  echo; echo "=== 6. Docker group ==="; groups <deploy-user>; docker ps --format "{{.Names}}" 2>&1 | head -3'
```

---

## Anti-patterns ❌

- Tắt password SSH TRƯỚC khi verify key login → lock out chính mình. Luôn giữ session cũ + test ở terminal mới.
- Dùng `PermitRootLogin no` khi server chỉ có user `root` và chưa tạo deploy user → lock out hoàn toàn, chỉ recover được qua web console VPS provider.
- Thêm `AuthenticationMethods publickey` vào config khi có `50-cloud-init.conf` đang set `PasswordAuthentication yes` → conflict, SSH daemon từ chối key dù fingerprint đúng.
- Dùng `systemctl reload sshd` trên Ubuntu 22+ — service không tồn tại, dùng `systemctl reload ssh`.
- Không check `/etc/ssh/sshd_config.d/` trước khi edit — file drop-in override hết config chính mà không biết.
- `ufw enable` trên SSH session đang dùng mà chưa `allow 22` → đứt kết nối luôn.
- Expose `0.0.0.0:5432` "để dev tiện connect" → lộ DB ra Internet. Dùng SSH tunnel: `ssh -L 5432:localhost:5432 my-vps`.
- Cài fail2ban xong quên kiểm tra `findtime/maxretry` → ban quá gắt, ban nhầm IP văn phòng.
- Đổi Dockerfile sang USER app mà quên chmod volume mount → app crash ghi log vì không có quyền.
- `docker run --privileged` cho tiện debug → cấp root host cho container. Không dùng prod.
- Không thêm deploy user vào group `docker` → mọi deploy cần sudo password hoặc NOPASSWD sudoers → lộ attack surface.
- Clone repo bằng root rồi deploy bằng deploy user → `.git/` owned by root, `git fetch/pull` fail với "Permission denied". Fix: `chown -R <deploy-user>:docker .git && chmod -R g+w .git`.
- Thêm user thường (không phải deploy script) vào group `docker` → user đó có thể `docker run -v /:/host --rm -it ubuntu chroot /host` = root host.
- Expect group change có hiệu lực ngay trong session hiện tại → không hoạt động. Phải mở session SSH mới.

---

## Khi nào chạy /harden

- Lần đầu setup VPS mới.
- Sau khi thấy log nginx/sshd có bot scan dày.
- Trước khi mở public traffic (vd chạy quảng cáo lớn).
- Audit định kỳ 3 tháng / lần.

Không cần chạy mỗi deploy — đây là one-shot per server lifetime + audit định kỳ.
