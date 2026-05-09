import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  timestamp,
  boolean,
  real,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── enums ──────────────────────────────────────────────────

export const cardTypeEnum = pgEnum("card_type", ["mc", "cloze", "freeform"]);

export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const planningStageEnum = pgEnum("planning_stage", [
  "functional_reqs",
  "non_functional_reqs",
  "core_entities",
  "api_design",
  "high_level_design",
  "deep_dives",
  "verification",
]);

export const llmCallStatusEnum = pgEnum("llm_call_status", [
  "success",
  "retry",
  "failed",
]);

export const themeEnum = pgEnum("theme", ["dark", "light", "system"]);

// ─── source material ────────────────────────────────────────

export const sourceFiles = pgTable(
  "source_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    title: text("title").notNull(),
    contentHash: text("content_hash").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull(),
    chunkCount: integer("chunk_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("source_files_filename_unique").on(t.filename)],
);

export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => sourceFiles.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    content: text("content").notNull(),
    headingPath: text("heading_path").array().notNull().default(sql`'{}'::text[]`),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    tokenCount: integer("token_count").notNull(),
    topicTags: text("topic_tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("source_chunks_file_position_idx").on(t.fileId, t.position),
    // HNSW index added in raw SQL migration (Drizzle Kit support varies)
  ]
);

export const concepts = pgTable("concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  canonicalSummary: text("canonical_summary").notNull(),
  parentTopic: text("parent_topic").notNull(),
  sourceChunkIds: uuid("source_chunk_ids").array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conceptNotes = pgTable("concept_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  conceptId: uuid("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── cards & reviews ────────────────────────────────────────

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  conceptId: uuid("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "restrict" }),
  cardType: cardTypeEnum("card_type").notNull(),
  prompt: text("prompt").notNull(),
  canonicalAnswer: text("canonical_answer").notNull(),
  rubric: jsonb("rubric"),
  mcOptions: jsonb("mc_options"),
  clozeAnswers: jsonb("cloze_answers"),
  explanation: text("explanation").notNull(),
  sourceChunkIds: uuid("source_chunk_ids").array().notNull().default(sql`'{}'::uuid[]`),
  difficulty: smallint("difficulty").notNull(),
  parentCardId: uuid("parent_card_id"),
  isLiveGenerated: boolean("is_live_generated").notNull().default(false),
  isDisabled: boolean("is_disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewState = pgTable(
  "review_state",
  {
    cardId: uuid("card_id")
      .primaryKey()
      .references(() => cards.id, { onDelete: "cascade" }),
    ease: real("ease").notNull().default(2.5),
    intervalDays: real("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lastGrade: smallint("last_grade"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  },
  (t) => [index("review_state_due_at_idx").on(t.dueAt)]
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "restrict" }),
    userAnswer: text("user_answer"),
    score: real("score").notNull(),
    grade: smallint("grade").notNull(),
    feedback: text("feedback"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attempts_card_created_idx").on(t.cardId, t.createdAt),
    index("attempts_created_idx").on(t.createdAt),
  ]
);

// ─── planning ───────────────────────────────────────────────

export const planningSessions = pgTable(
  "planning_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    appIdea: text("app_idea").notNull(),
    status: sessionStatusEnum("status").notNull().default("in_progress"),
    currentStage: planningStageEnum("current_stage")
      .notNull()
      .default("functional_reqs"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("planning_sessions_updated_idx").on(t.updatedAt)]
);

export const planningStages = pgTable(
  "planning_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => planningSessions.id, { onDelete: "cascade" }),
    stage: planningStageEnum("stage").notNull(),
    output: jsonb("output").notNull(),
    userEdits: jsonb("user_edits"),
    isStale: boolean("is_stale").notNull().default(false),
    llmCallId: uuid("llm_call_id"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    regenerateCount: integer("regenerate_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("planning_stages_session_stage_unique").on(t.sessionId, t.stage),
  ]
);

// ─── settings & observability ───────────────────────────────

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  userName: text("user_name").notNull().default("Learner"),
  dailyTarget: integer("daily_target").notNull().default(20),
  monthlyCostCap: numeric("monthly_cost_cap", { precision: 10, scale: 2 })
    .notNull()
    .default("50.00"),
  modelHaiku: text("model_haiku").notNull().default("anthropic/claude-haiku-4-5"),
  modelSonnet: text("model_sonnet").notNull().default("anthropic/claude-sonnet-4-6"),
  embeddingModel: text("embedding_model").notNull().default("voyageai/voyage-3"),
  customFocus: jsonb("custom_focus").notNull().default(sql`'[]'::jsonb`),
  corpusSignature: text("corpus_signature"),
  theme: themeEnum("theme").notNull().default("dark"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    module: text("module").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    status: llmCallStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("llm_calls_module_created_idx").on(t.module, t.createdAt),
    index("llm_calls_created_idx").on(t.createdAt),
  ]
);
