CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"body_en" text,
	"body_fr" text,
	"featured_en" boolean DEFAULT false NOT NULL,
	"featured_fr" boolean DEFAULT false NOT NULL,
	"featured_order_en" integer DEFAULT 0 NOT NULL,
	"featured_order_fr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testimonials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;