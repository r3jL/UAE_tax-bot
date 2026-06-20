# Project Lex — UAE Tax Bot

An AI assistant that answers UAE **VAT & Corporate Tax** questions for Sobha —
grounded in official FTA law, **every answer cited**, decision-support only
(a human reviews; the bot never files anything).

> Internal · Finance & Accounts / MD's Office · UAE-first

## What it does (Phase 1)
- **Cited Q&A** on UAE VAT + Corporate Tax (answers trace to the actual Decree-Law / Decision / Guide)
- **Vendor VAT / tax-invoice check** — "is this invoice valid to claim input VAT?" (the priority use case)
- **Escalates** instead of guessing when the corpus doesn't support an answer

Read [ROADMAP.md](ROADMAP.md) for phases/features and [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical design.

---

## Get running (≈10 min)

```bash
git clone https://github.com/Jatin0129/tax-bot.git
cd tax-bot
npm install

# 1. Add your key (no database needed for the MVP)
cp .env.example .env.local
#   then set AI_GATEWAY_API_KEY=...  (Vercel dashboard → AI Gateway → API Keys)

# 2. Build the knowledge base from the 55 FTA docs in ./corpus
npm run ingest        # reads PDFs → chunks → embeds → lib/rag/corpus-index.json

# 3. Run it
npm run dev           # http://localhost:3000
```

That's it — **one key, no database** for the MVP. (Neon Postgres + pgvector is
wired for scale later; set `DATABASE_URL` to switch the index to the DB.)

### What needs a real key
The AI Gateway key powers **both** ingestion (embeddings) and answers (the LLM).
Without it the app boots and the UI renders, but questions return a clear
"unauthenticated" error.

---

## How it works (short version)
```
question → embed → retrieve top chunks from corpus index
        → rank (semantic + authority: Decree-Law > Decision > Guide)
        → Claude generates a CITED answer (or escalates)  → UI
```
- `lib/rag/` — chunking, retrieval, the seed/local-index/DB sources
- `lib/ai/` — model config, the **cited-or-escalate answer contract**, the answer engine
- `app/` — chat UI + `/api/chat`
- `scripts/ingest.ts` — corpus → searchable index (PDF-aware, article-aware, authority-tagged)
- `corpus/` — 55 official FTA documents (VAT + CT laws, decisions, guides, public clarifications)

## Knowledge base
`corpus/` holds the committed **public** FTA grounding docs. Drop new public
docs into the right subfolder and re-run `npm run ingest`.
**Confidential** material (sample invoices, internal checklists) goes in
`corpus/confidential/` — it's git-ignored, never commit it.

---

## Working together
- `git pull` before you start.
- Branch per change: `git checkout -b feature/x`, open a PR into `main`.
- Don't commit `.env.local` (ignored) or anything under `corpus/confidential/`.

## What's next (open tasks)
1. **Bilingual support** — FTA PDFs are Arabic+English; segment chunks by language (`en`/`ar`) so Arabic queries work + the binding Arabic text is preserved.
2. **Cross-encoder reranker** — re-score top candidates before the LLM (precision boost).
3. **Model tiering** — Haiku for simple invoice checks, Sonnet for Q&A, Opus for hard QFZP/multi-hop questions (cost control).
4. **F&A eval set** — ~20–30 real questions + correct cited answers to benchmark accuracy.
5. Phase 2: compliance register + deadline tracker.

## Decisions already made (don't re-litigate)
- **RAG over a frontier model (Claude), not a self-trained/3B model** — accuracy + cost win for a high-stakes tax tool (see chat history / cost analysis).
- **Cited-or-escalate is structural** — no answer ships without a source.
- **No autonomous filing** — draft + human sign-off only.
