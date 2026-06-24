-- Board members
CREATE TYPE "BoardRole" AS ENUM ('admin', 'member', 'observer');

CREATE TABLE "board_members" (
  "board_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "BoardRole" NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "board_members_pkey" PRIMARY KEY ("board_id", "user_id")
);
CREATE INDEX "board_members_user_id_idx" ON "board_members" ("user_id");
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom fields
CREATE TYPE "CustomFieldType" AS ENUM ('text', 'number', 'date', 'checkbox', 'dropdown');

CREATE TABLE "custom_fields" (
  "id" UUID NOT NULL,
  "board_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CustomFieldType" NOT NULL DEFAULT 'text',
  "options" JSONB,
  "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "custom_fields_board_id_idx" ON "custom_fields" ("board_id");
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_board_id_fkey"
  FOREIGN KEY ("board_id") REFERENCES "boards" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "custom_field_values" (
  "field_id" UUID NOT NULL,
  "card_id" UUID NOT NULL,
  "value" JSONB,
  CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("field_id", "card_id")
);
CREATE INDEX "custom_field_values_card_id_idx" ON "custom_field_values" ("card_id");
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_id_fkey"
  FOREIGN KEY ("field_id") REFERENCES "custom_fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
