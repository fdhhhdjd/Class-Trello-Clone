# API Contract — Trello Clone (v1)

Single source of truth for backend ↔ frontend. All paths prefixed `/api`. JSON. Auth = Bearer access token (in-memory) + refresh httpOnly cookie. Responses are camelCase. Errors: `{ "error": "CODE", "message": "..." }` with proper HTTP status.

## Conventions
- List responses return a bare array `[...]` (frontend tolerates `{items}` too, but prefer bare array; admin lists may return `{ data: [...], total: n }`).
- Timestamps ISO 8601. IDs are UUID strings (roles/permissions are ints).
- Auth required on everything except `/auth/login`, `/auth/register`, `/auth/renew`.
- RBAC: workspace/board scoped via membership (see Scoping). Admin endpoints require system role permission via `authorize(...)`.
- `position` is a Float (fractional indexing). New item at end = max(position)+1024. Move = midpoint of neighbors.

## Scoping (tier B)
- A user can access a workspace if they are owner OR have a UserRole with tenantId=workspaceId.
- Board access derived from its workspace membership (MVP: workspace members can access all boards in workspace unless board visibility=private and user not a member). Keep MVP simple: workspace membership grants board access.
- On workspace create, creator becomes owner + gets `ws_owner` role (UserRole tenantId=workspace.id). Ensure roles `ws_owner`, `ws_admin`, `ws_member`, `ws_guest`, `board_admin`, `board_member`, `observer` exist (add to seed if missing; non-system or system=false).

---

## AUTH (exists already, do not change behavior)
- POST `/auth/register` {email,password,name} -> 201 {accessToken} + sets refresh cookie. Also assigns the `user` system role.
- POST `/auth/login` {email,password,otp?} -> 200 {accessToken} + refresh cookie.
- POST `/auth/renew` -> 200 {accessToken} (rotates refresh).
- POST `/auth/logout`, `/auth/logout-all`, `/auth/change-password`.
- GET `/me` -> { user:{id,email,name,avatarUrl,isActive,createdAt}, roles:[...keys], permissions:[...keys] }.

---

## USER APP ENDPOINTS

### Workspaces
- GET `/workspaces` -> array of workspaces the user can access: `{id,name,visibility,ownerId,role,boardCount,createdAt}` (role = user's role in ws).
- POST `/workspaces` {name, visibility?} -> 201 workspace. Creator = owner.
- GET `/workspaces/:id` -> workspace detail incl members.
- PATCH `/workspaces/:id` {name?,visibility?} -> updated (ws_admin/owner).
- DELETE `/workspaces/:id` -> 204 (owner only).
- POST `/workspaces/:id/members` {email, role} -> add/invite member (ws_admin/owner).
- GET `/workspaces/:id/members` -> array {userId,email,name,role}.

### Boards
- GET `/boards?workspaceId=` -> array `{id,workspaceId,name,background,visibility,archived,createdAt}`.
- POST `/boards` {workspaceId,name,background?,visibility?} -> 201 board.
- GET `/boards/:id` -> board detail `{...board, lists:[{...list, cards:[{...card, labels, members, commentCount, checklistSummary}]}], labels:[]}` (the full board payload for the board view).
- PATCH `/boards/:id` {name?,background?,visibility?,archived?} -> updated.
- DELETE `/boards/:id` -> 204.

### Lists
- GET `/lists?boardId=` -> array `{id,boardId,name,position,archived}` ordered by position.
- POST `/lists` {boardId,name,position?} -> 201 list (position defaults to end).
- PATCH `/lists/:id` {name?,position?,archived?} -> updated.
- DELETE `/lists/:id` -> 204.

### Cards
- GET `/cards?boardId=` (or `?listId=`) -> array `{id,listId,title,description,position,dueDate,startDate,coverUrl,archived,labels:[],members:[],commentCount,createdAt}`.
- POST `/cards` {listId,title,position?} -> 201 card.
- GET `/cards/:id` -> full card incl labels, members, comments, checklists.
- PATCH `/cards/:id` {title?,description?,dueDate?,startDate?,coverUrl?,archived?} -> updated.
- PATCH `/cards/:id/move` {listId, position} -> 200 updated card. Emits realtime.
- DELETE `/cards/:id` -> 204.

### Comments
- GET `/cards/:id/comments` -> array `{id,cardId,body,editedAt,createdAt,author:{id,name,email,avatarUrl}}` newest last.
- POST `/cards/:id/comments` {body} -> 201 comment (with author populated).
- PATCH `/comments/:id` {body} -> updated (author only).
- DELETE `/comments/:id` -> 204 (author or board_admin).

### Labels / Checklists (board view support)
- GET `/boards/:id/labels`, POST `/boards/:id/labels` {name,color}, DELETE `/labels/:id`.
- POST `/cards/:id/labels` {labelId}, DELETE `/cards/:id/labels/:labelId`.
- POST `/cards/:id/checklists` {title}, POST `/checklists/:id/items` {text}, PATCH `/checklist-items/:id` {done?,text?}, DELETE variants.

### Realtime (Socket.IO, namespace default, path /socket.io)
- Client emits `board:join` {boardId} / `board:leave` {boardId}.
- Server emits to room `board:<id>`: `card:created|updated|moved|deleted`, `list:created|updated|deleted`, `comment:created`.

---

## ADMIN APP ENDPOINTS (system roles; guard each with authorize)
- GET `/admin/stats` (authorize `system.view_audit_log` or `users.list`) -> `{users:{total,active,suspended}, workspaces:{total}, boards:{total}, storage:{bytes}}`.
- GET `/admin/users?search=&page=&pageSize=` (authorize `users.list`) -> `{ data:[{id,email,name,isActive,roles:[],createdAt}], total }`.
- POST `/admin/users/:id/suspend` {suspend:boolean} (authorize `users.suspend`) -> updated user. Audit.
- POST `/admin/roles/assign` {userId, roleKey, tenantId?} (authorize `roles.assign`) -> ok. Invalidate user perms cache. Audit.
- GET `/admin/workspaces?search=&page=&pageSize=` (authorize `workspaces.list` or admin) -> `{ data:[{id,name,ownerEmail,boardCount,memberCount,createdAt}], total }`.
- DELETE `/admin/workspaces/:id` (authorize `workspaces.delete`) -> 204. Audit.
- GET `/admin/audit?actor=&action=&from=&to=&page=&pageSize=` (authorize `system.view_audit_log`) -> `{ data:[{id,actorId,actorEmail,action,targetId,metadata,ipAddress,createdAt}], total }`.

Add any missing permission keys to the seed (e.g. `workspaces.list`, `workspaces.delete`, `users.suspend`, `roles.assign`, `system.view_audit_log`) and map to admin/super_admin roles.

---

## PROFILE / SETTINGS / NOTIFICATIONS (added)
- PATCH `/me` {name?,avatarUrl?} -> updated user.
- POST `/me/avatar` {filename,contentType} -> {uploadUrl (presigned PUT), fileUrl, key}. Client PUTs the file to uploadUrl, then PATCH `/me` {avatarUrl:fileUrl}.
- POST `/me/change-password` {currentPassword,newPassword} -> 204.
- DELETE `/me` -> deactivate own account (super_admin blocked).
- GET `/me/settings` -> settings object (e.g. {theme,notifications}). PATCH `/me/settings` {settings} -> merged settings.
- GET `/notifications?unread=&page=&pageSize=` -> {data:[{id,type,payload,read,createdAt}],total,unreadCount}.
- GET `/notifications/unread-count` -> {count}. POST `/notifications/:id/read`. POST `/notifications/read-all`. DELETE `/notifications/:id`.
- Realtime: socket joins room `user:<id>`; server emits `notification:new` {..notification}.
- Card members: POST `/cards/:id/members` {userId}, DELETE `/cards/:id/members/:userId`.
- PATCH `/lists/:id` (rename/move/archive), PATCH `/labels/:id`, PATCH `/checklists/:id` all exist. Full CRUD on workspace/board/list/card/comment/label/checklist.
