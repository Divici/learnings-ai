CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('mc', 'cloze', 'freeform');--> statement-breakpoint
CREATE TYPE "public"."llm_call_status" AS ENUM('success', 'retry', 'failed');--> statement-breakpoint
CREATE TYPE "public"."planning_stage" AS ENUM('functional_reqs', 'non_functional_reqs', 'core_entities', 'api_design', 'high_level_design', 'deep_dives', 'verification');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('dark', 'light', 'system');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_answer" text,
	"score" real NOT NULL,
	"grade" smallint NOT NULL,
	"feedback" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"card_type" "card_type" NOT NULL,
	"prompt" text NOT NULL,
	"canonical_answer" text NOT NULL,
	"rubric" jsonb,
	"mc_options" jsonb,
	"cloze_answers" jsonb,
	"explanation" text NOT NULL,
	"source_chunk_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"difficulty" smallint NOT NULL,
	"parent_card_id" uuid,
	"is_live_generated" boolean DEFAULT false NOT NULL,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"canonical_summary" text NOT NULL,
	"parent_topic" text NOT NULL,
	"source_chunk_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concepts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"latency_ms" integer NOT NULL,
	"status" "llm_call_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"app_idea" text NOT NULL,
	"status" "session_status" DEFAULT 'in_progress' NOT NULL,
	"current_stage" "planning_stage" DEFAULT 'functional_reqs' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"stage" "planning_stage" NOT NULL,
	"output" jsonb NOT NULL,
	"user_edits" jsonb,
	"is_stale" boolean DEFAULT false NOT NULL,
	"llm_call_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"regenerate_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_state" (
	"card_id" uuid PRIMARY KEY NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"interval_days" real DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"last_grade" smallint,
	"last_reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"user_name" text DEFAULT 'Learner' NOT NULL,
	"daily_target" integer DEFAULT 20 NOT NULL,
	"monthly_cost_cap" numeric(10, 2) DEFAULT '50.00' NOT NULL,
	"model_haiku" text DEFAULT 'anthropic/claude-haiku-4-5' NOT NULL,
	"model_sonnet" text DEFAULT 'anthropic/claude-sonnet-4-6' NOT NULL,
	"embedding_model" text DEFAULT 'voyageai/voyage-3' NOT NULL,
	"custom_focus" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"corpus_signature" text,
	"theme" "theme" DEFAULT 'dark' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" text NOT NULL,
	"heading_path" text[] DEFAULT '{}'::text[] NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"token_count" integer NOT NULL,
	"topic_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"title" text NOT NULL,
	"content_hash" text NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"chunk_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_notes" ADD CONSTRAINT "concept_notes_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_stages" ADD CONSTRAINT "planning_stages_session_id_planning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."planning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_file_id_source_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."source_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_card_created_idx" ON "attempts" USING btree ("card_id","created_at");--> statement-breakpoint
CREATE INDEX "attempts_created_idx" ON "attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "llm_calls_module_created_idx" ON "llm_calls" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "planning_sessions_updated_idx" ON "planning_sessions" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_stages_session_stage_unique" ON "planning_stages" USING btree ("session_id","stage");--> statement-breakpoint
CREATE INDEX "review_state_due_at_idx" ON "review_state" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "source_chunks_file_position_idx" ON "source_chunks" USING btree ("file_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_chunks_embedding_hnsw_idx"
  ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);