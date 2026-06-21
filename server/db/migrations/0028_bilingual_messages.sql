ALTER TABLE "messages" ADD COLUMN "title_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "title_fr" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "body_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "body_fr" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "messages" SET "body_en" = "body", "body_fr" = "body" WHERE "body" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "title_en" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "title_fr" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "body_en" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "body_fr" DROP DEFAULT;