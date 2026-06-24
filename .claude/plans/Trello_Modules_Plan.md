# Kế Hoạch Module & Chức Năng - Trello Clone (Admin + User)

## 0. Kiến Trúc & Tech Stack

### Infra (Docker hoá toàn bộ)
| Thành phần | Công nghệ | Vai trò |
|-----------|-----------|---------|
| Database | PostgreSQL | Dữ liệu chính (user, workspace, board, card...) |
| Cache | Redis | Session, cache, queue, rate limit, pub/sub realtime |
| Reverse proxy | Nginx | Bảo mật, TLS, định tuyến, deploy toàn dự án |
| Media/Storage | MinIO (S3) | Attachment, avatar, cover image |
| Orchestration | Docker Compose | Chạy toàn bộ stack |

### Application
| Layer | Stack | Người dùng |
|-------|-------|-----------|
| Backend API | Node.js | Phục vụ cả Admin & User (REST + WebSocket) |
| User App | React.js | Người dùng cuối dùng Trello |
| Admin App | React.js | Quản trị viên hệ thống (app riêng) |
| Landing page | Next.js | SEO/GEO, marketing, quảng bá |

### Frontend tách 3 app riêng
- **User App (React)** — `app.domain.com` — toàn bộ chức năng Trello.
- **Admin App (React)** — `admin.domain.com` — quản trị hệ thống, route bảo vệ riêng.
- **Landing (Next.js)** — `domain.com` — SSR, SEO, đăng ký dùng thử.

---

## 1. Mô Hình Phân Quyền (RBAC)

Hệ thống có **2 tầng quyền** (cả hai cùng tồn tại):

### Tầng A — System Role (toàn cục, dùng ở Admin App)
| Role | Mô tả |
|------|-------|
| `SUPER_ADMIN` | Toàn quyền hệ thống, quản lý admin khác, billing, cấu hình |
| `ADMIN` | Quản lý user, workspace, storage, audit log, monitoring |
| `SUPPORT` | Chỉ đọc + hỗ trợ: xem user/workspace, không xoá/sửa cấu hình |
| `USER` | Người dùng thường (không vào được Admin App) |

### Tầng B — Workspace/Board Role (theo ngữ cảnh, dùng ở User App)
| Cấp | Role | Quyền chính |
|-----|------|-------------|
| Workspace | `OWNER` | Toàn quyền workspace, xoá workspace, billing |
| Workspace | `WS_ADMIN` | Quản lý member, settings, tạo/xoá board |
| Workspace | `MEMBER` | Tạo/sửa board được phép, dùng card |
| Workspace | `GUEST` | Chỉ truy cập board được mời |
| Board | `BOARD_ADMIN` | Quản lý member board, settings, xoá board |
| Board | `BOARD_MEMBER` | CRUD list/card trong board |
| Board | `OBSERVER` | Chỉ xem (read-only) |

> Một user có thể là `USER` ở tầng A nhưng là `OWNER` ở 1 workspace.
> `SUPER_ADMIN`/`ADMIN` ở tầng A có quyền can thiệp mọi workspace cho mục đích quản trị (audit).

---

# PHẦN I — USER APP (React) — Người dùng cuối

## 2. Authentication & User Management
- Đăng ký / Đăng nhập / Đăng xuất
- Quên mật khẩu / Đổi mật khẩu
- Đăng nhập Google / Microsoft (OAuth)
- Hồ sơ cá nhân + Avatar (lưu MinIO)
- Cài đặt notification cá nhân
- Phiên đăng nhập (Redis session), refresh token

## 3. Workspace Management
- Tạo / sửa / xoá workspace
- Mời thành viên (email/link)
- Phân quyền: Owner / WS_Admin / Member / Guest
- Cài đặt workspace (tên, logo, visibility)

## 4. Board Management
- CRUD board + Archive
- Background, Visibility (Private / Workspace / Public), Description
- Thành viên board: add / remove / change role (Board_Admin/Member/Observer)

## 5. List Management
- Tạo / sửa / xoá / archive list
- Kéo thả đổi vị trí, collapse list

## 6. Card Management (Core)
- CRUD + Archive + Duplicate
- Title, Description, Assignee, Due/Start Date, Status
- Drag & Drop: Todo → Doing → Testing → Done
- Labels, Checklist, Comments, Attachments, Cover Image
- Mention (@), Watch card, Activity log

## 7. Checklist
- Tạo checklist + item, tick completed, % progress

## 8. Comment & Activity
- Comment: tạo / sửa / xoá / mention
- Activity log: tạo card, đổi trạng thái, hoàn thành checklist, lịch sử thao tác

## 9. Attachment
- Upload/preview/download/delete (PDF, DOCX, XLSX, PNG, JPG, ZIP) — lưu MinIO

## 10. Label
- Tạo / sửa màu / xoá / gắn vào card

## 11. Collaboration (Realtime)
- Add member board/card, mention, realtime update
- WebSocket + Redis pub/sub

## 12. Notification
- Comment mới, được assign, due date sắp tới, mention, invite
- In-app + Email + Push

## 13. Search & Filter
- Search: card / board / member
- Filter: label / assignee / due date / status

## 14. Calendar
- Calendar view, task theo ngày, kéo task, đồng bộ Google Calendar

## 15. Dashboard cá nhân & Reporting
- Tổng task, hoàn thành, quá hạn, velocity
- Pie / Bar / Burndown chart

## 16. Automation (Butler)
- Rule engine: Trigger → Condition → Action
- Rule, Scheduled Job, Card/Board Button, Due Date Trigger

## 17. Integration
- Google Drive, Slack, GitHub, Jira, Teams...

---

# PHẦN II — ADMIN APP (React) — Quản trị hệ thống

## 18. Admin Authentication
- Đăng nhập riêng cho admin (tách User App)
- Bảo vệ bằng System Role (SUPER_ADMIN / ADMIN / SUPPORT)
- 2FA bắt buộc cho admin
- Audit mọi hành động admin

## 19. User Management (Admin)
- Danh sách user (search, filter, phân trang)
- Xem chi tiết user (workspace, hoạt động)
- Khoá / mở khoá / xoá user
- Reset mật khẩu, gỡ 2FA hộ user
- Gán / thu hồi System Role
- Impersonate (đăng nhập hộ để hỗ trợ — có log)

## 20. Workspace & Board Management (Admin)
- Danh sách toàn bộ workspace
- Xem/sửa/xoá workspace bất kỳ
- Chuyển quyền Owner
- Thống kê số board/member/card mỗi workspace
- Khoá workspace vi phạm

## 21. Storage Management (Admin)
- Tổng dung lượng MinIO, theo workspace/user
- Quota & cảnh báo vượt hạn mức
- Dọn file rác / orphan

## 22. Audit Log & Security
- Nhật ký mọi hành động nhạy cảm (ai, làm gì, khi nào, IP)
- Lọc theo user / hành động / thời gian
- Cảnh báo bất thường (login lạ, brute force)

## 23. Monitoring & Health
- Trạng thái dịch vụ (API, DB, Redis, MinIO)
- Metrics: request/s, error rate, latency
- Số user online (realtime), queue status

## 24. Billing & Subscription (Admin)
- Gói dịch vụ (Free / Pro / Business)
- Quản lý subscription theo workspace
- Hoá đơn, thanh toán, lịch sử

## 25. System Configuration (Admin)
- Feature flags (bật/tắt tính năng)
- Cấu hình email/SMTP, OAuth provider
- Giới hạn mặc định (quota, rate limit)
- Quản lý template thông báo

## 26. Content Moderation (Admin)
- Báo cáo vi phạm từ user
- Gỡ nội dung (card/comment/attachment) vi phạm
- Blacklist từ khoá / domain

---

# PHẦN III — LANDING PAGE (Next.js)

## 27. Marketing & SEO
- Trang chủ, tính năng, bảng giá, blog
- SSR/SSG cho SEO + GEO tốt
- CTA đăng ký dùng thử → redirect User App
- Sitemap, meta tags, structured data

---

## Ma Trận Quyền Tóm Tắt (rút gọn)

| Hành động | USER | WS_OWNER | ADMIN (hệ thống) | SUPER_ADMIN |
|-----------|:----:|:--------:|:----------------:|:-----------:|
| Dùng board/card | ✅ | ✅ | ✅ | ✅ |
| Quản lý member workspace | ❌ | ✅ | ✅ | ✅ |
| Xoá workspace bất kỳ | ❌ | own | ✅ | ✅ |
| Khoá/xoá user | ❌ | ❌ | ✅ | ✅ |
| Gán System Role | ❌ | ❌ | một phần | ✅ |
| Billing / Config hệ thống | ❌ | ❌ | đọc | ✅ |
| Audit log | ❌ | ❌ | ✅ | ✅ |

---

# MVP (thứ tự ưu tiên)

```
Auth → Workspace → Board → List → Card → Comment → Attachment → Notification
                                                          │
                              Admin App (User mgmt + Audit log) ◄── song song
```

## 70% Giá Trị Cốt Lõi
- User: Board, List, Card, Checklist, Comment, Member, Notification, Drag & Drop
- Admin: User Management, Workspace Management, Audit Log
