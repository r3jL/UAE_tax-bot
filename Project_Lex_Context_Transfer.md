# Project Lex — Context Transfer for Claude Code

> **How to use this file:** save it as `docs/CONTEXT.md` in the repo (or paste it into your
> Claude Code session). It is the single orientation brief for anyone — human or agent —
> picking up this codebase. Read it before writing code.

---

## 1. What this is

**Project Lex** is an internal AI tax assistant for **Sobha** (real-estate group), built for the
Finance & Accounts team / MD's Office. It answers **UAE Corporate Tax (CT) and VAT** questions,
**grounded in official FTA law with every answer cited**, and it is **decision-support only** — a
human reviews everything; the bot never files anything.

Primary Phase-1 value: deflect routine tax questions from F&A, and let non-tax staff
(procurement / AP) self-check vendor VAT treatment before they involve F&A.

---

## 2. Non-negotiable principles (DO NOT re-litigate)

These are settled design decisions. Do not weaken or re-open them without an explicit instruction.

1. **RAG over a frontier model (Claude via the Vercel AI Gateway), NOT a self-trained / fine-tuned
   model.** The accuracy-and-cost trade-off was analysed and decided. Knowledge lives in the
   corpus; "updating the law" = editing a document, never retraining.
2. **Cited-or-escalate is STRUCTURAL, not a prompt hope.** Every answer/determination must carry a
   citation that maps to a *real retrieved chunk id*. If it can't be grounded, it returns
   `status: "escalate"` instead of guessing. The validation guard in `lib/ai/answer.ts` is what
   enforces this — never remove or loosen it; add tests around it instead.
3. **Human-in-the-loop.** The system drafts and recommends; a person reviews and signs off.
4. **No autonomous filing — ever.** Returns are prepared as *drafts only*; a human files.
5. **Deterministic where it matters.** Dates, rates, thresholds, and figures are computed in code,
   never by the model.
6. **Walled-off data.** Confidential invoices/filings/checklists never go in git and never get
   logged. They live only in `corpus/confidential/` (git-ignored) or private storage.
7. **UAE only.** One jurisdiction (UAE), two tax types (Corporate Tax + VAT). Multi-jurisdiction is
   **not** a current design goal — optimise solely for UAE accuracy (see §3).

---

## 3. Jurisdiction scope (CURRENT — authoritative)

- **UAE only.** Corporate Tax + VAT, sourced from the FTA (tax.gov.ae). This is the *sole* target;
  the single goal is the most accurate possible UAE tax assistant. There is **no near-term
  multi-jurisdiction plan** — any earlier US/India/Oman/Bahrain/Brunei sequencing is dropped.
- **Do NOT design for multi-jurisdiction.** This reverses the earlier guidance that used to live in
  this section. Build directly for UAE; UAE-specific assumptions in shared logic are fine and
  expected.
  - The schema retains a `jurisdiction` column on `documents` and `law_chunks` that **defaults to
    `'UAE'`** (`lib/db/schema.ts`). Leave it — it is harmless and costs nothing — but treat it as
    **dormant**: no query reads or filters by it today, and you should **not** add jurisdiction
    filters, a per-jurisdiction rules/determination abstraction, or corpus namespacing
    (`corpus/uae/…` etc.).
  - The corpus, retrieval, prompts, and determination logic all assume UAE. Optimise them for UAE
    accuracy without abstracting for other jurisdictions.
  - If multi-jurisdiction ever returns, it will be a deliberate, scoped project — not something to
    pre-build for now.

---

## 4. Stack (use these — do not guess or substitute)

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) + TypeScript |
| AI orchestration | **Vercel AI SDK v6** (`ai@^6`) + **AI Gateway** (provider/model strings; `AI_GATEWAY_API_KEY`) |
| Reasoning model | `anthropic/claude-sonnet-4-6` (override via `REASONING_MODEL`) |
| Embeddings | `openai/text-embedding-3-small`, **1536 dims** (`EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`) |
| DB + vectors | **Neon Postgres + pgvector**, single store |
| ORM | **Drizzle** |
| Auth | **Passcode gate** (built — `proxy.ts` + cookie/`AUTH_TOKEN`); Clerk/SSO planned |
| File storage | **Vercel Blob** (planned — invoices) |
| Background jobs | **Vercel Cron** (built — weekly law-change detector); Workflow + reminders planned |
| Email | **Resend** (planned — deadline reminders) |
| PDF parse | `unpdf` |

> **Next.js 16 caveat (`AGENTS.md`):** this Next.js has breaking changes vs. older knowledge. Read
> the relevant guide under `node_modules/next/dist/docs/` before writing Next-specific code.

> **Note on cost docs:** earlier cost modelling assumed an Azure OpenAI + Azure Document
> Intelligence stack. The repo has since moved to **Claude (Sonnet 4.6) via the Vercel AI Gateway**,
> with invoice extraction planned on **Claude vision** (not Document Intelligence). Any cost model
> must be re-based onto this stack before it's quoted.

---

## 5. Repo map

```
app/
  page.tsx              # Chat UI (question + CT/VAT filter; renders answer, confidence,
                        #   escalation, flagged premise, citations)
  api/chat/route.ts     # POST -> answerQuestion()  (NOTE: no auth gate yet)
  layout.tsx            # still has "Create Next App" boilerplate metadata — fix
  globals.css
lib/
  ai/
    models.ts           # model + embedding config (Gateway slugs, dims)
    contracts.ts        # Zod: answerContract + determinationContract  (the output schemas)
    answer.ts           # answer engine: retrieve -> generateObject -> CITATION GUARD ->
                        #   escalate-if-ungrounded -> query_log audit
  rag/
    context.ts          # getRelevantChunks(): 3-tier retrieval (DB -> local index -> seed)
    retrieve.ts         # pgvector cosine query (DB mode)
    chunk.ts            # article-aware chunking for laws; section chunking for guides
    seed/               # hand-written MVP corpus (vat, corporate-tax, real-estate,
                        #   compliance, legal-framework) — accurate UAE paraphrases
  db/
    schema.ts           # documents, law_chunks(+hnsw, +status/superseded),
                        #   law_changes, tax_parameters, query_log, audit_log
  tax/
    compute.ts          # deterministic VAT arithmetic (rates injected from tax_parameters)
    parameters.ts       # cached, effective-dated tax_parameters accessor
    index.ts            # drizzle + neon client (boots with placeholder URL pre-provision)
    setup.sql           # CREATE EXTENSION vector
scripts/
  ingest.ts             # corpus -> chunks -> embeddings -> DB or local corpus-index.json
  db-setup.ts           # enables pgvector
corpus/                 # PUBLIC FTA docs (committed); confidential/ is git-ignored
ARCHITECTURE.md  ROADMAP.md  README.md  AGENTS.md
```

---

## 6. Current state — built vs. scaffolded

**Built and wired end-to-end:**
- **Cited Q&A** (Phase 1): chat UI → `/api/chat` → `answerQuestion()` → retrieval → `generateObject`
  against `answerContract` → **structural citation guard** (drops citations whose `chunkId`
  wasn't retrieved; forces `escalate` if an "answered" response has none) → `query_log` audit.
- **Retrieval**: Neon pgvector with **hybrid** semantic + Postgres full-text (RRF), optional reranker;
  falls back to local `corpus-index.json` → lexical seed (runs with one key, no DB). Now filtered to
  **`status='active'` + `effective_date <= now`** so superseded/repealed law is never cited.
- **Vendor VAT determination** (Phase 1): `lib/ai/determine.ts` — RAG-grounded treatment +
  recoverability, **deterministic VAT arithmetic** in `lib/tax/compute.ts`, cited, logged.
- **Invoice upload + extraction** (Phase 1.5): `app/api/invoice/*` (extract / determine / process) +
  `lib/ai/extract-invoice.ts` → determination engine → cited result.
- **Incremental, versioned ingestion** (Phase 3 foundation): idempotent, hash-diffing; supersedes
  changed chunks (kept for audit), records `law_changes`; metadata from `corpus/manifest.json`.
- **Scheduled change detection**: weekly Vercel Cron `/api/cron/detect-changes` (flag-only).
- **Rates/thresholds as versioned data**: `tax_parameters` + cached accessor (`lib/tax/parameters.ts`)
  — a rate change is a data edit, not a redeploy.
- **Auth**: passcode gate (`proxy.ts` + `/api/auth` + `/login`); every route protected by a cookie
  holding a server `AUTH_TOKEN`.
- **Eval harness**: `scripts/eval.ts` (`npm run eval`).
- Article-aware chunking; UAE seed corpus + ingested FTA corpus; `taxType` (CT/VAT) filter;
  `query_log` + `audit_log` tables.

**Specced/contracted but NOT built yet:**
- **Compliance register + tracker + reminders** (Phase 2): no `compliance_items` table yet.
- **Change-impact — impact flagging** (Phase 3, remaining half): detect-and-supersede is built;
  automatically flagging the past answers / register entries that cited a now-changed rule is not.
- **Auth → Clerk/SSO + per-user identity**: still a shared passcode; no `users` / `roles` table.
- **Return prep / reporting** (Phase 4).

---

## 7. How the core works (so you don't break it)

1. User question (+ optional CT/VAT filter) → `getRelevantChunks()` returns top-k chunks, each
   carrying `chunkId`, `articleRef`, and (should carry) `instrument`, `sourceUrl`, `docTitle`.
2. `answer.ts` builds a context block tagging each passage `[chunkId:N] … | type: … | source: …`.
3. `generateObject` with `answerContract` + a strict system prompt: answer **only** from context,
   cite every claim by `chunkId`, escalate if unsupported, flag false premises, set confidence
   honestly, and resolve conflicts by **authority hierarchy**
   (`decree_law > cabinet_decision > ministerial_decision > fta_decision > public_clarification / fta_guide`).
4. **Guard:** citations are filtered to `chunkId`s actually retrieved; if `status="answered"` ends
   up with zero valid citations, it is flipped to `escalate`. This is the safety spine.
5. Result is logged to `query_log` (best-effort, non-blocking).

The authority hierarchy and the citations both depend on the retrieval layer returning
`instrument` and `sourceUrl` — see the bug in §8.

---

## 8. Priority backlog (do in this order)

**Already done since this brief was first written** (kept for history): the DB-mode metadata drop is
fixed (`retrieve.ts` joins `documents` and returns `instrument`/`sourceUrl`/`effectiveDate`/`docTitle`,
mapped through `context.ts`); `/api/chat` (and every route) is gated by the passcode `proxy.ts`; the
**eval harness** exists (`scripts/eval.ts`); the **determination engine** is built (`lib/ai/determine.ts`);
`ingest.ts` now reads `corpus/manifest.json`.

**Now (do in this order):**
1. **Change-impact — impact flagging.** Build the durable Vercel Workflow that, on a `law_changes`
   entry, flags the `query_log` answers (and future register entries) that cited the changed chunk
   for human re-review. Detection + supersession already exist; this is the remaining half of Phase 3.
2. **Compliance register + tracker + reminders** (Phase 2): `compliance_items` table, dashboard,
   Vercel Cron reminders, PDF/Excel export.
3. **Bilingual chunking.** FTA PDFs are Arabic+English; segment by language in `ingest.ts` so chunks
   aren't mixed-script (mixed scripts dilute embeddings and hurt retrieval).
4. **Per-user identity / Clerk SSO** to replace the shared passcode (enables per-user chat history + roles).
5. **Minor:** replace any leftover `layout.tsx` boilerplate metadata.

---

## 9. Working conventions / guardrails

- **Read `node_modules/next/dist/docs/` before writing Next.js 16 code.**
- **Never commit** anything under `corpus/confidential/` or any `.env*`.
- **Keep the answer contract + citation guard intact.** Extend with tests; don't relax.
- **UAE only** — build directly for UAE; UAE-specific assumptions in shared logic are fine. Do not
  add jurisdiction filters or a per-jurisdiction abstraction (see §3).
- After changes: `npm run lint && npm run build`. If you touch the schema:
  `npm run db:generate` then `npm run db:migrate`. If you touch the corpus: `npm run ingest`.
- Prefer editing existing modules over adding parallel ones; match the existing TS style.
- Branch per change; PR into `main`.

---

## 10. Phase roadmap (current)

| Phase | Theme | Jurisdiction | Status |
|---|---|---|---|
| 0 | Ingestion + pgvector + answer contract | UAE | Built |
| 1 | Cited Q&A + Vendor VAT determination | UAE | **Built** |
| 1.5 | Invoice upload + extraction | UAE | **Built** |
| 2 | Compliance register + deadline tracker + reminders | UAE | Not started |
| 3 | Change-impact engine | UAE | **Foundation built** — versioning, temporal retrieval, detection cron, `tax_parameters`; impact-flagging pending |
| 4 | Draft return preparation + reporting | UAE | Not started |

**Out of scope (explicit):** autonomous/automatic filing; aggressive tax-optimisation;
multi-jurisdiction support (UAE only for now); any answer or determination without a citation.
