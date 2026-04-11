CREATE TABLE IF NOT EXISTS "experiment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"event_name" varchar(128) NOT NULL,
	"value" numeric(15, 4),
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experiment_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experiment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"metric_name" varchar(128) NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"conversion_rate" numeric(8, 6) DEFAULT '0' NOT NULL,
	"uplift" numeric(8, 6),
	"p_value" numeric(10, 8),
	"is_significant" boolean DEFAULT false NOT NULL,
	"sample_mean" numeric(15, 8),
	"sample_variance" numeric(15, 8),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_evt_experiment_event" ON "experiment_events" ("experiment_id","event_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_evt_user" ON "experiment_events" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_experiment_variant" ON "experiment_impressions" ("experiment_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_imp_user_id" ON "experiment_impressions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_results_exp_variant_metric" ON "experiment_results" ("experiment_id","variant_id","metric_name");