CREATE TYPE "CardPriority" AS ENUM ('none', 'low', 'medium', 'high');

ALTER TABLE "cards" ADD COLUMN "priority" "CardPriority" NOT NULL DEFAULT 'none';
