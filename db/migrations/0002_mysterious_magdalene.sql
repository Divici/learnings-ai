ALTER TABLE "settings" ALTER COLUMN "embedding_model" SET DEFAULT 'openai/text-embedding-3-small';
--> statement-breakpoint
UPDATE "settings" SET "embedding_model" = 'openai/text-embedding-3-small' WHERE "embedding_model" = 'voyageai/voyage-3';