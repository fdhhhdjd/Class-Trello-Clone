-- Session tracking on refresh tokens
ALTER TABLE "refresh_tokens" ADD COLUMN "user_agent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "ip_address" TEXT;

-- Workspace logo
ALTER TABLE "workspaces" ADD COLUMN "logo_url" TEXT;

-- Per-board card numbering
ALTER TABLE "boards" ADD COLUMN "card_seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cards" ADD COLUMN "number" INTEGER;

-- Workspace invite links
CREATE TABLE "workspace_invites" (
  "token" TEXT NOT NULL,
  "workspace_id" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'ws_member',
  "created_by_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("token")
);
CREATE INDEX "workspace_invites_workspace_id_idx" ON "workspace_invites" ("workspace_id");
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
