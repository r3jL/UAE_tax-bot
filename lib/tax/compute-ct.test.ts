import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCorporateTax } from "./compute-ct";
import { computeVatReturn } from "./compute-vat-return";

// The XYZ LLC scenario that the freeform-LLM ledger got wrong (it answered
// 190,350 after flipping add-back signs and double-deducting interest).
test("XYZ LLC CT scenario — signs, GIDLR, losses, bands", () => {
  const c = computeCorporateTax({
    accountingProfit: 4_800_000,
    entertainmentExpense: 240_000,
    adjustments: [
      { label: "Depreciation excess over tax depreciation", amount: 60_000, kind: "add_back" },
      { label: "Donation to unapproved foreign charity", amount: 150_000, kind: "add_back" },
      { label: "Exempt dividend (participation exemption)", amount: 500_000, kind: "exempt_income" },
    ],
    netInterestExpense: 900_000,
    taxEbitda: 2_900_000,
    carriedForwardLosses: 700_000,
  });

  // 4.8m + 120k (50% entertainment) + 60k + 150k − 500k = 4,630,000
  assert.equal(c.taxableIncomeBeforeLosses, 4_630_000);
  // interest within the 12m safe harbour → no adjustment
  assert.equal(c.interest.disallowed, 0);
  // 700k < 75% cap (3,472,500) → fully used
  assert.equal(c.lossesUsed, 700_000);
  assert.equal(c.taxableIncome, 3_930_000);
  // (3,930,000 − 375,000) × 9%
  assert.equal(c.taxDue, 319_950);
});

test("loss offset is capped at 75% of taxable income", () => {
  const c = computeCorporateTax({
    accountingProfit: 1_000_000,
    carriedForwardLosses: 900_000,
  });
  assert.equal(c.lossOffsetCap, 750_000);
  assert.equal(c.lossesUsed, 750_000);
  assert.equal(c.lossesRemaining, 150_000);
  assert.equal(c.taxableIncome, 250_000);
  assert.equal(c.taxDue, 0); // under the 375k band
  assert.ok(c.warnings.some((w) => /capped/i.test(w)));
});

test("GIDLR adds back only the excess over the greater limit", () => {
  const c = computeCorporateTax({
    accountingProfit: 100_000_000,
    netInterestExpense: 20_000_000,
    taxEbitda: 50_000_000,
  });
  // limit = max(12m, 15m) = 15m → 5m disallowed (added back)
  assert.equal(c.interest.limit, 15_000_000);
  assert.equal(c.interest.disallowed, 5_000_000);
  assert.equal(c.taxableIncomeBeforeLosses, 105_000_000);
});

test("interest above safe harbour without EBITDA warns instead of guessing", () => {
  const c = computeCorporateTax({
    accountingProfit: 50_000_000,
    netInterestExpense: 13_000_000,
  });
  assert.equal(c.interest.disallowed, 0);
  assert.ok(c.warnings.some((w) => /EBITDA is missing/i.test(w)));
});

test("income-like item classified as add_back trips a warning", () => {
  const c = computeCorporateTax({
    accountingProfit: 1_000_000,
    adjustments: [
      { label: "Unrealised gain on investment property", amount: 320_000, kind: "add_back" },
    ],
  });
  assert.ok(c.warnings.some((w) => /looks like INCOME/i.test(w)));
});

test("adjustment signs come from kind, never from the given sign", () => {
  const c = computeCorporateTax({
    accountingProfit: 1_000_000,
    adjustments: [{ label: "Fine", amount: -50_000, kind: "add_back" }],
  });
  assert.equal(c.taxableIncomeBeforeLosses, 1_050_000);
  assert.ok(c.warnings.some((w) => /negative amount/i.test(w)));
});

// The Q2 electronics-importer scenario from the chat transcript.
test("Q2 electronics VAT return — RCM both sides, blocked entertainment", () => {
  const r = computeVatReturn({
    supplies: [
      { label: "Local taxable sales", amount: 1_250_000, category: "standard_5" },
      { label: "Exports to KSA", amount: 420_000, category: "zero_rated" },
      { label: "Exports to Germany", amount: 310_000, category: "zero_rated" },
    ],
    purchases: [
      { label: "Local inventory", amount: 730_000, category: "standard_5", recovery: "recoverable" },
      { label: "Imports from China (RCM)", amount: 400_000, category: "reverse_charge", recovery: "recoverable" },
      { label: "Office rent", amount: 120_000, category: "standard_5", recovery: "recoverable" },
      { label: "Client entertainment", amount: 18_000, category: "standard_5", recovery: "blocked" },
      { label: "MD passenger vehicle (partly personal)", amount: 180_000, category: "standard_5", recovery: "partial" },
    ],
  });

  assert.equal(r.boxes.standardRatedSupplies, 1_250_000);
  assert.equal(r.boxes.outputVatOnSupplies, 62_500);
  assert.equal(r.boxes.zeroRatedSupplies, 730_000);
  assert.equal(r.boxes.reverseChargeOutputVat, 20_000);
  assert.equal(r.boxes.totalOutputVat, 82_500);
  // 36,500 inventory + 20,000 RCM + 6,000 rent (vehicle excluded pending ratio)
  assert.equal(r.boxes.recoverableInputVat, 62_500);
  assert.equal(r.boxes.blockedInputVat, 900);
  assert.equal(r.boxes.netVatPayable, 20_000);
  assert.ok(r.warnings.some((w) => /vehicle/i.test(w) && /ratio/i.test(w)));
});

test("partial recovery with a ratio splits recoverable vs blocked", () => {
  const r = computeVatReturn({
    supplies: [],
    purchases: [
      { label: "Mixed-use overheads", amount: 100_000, category: "standard_5", recovery: "partial", recoveryRatio: 0.6 },
    ],
  });
  assert.equal(r.boxes.recoverableInputVat, 3_000);
  assert.equal(r.boxes.blockedInputVat, 2_000);
});
