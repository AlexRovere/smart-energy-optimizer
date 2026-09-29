CREATE TABLE "feedback" (
	"user_id" uuid NOT NULL,
	"site_id" varchar(16) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"useful" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id"),
	CONSTRAINT "feedback_target_type_known" CHECK ("feedback"."target_type" IN ('recommendation', 'forecast'))
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;