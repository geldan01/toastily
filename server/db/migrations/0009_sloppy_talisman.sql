ALTER TYPE "public"."vote_session_status" ADD VALUE 'draft' BEFORE 'open';--> statement-breakpoint
ALTER TABLE "vote_candidates" ADD COLUMN "excluded" boolean DEFAULT false NOT NULL;