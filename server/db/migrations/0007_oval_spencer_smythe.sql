CREATE TYPE "public"."email_cadence" AS ENUM('weekly');--> statement-breakpoint
CREATE TYPE "public"."email_send_status" AS ENUM('sent', 'stubbed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_trigger" AS ENUM('manual', 'scheduled');--> statement-breakpoint
CREATE TABLE "email_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"cadence" "email_cadence" DEFAULT 'weekly' NOT NULL,
	"day_of_week" integer DEFAULT 0 NOT NULL,
	"time_of_day" text DEFAULT '09:00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"trigger" "email_trigger" NOT NULL,
	"status" "email_send_status" NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"triggered_by" uuid,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description_en" text,
	"description_fr" text,
	"subject_en" text NOT NULL,
	"subject_fr" text NOT NULL,
	"body_en" text NOT NULL,
	"body_fr" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "email_schedules" ADD CONSTRAINT "email_schedules_template_key_email_templates_key_fk" FOREIGN KEY ("template_key") REFERENCES "public"."email_templates"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;