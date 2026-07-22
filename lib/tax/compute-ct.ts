// Deterministic UAE Corporate Tax computation. The language model classifies
// the facts (WHICH adjustments apply, whether income is exempt); every number
// here — signs, caps, bands, thresholds — is computed by exact code, never by
// the model. Pure and synchronous, like computeInvoiceVat: parameters are
// resolved by the caller (tax_parameters store) and passed in as plain numbers.

export interface CtAdjustment {
  label: string;
  // Magnitude only — the SIGN is implied by `kind`, so a misclassified sign is
  // structurally impossible (the exact failure the freeform-LLM ledger had).
  amount: number;
  kind:
    | "add_back" // non-deductible expense inside accounting profit (add)
    | "deduct" // extra tax deduction not in accounting profit (subtract)
    | "exempt_income"; // income in accounting profit that CT exempts (subtract)
}

export interface CtInputs {
  accountingProfit: number;
  adjustments?: CtAdjustment[];
  // Total entertainment expense — code applies the partial add-back itself.
  entertainmentExpense?: number;
  // Net interest expense for the General Interest Deduction Limitation Rule.
  netInterestExpense?: number;
  // Tax EBITDA for the 30% leg of the GIDLR (optional; safe harbour needs none).
  taxEbitda?: number;
  carriedForwardLosses?: number;
}

export interface CtParams {
  rate?: number; // ct.standard_rate (default 9%)
  zeroBand?: number; // ct.threshold.0pct (default AED 375,000)
  entertainmentDeductiblePct?: number; // Art. 32 (default 50%)
  interestEbitdaPct?: number; // ct.interest.ebitda_pct (default 30%)
  interestSafeHarbour?: number; // ct.interest.safe_harbour (default AED 12m)
  lossOffsetCapPct?: number; // ct.loss.offset_cap_pct (default 75%)
}

export interface CtScheduleLine {
  label: string;
  amount: number; // signed as applied
  running: number;
}

export interface CtComputation {
  schedule: CtScheduleLine[];
  taxableIncomeBeforeLosses: number;
  lossesAvailable: number;
  lossOffsetCap: number;
  lossesUsed: number;
  lossesRemaining: number;
  taxableIncome: number;
  zeroBand: number;
  rate: number;
  taxDue: number;
  interest: {
    net: number | null;
    limit: number | null; // greater of safe harbour and 30% EBITDA
    disallowed: number; // added back in the schedule when > 0
    note: string;
  };
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCorporateTax(
  inputs: CtInputs,
  params: CtParams = {},
): CtComputation {
  const rate = params.rate ?? 0.09;
  const zeroBand = params.zeroBand ?? 375_000;
  const entPct = params.entertainmentDeductiblePct ?? 0.5;
  const ebitdaPct = params.interestEbitdaPct ?? 0.3;
  const safeHarbour = params.interestSafeHarbour ?? 12_000_000;
  const lossCapPct = params.lossOffsetCapPct ?? 0.75;

  const warnings: string[] = [];
  const schedule: CtScheduleLine[] = [];
  let running = round2(inputs.accountingProfit);
  schedule.push({ label: "Accounting profit before tax", amount: running, running });

  const apply = (label: string, signed: number) => {
    running = round2(running + signed);
    schedule.push({ label, amount: round2(signed), running });
  };

  // Entertainment: only the non-deductible portion comes back. Code owns the
  // percentage so "50% deductible" can never turn into a subtraction.
  if (inputs.entertainmentExpense != null && inputs.entertainmentExpense > 0) {
    const addBack = round2(inputs.entertainmentExpense * (1 - entPct));
    apply(
      `Entertainment — non-deductible ${round2((1 - entPct) * 100)}% of ${inputs.entertainmentExpense.toLocaleString()}`,
      addBack,
    );
  }

  for (const adj of inputs.adjustments ?? []) {
    const magnitude = Math.abs(adj.amount);
    if (adj.amount < 0) {
      warnings.push(
        `Adjustment "${adj.label}" was given a negative amount; its magnitude was used — the sign comes from its kind (${adj.kind}).`,
      );
    }
    if (
      inputs.entertainmentExpense != null &&
      /entertain/i.test(adj.label)
    ) {
      warnings.push(
        `Adjustment "${adj.label}" looks like entertainment, which is already handled via entertainmentExpense — check for double counting.`,
      );
    }
    // Tripwire: an income-like item classified as add_back INCREASES taxable
    // income — almost always a sign error (income is either taxable as-is, or
    // excluded via deduct/exempt_income).
    if (adj.kind === "add_back" && /\b(gain|income|dividend|revenue)\b/i.test(adj.label)) {
      warnings.push(
        `Adjustment "${adj.label}" looks like INCOME but was classified add_back, which increases taxable income. If it should be excluded, use deduct/exempt_income; if it is simply taxable, no adjustment is needed. Verify before relying on this schedule.`,
      );
    }
    const signed = adj.kind === "add_back" ? magnitude : -magnitude;
    apply(adj.label, signed);
  }

  // General Interest Deduction Limitation Rule: deductible net interest is
  // capped at the GREATER of the safe harbour and 30% of tax EBITDA; only the
  // excess is added back. Interest itself is already inside accounting profit,
  // so "fully deductible" means NO adjustment (never a second deduction).
  let interest: CtComputation["interest"] = {
    net: null,
    limit: null,
    disallowed: 0,
    note: "No net interest expense provided.",
  };
  if (inputs.netInterestExpense != null) {
    const net = round2(inputs.netInterestExpense);
    if (net <= safeHarbour) {
      interest = {
        net,
        limit: safeHarbour,
        disallowed: 0,
        note: `Net interest ${net.toLocaleString()} is within the AED ${safeHarbour.toLocaleString()} safe harbour — fully deductible, no adjustment.`,
      };
    } else if (inputs.taxEbitda == null) {
      interest = {
        net,
        limit: null,
        disallowed: 0,
        note: `Net interest exceeds the safe harbour but tax EBITDA was not provided — disallowance NOT computed.`,
      };
      warnings.push(
        "Net interest exceeds the AED safe harbour but tax EBITDA is missing, so the 30%-of-EBITDA limit could not be applied. Provide EBITDA to compute any disallowance.",
      );
    } else {
      const limit = round2(Math.max(safeHarbour, inputs.taxEbitda * ebitdaPct));
      const disallowed = round2(Math.max(0, net - limit));
      interest = {
        net,
        limit,
        disallowed,
        note:
          disallowed > 0
            ? `Deduction limited to ${limit.toLocaleString()} (greater of safe harbour and ${round2(ebitdaPct * 100)}% of EBITDA); ${disallowed.toLocaleString()} added back.`
            : `Net interest is within the ${round2(ebitdaPct * 100)}%-of-EBITDA limit — fully deductible, no adjustment.`,
      };
      if (disallowed > 0) apply("Interest disallowed under GIDLR", disallowed);
    }
  }

  const taxableIncomeBeforeLosses = running;

  // Tax losses: offset capped at 75% of taxable income (and never below zero).
  const lossesAvailable = round2(Math.max(0, inputs.carriedForwardLosses ?? 0));
  const lossOffsetCap = round2(Math.max(0, taxableIncomeBeforeLosses) * lossCapPct);
  const lossesUsed = round2(Math.min(lossesAvailable, lossOffsetCap));
  if (lossesAvailable > lossesUsed && lossesAvailable > 0) {
    warnings.push(
      `Loss offset capped at ${round2(lossCapPct * 100)}% of taxable income: ${lossesUsed.toLocaleString()} used, ${round2(lossesAvailable - lossesUsed).toLocaleString()} carried forward.`,
    );
  }
  if (lossesUsed > 0) apply("Tax losses utilised", -lossesUsed);

  const taxableIncome = running;
  if (taxableIncome < 0) {
    warnings.push("Taxable income is negative — no tax due; the loss carries forward.");
  }

  const taxDue = round2(Math.max(0, taxableIncome - zeroBand) * rate);

  return {
    schedule,
    taxableIncomeBeforeLosses,
    lossesAvailable,
    lossOffsetCap,
    lossesUsed,
    lossesRemaining: round2(lossesAvailable - lossesUsed),
    taxableIncome,
    zeroBand,
    rate,
    taxDue,
    interest,
    warnings,
  };
}
