ALTER TABLE "users" ADD COLUMN "notify_role_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "role_reminder_sent_at" timestamp with time zone;