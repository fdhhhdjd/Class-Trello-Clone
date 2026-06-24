-- WIP limit per list
ALTER TABLE "lists" ADD COLUMN "wip_limit" INTEGER;

-- Reactions (emoji) on cards and comments
CREATE TABLE "reactions" (
  "id" UUID NOT NULL,
  "card_id" UUID,
  "comment_id" UUID,
  "user_id" UUID NOT NULL,
  "emoji" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reactions_card_id_user_id_emoji_key" ON "reactions" ("card_id", "user_id", "emoji");
CREATE UNIQUE INDEX "reactions_comment_id_user_id_emoji_key" ON "reactions" ("comment_id", "user_id", "emoji");
CREATE INDEX "reactions_card_id_idx" ON "reactions" ("card_id");
CREATE INDEX "reactions_comment_id_idx" ON "reactions" ("comment_id");
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
