# RBAC — Role-Based Access Control

> Authorization design process for any project — backend agnostic, frontend agnostic.
> Applicable to web apps, mobile apps, API services, and internal tools.

---

## 1. What is RBAC?

**Role-Based Access Control** = grant permissions based on ROLES rather than assigning permissions directly to individual users.

```
User  →  Role(s)  →  Permission(s)  →  Resource × Action
(who)    (role)       (what they can do)  (on what)
```

### Quick model comparison

| Model | When to use | Example |
|---|---|---|
| **ACL** (Access Control List) | Small apps, few users, highly personalized permissions | `userId=42 can edit project=99` |
| **RBAC** ⭐ | Medium-large apps, clear roles, easy to audit | `role=manager can edit project` |
| **ABAC** (Attribute-Based) | Permissions depend on dynamic context (time, IP, owner) | `edit only if owner + within business hours` |
| **ReBAC** (Relationship-Based) | Social graphs, sharing | `friend of a friend can view post` |

**Default to RBAC.** Simple, auditable, scales well. When RBAC isn't enough → add ABAC scope (e.g. `member.canEdit + isOwner`) rather than rewriting everything.

---

## 2. Three Core Concepts

### 2.1. User
An individual or service account — the entity that logs into the system.

### 2.2. Role
A collection of permissions. **Never assign permissions directly to a user** — always go through a role.

Standard roles for a commercial SaaS:
- `super_admin` — full access, **only 1-2 accounts** (founder, on-call). Bypasses all checks.
- `admin` — manages operations, no access to billing/owner-level settings.
- `manager` / `teacher` / `agent` — domain-specific roles.
- `user` / `member` / `customer` — regular end users.
- `guest` / `viewer` — read-only, no login required (or limited login).

### 2.3. Permission
A specific action on a specific resource type. Standard format:

```
<resource>.<action>
```

Examples:
- `users.create`, `users.update`, `users.delete`, `users.list`
- `orders.read`, `orders.refund`, `orders.cancel`
- `reports.export`, `reports.view_revenue`
- `system.manage_roles`, `system.view_audit_log`

**Common actions**: `create`, `read`, `update`, `delete`, `list`, `export`, `approve`, `reject`, `assign`, `manage`.

---

## 3. Standard Database Schema

Minimum schema for production-ready RBAC:

```sql
-- users table already exists
CREATE TABLE users (
    id          UUID PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    -- ... other columns
);

-- roles table — fixed, seeded during migration
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    key         TEXT UNIQUE NOT NULL,         -- 'super_admin' | 'admin' | 'user'
    name        TEXT NOT NULL,                -- 'Super Admin' (displayed on FE)
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false  -- true = built-in, cannot be deleted
);

-- permissions table — list of all actions in the system
CREATE TABLE permissions (
    id          SERIAL PRIMARY KEY,
    key         TEXT UNIQUE NOT NULL,         -- 'users.create'
    resource    TEXT NOT NULL,                -- 'users'
    action      TEXT NOT NULL,                -- 'create'
    description TEXT
);

-- M-N: which permissions a role has
CREATE TABLE role_permissions (
    role_id        INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id  INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- M-N: which roles a user has (one user can have multiple roles)
CREATE TABLE user_roles (
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id     INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES users(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- Audit log — required for all permission mutations
CREATE TABLE access_audit (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID NOT NULL,                -- who performed the action
    target_id   UUID,                         -- who was affected (if any)
    action      TEXT NOT NULL,                -- 'role.assigned' | 'permission.checked.denied'
    metadata    JSONB,                        -- {role: 'admin', resource: 'users', ...}
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_audit_actor ON access_audit(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON access_audit(action, created_at DESC);
```

**Important notes:**
- Seed permissions via migration code, not manual inserts → dev/staging/prod stay in sync.
- `roles.is_system = true` for built-in roles (super_admin, admin, user) → admin UI cannot delete them.
- Index on `user_roles(user_id)` for permission checks under 5ms.

---

## 4. Permission Check — Standard Flow

```
Request arrives at endpoint /api/orders/123/refund
    ↓
Middleware: authenticate (JWT/session) → user.id, user.roles
    ↓
Middleware: authorize(permission='orders.refund')
    ↓
    ├─ user has role super_admin? → ALLOW (skip check)
    ├─ load user.roles permissions from cache
    ├─ required permission ∈ permissions? → ALLOW
    └─ otherwise → 403 Forbidden + log audit DENIED
    ↓
Handler: business logic
    ↓
    ├─ ABAC scope check (if needed): is user the owner of the order?
    └─ perform action + log audit ALLOWED
```

### Decision: where to check?

| Layer | Checks | When |
|---|---|---|
| **Middleware** (router) | Static permission: `orders.refund` | Every mutation endpoint |
| **Service / Use case** | Context-based: `is owner OR is staff` | When RBAC alone isn't enough |
| **Repository / DB** | Row-level filter: `WHERE owner_id = $user_id` | List endpoints for non-staff |
| **Frontend** | Hide/disable UI element | After BE already checked (UX, not security) |

**Golden rule**: Frontend gates are UX only. All real checks MUST live in the backend.

---

## 5. Backend Implementation — Pseudocode

### 5.1. Authorize middleware

```pseudocode
function authorize(requiredPermission):
    return function(req, res, next):
        user = req.user  // already authenticated
        if not user:
            return res.status(401)

        // Super admin escape hatch — role check only
        if "super_admin" in user.roles:
            log_audit(user, "permission.checked.allowed", {
                permission: requiredPermission,
                via: "super_admin"
            })
            return next()

        // Load permissions from cache (Redis), TTL 5 min
        userPermissions = cache.get("perms:" + user.id)
        if not userPermissions:
            userPermissions = db.query("""
                SELECT DISTINCT p.key
                FROM permissions p
                JOIN role_permissions rp ON rp.permission_id = p.id
                JOIN user_roles ur ON ur.role_id = rp.role_id
                WHERE ur.user_id = $1
            """, user.id)
            cache.set("perms:" + user.id, userPermissions, ttl=300)

        if requiredPermission not in userPermissions:
            log_audit(user, "permission.checked.denied", {
                permission: requiredPermission,
                ip: req.ip
            })
            return res.status(403).json({
                error: "FORBIDDEN",
                message: "You do not have permission: " + requiredPermission
            })

        next()
```

### 5.2. Usage

```pseudocode
router.POST("/api/users",             authorize("users.create"),  handleCreateUser)
router.PATCH("/api/users/:id",        authorize("users.update"),  handleUpdateUser)
router.DELETE("/api/users/:id",       authorize("users.delete"),  handleDeleteUser)
router.POST("/api/orders/:id/refund", authorize("orders.refund"), handleRefund)
```

### 5.3. ABAC scope when needed

When RBAC alone isn't sufficient (e.g. a student can only edit their own project):

```pseudocode
function handleUpdateProject(req, res):
    project = repo.getProject(req.params.id)
    user = req.user

    // RBAC already passed middleware "projects.update"
    // Still need ABAC check: must be staff OR owner
    isStaff = "staff" in user.roles or "admin" in user.roles
    isOwner = project.ownerId == user.id

    if not (isStaff or isOwner):
        return res.status(403)

    // Continue with logic
```

---

## 6. Frontend Implementation — UI Gate

The frontend receives the **current user's permission list** from the `/api/me` endpoint and stores it in state.

### 6.1. usePermission hook

```pseudocode
function usePermission():
    user = useAuth()

    return {
        can: (permission) => {
            if "super_admin" in user.roles:
                return true
            return permission in user.permissions
        },
        canAny: (...permissions) => permissions.some(p => can(p)),
        canAll: (...permissions) => permissions.every(p => can(p)),
        hasRole: (role) => role in user.roles,
    }
```

### 6.2. Usage in components

```pseudocode
function UserList():
    { can } = usePermission()

    return (
        <table>
            ... rows ...
        </table>

        { can("users.create") && <button onClick={openCreateModal}>Create user</button> }

        { can("users.delete") && (
            <button onClick={handleDelete} className="text-red-500">Delete</button>
        ) }
    )
```

### 6.3. Route gate

```pseudocode
<Route path="/admin/billing" element={
    <RequirePermission permission="billing.view" fallback={<Forbidden />}>
        <BillingPage />
    </RequirePermission>
} />
```

**Important**: route gates only hide links — BE must still check when a user navigates directly via URL.

---

## 7. Common Patterns

### 7.1. Super admin escape hatch
1-2 root accounts that bypass all checks. Used to rescue the system when data is broken. **Never grant automatically** — seed once during setup only.

### 7.2. Role inheritance
`admin` has all permissions of `manager`, `manager` has all permissions of `user`. Simple implementation: assign the full permission set directly to each role rather than chaining. Easy to debug, single query.

### 7.3. Scoped permission (resource ownership)
`projects.update` grants edit access, but the repository filters `WHERE owner_id = user.id OR EXISTS member`. Separation: RBAC = "is the action allowed at all", ABAC = "is the action allowed on this specific row".

### 7.4. Permission pre-computation
Cache the `user.permissions` array in the JWT payload or Redis (TTL 5 min). Avoids a DB query on every request.

**Trade-off**: role changes take ≤ 5 minutes to take effect. Acceptable for most cases. For critical cases → invalidate cache when a role is assigned.

### 7.5. Multi-tenant
When one system hosts multiple organizations (workspace/team), add `tenant_id` to `user_roles`:

```sql
user_roles (user_id, role_id, tenant_id)
```

A user can be `admin` in tenant A but `member` in tenant B.

### 7.6. Temporary / time-bound role
For short-term collaborators:

```sql
ALTER TABLE user_roles ADD COLUMN expires_at TIMESTAMPTZ;
-- Permission check adds: AND (expires_at IS NULL OR expires_at > NOW())
```

---

## 8. Migration Path from Legacy

Many projects start with boolean flags or a single role enum. Migration proceeds in 3 stages:

### Stage 1: Boolean flags (legacy)
```sql
users (is_admin BOOLEAN, is_staff BOOLEAN)
```
**Problem**: adding a new role requires `ALTER TABLE`. Not auditable. No fine-grained permissions.

### Stage 2: Single role enum
```sql
users (role TEXT CHECK (role IN ('admin', 'manager', 'user')))
```
**Upgrade step**:
```sql
-- Migration script
INSERT INTO user_roles (user_id, role_id)
SELECT id, (SELECT id FROM roles WHERE key = users.role)
FROM users;

-- After verifying → drop column users.role
```

### Stage 3: Full RBAC ⭐
Schema as in section 3. Add roles/permissions via admin UI, no migration code needed.

**Migration rule**: Do NOT jump from Stage 1 directly to Stage 3 in production. Go through Stage 2 first, verify for 1-2 weeks, then expand to multi-role + permission table.

---

## 9. Suggested Permission Set for a SaaS

Organized by **domain**:

```
# User management
users.list
users.read
users.create
users.update
users.delete
users.invite
users.suspend

# Role / Permission
roles.list
roles.create
roles.update
roles.delete
roles.assign        # assign roles to users
permissions.list

# Billing
billing.view
billing.update_payment_method
billing.refund
billing.cancel_subscription

# Reports / Analytics
reports.view
reports.export
reports.view_revenue
reports.view_pii    # view personally identifiable information

# Audit / System
system.view_audit_log
system.manage_settings
system.impersonate  # log in as another user (for debugging)
```

**Naming rules**:
- Snake_case for multi-word: `view_audit_log`, not `viewAuditLog`.
- Plural resource: `users` not `user`.
- Short actions: `read` over `view`, but keep `view_xxx` for special actions.
- Use `manage` for grouped actions: `users.manage` = create + update + delete + list.

---

## 10. Anti-patterns (avoid)

### ❌ Hardcoded role checks in handlers
```pseudocode
if user.role == "admin" or user.role == "manager":
    // do thing
```
**Why it's bad**: adding a new role requires code changes. Not traceable.
**Correct**: use permission checks. Give admin the permission, give manager the same permission if needed.

### ❌ Role that can assign itself higher roles
`user` has `roles.assign` → promotes itself to `super_admin`. Role assignment permissions must be tightly controlled.

### ❌ Trusting the frontend completely
Hiding the "Delete" button for non-admins but BE doesn't check → user can call the API directly with curl and delete.

### ❌ Forgetting to invalidate cache on role change
User is downgraded from admin → user, but cached permissions still contain "users.delete" for 5 minutes. Must `cache.del("perms:" + user.id)` when granting or revoking a role.

### ❌ Audit log doesn't track DENY
Logging only successes → cannot detect an attacker probing permissions. Must log `permission.checked.denied` too.

### ❌ One user with too many roles
> 5 roles for one user → hard to reason about. Merge into a new role or rename.

### ❌ Permission keys named after UI functions
`menu.show_billing_tab` — wrong. Permissions are about resource × action, not UI elements. The frontend infers "show the menu" from `billing.view`.

---

## 11. Testing

### 11.1. Unit test permission check
```pseudocode
test "admin can delete user":
    user = factory.user(roles=["admin"])
    assert authorize("users.delete", user) == true

test "regular user cannot delete":
    user = factory.user(roles=["user"])
    assert authorize("users.delete", user) == false

test "super_admin bypasses all checks":
    user = factory.user(roles=["super_admin"])
    assert authorize("any.weird.permission", user) == true
```

### 11.2. Integration test
Each mutation endpoint needs at least 2 tests:
- Happy path: user has permission → 200/201
- Denied: user lacks permission → 403 + verify audit log has a DENIED row

### 11.3. Coverage matrix
Build a `roles × endpoints` table and ensure every cell is tested:

| Endpoint | super_admin | admin | manager | user | guest |
|---|---|---|---|---|---|
| POST /users | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /users | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 12. Audit Log — Best Practices

### What events to log?
**Required**:
- `auth.login.success/failed` — track brute force
- `role.assigned` / `role.revoked` — track privilege escalation
- `permission.checked.denied` — track attacker probing
- All mutations on billing / user / admin settings

**Optional** (high-volume):
- `permission.checked.allowed` — only log for sensitive permissions (refund, impersonate)

### Standard row structure
```json
{
    "actor_id": "uuid-user",
    "target_id": "uuid-target-resource",
    "action": "role.assigned",
    "metadata": {
        "role": "admin",
        "previous_roles": ["user"],
        "reason": "promoted by founder"
    },
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/...",
    "created_at": "2025-01-15T10:30:00Z"
}
```

### Retention
- 90 days in the main DB (fast queries).
- Archive to S3/cold storage for 2-7 years depending on compliance (GDPR, SOC2).

---

## 13. Admin UI for RBAC

Minimum 4 screens required:

1. **Users** — list, search, filter by role. Click a user → assign/revoke roles.
2. **Roles** — list roles, click to view a role's permissions. Edit allowed only for non-system roles.
3. **Permissions** — read-only list (seeded via migration), searchable by resource/action.
4. **Audit log** — filter by actor, action, target, date range. CSV export.

UX rules:
- When assigning a role, show a diff: `+admin -user` rather than the full new list.
- Confirmation dialog when assigning dangerous roles (super_admin, admin).
- Real-time validation: do not allow users to assign a role higher than their own.

---

## 14. Pre-launch Checklist

- [ ] Schema has `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `access_audit`
- [ ] Permissions are seeded via migration, not inserted manually
- [ ] `authorize(permission)` middleware is attached to EVERY mutation endpoint
- [ ] `/api/me` endpoint returns `roles` + `permissions` for FE UI gating
- [ ] FE has `usePermission()` hook + `RequirePermission` route guard
- [ ] Permissions cached with appropriate TTL (3-5 min)
- [ ] Cache invalidated when role is assigned or revoked
- [ ] Audit log covers both ALLOW (sensitive) and DENY
- [ ] Super admin escape hatch requires at least 2-FA
- [ ] Test coverage matrix `role × endpoint` ≥ 80%
- [ ] Admin UI for managing roles/permissions/audit is functional
- [ ] Documentation: permission list + short description for support team

---

## 15. References

- NIST RBAC standard: https://csrc.nist.gov/projects/role-based-access-control
- OWASP Authorization Cheat Sheet
- Casbin (open-source RBAC/ABAC engine, multi-language): https://casbin.org
- Oso (modern authorization framework): https://www.osohq.com

---

## TL;DR — 30-second checklist

```
1. User → Role(s) → Permission(s) → Resource × Action
2. Permission key = "resource.action" (snake_case, plural resource)
3. Schema: users, roles, permissions, role_permissions, user_roles, access_audit
4. authorize(permission) middleware on EVERY mutation endpoint
5. Cache permissions per-user, TTL 5 min, invalidate on role change
6. Frontend usePermission() is UX only — BE must check
7. ABAC scope (owner check) is separate from RBAC, handled at service layer
8. Audit log covers both ALLOW (sensitive) and DENY
9. super_admin = 1-2 people, bypasses everything, used to rescue the system
10. Test matrix role × endpoint ≥ 80% coverage
```
