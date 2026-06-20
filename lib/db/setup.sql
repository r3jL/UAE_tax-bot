-- Run once against your Neon database before the first migration.
-- Enables pgvector, which backs the law_chunks.embedding column.
CREATE EXTENSION IF NOT EXISTS vector;
