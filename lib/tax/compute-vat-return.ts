// Deterministic UAE VAT return computation for scenario questions ("what goes
// in the return this quarter?"). The language model categorises each supply
// and purchase line; code computes every figure — output VAT, reverse-charge
// self-accounting, recoverable vs blocked input VAT, and the net position.
// Pure and synchronous, like computeInvoiceVat / computeCorporateTax.

export type SupplyCategory = "standard_5" | "zero_rated" | "exempt" | "out_of_scope";

export interface VatSupplyLine {
  label: string;
  amount: number; // net (VAT-exclusive)
  category: SupplyCategory;
}

export interface VatPurchaseLine {
  label: string;
  amount: number; // net (VAT-exclusive)
  // reverse_charge = imported goods/services the recipient self-accounts for.
  category: "standard_5" | "zero_rated" | "exempt" | "out_of_scope" | "reverse_charge";
  // VAT actually paid to the supplier, when stated. Defaults to amount × rate
  // for standard_5 lines; ignored for reverse_charge (self-accounted at rate).
  vatPaid?: number;
  recovery: "recoverable" | "blocked" | "partial";
  recoveryRatio?: number; // required to compute a `partial` line
}

export interface VatReturnInputs {
  supplies: VatSupplyLine[];
  purchases: VatPurchaseLine[];
}

export interface VatReturnParams {
  standardRate?: number; // vat.standard_rate (default 5%)
}

export interface VatReturnComputation {
  boxes: {
    standardRatedSupplies: number;
    outputVatOnSupplies: number;
    zeroRatedSupplies: number;
    exemptSupplies: number;
    outOfScopeSupplies: number;
    reverseChargeBase: number;
    reverseChargeOutputVat: number;
    totalOutputVat: number;
    recoverableInputVat: number;
    blockedInputVat: number;
    netVatPayable: number; // negative = refundable
  };
  lines: {
    label: string;
    kind: "supply" | "purchase";
    category: string;
    amount: number;
    outputVat: number;
    inputVatRecoverable: number;
    inputVatBlocked: number;
    note: string;
  }[];
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeVatReturn(
  inputs: VatReturnInputs,
  params: VatReturnParams = {},
): VatReturnComputation {
  const rate = params.standardRate ?? 0.05;
  const warnings: string[] = [];
  const lines: VatReturnComputation["lines"] = [];

  const boxes = {
    standardRatedSupplies: 0,
    outputVatOnSupplies: 0,
    zeroRatedSupplies: 0,
    exemptSupplies: 0,
    outOfScopeSupplies: 0,
    reverseChargeBase: 0,
    reverseChargeOutputVat: 0,
    totalOutputVat: 0,
    recoverableInputVat: 0,
    blockedInputVat: 0,
    netVatPayable: 0,
  };

  for (const s of inputs.supplies) {
    const amount = round2(Math.abs(s.amount));
    let outputVat = 0;
    let note = "";
    switch (s.category) {
      case "standard_5":
        outputVat = round2(amount * rate);
        boxes.standardRatedSupplies = round2(boxes.standardRatedSupplies + amount);
        boxes.outputVatOnSupplies = round2(boxes.outputVatOnSupplies + outputVat);
        note = `Output VAT at ${round2(rate * 100)}%.`;
        break;
      case "zero_rated":
        boxes.zeroRatedSupplies = round2(boxes.zeroRatedSupplies + amount);
        note = "Zero-rated — reported, no output VAT.";
        break;
      case "exempt":
        boxes.exemptSupplies = round2(boxes.exemptSupplies + amount);
        note = "Exempt — no output VAT; affects input recovery.";
        break;
      case "out_of_scope":
        boxes.outOfScopeSupplies = round2(boxes.outOfScopeSupplies + amount);
        note = "Outside the scope of UAE VAT.";
        break;
    }
    lines.push({
      label: s.label,
      kind: "supply",
      category: s.category,
      amount,
      outputVat,
      inputVatRecoverable: 0,
      inputVatBlocked: 0,
      note,
    });
  }

  for (const p of inputs.purchases) {
    const amount = round2(Math.abs(p.amount));
    let outputVat = 0;
    let inputVat = 0;
    let note = "";

    if (p.category === "reverse_charge") {
      // Recipient self-accounts output VAT and (subject to recovery status)
      // reclaims the same amount — both sides computed here, never assumed.
      outputVat = round2(amount * rate);
      inputVat = outputVat;
      boxes.reverseChargeBase = round2(boxes.reverseChargeBase + amount);
      boxes.reverseChargeOutputVat = round2(boxes.reverseChargeOutputVat + outputVat);
      note = `Reverse charge: self-account ${outputVat.toLocaleString()} output VAT`;
      if (p.vatPaid != null && Math.abs(p.vatPaid - outputVat) > Math.max(1, outputVat * 0.01)) {
        warnings.push(
          `"${p.label}": stated VAT ${p.vatPaid.toLocaleString()} differs from the self-account amount ${outputVat.toLocaleString()} computed at ${round2(rate * 100)}%.`,
        );
      }
    } else if (p.category === "standard_5") {
      inputVat = p.vatPaid != null ? round2(Math.abs(p.vatPaid)) : round2(amount * rate);
      const expected = round2(amount * rate);
      if (p.vatPaid != null && Math.abs(inputVat - expected) > Math.max(1, expected * 0.01)) {
        warnings.push(
          `"${p.label}": VAT paid ${inputVat.toLocaleString()} differs from ${round2(rate * 100)}% of the net (${expected.toLocaleString()}) — check the invoice.`,
        );
      }
      note = "Standard-rated purchase";
    } else {
      note = `${p.category} purchase — no input VAT`;
    }

    let recoverable = 0;
    let blocked = 0;
    if (inputVat > 0) {
      switch (p.recovery) {
        case "recoverable":
          recoverable = inputVat;
          note += "; input VAT recoverable.";
          break;
        case "blocked":
          blocked = inputVat;
          note += "; input VAT BLOCKED (not recoverable).";
          break;
        case "partial":
          if (p.recoveryRatio == null) {
            blocked = 0;
            warnings.push(
              `"${p.label}" is partially recoverable but no recovery ratio was given — its input VAT (${inputVat.toLocaleString()}) is EXCLUDED from the recoverable total until apportioned.`,
            );
            note += "; partial recovery — ratio needed to compute.";
          } else {
            const ratio = Math.min(1, Math.max(0, p.recoveryRatio));
            recoverable = round2(inputVat * ratio);
            blocked = round2(inputVat - recoverable);
            note += `; ${round2(ratio * 100)}% recoverable by apportionment.`;
          }
          break;
      }
    }

    boxes.recoverableInputVat = round2(boxes.recoverableInputVat + recoverable);
    boxes.blockedInputVat = round2(boxes.blockedInputVat + blocked);
    lines.push({
      label: p.label,
      kind: "purchase",
      category: p.category,
      amount,
      outputVat,
      inputVatRecoverable: recoverable,
      inputVatBlocked: blocked,
      note,
    });
  }

  boxes.totalOutputVat = round2(boxes.outputVatOnSupplies + boxes.reverseChargeOutputVat);
  boxes.netVatPayable = round2(boxes.totalOutputVat - boxes.recoverableInputVat);

  return { boxes, lines, warnings };
}
