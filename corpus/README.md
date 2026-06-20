# Corpus — UAE FTA knowledge base

The official source documents the bot grounds its answers on. Committed here so
the knowledge base is reproducible. **All files here are public FTA documents.**

## Structure
| Folder | Contents | Committed? |
|--------|----------|-----------|
| `ct-legislation/` | CT Decree-Law 47/2022, QFZP CD 100/2023, MD 265/2023 | ✅ |
| `fta-legislation/` | VAT Law 8/2017, VAT Executive Regulations, Tax Procedures + decisions | ✅ |
| `ct-guides/` | CT guides + Public Clarifications (CTGxxx, CTPxxx) | ✅ |
| `fta-vat-guides/` | VAT guides (Real Estate, Designated Zones, Input Tax Apportionment…) | ✅ |
| `public-clarifications/` | VAT Public Clarifications (VATPxxx) | ✅ |
| `_bulletins-low-value/`, `_portal-manuals/` | newsletters / portal manuals | ❌ git-ignored |
| `confidential/` | **client docs — sample invoices, internal checklists** | ❌ git-ignored, **never commit** |

## Add documents
1. Drop PDF/TXT/MD into the right subfolder (or `confidential/` for client data).
2. `npm run ingest` — auto-discovers everything, extracts text, chunks (article-aware
   for laws), tags authority, embeds, and writes `lib/rag/corpus-index.json`.

Metadata (tax type, instrument, authority rank) is derived from the folder +
filename — see `deriveMeta()` in `scripts/ingest.ts`.

## ⚠️ Note
PDFs are bilingual (Arabic + English). Language-aware segmentation is an open
task (see the root README) — until then, chunks contain both scripts.
