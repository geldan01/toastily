CREATE TYPE "public"."minutes_approval_status" AS ENUM('pending', 'read', 'amended');--> statement-breakpoint
CREATE TABLE "meeting_minutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"unfinished_business" text,
	"new_business" text,
	"upcoming_events" text,
	"special_reminders" text,
	"general_evaluator_mention" text,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"approval_status" "minutes_approval_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"amendment_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_minutes_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
ALTER TABLE "executive_positions" ADD COLUMN "can_manage_minutes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_roles" ADD COLUMN "is_minutes_secretary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "minutes_en";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "minutes_fr";