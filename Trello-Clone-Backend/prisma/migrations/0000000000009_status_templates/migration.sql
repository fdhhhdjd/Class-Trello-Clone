-- Card status field (null = unset)
ALTER TABLE "cards" ADD COLUMN "status" TEXT;

-- Board templates
ALTER TABLE "boards" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
