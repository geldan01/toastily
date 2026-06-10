CREATE TYPE "public"."agenda_section" AS ENUM('administrative', 'speeches', 'table_topics', 'evaluations');--> statement-breakpoint
ALTER TABLE "agenda_template_items" ADD COLUMN "section" "agenda_section" DEFAULT 'administrative' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_roles" ADD COLUMN "is_meeting_officer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Data fix for existing deployments still on the generic seed data: flag the
-- standard officer roles and map the seeded template items to their sections.
-- Clubs that renamed roles/items assign these via the admin UI instead.
UPDATE "meeting_roles" SET "is_meeting_officer" = true
  WHERE "name_en" IN ('Chair','Toastmaster','Table Topics Master','General Evaluator','Secretary','Sergeant-at-Arms','Grammarian','Timer');--> statement-breakpoint
UPDATE "agenda_template_items" SET "section" = 'speeches' WHERE "item_type" = 'speeches';--> statement-breakpoint
UPDATE "agenda_template_items" SET "section" = 'evaluations' WHERE "item_type" = 'evaluations';--> statement-breakpoint
UPDATE "agenda_template_items" SET "section" = 'table_topics'
  WHERE "item_type" = 'item' AND "label_en" IN ('Break','Table Topics');--> statement-breakpoint
UPDATE "agenda_template_items" SET "section" = 'evaluations'
  WHERE "item_type" = 'item' AND "label_en" IN ('Evaluation Session','Grammarian''s Report','Voting & Awards');--> statement-breakpoint
INSERT INTO "settings" ("key","value","is_admin_only") VALUES ('meeting.start_time','18:00',false)
  ON CONFLICT ("key") DO NOTHING;