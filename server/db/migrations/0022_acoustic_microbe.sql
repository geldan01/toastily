CREATE TABLE "written_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"speech_id" uuid NOT NULL,
	"evaluator_user_id" uuid,
	"evaluator_guest_name" text,
	"liked" text,
	"recommend" text,
	"structure_rating" integer NOT NULL,
	"vocal_variety_rating" integer NOT NULL,
	"gestures_rating" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "written_eval_member_unique" UNIQUE("speech_id","evaluator_user_id")
);
--> statement-breakpoint
ALTER TABLE "written_evaluations" ADD CONSTRAINT "written_evaluations_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "written_evaluations" ADD CONSTRAINT "written_evaluations_speech_id_speeches_id_fk" FOREIGN KEY ("speech_id") REFERENCES "public"."speeches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "written_evaluations" ADD CONSTRAINT "written_evaluations_evaluator_user_id_users_id_fk" FOREIGN KEY ("evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;