import { embed } from "ai";
import { cosineDistance, sql, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { lawChunks, documents } from "../db/schema";
import { EMBEDDING_MODEL } from "../ai/models";

export interface RetrievedChunk {
  id: number;
  content: string;
  articleRef: string | null;
  documentId: number;
  docTitle: string | null;
  sourceUrl: string | null;
  similarity: number;
}

// Embed the query and pull the most similar law chunks (cosine similarity),
// optionally filtered to a tax type. Returns chunks with their ids so the
// answer engine can verify citations against what was actually retrieved.
export async function retrieve(
  question: string,
  opts: { taxType?: "CT" | "VAT"; topK?: number } = {},
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: question });

  const similarity = sql<number>`1 - (${cosineDistance(lawChunks.embedding, embedding)})`;

  const rows = await db
    .select({
      id: lawChunks.id,
      content: lawChunks.content,
      articleRef: lawChunks.articleRef,
      documentId: lawChunks.documentId,
      docTitle: documents.title,
      sourceUrl: documents.sourceUrl,
      similarity,
    })
    .from(lawChunks)
    .leftJoin(documents, eq(lawChunks.documentId, documents.id))
    .where(opts.taxType ? eq(lawChunks.taxType, opts.taxType) : undefined)
    .orderBy(desc(similarity))
    .limit(opts.topK ?? 8);

  return rows;
}
