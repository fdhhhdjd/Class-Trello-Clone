# Auth Flow — JWT + Refresh Token + Redis Blacklist

## Prerequisites (One-time Setup)

| # | Task |
|---|---|
| 1 | Server generates `JWT_SECRET` in `.env` — never commit to git |
| 2 | Provision Redis to store the JTI blacklist for revoked tokens |
| 3 | Add column `token_version INTEGER DEFAULT 0` to the `users` table |
| 4 | Create the `refresh_tokens` table (see schema below) |
| 5 | Frontend creates a React Context or Zustand store to hold access token **in memory** |
| 6 | Frontend creates a dedicated axios instance with a 401 interceptor |
| 7 | Server enables CSP header: `default-src 'self'; script-src 'self' 'nonce-xxx'` |

```sql
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL,
    jti        UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Step 1 — User Login

1. User enters email + password and submits the form.
2. Frontend calls `POST /api/auth/login` with body `{ email, password }`.
3. Server verifies the email exists and the password matches the stored hash.
   - If wrong → return `401`, stop.
4. Server reads the user's `token_version` from the DB.
5. Server generates an **access token** (JWT):
   ```
   payload: { user_id, token_version, jti (UUID v4), exp (now + 15 min) }
   ```
6. Server generates a **refresh token** (random UUID v4).
7. Server hashes the refresh token (bcrypt / sha256), stores it in `refresh_tokens`:
   ```
   { user_id, jti, expires_at: now + 7 days, used: false }
   ```
8. Server returns the response:
   - Access token → **JSON body**
   - Refresh token → `Set-Cookie`: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800`
9. Frontend stores the access token in **React state (memory)**. ⚠️ Never use `localStorage` or `sessionStorage`.
10. Frontend redirects the user to the main page.

---

## Step 2 — Normal API Calls

1. On every request, the axios interceptor automatically attaches the header:
   ```
   Authorization: Bearer <access_token>
   ```
2. Server verifies the JWT using `JWT_SECRET`.
3. Server decodes the payload → extracts `user_id`, `token_version`, `jti`.
4. Checks `jti` against the Redis blacklist (`revoked_jti:<jti>`):
   - If found → return `401`, stop.
5. Queries DB for the user's current `token_version`:
   - If it differs from the token → return `401`, stop.
6. All checks pass → process the request and return the result.

---

## Step 3 — Access Token Expired

1. Server verifies JWT and finds `exp` is in the past → returns `401` with `TOKEN_EXPIRED`.
2. Axios interceptor catches the 401.
3. Interceptor checks: **is there already a `/renew` request in flight?**
   - Yes → wait for it to finish, use the new access token to retry. *(Prevents 10 simultaneous requests each calling `/renew` 10 times.)*
   - No → continue to step 4.
4. Interceptor calls `POST /api/auth/renew` — the browser automatically sends the refresh token via the httpOnly cookie.
5. Server reads the refresh token from the cookie, hashes it, and looks it up in `refresh_tokens`.
   - Not found or expired → return `401`, stop.
   - `used = true` → **token reuse detected / token stolen**:
     - Delete all refresh tokens for this user in the DB.
     - Increment `token_version` by 1.
     - Return `401` → all devices are forced to log in again.
6. If valid, server:
   - Marks the current refresh token as `used = true`.
   - Generates a new access token (15 min) + new refresh token.
   - Saves the new refresh token in the DB (`used = false`).
   - Returns the new access token in the JSON body + sets a new cookie (replacing the old one).
7. Frontend updates React state with the new access token.
8. Interceptor retries the original request → succeeds. User notices nothing.

---

## Step 4 — Renew Fails

If `/api/auth/renew` returns `401`:

1. Clear the access token from React state.
2. Call `POST /api/auth/logout` so the server clears the cookie.
3. Redirect the user to `/login`.

---

## Step 5 — User Logs Out

1. User clicks the Logout button.
2. Frontend calls `POST /api/auth/logout`.
3. Server reads the access token from the header, extracts `jti` and `exp`.
4. Adds `revoked_jti:<jti>` to Redis with `TTL = exp - now`.
5. Reads the refresh token from the cookie → deletes the record in `refresh_tokens`.
6. Server returns `Set-Cookie: Max-Age=0` to clear the cookie on the client.
7. Frontend clears React state → redirects to `/login`.

---

## Step 6 — Logout All Devices / Change Password

1. Frontend calls `POST /api/auth/logout-all` or `POST /api/auth/change-password`.
2. Server increments the user's `token_version` by 1 in the DB.
3. Deletes all refresh tokens for this user in `refresh_tokens`.
4. Clears the refresh token cookie on the current client (`Set-Cookie: Max-Age=0`).
5. From this point, all existing access tokens on all devices fail the `token_version` check.

---

## Summary — What Is Stored Where

| Item | Stored in | TTL |
|------|-----------|-----|
| Access token | React state (memory) | 15 min |
| Refresh token | Cookie `HttpOnly + Secure + SameSite=Strict` | 7 days |
| Refresh token hash | `refresh_tokens` table in DB | 7 days |
| `token_version` | Column in `users` table | Persistent |
| JTI blacklist | Redis key `revoked_jti:<jti>` | TTL = remaining lifetime of token |
| `JWT_SECRET` | Server environment variable `.env` | - |
