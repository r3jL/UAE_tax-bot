import { tool } from "ai";
import { z } from "zod";
import { computeCorporateTax } from "../tax/compute-ct";
import { computeVatReturn } from "../tax/compute-vat-return";
import { loadParameters, getNumber, parseAsOf } from "../tax/parameters";

// Calculator tools for the answer engine. The model's job is CLASSIFICATION —
// naming each amount and which treatment applies; these tools own every number.
// Rates/thresholds resolve from the versioned tax_parameters store as of the
// period in question, so a rate change is a data edit, not a redeploy.

const ctAdjustmentSchema = z.object({
  label: z.string().describe("What this adjustment is, e.g. 'Depreciation excess over tax depreciation'"),
  amount: z.number().describe("Magnitude in AED (sign is derived from kind)"),
  kind: z
    .enum(["add_back", "deduct", "exempt_income"])
    .describe(
      "add_back: non-deductible expense sitting in accounting profit (increases taxable income). deduct: extra tax deduction not in accounting profit. exempt_income: income in accounting profit that CT exempts (e.g. participation-exempt dividends).",
    ),
});

export const computeCorporateTaxTool = tool({
  description:
    "Compute UAE Corporate Tax deterministically: builds the taxable-income schedule from accounting profit and classified adjustments, applies the entertainment add-back, the General Interest Deduction Limitation Rule, the 75% tax-loss offset cap, and the 0%/9% bands. Call this for ANY question that needs a CT liability or taxable-income number — never do this arithmetic yourself. Do NOT also pass entertainment or interest inside `adjustments`; use their dedicated fields.",
  inputSchema: z.object({
    accountingProfit: z.number().describe("Accounting profit/(loss) before tax, AED"),
    adjustments: z
      .array(ctAdjustmentSchema)
      .optional()
      .describe("Classified adjustments OTHER than entertainment and interest"),
    entertainmentExpense: z
      .number()
      .optional()
      .describe("TOTAL entertainment expense, AED — the tool applies the partial add-back itself"),
    netInterestExpense: z.number().optional().describe("Net interest expense, AED"),
    taxEbitda: z.number().optional().describe("Tax EBITDA, AED (for the 30% interest limit)"),
    carriedForwardLosses: z.number().optional().describe("Carried-forward tax losses, AED"),
    periodEnd: z
      .string()
      .optional()
      .describe("Tax period end date (ISO), for rate/threshold versioning"),
  }),
  execute: async (input) => {
    try {
      const params = await loadParameters();
      const asOf = parseAsOf(input.periodEnd) ?? new Date();
      return computeCorporateTax(
        {
          accountingProfit: input.accountingProfit,
          adjustments: input.adjustments,
          entertainmentExpense: input.entertainmentExpense,
          netInterestExpense: input.netInterestExpense,
          taxEbitda: input.taxEbitda,
          carriedForwardLosses: input.carriedForwardLosses,
        },
        {
          rate: getNumber(params, "ct.standard_rate", asOf) ?? undefined,
          zeroBand: getNumber(params, "ct.threshold.0pct", asOf) ?? undefined,
          interestEbitdaPct: getNumber(params, "ct.interest.ebitda_pct", asOf) ?? undefined,
          interestSafeHarbour: getNumber(params, "ct.interest.safe_harbour", asOf) ?? undefined,
          lossOffsetCapPct: getNumber(params, "ct.loss.offset_cap_pct", asOf) ?? undefined,
        },
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Corporate Tax computation failed." };
    }
  },
});

const vatSupplySchema = z.object({
  label: z.string(),
  amount: z.number().describe("Net (VAT-exclusive) amount, AED"),
  category: z.enum(["standard_5", "zero_rated", "exempt", "out_of_scope"]),
});

const vatPurchaseSchema = z.object({
  label: z.string(),
  amount: z.number().describe("Net (VAT-exclusive) amount, AED"),
  category: z
    .enum(["standard_5", "zero_rated", "exempt", "out_of_scope", "reverse_charge"])
    .describe("reverse_charge = imported goods/services the recipient self-accounts"),
  vatPaid: z.number().optional().describe("VAT actually charged by the supplier, if stated"),
  recovery: z
    .enum(["recoverable", "blocked", "partial"])
    .describe(
      "blocked = non-recoverable input VAT (entertainment, personal-use vehicles); partial = mixed taxable/exempt or partly personal use",
    ),
  recoveryRatio: z.number().optional().describe("0..1 — required to compute a partial line"),
});

export const computeVatReturnTool = tool({
  description:
    "Compute a UAE VAT return position deterministically from categorised supply and purchase lines: output VAT, reverse-charge self-accounting (both sides), recoverable vs blocked input VAT, and net VAT payable. Call this for ANY question that needs VAT amounts across multiple transactions — never do this arithmetic yourself.",
  inputSchema: z.object({
    supplies: z.array(vatSupplySchema),
    purchases: z.array(vatPurchaseSchema),
    periodEnd: z.string().optional().describe("Period end date (ISO), for rate versioning"),
  }),
  execute: async (input) => {
    try {
      const params = await loadParameters();
      const asOf = parseAsOf(input.periodEnd) ?? new Date();
      return computeVatReturn(
        { supplies: input.supplies, purchases: input.purchases },
        { standardRate: getNumber(params, "vat.standard_rate", asOf) ?? undefined },
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : "VAT return computation failed." };
    }
  },
});

export const taxCalculatorTools = {
  computeCorporateTax: computeCorporateTaxTool,
  computeVatReturn: computeVatReturnTool,
};
