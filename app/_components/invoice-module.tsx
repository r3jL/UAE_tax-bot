"use client";

import { useRef, useState } from "react";
import {
  CONF_MAP,
  INVOICE_FIELD_LABELS,
  INVOICE_LANGUAGE_LABELS,
  MISMATCH_LABELS,
  RECOVERABLE_LABELS,
  SAMPLE_INVOICE,
  SERIF,
  treatmentLabel,
  type Determination,
  type InvoiceFieldsData,
  type SupplyType,
  type VatComputationData,
} from "../_lib/lex-data";
import { Markdown } from "./markdown";

const card: React.CSSProperties = { border: "1px solid #ececea", borderRadius: 14 };
const cap: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#b4b4ae",
  marginBottom: 12,
};

const money = (n: number | null | undefined, cur: string) =>
  n == null ? "—" : `${cur} ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function mismatchColor(s: VatComputationData["mismatch"]["status"]) {
  return s === "match" ? "#2f7a52" : s === "unknown" ? "#9a9a93" : "#b0453a";
}

function friendlyErr(e: unknown): string {
  const err = e as Error;
  if (err?.name === "TimeoutError" || /abort|timed? ?out/i.test(err?.message ?? "")) {
    return "Timed out — the model took too long to respond. Please try again.";
  }
  return err?.message ?? "Request failed";
}

// Small inline loading spinner.
function Spinner({ size = 14, color = "#9a9a93" }: { size?: number; color?: string }) {
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

// Filename in a small left-right scrollable box (long names don't overflow).
function FileName({ name, color = "#a8a8a2", size = 11.5 }: { name: string; color?: string; size?: number }) {
  return (
    <div className="lex-xscroll" style={{ maxWidth: "100%", fontSize: size, color }}>
      {name}
    </div>
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

type Phase = "idle" | "extracting" | "review" | "determining" | "done";
interface BulkRow {
  name: string;
  status: "pending" | "processing" | "done" | "error";
  vendor?: string;
  det?: Determination;
  error?: string;
}

export function InvoiceModule() {
  // selected-but-not-yet-processed files
  const [pending, setPending] = useState<File[]>([]);
  // single-invoice state
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [fields, setFields] = useState<InvoiceFieldsData | null>(null);
  const [det, setDet] = useState<Determination | null>(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  // bulk state
  const [bulk, setBulk] = useState<BulkRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetAll() {
    setPending([]);
    setPhase("idle");
    setFileName("");
    setFields(null);
    setDet(null);
    setError("");
    setBulk([]);
    setExpanded(null);
  }

  // Load a SIMULATED invoice result instantly — no upload / model call.
  function loadSample() {
    resetAll();
    setFileName("sample_invoice.pdf");
    setFields(SAMPLE_INVOICE.fields);
    setDet(SAMPLE_INVOICE.determination);
    setPhase("done");
  }

  // Selecting files no longer auto-processes — it stages them for a button click.
  function onFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    resetAll();
    setPending(files);
  }

  function startProcessing() {
    const files = pending;
    if (!files.length) return;
    setPending([]);
    if (files.length === 1) void onFile(files[0]);
    else void runBulk(files);
  }

  async function onFile(file: File) {
    setFileName(file.name);
    setBulk([]);
    setError("");
    setDet(null);
    setFields(null);
    setPhase("extracting");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/invoice/extract", {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(70_000),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Extraction failed");
      setFields(data as InvoiceFieldsData);
      setPhase("review");
    } catch (e) {
      setError(friendlyErr(e));
      setPhase("idle");
    }
  }

  function setField<K extends keyof InvoiceFieldsData>(k: K, v: InvoiceFieldsData[K]) {
    setFields((f) => (f ? { ...f, [k]: v } : f));
  }

  async function runCheck() {
    if (!fields) return;
    setPhase("determining");
    setError("");
    setDet(null);
    try {
      const res = await fetch("/api/invoice/determine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
        signal: AbortSignal.timeout(75_000),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Determination failed");
      setDet(data as Determination);
      setPhase("done");
    } catch (e) {
      setError(friendlyErr(e));
      setPhase("review");
    }
  }

  async function runBulk(files: File[]) {
    setFields(null);
    setDet(null);
    setError("");
    setExpanded(null);
    const rows: BulkRow[] = files.map((f) => ({ name: f.name, status: "pending" }));
    setBulk([...rows]);
    for (let i = 0; i < files.length; i++) {
      // Space out files to stay under per-minute rate limits.
      if (i > 0) await new Promise((r) => setTimeout(r, 2500));
      rows[i] = { ...rows[i], status: "processing" };
      setBulk([...rows]);
      try {
        const fd = new FormData();
        fd.append("file", files[i]);
        const res = await fetch("/api/invoice/process", {
          method: "POST",
          body: fd,
          signal: AbortSignal.timeout(130_000),
        });
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error ?? "Failed");
        rows[i] = {
          ...rows[i],
          status: "done",
          vendor: data.fields?.vendorName,
          det: data.determination as Determination,
        };
      } catch (e) {
        rows[i] = { ...rows[i], status: "error", error: friendlyErr(e) };
      }
      setBulk([...rows]);
    }
  }

  const busy = phase === "extracting" || phase === "determining";
  const bulkBusy = bulk.some((r) => r.status === "pending" || r.status === "processing");

  return (
    <>
      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${drag ? "#9a9a93" : "#e0e0db"}`,
          borderRadius: 14,
          background: drag ? "#f6f6f4" : "#fafaf9",
          textAlign: "center",
          padding: "26px 20px",
          cursor: "pointer",
          marginBottom: 18,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        {phase === "extracting" ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <Spinner size={20} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Reading the document…</div>
            <div style={{ fontSize: 13, color: "#9a9a93", marginTop: 5 }}>
              <FileName name={fileName} size={13} />
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, color: "#9a9a93", marginBottom: 10 }}>↥</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Drag & drop one or more invoices</div>
            <div style={{ fontSize: 13, color: "#9a9a93", marginTop: 5 }}>
              or browse files — PDF, JPG or PNG up to 4 MB. Drop several to run a batch.
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: -8, marginBottom: 18 }}>
        <button
          onClick={loadSample}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#8a8a85",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            textDecorationColor: "#d8d8d2",
          }}
        >
          Try a sample invoice (demo)
        </button>
      </div>

      {/* Staged files — choose Process / Batch process */}
      {pending.length > 0 && (
        <div style={{ ...card, padding: 16, marginBottom: 18, animation: "lexrise .25s ease both" }}>
          <div style={{ ...cap, marginBottom: 10 }}>
            {pending.length === 1 ? "1 document ready" : `${pending.length} documents ready`}
          </div>
          {pending.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
                borderTop: i ? "1px solid #f4f4f1" : "none",
              }}
            >
              <span style={{ fontSize: 13, color: "#9a9a93", flex: "none" }}>↳</span>
              <FileName name={f.name} color="#33312c" size={13} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={startProcessing}
              style={{
                flex: 1,
                border: "1px solid #1a1a1a",
                borderRadius: 99,
                background: "#1a1a1a",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 0",
                cursor: "pointer",
              }}
            >
              {pending.length === 1 ? "Process" : `Batch process ${pending.length} documents`}
            </button>
            <button
              onClick={() => setPending([])}
              style={{
                border: "1px solid #e0e0db",
                borderRadius: 99,
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
                color: "#6b6b66",
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            border: "1px solid #e7c9c4",
            background: "#fbf2f1",
            color: "#9a3b30",
            borderRadius: 12,
            padding: "11px 15px",
            fontSize: 13.5,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Bulk results table ── */}
      {bulk.length > 0 && (
        <div style={{ ...card, padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={{ ...cap, marginBottom: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              Batch — {bulk.filter((r) => r.status === "done").length}/{bulk.length} done
              {bulkBusy && <Spinner size={11} />}
            </span>
            {!bulkBusy && (
              <button
                onClick={resetAll}
                style={{
                  border: "1px solid #e0e0db",
                  borderRadius: 99,
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >
                New batch
              </button>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 0.8fr",
              gap: 8,
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "#b4b4ae",
              padding: "0 0 8px",
            }}
          >
            <span>File / Vendor</span>
            <span>Treatment</span>
            <span>VAT check</span>
            <span>Recoverable</span>
            <span>Review</span>
          </div>
          {bulk.map((r, i) => {
            const c = r.det?.computation;
            return (
              <div key={i}>
                <div
                  onClick={() => r.det && setExpanded(expanded === i ? null : i)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 0.8fr",
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: "1px solid #f1f1ee",
                    fontSize: 13,
                    cursor: r.det ? "pointer" : "default",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 500, color: "#1a1a1a" }}>
                      {r.vendor || r.name}
                    </span>
                    <FileName name={r.name} />
                  </span>
                  {r.status === "done" && r.det ? (
                    <>
                      <span style={{ color: "#33312c" }}>{treatmentLabel(r.det.treatment, r.det.computation)}</span>
                      <span
                        style={{
                          color: c ? mismatchColor(c.mismatch.status) : "#9a9a93",
                          fontWeight: 600,
                          fontSize: 12.5,
                        }}
                      >
                        {c ? MISMATCH_LABELS[c.mismatch.status] : "—"}
                      </span>
                      <span style={{ color: "#1a1a1a" }}>
                        {c ? money(c.recoverableInputVat, c.currency) : "—"}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: r.det.confirmWithFA ? "#9a6b18" : "#2f7a52",
                        }}
                      >
                        {r.det.confirmWithFA ? "F&A" : "OK"}
                      </span>
                    </>
                  ) : (
                    <span
                      style={{
                        gridColumn: "2 / 6",
                        color: "#9a9a93",
                        fontSize: 12.5,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {r.status === "processing" ? (
                        <>
                          <Spinner size={11} /> Processing…
                        </>
                      ) : r.status === "pending" ? (
                        "Queued"
                      ) : (
                        `Error — ${r.error ?? "failed"}`
                      )}
                    </span>
                  )}
                </div>
                {expanded === i && r.det && (
                  <div
                    style={{
                      padding: "0 0 14px 2px",
                      borderTop: "1px solid #f8f8f6",
                      background: "#fcfcfb",
                      animation: "lexrise .25s ease both",
                    }}
                  >
                    <div style={{ margin: "10px 0" }}>
                      <Markdown size={13.5} color="#33312c">
                        {r.det.whatToDo}
                      </Markdown>
                    </div>
                    {r.det.computation && <ComputationBlock c={r.det.computation} />}
                    {r.det.citations.length > 0 && (
                      <div style={{ fontSize: 12, color: "#6b6b66" }}>
                        Sources: {r.det.citations.map((x) => x.articleRef).join("; ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Single invoice flow ── */}
      {bulk.length === 0 && fields && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, animation: "lexrise .3s ease both" }}>
          {/* Extracted fields */}
          <div style={{ ...card, padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span style={{ ...cap, marginBottom: 0 }}>Extracted fields — confirm</span>
              {(() => {
                const hasArabic = fields.language === "ar" || fields.language === "mixed";
                return (
                  <span
                    title={
                      hasArabic
                        ? "Arabic text detected on this invoice — fields were read and translated from Arabic."
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
                );
              })()}
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
                  onChange={(e) => setField(key, e.target.value as never)}
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
                    <span style={{ color: "#1a1a1a", fontWeight: 500, flex: "none" }}>
                      {li.amount}
                    </span>
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
                onChange={(e) => setField("supplyType", e.target.value as SupplyType)}
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
            <button
              onClick={runCheck}
              disabled={busy}
              style={{
                width: "100%",
                marginTop: 16,
                border: "1px solid #1a1a1a",
                borderRadius: 99,
                background: busy ? "#f0efec" : "#1a1a1a",
                color: busy ? "#9a9a93" : "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 0",
                cursor: busy ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {phase === "determining" ? (
                <>
                  <Spinner size={13} color="#9a9a93" /> Checking VAT law…
                </>
              ) : (
                "Confirm & run VAT check"
              )}
            </button>
          </div>

          {/* Treatment + computed numbers */}
          <div style={{ ...card, padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span style={{ ...cap, marginBottom: 0 }}>Treatment</span>
              {det && (
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
              )}
            </div>

            {!det && (
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "#9a9a93", display: "flex", alignItems: "center", gap: 9 }}>
                {phase === "determining" ? (
                  <>
                    <Spinner /> Retrieving the relevant VAT provisions…
                  </>
                ) : (
                  "Confirm the fields, then run the check to see the cited treatment."
                )}
              </div>
            )}

            {det && (
              <div style={{ animation: "lexrise .3s ease both" }}>
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
            )}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: "#a8a8a2", marginTop: 18, fontFamily: SERIF }}>
        Lex reads each invoice, applies the cited rule, and computes the numbers in code — a person
        reviews before anything is recorded. Lex never files.
      </p>
    </>
  );
}
