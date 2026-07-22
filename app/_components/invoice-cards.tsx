"use client";

// Invoice check cards rendered INLINE in the Ask thread — the single merged
// workspace. Extracted-fields confirmation and the cited determination reuse
// the visual language of the old standalone Invoice module, sized for the
// 760px chat column (stacked, not side-by-side).

import {
  CONF_MAP,
  INVOICE_FIELD_LABELS,
  INVOICE_LANGUAGE_LABELS,
  MISMATCH_LABELS,
  RECOVERABLE_LABELS,
  treatmentLabel,
  type Determination,
  type InvoiceFieldsData,
  type SupplyType,
  type VatComputationData,
} from "../_lib/lex-data";
import { Markdown } from "./markdown";

const card: React.CSSProperties = {
  border: "1px solid #ececea",
  borderRadius: 14,
  background: "#fff",
};
const cap: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#b4b4ae",
  marginBottom: 12,
};

const money = (n: number | null | undefined, cur: string) =>
  n == null
    ? "—"
    : `${cur} ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function mismatchColor(s: VatComputationData["mismatch"]["status"]) {
  return s === "match" ? "#2f7a52" : s === "unknown" ? "#9a9a93" : "#b0453a";
}

export function Spinner({ size = 14, color = "#9a9a93" }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "lexspin .7s linear infinite",
        verticalAlign: "middle",
      }}
    />
  );
}

// Deterministic numbers block (code-computed, not the model).
function ComputationBlock({ c }: { c: VatComputationData }) {
  const rows: [string, string][] = [
    ["Net (excl. VAT)", money(c.net, c.currency)],
    ["VAT charged", money(c.vatCharged, c.currency)],
    ["Expected VAT", money(c.expectedVat, c.currency)],
  ];
  if (c.selfAccountedVat != null)
    rows.push(["Self-account (reverse charge)", money(c.selfAccountedVat, c.currency)]);
  rows.push(["Recoverable input VAT", money(c.recoverableInputVat, c.currency)]);

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      <div style={{ ...cap, marginBottom: 8 }}>Computed</div>
      {rows.map(([k, v]) => (
        <div
          key={k}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: "4px 0",
            fontSize: 13,
          }}
        >
          <span style={{ color: "#9a9a93" }}>{k}</span>
          <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      <div
        style={{
          marginTop: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12.5,
          fontWeight: 600,
          color: mismatchColor(c.mismatch.status),
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: mismatchColor(c.mismatch.status),
          }}
        />
        {MISMATCH_LABELS[c.mismatch.status]}
      </div>
      <div style={{ fontSize: 12.5, color: "#6b6b66", marginTop: 4, lineHeight: 1.5 }}>
        {c.mismatch.message}
      </div>
    </div>
  );
}

// Editable "confirm the extracted fields" card. Read-only when onField is
// absent (history reload — the check already ran).
export function InvoiceFieldsCard({
  fields,
  fileName,
  determining,
  onField,
  onRun,
}: {
  fields: InvoiceFieldsData;
  fileName: string;
  determining?: boolean;
  onField?: <K extends keyof InvoiceFieldsData>(k: K, v: InvoiceFieldsData[K]) => void;
  onRun?: () => void;
}) {
  const hasArabic = fields.language === "ar" || fields.language === "mixed";
  const editable = !!onField;
  return (
    <div style={{ ...card, padding: 18, animation: "lexrise .3s ease both" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span style={{ ...cap, marginBottom: 0 }}>
          {editable ? "Extracted fields — confirm" : "Extracted fields"}
        </span>
        <span
          title={
            hasArabic
              ? "Arabic text detected — fields were read and translated from Arabic."
              : "Detected invoice language."
          }
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            color: hasArabic ? "#9a6b18" : "#8a8a83",
            background: hasArabic ? "#fbf3e2" : "#f4f4f1",
            border: `1px solid ${hasArabic ? "#f0e0bd" : "#ececea"}`,
          }}
        >
          {INVOICE_LANGUAGE_LABELS[fields.language]}
        </span>
      </div>
      <div className="lex-xscroll" style={{ fontSize: 11.5, color: "#a8a8a2", marginBottom: 8 }}>
        {fileName}
      </div>

      {INVOICE_FIELD_LABELS.map(({ key, label }) => (
        <label
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "6px 0",
            borderTop: "1px solid #f1f1ee",
          }}
        >
          <span style={{ fontSize: 13, color: "#9a9a93", flex: "none" }}>{label}</span>
          <input
            value={(fields[key] ?? "") as string}
            readOnly={!editable}
            onChange={(e) => onField?.(key, e.target.value as never)}
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#1a1a1a",
              textAlign: "right",
              border: "none",
              outline: "none",
              background: "transparent",
              flex: 1,
              minWidth: 0,
            }}
          />
        </label>
      ))}

      {fields.lineItems.length > 0 && (
        <div style={{ borderTop: "1px solid #f1f1ee", paddingTop: 10, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: "#9a9a93", marginBottom: 6 }}>
            Line items ({fields.lineItems.length})
          </div>
          {fields.lineItems.map((li, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "3px 0",
                fontSize: 12.5,
              }}
            >
              <span style={{ color: "#5a564d", flex: 1, minWidth: 0 }}>{li.description}</span>
              <span style={{ color: "#1a1a1a", fontWeight: 500, flex: "none" }}>{li.amount}</span>
            </div>
          ))}
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 0",
          borderTop: "1px solid #f1f1ee",
        }}
      >
        <span style={{ fontSize: 13, color: "#9a9a93" }}>Supply</span>
        <select
          value={fields.supplyType}
          disabled={!editable}
          onChange={(e) => onField?.("supplyType", e.target.value as SupplyType)}
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "#1a1a1a",
            border: "none",
            background: "transparent",
            textAlign: "right",
          }}
        >
          <option value="goods">Goods</option>
          <option value="services">Services</option>
          <option value="mixed">Mixed</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>

      {editable && (
        <button
          onClick={onRun}
          disabled={determining}
          style={{
            width: "100%",
            marginTop: 14,
            border: "1px solid #1a1a1a",
            borderRadius: 99,
            background: determining ? "#f0efec" : "#1a1a1a",
            color: determining ? "#9a9a93" : "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 0",
            cursor: determining ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {determining ? (
            <>
              <Spinner size={13} color="#9a9a93" /> Checking VAT law…
            </>
          ) : (
            "Confirm & run VAT check"
          )}
        </button>
      )}
    </div>
  );
}

// The cited treatment + code-computed numbers, shown once a check completes.
export function DeterminationCard({ det }: { det: Determination }) {
  return (
    <div style={{ ...card, padding: 18, animation: "lexrise .3s ease both" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ ...cap, marginBottom: 0 }}>Treatment</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: (CONF_MAP[det.confidence] ?? CONF_MAP.low).color,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: (CONF_MAP[det.confidence] ?? CONF_MAP.low).color,
            }}
          />
          {(CONF_MAP[det.confidence] ?? CONF_MAP.low).label}
        </span>
      </div>

      <span
        style={{
          display: "inline-block",
          fontSize: 13,
          fontWeight: 600,
          background: "#f0efec",
          borderRadius: 8,
          padding: "7px 13px",
          marginBottom: 4,
        }}
      >
        {treatmentLabel(det.treatment, det.computation)}
      </span>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#5a564d", marginTop: 8 }}>
        {RECOVERABLE_LABELS[det.inputVatRecoverable]}
      </div>

      {det.computation && <ComputationBlock c={det.computation} />}

      <div style={{ margin: "0 0 12px" }}>
        <Markdown size={14} color="#33312c">
          {det.whatToDo}
        </Markdown>
      </div>

      {det.explanation && (
        <div style={{ margin: "0 0 12px" }}>
          <div style={{ ...cap, marginBottom: 8 }}>Why, and what to check</div>
          <Markdown size={13.5} color="#5a564d">
            {det.explanation}
          </Markdown>
        </div>
      )}

      {det.confirmWithFA && (
        <div
          style={{
            borderLeft: "2px solid #c9952a",
            paddingLeft: 12,
            fontSize: 12.5,
            color: "#9a6b18",
            marginBottom: 12,
          }}
        >
          Confirm with Finance &amp; Accounts before acting.
        </div>
      )}

      {det.citations.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ ...cap, marginBottom: 8 }}>Sources</div>
          {det.citations.map((x, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "6px 0",
                borderTop: "1px solid #f1f1ee",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{x.articleRef}</span>
              {x.sourceUrl && (
                <a
                  href={x.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12.5,
                    color: "#1a1a1a",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    textDecorationColor: "#cdcdc8",
                    marginLeft: "auto",
                  }}
                >
                  source ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
