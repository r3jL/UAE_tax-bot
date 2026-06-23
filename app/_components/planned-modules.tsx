"use client";

import {
  ALERTS,
  HISTORY,
  HIST_MAP,
  INVOICE_FIELDS,
  MODULES,
  QUEUE,
  REGISTER,
  REPORTS,
  RETURN_ROWS,
  SERIF,
  STATUS_MAP,
  TILES,
  type ModuleKey,
  type QueueItem,
  type Role,
} from "../_lib/lex-data";

interface PlannedModulesProps {
  module: Exclude<ModuleKey, "ask">;
  role: Role;
  onOpenDrawer: (item: QueueItem) => void;
  onSwitchReviewer: () => void;
}

const planned: React.CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: "#9a9a93",
  background: "#fafaf9",
  border: "1px dashed #e0e0db",
  borderRadius: 12,
  padding: "14px 16px",
};

const card: React.CSSProperties = {
  border: "1px solid #ececea",
  borderRadius: 14,
  padding: 22,
};

const pillBtn: React.CSSProperties = {
  border: "1px solid #e0e0db",
  borderRadius: 99,
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "9px 16px",
  cursor: "pointer",
};

const sourcesLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "#b4b4ae",
  marginBottom: 8,
};

export function PlannedModules({
  module,
  role,
  onOpenDrawer,
  onSwitchReviewer,
}: PlannedModulesProps) {
  const meta = MODULES[module];
  const isReviewer = role === "reviewer";

  return (
    <div className="lex-scroll" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 32px 60px" }}>
        {/* heading */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: 25,
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: "-.01em",
                }}
              >
                {meta.title}
              </h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "#8a8a85",
                  background: "#f0efec",
                  border: "1px solid #e4e3df",
                  borderRadius: 5,
                  padding: "3px 8px",
                }}
              >
                Planned
              </span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#6b6b66", margin: "9px 0 0" }}>
              {meta.desc}
            </p>
          </div>
        </div>

        {module === "vendor" && <VendorModule />}
        {module === "invoice" && <InvoiceModule />}
        {module === "register" && <RegisterModule />}
        {module === "queue" && (
          <QueueModule
            isReviewer={isReviewer}
            onOpenDrawer={onOpenDrawer}
            onSwitchReviewer={onSwitchReviewer}
          />
        )}
        {module === "alerts" && <AlertsModule />}
        {module === "reports" && <ReportsModule />}
        {module === "history" && <HistoryModule />}
      </div>
    </div>
  );
}

// ── Vendor VAT Check ─────────────────────────────────────────────────────────
function VendorModule() {
  return (
    <>
      <div style={{ ...card, marginBottom: 20 }}>
        <label
          style={{
            display: "block",
            fontSize: 12.5,
            fontWeight: 600,
            color: "#3a3a36",
            marginBottom: 9,
          }}
        >
          Describe the transaction or vendor
        </label>
        <div
          style={{
            border: "1px solid #e0e0db",
            borderRadius: 14,
            background: "#fafaf9",
            padding: "14px 16px",
            fontSize: 14.5,
            color: "#6b6b66",
            lineHeight: 1.5,
          }}
        >
          Imported consulting services from the UK, AED 50,000, supplier not
          VAT-registered in the UAE.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            style={{
              border: "none",
              borderRadius: 99,
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 600,
              padding: "11px 22px",
              cursor: "pointer",
            }}
          >
            Run check
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#b4b4ae",
            }}
          >
            Sample determination
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#9a6b18",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9952a" }} />
            Medium confidence
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#1a1a1a",
              background: "#f0efec",
              borderRadius: 8,
              padding: "7px 13px",
            }}
          >
            Treatment · Reverse charge
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#2f7a52",
              background: "#eaf3ee",
              borderRadius: 8,
              padding: "7px 13px",
            }}
          >
            Input VAT · Recoverable
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "#9a9a93",
            marginBottom: 6,
          }}
        >
          What to do next
        </div>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: 16,
            lineHeight: 1.72,
            color: "#1f1f1c",
            margin: "0 0 16px",
          }}
        >
          Self-account for 5% output VAT on the imported service and recover the same
          amount as input VAT on the next return (net nil where fully recoverable). Retain
          the supplier invoice and proof of import in your records.
        </p>
        <div style={sourcesLabel}>Sources</div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            padding: "7px 0",
            borderTop: "1px solid #f1f1ee",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Article 48 (reverse charge)</span>
          <span style={{ fontSize: 12.5, color: "#a8a8a2", flex: 1 }}>
            Effective 2018-01-01
          </span>
          <a
            href="https://tax.gov.ae/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: "#1a1a1a",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              textDecorationColor: "#cdcdc8",
            }}
          >
            source ↗
          </a>
        </div>
      </div>

      <div style={planned}>
        Planned: live engine that scores treatment and routes low-confidence cases to the
        Review Queue automatically.
      </div>
    </>
  );
}

// ── Invoice Upload ───────────────────────────────────────────────────────────
function InvoiceModule() {
  return (
    <>
      <div
        style={{
          border: "2px dashed #dcdcd7",
          borderRadius: 16,
          padding: "46px 24px",
          textAlign: "center",
          background: "#fafaf9",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #ececea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            fontSize: 22,
            color: "#9a9a93",
          }}
        >
          ↥
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          Drag &amp; drop a PDF or image invoice
        </div>
        <div style={{ fontSize: 13, color: "#9a9a93", marginTop: 5 }}>
          or{" "}
          <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
            browse files
          </span>{" "}
          — PDF, JPG or PNG up to 10MB
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={{ ...card, padding: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "#b4b4ae",
              marginBottom: 12,
            }}
          >
            Extracted fields — confirm
          </div>
          {INVOICE_FIELDS.map((f) => (
            <div
              key={f.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 0",
                borderTop: "1px solid #f1f1ee",
              }}
            >
              <span style={{ fontSize: 13, color: "#9a9a93" }}>{f.k}</span>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "#1a1a1a",
                  textAlign: "right",
                }}
              >
                {f.v}
              </span>
            </div>
          ))}
          <button
            style={{
              width: "100%",
              marginTop: 14,
              border: "1px solid #e0e0db",
              borderRadius: 99,
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 0",
              cursor: "pointer",
            }}
          >
            Confirm &amp; run VAT check
          </button>
        </div>

        <div style={{ ...card, padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "#b4b4ae",
              }}
            >
              Treatment
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#9a6b18",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9952a" }} />
              Medium
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
              marginBottom: 14,
            }}
          >
            Reverse charge
          </span>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "#5a564d", margin: 0 }}>
            Self-account for 5% output VAT and recover as input VAT, subject to use.
            Treatment derived from the extracted vendor country and tax shown.
          </p>
        </div>
      </div>

      <div style={planned}>
        Planned: OCR extraction and field confirmation before the determination is run.
      </div>
    </>
  );
}

// ── Compliance Register & Deadlines ──────────────────────────────────────────
function RegisterModule() {
  const headerCell: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: ".05em",
    textTransform: "uppercase",
    color: "#9a9a93",
  };
  const cols = "1.7fr 1.4fr 1fr 1fr .9fr 1fr";

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 22,
        }}
      >
        {TILES.map((t) => (
          <div key={t.label} style={{ ...card, padding: 18 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: t.color,
                fontFamily: SERIF,
                lineHeight: 1,
              }}
            >
              {t.n}
            </div>
            <div style={{ fontSize: 12.5, color: "#6b6b66", marginTop: 8 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        <button style={pillBtn}>Email reminders</button>
        <button style={pillBtn}>Export Excel</button>
        <button style={pillBtn}>Export PDF</button>
      </div>

      <div style={{ border: "1px solid #ececea", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            background: "#fafaf9",
            borderBottom: "1px solid #ececea",
            padding: "11px 18px",
          }}
        >
          <span style={headerCell}>Entity</span>
          <span style={headerCell}>Type</span>
          <span style={headerCell}>Due</span>
          <span style={headerCell}>Frequency</span>
          <span style={headerCell}>Authority</span>
          <span style={headerCell}>Status</span>
        </div>
        {REGISTER.map((r, i) => {
          const s = STATUS_MAP[r.status];
          const overdue = r.status === "Overdue";
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                alignItems: "center",
                padding: "13px 18px",
                borderBottom: "1px solid #f4f3f0",
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{r.entity}</span>
              <span style={{ fontSize: 13, color: "#5a564d" }}>{r.type}</span>
              <span
                style={{
                  fontSize: 13,
                  color: overdue ? "#b0453a" : "#5a564d",
                  fontWeight: overdue ? 600 : 400,
                }}
              >
                {r.due}
              </span>
              <span style={{ fontSize: 13, color: "#5a564d" }}>{r.freq}</span>
              <span style={{ fontSize: 13, color: "#5a564d" }}>{r.authority}</span>
              <span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: s.color,
                    background: s.bg,
                    borderRadius: 99,
                    padding: "4px 10px",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                  {r.status}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Review Queue ─────────────────────────────────────────────────────────────
function QueueModule({
  isReviewer,
  onOpenDrawer,
  onSwitchReviewer,
}: {
  isReviewer: boolean;
  onOpenDrawer: (item: QueueItem) => void;
  onSwitchReviewer: () => void;
}) {
  if (!isReviewer) {
    return (
      <div
        style={{
          border: "1px solid #ececea",
          borderRadius: 16,
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: "#f7efdd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            fontSize: 20,
            color: "#9a6b18",
          }}
        >
          🔒
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Finance Reviewer only</div>
        <p
          style={{
            fontSize: 14,
            color: "#6b6b66",
            margin: "8px auto 16px",
            maxWidth: 380,
            lineHeight: 1.6,
          }}
        >
          The review queue holds escalated questions and flagged determinations awaiting
          sign-off. Switch your view to Reviewer to see it.
        </p>
        <button
          onClick={onSwitchReviewer}
          style={{
            border: "none",
            borderRadius: 99,
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          Switch to Reviewer
        </button>
      </div>
    );
  }

  return (
    <>
      {QUEUE.map((item, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #ececea",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#9a6b18",
                    background: "#f7efdd",
                    borderRadius: 5,
                    padding: "3px 8px",
                  }}
                >
                  {item.type}
                </span>
                <span style={{ fontSize: 12, color: "#a8a8a2" }}>
                  {item.from} · {item.when}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.45 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: "#6b6b66", marginTop: 6 }}>
                Reason: {item.reason}
              </div>
            </div>
            <button
              onClick={() => onOpenDrawer(item)}
              style={{
                flex: "none",
                border: "1px solid #e0e0db",
                borderRadius: 99,
                background: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 15px",
                cursor: "pointer",
              }}
            >
              Review
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid #f4f3f0",
            }}
          >
            <button
              style={{
                border: "none",
                borderRadius: 99,
                background: "#1a1a1a",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Approve
            </button>
            <button style={{ ...pillBtn, padding: "8px 16px" }}>Edit answer</button>
            <button style={{ ...pillBtn, padding: "8px 16px", color: "#b0453a" }}>
              Send back
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Change Alerts ────────────────────────────────────────────────────────────
function AlertsModule() {
  return (
    <>
      {ALERTS.map((al, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 14,
            border: "1px solid #ececea",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: al.dot,
              flex: "none",
              marginTop: 6,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                alignItems: "baseline",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{al.title}</div>
              <span style={{ fontSize: 12, color: "#a8a8a2", flex: "none" }}>{al.date}</span>
            </div>
            <div style={{ fontSize: 13.5, color: "#6b6b66", marginTop: 6 }}>{al.impact}</div>
            {al.needsReview && (
              <button style={{ ...pillBtn, marginTop: 11, padding: "7px 14px" }}>
                Re-review affected items
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Reports & Draft Returns ──────────────────────────────────────────────────
function ReportsModule() {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 22,
        }}
      >
        {REPORTS.map((rp, i) => (
          <div key={i} style={{ ...card, padding: "18px 20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{rp.name}</div>
              {rp.draft && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: ".07em",
                    textTransform: "uppercase",
                    color: "#6b6b66",
                    background: "#f0efec",
                    border: "1px solid #e4e3df",
                    borderRadius: 5,
                    padding: "3px 7px",
                  }}
                >
                  Draft
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#9a9a93", marginTop: 6 }}>{rp.meta}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>
            VAT Return — Q2 2026
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".07em",
              textTransform: "uppercase",
              color: "#6b6b66",
              background: "#f0efec",
              border: "1px solid #e4e3df",
              borderRadius: 5,
              padding: "4px 9px",
            }}
          >
            Draft — never filed by Lex
          </span>
        </div>
        {RETURN_ROWS.map((rr, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "11px 0",
              borderTop: "1px solid #f1f1ee",
            }}
          >
            <span style={{ fontSize: 13.5, color: "#5a564d" }}>{rr.label}</span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {rr.val}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 12, color: "#9a9a93", marginTop: 14 }}>
          Every figure is traceable to source determinations and invoices. Review and file
          through the FTA portal yourself.
        </div>
      </div>
    </>
  );
}

// ── History ──────────────────────────────────────────────────────────────────
function HistoryModule() {
  return (
    <>
      {HISTORY.map((h, i) => {
        const hm = HIST_MAP[h.status];
        return (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              border: "1px solid #ececea",
              borderRadius: 12,
              padding: "15px 18px",
              marginBottom: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.4 }}>{h.q}</div>
              <div style={{ fontSize: 12.5, color: "#9a9a93", marginTop: 5 }}>
                {h.when} · {h.refs}
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600,
                color: hm.color,
                background: hm.bg,
                borderRadius: 99,
                padding: "4px 11px",
                flex: "none",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: hm.color }} />
              {hm.label}
            </span>
          </div>
        );
      })}
    </>
  );
}
