CREATE TYPE "public"."chain" AS ENUM('ethereum', 'base');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('confirmed_rug', 'survived', 'dead', 'pending');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'whale');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('low_risk', 'caution', 'high_risk');--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "token_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"score" numeric(4, 2) NOT NULL,
	"verdict" "verdict" NOT NULL,
	"confidence" "confidence" NOT NULL,
	"summary" text,
	"red_flags" jsonb DEFAULT '[]'::jsonb,
	"green_flags" jsonb DEFAULT '[]'::jsonb,
	"raw_signals" jsonb,
	"goplus_available" boolean DEFAULT true NOT NULL,
	"social_available" boolean DEFAULT true NOT NULL,
	"model_version" text,
	"prompt_hash" text,
	"outcome" "outcome" DEFAULT 'pending' NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"chain" "chain" NOT NULL,
	"name" text,
	"symbol" text,
	"deployed_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_reputations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"chain" "chain" NOT NULL,
	"trades_tracked" numeric DEFAULT '0' NOT NULL,
	"profitable_trades" numeric DEFAULT '0' NOT NULL,
	"accuracy_pct" numeric(5, 2),
	"avg_entry_timing_hrs" numeric(8, 2),
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_id" uuid NOT NULL,
	"score_at_add" numeric(4, 2) NOT NULL,
	"verdict_at_add" "verdict" NOT NULL,
	"alert_threshold" numeric(4, 2) DEFAULT '2.0',
	"last_alert_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_scores" ADD CONSTRAINT "token_scores_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_scores_token_id_scored_at_idx" ON "token_scores" USING btree ("token_id","scored_at");--> statement-breakpoint
CREATE INDEX "token_scores_scored_at_idx" ON "token_scores" USING btree ("scored_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_address_chain_idx" ON "tokens" USING btree ("address","chain");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_rep_address_chain_idx" ON "wallet_reputations" USING btree ("address","chain");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_token_idx" ON "watchlist_items" USING btree ("user_id","token_id");