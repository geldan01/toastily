CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "executive_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executive_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"can_manage_calendar" boolean DEFAULT false NOT NULL,
	"can_manage_content" boolean DEFAULT false NOT NULL,
	"can_assign_officers" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meeting_number" integer;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "status" "meeting_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "minutes_en" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "minutes_fr" text;--> statement-breakpoint
ALTER TABLE "executive_assignments" ADD CONSTRAINT "executive_assignments_position_id_executive_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."executive_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_assignments" ADD CONSTRAINT "executive_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_assignments" ADD CONSTRAINT "executive_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;