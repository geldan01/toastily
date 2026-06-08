CREATE TYPE "public"."vote_category" AS ENUM('best_speaker', 'best_evaluator', 'best_table_topics_speaker', 'best_table_topics_evaluator');--> statement-breakpoint
CREATE TYPE "public"."vote_session_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "vote_ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"voter_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_ballot_one_per_token" UNIQUE("session_id","voter_token")
);
--> statement-breakpoint
CREATE TABLE "vote_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"category" "vote_category" NOT NULL,
	"status" "vote_session_status" DEFAULT 'open' NOT NULL,
	"opened_by" uuid,
	"closed_by" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_session_meeting_category" UNIQUE("meeting_id","category")
);
--> statement-breakpoint
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_session_id_vote_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."vote_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_ballots" ADD CONSTRAINT "vote_ballots_candidate_id_vote_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."vote_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_candidates" ADD CONSTRAINT "vote_candidates_session_id_vote_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."vote_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_candidates" ADD CONSTRAINT "vote_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_sessions" ADD CONSTRAINT "vote_sessions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_sessions" ADD CONSTRAINT "vote_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_sessions" ADD CONSTRAINT "vote_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;