-- Backup run history
CREATE TABLE "backup_runs" (
  "id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "scope_db" BOOLEAN NOT NULL DEFAULT false,
  "scope_uploads" BOOLEAN NOT NULL DEFAULT false,
  "scope_configs" BOOLEAN NOT NULL DEFAULT false,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "finished_at" TIMESTAMPTZ(6),
  "size_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remote_path" TEXT NOT NULL DEFAULT '',
  "error" TEXT NOT NULL DEFAULT '',
  "log_tail" TEXT NOT NULL DEFAULT '',
  "triggered_by" UUID,
  CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "backup_runs_started_at_idx" ON "backup_runs" ("started_at");
