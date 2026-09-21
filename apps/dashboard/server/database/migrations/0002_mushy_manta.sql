CREATE TABLE "alert_thresholds" (
	"site_id" varchar(16) NOT NULL,
	"type" varchar(10) NOT NULL,
	"duration" integer DEFAULT 5 NOT NULL,
	"threshold" real NOT NULL,
	CONSTRAINT "alert_thresholds_site_id_type_pk" PRIMARY KEY("site_id","type")
);
--> statement-breakpoint
ALTER TABLE "alert_thresholds" ADD CONSTRAINT "alert_thresholds_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action;