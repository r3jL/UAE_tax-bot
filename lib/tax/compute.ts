// Deterministic VAT computation. The language model decides WHICH rule applies
// (the treatment + recoverability); every number here is computed by exact code,
// never by the model. Pure functions — no I/O, fully testable and repeatable.

import type { DeterminationContract, InvoiceFields } from "../ai/contracts";

export interface VatComputation {
  currency: string;
  net: number | null; // amount excluding VAT
  vatCharged: number | null; // VAT actually on the invoice
  total: number | null;
  expectedRate: number | null; // the rate the determined treatment implies
  expectedVat: number | null; // net * expectedRate, by code
  selfAccountedVat: number | null; // reverse charge: recipient self-accounts 5%
  recoverableInputVat: number | null; // input VAT the recipient can reclaim
  mismatch: {
    status: "match" | "overcharged" | "undercharged" | "vat_not_expected" | "unknown";
    delta: number | null; // charged − expected
    message: string;
  };
  notes: string[];
}

// VAT rate implied by each treatment (what the SUPPLIER should charge). These
// are FALLBACK defaults — when a live rate table is passed via opts.rates (from
// the versioned tax_parameters store), it is merged over these so a rate change
// is a data edit, not a code change. Only the numeric rates (standard_5) are
// data-driven; the structural zeros/nulls below stay in code.
const DEFAULT_RATE_BY_TREATMENT: Record<string, number | null> = {
  standard_5: 0.05,
  zero_rated: 0,
  exempt: 0,
  out_of_scope: 0,
  reverse_charge: 0, // supplier charges nothing; recipient self-accounts
  designated_zone: null, // genuinely depends — don't assert a rate
  unknown: null,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Pull a number out of a free-text amount, e.g. "126,450.00 AED" → 126450,
// "AED 200 (5%)" → 200, "None" → 0. Strips note-parentheticals and percentages,
// then takes the largest-magnitude number present.
export function parseAmount(s: string | null | undefined): number | null {
  if (s == null) return null;
  if (/^\s*(none|n\/a|-)\s*$/i.test(s)) return 0;
  const cleaned = s
    .replace(/\([^)]*[%A-Za-z][^)]*\)/g, " ") // drop notes like (5%), (first supply)
    .replace(/\d+(?:\.\d+)?\s*%/g, " "); // drop bare percentages
  const matches = cleaned.match(/-?\d[\d,]*(?:\.\d+)?/g);
  if (!matches) return null;
  const nums = matches.map((m) => Number(m.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const negative = nums.some((n) => n < 0);
  const magnitude = Math.max(...nums.map((n) => Math.abs(n)));
  return negative ? -magnitude : magnitude;
}

function detectCurrency(fields: InvoiceFields): string {
  const explicit = (fields.currency || "").toUpperCase().match(/[A-Z]{3}/);
  if (explicit) return explicit[0];
  const blob = `${fields.total} ${fields.subtotal} ${fields.vatAmount}`.toUpperCase();
  const found = blob.match(/\b(AED|USD|GBP|EUR|SAR|INR)\b/);
  return found ? found[1] : "AED";
}

export function computeInvoiceVat(
  fields: InvoiceFields,
  det: Pick<DeterminationContract, "treatment" | "inputVatRecoverable">,
  opts: {
    recoveryRatio?: number;
    // Live rate overrides (treatment → rate), merged over the defaults above.
    rates?: Record<string, number | null>;
    // Reverse-charge self-account rate; defaults to the standard rate.
    selfAccountRate?: number;
  } = {},
): VatComputation {
  // Merge any live (data-driven) rates over the built-in defaults so missing
  // keys transparently fall back — the function stays pure and synchronous.
  const rateTable = { ...DEFAULT_RATE_BY_TREATMENT, ...(opts.rates ?? {}) };
  const currency = detectCurrency(fields);
  const vatCharged = parseAmount(fields.vatAmount);
  const total = parseAmount(fields.total);
  const notes: string[] = [];

  let net = parseAmount(fields.subtotal);
  if (net == null && total != null && vatCharged != null) {
    net = round2(total - vatCharged);
    notes.push("Net derived from total − VAT.");
  }

  const expectedRate = rateTable[det.treatment] ?? null;
  const expectedVat = expectedRate != null && net != null ? round2(net * expectedRate) : null;

  // Compare what the supplier charged against what the rule expects.
  let mismatch: VatComputation["mismatch"];
  if (expectedRate == null || vatCharged == null || expectedVat == null) {
    mismatch = {
      status: "unknown",
      delta: null,
      message: "Not enough information to compare charged vs expected VAT.",
    };
  } else if (expectedVat === 0) {
    mismatch =
      vatCharged > 0.5
        ? {
            status: "vat_not_expected",
            delta: round2(vatCharged),
            message: `Supplier charged ${currency} ${vatCharged.toFixed(2)} VAT, but none is expected for this treatment — check the invoice.`,
          }
        : { status: "match", delta: 0, message: "No VAT charged, and none expected." };
  } else {
    const delta = round2(vatCharged - expectedVat);
    const tolerance = Math.max(1, expectedVat * 0.01);
    if (Math.abs(delta) <= tolerance) {
      mismatch = {
        status: "match",
        delta,
        message: `VAT charged matches the expected ${(expectedRate * 100).toFixed(0)}%.`,
      };
    } else if (delta > 0) {
      mismatch = {
        status: "overcharged",
        delta,
        message: `Charged ${currency} ${delta.toFixed(2)} more than the expected ${currency} ${expectedVat.toFixed(2)}.`,
      };
    } else {
      mismatch = {
        status: "undercharged",
        delta,
        message: `Charged ${currency} ${Math.abs(delta).toFixed(2)} less than the expected ${currency} ${expectedVat.toFixed(2)}.`,
      };
    }
  }

  // Reverse charge: the recipient self-accounts output VAT at the standard rate
  // on the net (the same rate the supplier would have charged — data-driven).
  const selfAccountRate = opts.selfAccountRate ?? opts.rates?.standard_5 ?? 0.05;
  const selfAccountedVat =
    det.treatment === "reverse_charge" && net != null
      ? round2(net * selfAccountRate)
      : null;

  // Recoverable input VAT (reverse charge recovers the self-accounted amount).
  const baseVat = det.treatment === "reverse_charge" ? selfAccountedVat : vatCharged;
  let recoverableInputVat: number | null = null;
  switch (det.inputVatRecoverable) {
    case "yes":
      recoverableInputVat = baseVat;
      break;
    case "no":
      recoverableInputVat = 0;
      break;
    case "partial":
      if (opts.recoveryRatio != null && baseVat != null) {
        recoverableInputVat = round2(baseVat * opts.recoveryRatio);
      } else {
        recoverableInputVat = null;
        notes.push("Partial recovery — apportion by the recovery ratio (set it to compute the amount).");
      }
      break;
    case "na":
      recoverableInputVat = null;
      break;
  }

  return {
    currency,
    net,
    vatCharged,
    total,
    expectedRate,
    expectedVat,
    selfAccountedVat,
    recoverableInputVat,
    mismatch,
    notes,
  };
}
