CREATE TABLE "member_pathway_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"title" text NOT NULL,
	"completed_at" date,
	"speech_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_pathways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"started_at" date,
	"completed_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_pathway_unique" UNIQUE("user_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "pathways_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_pathway_projects" ADD CONSTRAINT "member_pathway_projects_enrollment_id_member_pathways_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."member_pathways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_pathway_projects" ADD CONSTRAINT "member_pathway_projects_speech_id_speeches_id_fk" FOREIGN KEY ("speech_id") REFERENCES "public"."speeches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_pathways" ADD CONSTRAINT "member_pathways_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_pathways" ADD CONSTRAINT "member_pathways_path_id_pathways_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."pathways_paths"("id") ON DELETE restrict ON UPDATE no action;