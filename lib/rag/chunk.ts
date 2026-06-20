import { createHash } from "crypto";

export interface Chunk {
  content: string;
  articleRef?: string;
}

export type DocKind = "law" | "guide" | "clarification";

export function hashContent(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function push(chunks: Chunk[], content: string, articleRef?: string) {
  const t = content.trim();
  if (t.length > 30) chunks.push({ content: t, articleRef });
}

// Split an over-long string at whitespace boundaries, never mid-word.
function splitToMax(s: string, maxChars: number): string[] {
  if (s.length <= maxChars) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + maxChars, s.length);
    if (end < s.length) {
      const sp = s.lastIndexOf(" ", end);
      if (sp > i + maxChars * 0.6) end = sp;
    }
    out.push(s.slice(i, end).trim());
    i = end;
  }
  return out.filter(Boolean);
}

// Laws & decisions: start a new chunk at each "Article (N)" header (the FTA
// formatting style), so a citation maps to a real legal article.
function chunkByArticle(text: string, maxChars: number): Chunk[] {
  // Header style varies: "Article 2 – Scope of Tax" or "Article (2): ...".
  // Require a separator (dash/colon) after the number so in-prose references
  // like "pursuant to Article 2 of this Decree-Law" don't trigger a split.
  const HEADER = /Article\s*\(?\s*(\d+[A-Za-z]?)\s*\)?\s*[–\-:]/;
  const parts = text.split(/(?=Article\s*\(?\s*\d+[A-Za-z]?\s*\)?\s*[–\-:])/);
  const chunks: Chunk[] = [];
  for (const part of parts) {
    const m = part.match(HEADER);
    const ref = m ? `Article ${m[1]}` : undefined;
    for (const piece of splitToMax(part.trim(), maxChars)) push(chunks, piece, ref);
  }
  // Fallback: if no article headers were found, treat it like a guide.
  return chunks.length ? chunks : chunkBySection(text, maxChars);
}

// Guides & clarifications: accumulate paragraphs up to a size cap.
function chunkBySection(text: string, maxChars: number): Chunk[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let cur = "";
  const flush = () => {
    if (cur) push(chunks, cur);
    cur = "";
  };

  for (const para of paras) {
    if (para.length > maxChars) {
      flush();
      for (const piece of splitToMax(para, maxChars)) push(chunks, piece);
      continue;
    }
    if (cur.length + para.length > maxChars) flush();
    cur += (cur ? "\n\n" : "") + para;
  }
  flush();
  return chunks;
}

// Dispatch chunking strategy by document type.
export function chunkDocument(text: string, kind: DocKind): Chunk[] {
  switch (kind) {
    case "law":
      return chunkByArticle(text, 1400);
    case "clarification":
      return chunkBySection(text, 2000);
    case "guide":
    default:
      return chunkBySection(text, 1500);
  }
}

// Backward-compatible generic chunker.
export function chunkText(text: string, maxChars = 1200): Chunk[] {
  return chunkBySection(text, maxChars);
}
