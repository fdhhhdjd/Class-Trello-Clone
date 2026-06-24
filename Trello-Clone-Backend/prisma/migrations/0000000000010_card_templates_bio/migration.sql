-- User public bio
ALTER TABLE "users" ADD COLUMN "bio" TEXT;

-- Card templates
ALTER TABLE "cards" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
