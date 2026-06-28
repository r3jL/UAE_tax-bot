import { eq } from "drizzle-orm";
import { db } from "../db";
import { taxParameters } from "../db/schema";

// Cached accessor for versioned, effective-dated tax parameters (rates,
// thresholds, dates). The hot path (computeInvoiceVat) is synchronous and runs
// per determination, so we DON'T hit the DB per call: loadParameters() pulls the
// whole (tiny) UAE parameter set once into a process-local snapshot with a TTL,
// and the sync resolvers below answer from that snapshot. A value change in the
// DB (new effective-dated row) is picked up within one TTL — no redeploy.

export interface ParamRow {
  paramKey: string;
  kind: string; // rate | amount | date | text
  valueNumeric: number | null; // parsed ONCE from the numeric (string) column
  valueText: string | null;
  valueDate: Date | null;
  unit: string | null;
  effectiveDate: Date;
  supersededAt: Date | null;
  sourceUrl: string | null;
  articleRef: string | null;
}

// Treatment → the parameter key that supplies its rate. Only the data-driven
// rates live here; structural zeros/nulls (exempt, out_of_scope, reverse_charge,
// designated_zone, unknown) stay in compute.ts's DEFAULT_RATE_BY_TREATMENT.
export const RATE_KEY: Record<string, string> = {
  standard_5: "vat.standard_rate",
  zero_rated: "vat.zero_rate",
};

let snapshot: ParamRow[] | null | undefined; // undefined = not loaded; null = load failed
let loadedAt = 0;
const TTL_MS = Number(process.env.TAX_PARAM_TTL_MS ?? 5 * 60_000);

// Load (and cache) all UAE parameters. Safe when the DB is unavailable: returns
// [] so callers fall back to their built-in defaults.
export async function loadParameters(): Promise<ParamRow[]> {
  const fresh = snapshot !== undefined && Date.now() - loadedAt < TTL_MS;
  if (fresh) return snapshot ?? [];
  try {
    const rows = await db
      .select({
        paramKey: taxParameters.paramKey,
        kind: taxParameters.kind,
        valueNumeric: taxParameters.valueNumeric,
        valueText: taxParameters.valueText,
        valueDate: taxParameters.valueDate,
        unit: taxParameters.unit,
        effectiveDate: taxParameters.effectiveDate,
        supersededAt: taxParameters.supersededAt,
        sourceUrl: taxParameters.sourceUrl,
        articleRef: taxParameters.articleRef,
      })
      .from(taxParameters)
      .where(eq(taxParameters.jurisdiction, "UAE"));
    // Drizzle returns numeric columns as STRINGS — parse once, here, so every
    // downstream consumer gets a real number (the top correctness risk).
    snapshot = rows.map((r) => ({
      ...r,
      valueNumeric: r.valueNumeric == null ? null : Number(r.valueNumeric),
    }));
  } catch {
    if (snapshot === undefined) snapshot = null;
  }
  loadedAt = Date.now();
  return snapshot ?? [];
}

// Drop the cache so the next load re-reads the DB (use after editing a value
// when you want it reflected immediately rather than within the TTL).
export function invalidateParameters() {
  snapshot = undefined;
  loadedAt = 0;
}

// The current row for a key as of a date = latest effectiveDate <= asOf that
// hasn't been superseded by asOf. History is preserved, so as-of queries work.
export function resolveCurrent(
  rows: ParamRow[],
  key: string,
  asOf: Date = new Date(),
): ParamRow | undefined {
  return rows
    .filter(
      (r) =>
        r.paramKey === key &&
        r.effectiveDate <= asOf &&
        (r.supersededAt == null || r.supersededAt > asOf),
    )
    .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0];
}

export function getNumber(
  rows: ParamRow[],
  key: string,
  asOf: Date = new Date(),
): number | null {
  return resolveCurrent(rows, key, asOf)?.valueNumeric ?? null;
}

// Async single-key convenience (loads + resolves).
export async function getParameter(
  key: string,
  opts: { asOf?: Date } = {},
): Promise<ParamRow | undefined> {
  return resolveCurrent(await loadParameters(), key, opts.asOf);
}

// Build the partial rate-override table compute.ts merges over its defaults.
// Only includes keys we actually have data for, so a missing/empty parameter
// table transparently falls back to the built-in defaults.
export function buildRateTable(
  rows: ParamRow[],
  asOf: Date = new Date(),
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [treatment, key] of Object.entries(RATE_KEY)) {
    const v = getNumber(rows, key, asOf);
    if (v != null) out[treatment] = v;
  }
  return out;
}

// Parse a free-text invoice/supply date into an as-of Date, or undefined.
export function parseAsOf(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}
