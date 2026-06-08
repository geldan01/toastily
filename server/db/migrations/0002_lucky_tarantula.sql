CREATE TYPE "public"."agenda_item_type" AS ENUM('item', 'speeches');--> statement-breakpoint
CREATE TABLE "agenda_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"item_type" "agenda_item_type" DEFAULT 'item' NOT NULL,
	"label_en" text NOT NULL,
	"label_fr" text NOT NULL,
	"duration_minutes" integer,
	"meeting_role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"label_en" text NOT NULL,
	"label_fr" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_exceptions_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "meeting_role_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" text,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_role_unique" UNIQUE("meeting_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"description_en" text,
	"description_fr" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"theme_en" text,
	"theme_fr" text,
	"location" text,
	"notes_en" text,
	"notes_fr" text,
	"template_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "speeches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"slot" integer DEFAULT 1 NOT NULL,
	"title" text,
	"presenter_user_id" uuid,
	"presenter_guest_name" text,
	"pathways_project" text,
	"evaluator_user_id" uuid,
	"evaluator_guest_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_speech_slot_unique" UNIQUE("meeting_id","slot")
);
--> statement-breakpoint
ALTER TABLE "agenda_template_items" ADD CONSTRAINT "agenda_template_items_template_id_agenda_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."agenda_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_template_items" ADD CONSTRAINT "agenda_template_items_meeting_role_id_meeting_roles_id_fk" FOREIGN KEY ("meeting_role_id") REFERENCES "public"."meeting_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_role_signups" ADD CONSTRAINT "meeting_role_signups_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_role_signups" ADD CONSTRAINT "meeting_role_signups_role_id_meeting_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."meeting_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_role_signups" ADD CONSTRAINT "meeting_role_signups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_role_signups" ADD CONSTRAINT "meeting_role_signups_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_template_id_agenda_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."agenda_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_presenter_user_id_users_id_fk" FOREIGN KEY ("presenter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_evaluator_user_id_users_id_fk" FOREIGN KEY ("evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;