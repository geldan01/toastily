ALTER TABLE "users" ADD COLUMN "privacy_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privacy_consent_version" text;