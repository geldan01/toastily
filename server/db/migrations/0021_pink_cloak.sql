ALTER TYPE "public"."email_trigger" ADD VALUE 'triggered';--> statement-breakpoint
ALTER TABLE "executive_positions" ADD COLUMN "notify_member_requests" boolean DEFAULT false NOT NULL;