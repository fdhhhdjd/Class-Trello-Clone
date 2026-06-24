# Backup Google Drive — Setup Guide

Hướng dẫn admin setup backup MasterLMS lên Google Drive qua rclone OAuth.
Toàn bộ flow đã có UI ở `/admin/backup`; doc này để reference offline + lưu trữ.

> Yêu cầu: Super Admin role · Gmail (có thể tạo project GCP free).

---

## Bước 1 — Tạo project GCP

Vào https://console.cloud.google.com/projectcreate

- Project name: `MasterLMS Backup` (hoặc tên tùy ý)
- Bấm **Create**
- Chờ vài giây → chọn project vừa tạo ở top bar

---

## Bước 2 — Enable Google Drive API

Vào https://console.cloud.google.com/apis/library/drive.googleapis.com

- Bấm **Enable**
- Chờ ~30s thấy status "API enabled"

---

## Bước 3 — Cấu hình OAuth consent screen

### 3.1 Branding

Vào https://console.cloud.google.com/auth/branding

- **User Type**: External *(vì dùng Gmail thường, không phải Workspace)*
- App name: `MasterLMS Backup`
- User support email: email bạn
- Developer contact: email bạn
- Save

### 3.2 Audience — add test user

Tab **Audience** → **Test users → + Add users**
- Paste email Gmail bạn sẽ dùng để backup
- Save

> ⚠ Bắt buộc. Không add = login bị block 403 access_denied.

---

## Bước 4 — Add scope Drive

Vào https://console.cloud.google.com/auth/scopes

- Bấm **Add or remove scopes**
- Search "drive". Nếu không thấy → kéo xuống **Manually add scopes**, paste:
  ```
  https://www.googleapis.com/auth/drive
  ```
- **Add to table** → **Update** → **Save**

> Đây là sensitive scope, sẽ hiện cảnh báo "App not verified" khi login — bình thường khi testing.

---

## Bước 5 — Tạo OAuth Client ID

Vào https://console.cloud.google.com/apis/credentials

- **+ Create Credentials → OAuth client ID**
- Application type: **Web application**
- Name: `Web client 1` (tùy ý)
- **Authorized redirect URIs** → paste:
  ```
  https://lms-codewebkhongkho.com/api/v1/public/backup/oauth/callback
  ```
  *(local dev: `http://localhost:8080/...` — tự đổi host)*
- **Create**
- Popup hiện Client ID + Client Secret → **copy NGAY** (secret chỉ thấy 1 lần)

---

## Bước 6 — Paste creds + Login trong UI

Vào /admin/backup:
- Paste **Client ID** + **Client Secret** vào 2 ô
- Bấm **Lưu credentials**
- Bấm **Đăng nhập Google** → popup mở
- Chọn account → bấm **Tiếp tục** qua warning "Google chưa xác minh" (bình thường)
- Màn consent: **TICK CHECKBOX DRIVE** ("See, edit, create, delete all of your Google Drive files")
- **Continue → Allow**

UI hiện email account = thành công. Bấm **Backup ngay** để test lần đầu.

---

## Lỗi thường gặp

| Lỗi | Cách fix |
|---|---|
| `Error 403: access_denied` | Email chưa add Test users → vào Audience tab add lại |
| `ACCESS_TOKEN_SCOPE_INSUFFICIENT` | Chưa add scope Drive (bước 4) hoặc lúc consent không tick checkbox Drive → Disconnect + login lại tick Drive |
| `Google chưa xác minh ứng dụng này` | Bình thường khi Testing → bấm "Tiếp tục" (chữ nhỏ bên trái) |
| Refresh token expire 7 ngày | App ở Testing → mỗi tuần login lại, hoặc vào Audience → **Publish app** chuyển sang In production (không expire) |
| `insufficient authentication scopes` sau khi đã add scope | Token cũ cache → Disconnect trong UI rồi login lại |
| `infra snapshot mount missing /infra-snapshot` | Bind mount chưa active → trên VPS `cd /root/web/LMS-Master/class-lms-infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api` để container pickup mount |

---

## Reference

- Migration 116 (backup_settings, backup_runs): `class-lms-backend/migrations/116_*`
- Migration 117 (gdrive_client_id, secret, account_email): `class-lms-backend/migrations/117_*`
- Service: `class-lms-backend/internal/service/backup.go` + `backup_oauth.go` + `backup_scheduler.go`
- Handlers: `class-lms-backend/internal/handlers/backup.go`
- FE page: `class-lms-web/src/pages/admin/Backup.jsx`
- Volumes prod: `rclone-config` (token), `backup-tmp` (staging), bind-mount `../class-lms-infra:/infra-snapshot:ro`
- Tools trong API container: rclone v1.66, pg_dump 16.14, mc 2025-08-13
- Schedule timezone: Asia/Ho_Chi_Minh
- Retention: tự xoá folder cũ trên Drive, giữ N mới nhất theo settings
