-- Board description
ALTER TABLE "boards" ADD COLUMN "description" TEXT;

-- Star / favorite board
CREATE TABLE "board_stars" (
  "board_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "board_stars_pkey" PRIMARY KEY ("board_id", "user_id")
);
CREATE INDEX "board_stars_user_id_idx" ON "board_stars" ("user_id");
ALTER TABLE "board_stars" ADD CONSTRAINT "board_stars_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_stars" ADD CONSTRAINT "board_stars_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Watch card
CREATE TABLE "card_watchers" (
  "card_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "card_watchers_pkey" PRIMARY KEY ("card_id", "user_id")
);
CREATE INDEX "card_watchers_user_id_idx" ON "card_watchers" ("user_id");
ALTER TABLE "card_watchers" ADD CONSTRAINT "card_watchers_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_watchers" ADD CONSTRAINT "card_watchers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
