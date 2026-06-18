ALTER TABLE "executive_positions" ADD COLUMN "write_people" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_positions" ADD COLUMN "write_meetings" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_positions" ADD COLUMN "write_content" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_positions" ADD COLUMN "write_communication" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_positions" ADD COLUMN "write_config" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "executive_positions" SET
  "write_people" = "can_assign_officers",
  "write_meetings" = ("can_manage_calendar" OR "can_manage_minutes"),
  "write_content" = "can_manage_content",
  "write_communication" = "can_assign_officers",
  "write_config" = "can_assign_officers";--> statement-breakpoint
ALTER TABLE "executive_positions" DROP COLUMN "can_manage_calendar";--> statement-breakpoint
ALTER TABLE "executive_positions" DROP COLUMN "can_manage_content";--> statement-breakpoint
ALTER TABLE "executive_positions" DROP COLUMN "can_assign_officers";--> statement-breakpoint
ALTER TABLE "executive_positions" DROP COLUMN "can_manage_minutes";
