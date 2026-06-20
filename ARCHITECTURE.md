# Project Lex — Technical Architecture

How the system is built and how every part functions. Stack is **Vercel-native** (the deployment target).

---

## 1. Stack at a glance

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 16 (App Router) + TypeScript | One codebase for UI + API; deploys natively to Vercel |
| **UI** | Tailwind CSS + shadcn/ui | Fast, clean, accessible components |
| **AI orchestration** | Vercel AI SDK v6 + AI Gateway | Streaming, tool-calling, structured output; provider failover |
| **Model (reasoning)** | Claude (Opus/Sonnet) via Gateway (`anthropic/claude-...`) | Strong at grounded reasoning + citation discipline |
| **Model (extraction/vision)** | Claude vision | Reads invoices → structured data |
| **Embeddings** | Embedding model via AI Gateway | Turns law text + queries into vectors |
| **Database + vectors** | **Neon Postgres + pgvector** (Vercel Marketplace) | *One* store for both relational compliance data **and** vector search |
| **ORM** | Drizzle | Type-safe schema + migrations |
| **File storage** | Vercel Blob (private) | Holds uploaded invoices, generated PDFs/Excel |
| **Auth** | Clerk (Vercel Marketplace) | SSO/roles for internal staff |
| **Background jobs** | Vercel Cron + Functions | Reminders, nightly source crawls |
| **Durable multi-step** | Vercel Workflow (WDK) | Change-impact re-runs that must survive crashes/retries |
| **Email reminders** | Resend | 30/15/7/1-day deadline alerts (SMS/WhatsApp later via Twilio) |
| **Reports** | PDF + Excel generation | Compliance register exports |
| **Evals** | Lightweight eval harness | Scores cited-answer accuracy against the F&A test set |

> **The one rule the architecture enforces:** no answer, determination, or report is emitted without a citation to a retrieved source. If the model can't ground a claim, it escalates to F&A instead of guessing.

---

## 2. System architecture

```
                          ┌─────────────────────────────────────────┐
                          │              Next.js app                 │
   Staff (F&A,            │  Chat UI · Invoice upload · Register     │
   procurement, AP) ─────▶│  dashboard · Admin / review queue        │
                          └───────────────┬─────────────────────────┘
                                          │  (API routes / Server Actions)
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
     ┌─────────────────┐        ┌──────────────────┐        ┌──────────────────┐
     │  RAG / Answer    │        │  Determination   │        │  Compliance      │
     │  engine          │        │  engine          │        │  register +      │
     │  (cited Q&A)     │        │  (VAT triage)    │        │  reminders       │
     └────────┬─────────┘        └────────┬─────────┘        └────────┬─────────┘
              │                           │                           │
              ▼                           ▼                           ▼
     ┌──────────────────────────────────────────────────────────────────────┐
     │            Neon Postgres + pgvector  (single source of truth)         │
     │  law_chunks(embeddings) · documents · compliance_items · invoices ·   │
     │  query_log · law_changes · users/roles · audit_log                    │
     └──────────────────────────────────────────────────────────────────────┘
              ▲                           ▲                           ▲
              │ nightly                   │ on upload                 │ cron
     ┌────────┴─────────┐        ┌────────┴─────────┐        ┌────────┴─────────┐
     │  Ingestion       │        │  Vercel Blob     │        │  Cron + Workflow │
     │  pipeline        │        │  (invoice files) │        │  (reminders,     │
     │  (crawl→chunk→   │        │                  │        │   change monitor)│
     │   embed)         │        │                  │        │                  │
     └────────┬─────────┘        └──────────────────┘        └──────────────────┘
              │
     Official tax sources (tax.gov.ae — Corporate Tax, VAT; later other authorities)
```

---

## 3. The RAG + citation pipeline (the heart of the system)

### 3a. Ingestion (Phase 0, runs nightly)
1. **Crawl** official sources (start: tax.gov.ae — CT + VAT).
2. **Clean** HTML/PDF → plain text.
3. **Chunk** by article/section so a citation maps to a real legal unit.
4. **Embed** each chunk → vector.
5. **Store** in `law_chunks` with metadata: `source_url`, `article_ref`, `effective_date`, `jurisdiction`, `tax_type`, `version`, `content_hash`.
6. **Diff** against last crawl by `content_hash` → new/changed chunks feed the **Change-Impact Engine** (Phase 3).

### 3b. Query (every question)
1. User question (+ jurisdiction/tax-type filter) → **embed**.
2. **Retrieve** top-k chunks from pgvector, filtered to the right jurisdiction & current `effective_date`.
3. **Generate** with Claude under a strict contract:
   - *Answer only from the provided context.*
   - *Attach a citation (article_ref + date + url) to every claim.*
   - *If the context doesn't cover it → return `escalate` with a reason, don't guess.*
4. **Validate** the structured output: every statement must reference a real retrieved chunk id. If not → escalate.
5. **Render** the answer with inline citations + a confidence signal.
6. **Log** the question, retrieved sources, answer, and confidence to `query_log` (audit + eval + measuring F&A time saved).

### 3c. The answer contract (structured output)
```ts
{
  status: "answered" | "escalate",
  answer: string,                    // empty if escalate
  citations: [{ chunkId, articleRef, sourceUrl, effectiveDate }],
  confidence: "high" | "medium" | "low",
  escalationReason?: string          // when status = escalate
}
```
This contract is what makes "grounded & cited, or it escalates" a *structural guarantee*, not a prompt suggestion.

---

## 4. Vendor VAT Determination engine (Phase 1)

For "is there VAT on this, and what do I do?" — a hybrid of **deterministic rules + RAG**:

1. **Deterministic rule layer** handles known-clear cases first (e.g. imported services from abroad → reverse charge; designated-zone rules). Fast, exact, no model.
2. **RAG fallback** for everything else → cited reasoning via the answer engine.
3. **Structured determination output:**
```ts
{
  treatment: "standard_5" | "zero_rated" | "exempt" | "out_of_scope" | "reverse_charge" | "designated_zone",
  inputVatRecoverable: boolean | "partial",
  whatToDo: string,
  confirmWithFA: boolean,            // true → routes to F&A review queue
  citations: [...],
  confidence: "high" | "medium" | "low"
}
```
4. **Escalation routing:** low confidence or flagged scenarios → the **F&A review queue** instead of a final answer.

---

## 5. Invoice upload & extraction (Phase 1.5)
1. Upload PDF/image → **Vercel Blob (private)**.
2. **Claude vision** extracts structured fields → `{ vendor, country, currency, amount, lineItems[], taxShown }`.
3. Extracted data + user context → **Determination engine** (Section 4).
4. Output: treatment + what to do + what to confirm — cited.
5. File + extraction + determination logged against the invoice record (audit).

---

## 6. Compliance Register + Deadline Tracker (Phase 2)
- **Data:** `compliance_items` — `entity, jurisdiction, type, due_date, frequency, authority, status`. Deterministic — **no model in the loop**, so no hallucination risk.
- **Dashboard:** Due This Week / This Month / Overdue / Completed.
- **Reminders:** a **Vercel Cron** job runs daily → finds items due in 30/15/7/1 days → sends via **Resend** → logs to `audit_log`. Overdue → red + escalation.
- **Exports:** generate **PDF/Excel** of the register on demand → Blob.

---

## 7. Change-Impact Engine (Phase 3)
- Nightly ingestion diff surfaces amended/new law (Section 3a).
- A **Vercel Workflow** (durable, retry-safe) then:
  1. Identifies `compliance_items`, cached answers, and reports that cited the old rule.
  2. Flags them for **human re-review** (never silently auto-edits).
  3. Notifies F&A of what changed and what it affects.
- Durable execution matters here: a re-run touching many records must survive timeouts/retries without double-processing.

---

## 8. Data model (Postgres, simplified)

| Table | Purpose |
|-------|---------|
| `documents` | Source docs: url, authority, jurisdiction, fetched_at, version |
| `law_chunks` | Chunk text + `embedding vector` + article_ref, effective_date, content_hash |
| `compliance_items` | The register: entity, jurisdiction, type, due_date, frequency, authority, status |
| `invoices` | Blob ref + extracted fields + determination result |
| `query_log` | Every Q&A: question, retrieved chunk ids, answer, confidence, user |
| `law_changes` | Detected amendments + impacted items (Change-Impact) |
| `users` / `roles` | Staff, role (F&A reviewer vs. general staff), permissions |
| `audit_log` | Who saw/approved/sent what, when — the trust backbone |

`pgvector` lives on `law_chunks.embedding`; everything else is ordinary relational data in the **same** database — one store, simpler ops.

---

## 9. Security, roles & audit
- **Auth:** Clerk; internal SSO. Two base roles: **F&A reviewer** (approves, sees everything) and **general staff** (asks, uploads, sees own queries).
- **Data isolation:** invoices and filings in **private** Blob; DB access-controlled. Nothing leaves the private pipeline.
- **Audit everything:** every answer, determination, reminder, and sign-off is logged. This is what lets the tax team *trust* the routine work.
- **Model safety:** answers grounded in retrieved context only; the answer contract blocks ungrounded claims.

---

## 10. Component → phase mapping

| Component | Built in |
|-----------|----------|
| Ingestion pipeline + pgvector + answer contract | Phase 0 |
| Chat UI + Cited Q&A + Determination engine | Phase 1 |
| Invoice upload + vision extraction | Phase 1.5 |
| Register + dashboard + cron reminders + exports | Phase 2 |
| Change-Impact workflow + more jurisdictions | Phase 3 |
| Draft return preparation + reporting | Phase 4 |

---

## 11. Proposed repo structure
```
tax-bot/
├─ app/                    # Next.js routes (chat, invoices, register, admin)
│  ├─ (chat)/
│  ├─ invoices/
│  ├─ register/
│  └─ api/                 # API routes / server actions
├─ lib/
│  ├─ ai/                  # AI SDK setup, prompts, answer contract
│  ├─ rag/                 # retrieval, ingestion, chunking
│  ├─ determination/       # VAT rules + engine
│  └─ db/                  # Drizzle schema, queries
├─ ingestion/              # crawlers per authority
├─ workflows/              # Vercel Workflow definitions (change-impact)
├─ jobs/                   # cron handlers (reminders)
├─ evals/                  # cited-answer accuracy harness
└─ ROADMAP.md / ARCHITECTURE.md
```

---

## Open technical decisions
1. **Neon Postgres+pgvector** (recommended — one store) vs. a dedicated vector DB (Upstash/Pinecone). Recommend pgvector to keep ops simple since we need relational compliance data anyway.
2. **Crawl vs. manual upload** of source law for Phase 0 — start with a small curated set (CT + VAT core pages), automate crawling later.
3. **Clerk vs. existing Sobha SSO** — confirm whether to integrate with internal identity.
