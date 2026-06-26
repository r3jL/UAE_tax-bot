"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";
import { PlannedModules } from "./_components/planned-modules";
import { Drawer } from "./_components/drawer";
import { Markdown } from "./_components/markdown";
import {
  CONF_MAP,
  SAMPLES,
  SERIF,
  filterToTaxType,
  resolveSample,
  type AnswerResult,
  type Message,
  type ModuleKey,
  type QueueItem,
  type Role,
  type TaxFilter,
} from "./_lib/lex-data";

export default function Workspace() {
  const [module, setModule] = useState<ModuleKey>("ask");
  const [role, setRole] = useState<Role>("staff");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<TaxFilter>("All");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Reviewing FTA law");
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drawer, setDrawer] = useState<QueueItem | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the thread pinned to the latest message, like the comp.
  useEffect(() => {
    if (module === "ask" && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading, module]);

  async function send(text: string, filterOverride?: TaxFilter) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const effFilter = filterOverride ?? filter;
    const attached = files;

    setQ("");
    setFiles([]);
    if (filterOverride) setFilter(filterOverride);
    setMessages((m) => [
      ...m,
      {
        role: "user",
        text: trimmed,
        files: attached.length ? attached.map((f) => f.name) : undefined,
      },
    ]);
    setLoadingLabel(attached.length ? "Reading your document" : "Reviewing FTA law");
    setLoading(true);

    let resp: AnswerResult;
    try {
      const taxType = filterToTaxType(effFilter);
      let res: Response;
      if (attached.length) {
        // With attachments we send multipart so the files ride along; the server
        // extracts their text and uses it as extra context.
        const fd = new FormData();
        fd.append("question", trimmed);
        if (taxType) fd.append("taxType", taxType);
        attached.forEach((f) => fd.append("files", f));
        res = await fetch("/api/chat", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, taxType }),
        });
      }
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Request failed");
      resp = data as AnswerResult;
    } catch (err) {
      if (attached.length) {
        // For a document question, a canned sample would be nonsense — surface
        // the real problem (e.g. a scanned PDF) as a clear escalation instead.
        resp = {
          status: "escalate",
          answer: "",
          reasoning: "",
          citations: [],
          confidence: "low",
          flaggedPremise: null,
          escalationReason:
            (err as Error)?.message || "I couldn't read the attached file. Please try another copy.",
        };
      } else {
        // Offline / unconfigured backend: fall back to the canned sample matcher
        // so the workspace stays demonstrable on its own.
        resp = resolveSample(trimmed);
      }
    }

    setMessages((m) => [...m, { role: "assistant", resp, showReasoning: false }]);
    setLoading(false);
  }

  function ask() {
    void send(q);
  }

  // Sample chips show a SIMULATED (canned) answer instantly — no backend call.
  // Lets the workspace demo reliably regardless of model availability.
  function pick(key: string) {
    const s = SAMPLES.find((x) => x.key === key);
    if (!s || loading) return;
    setModule("ask");
    setFilter(s.filter);
    setMessages((m) => [...m, { role: "user", text: s.q }]);
    setLoading(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", resp: s.resp, showReasoning: false }]);
      setLoading(false);
    }, 800);
  }

  function toggleMsg(idx: number) {
    setMessages((m) =>
      m.map((msg, i) =>
        i === idx && msg.role === "assistant"
          ? { ...msg, showReasoning: !msg.showReasoning }
          : msg,
      ),
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  function go(key: ModuleKey) {
    setModule(key);
    setDrawer(null);
  }

  const empty = messages.length === 0 && !loading;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        background: "#fff",
        color: "#1a1a1a",
        overflow: "hidden",
      }}
    >
      <Sidebar module={module} role={role} onNavigate={go} onSetRole={setRole} />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Topbar module={module} />

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {module === "ask" ? (
            <>
              <div className="lex-scroll" ref={threadRef} style={{ flex: 1, overflowY: "auto" }}>
                <div style={{ maxWidth: 740, margin: "0 auto", padding: "30px 28px 16px" }}>
                  {empty && (
                    <div style={{ marginTop: 20 }}>
                      <div
                        style={{
                          fontFamily: SERIF,
                          fontSize: 28,
                          fontWeight: 600,
                          lineHeight: 1.2,
                          letterSpacing: "-.01em",
                        }}
                      >
                        How can I help with UAE tax?
                      </div>
                      <p
                        style={{
                          fontSize: 16,
                          lineHeight: 1.65,
                          color: "#6b6b66",
                          margin: "12px 0 0",
                          maxWidth: 560,
                        }}
                      >
                        Ask a Corporate Tax or VAT question. I answer from official UAE FTA
                        law with citations — and escalate to your finance team rather than
                        guess when the law can&apos;t settle it. You can also attach a
                        contract or invoice (PDF or image) and ask about it.
                      </p>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 22,
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#b4b4ae", fontWeight: 500 }}>
                          Try
                        </span>
                        {SAMPLES.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => pick(s.key)}
                            style={{
                              border: "1px solid #e6e6e2",
                              background: "#fff",
                              borderRadius: 99,
                              padding: "6px 13px",
                              fontSize: 12,
                              color: "#6b6b66",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <UserMessage key={i} text={m.text} files={m.files} first={i === 0} />
                    ) : (
                      <AssistantMessage
                        key={i}
                        resp={m.resp}
                        showReasoning={m.showReasoning}
                        onToggle={() => toggleMsg(i)}
                      />
                    ),
                  )}

                  {loading && <TypingIndicator label={loadingLabel} />}
                </div>
              </div>

              <Composer
                q={q}
                filter={filter}
                loading={loading}
                files={files}
                onQ={setQ}
                onFilter={setFilter}
                onFiles={setFiles}
                onKeyDown={onKeyDown}
                onAsk={ask}
              />
            </>
          ) : (
            <PlannedModules module={module} />
          )}
        </div>
      </div>

      <Drawer item={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

// ── Ask thread pieces ────────────────────────────────────────────────────────

function UserMessage({
  text,
  files,
  first,
}: {
  text: string;
  files?: string[];
  first: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        margin: first ? "0 0 4px" : "26px 0 4px",
        animation: "lexrise .3s ease both",
      }}
    >
      {files && files.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "flex-end",
            maxWidth: "80%",
            marginBottom: 6,
          }}
        >
          {files.map((name, i) => (
            <span
              key={i}
              title={name}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                maxWidth: 220,
                background: "#fff",
                border: "1px solid #e6e6e2",
                borderRadius: 10,
                padding: "5px 10px",
                fontSize: 12,
                color: "#5a564d",
              }}
            >
              <span style={{ flex: "none" }}>📄</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
            </span>
          ))}
        </div>
      )}
      <div
        style={{
          maxWidth: "80%",
          background: "#f3f2ee",
          borderRadius: "16px 16px 5px 16px",
          padding: "12px 16px",
          fontSize: 15.5,
          lineHeight: 1.5,
          fontFamily: SERIF,
        }}
      >
        {text}
      </div>
    </div>
  );
}

// Strip internal [chunkId:N] / 【chunkId:N】 tags (and the debris they leave)
// from model text before it's shown to the user — citations live in their own
// Sources block, so these markers are noise in the prose.
function stripRefs(text: string): string {
  return text
    .replace(/[【[]\s*chunk\s*id\s*[:#]?\s*\d+\s*[\]】]/gi, "")
    .replace(/chunk\s*id\s*[:#]?\s*\d+/gi, "")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim();
}

function AssistantMessage({
  resp,
  showReasoning,
  onToggle,
}: {
  resp: AnswerResult;
  showReasoning: boolean;
  onToggle: () => void;
}) {
  const isEscalate = resp.status === "escalate";
  const isAnswered = resp.status === "answered";
  const conf = CONF_MAP[resp.confidence] ?? CONF_MAP.low;
  const cleanAnswer = stripRefs(resp.answer ?? "");
  const cleanReasoning = stripRefs(resp.reasoning ?? "");
  const hasReasoning = cleanReasoning.length > 0;
  // Only answered responses have grounded sources to show; escalations don't.
  const hasCitations = isAnswered && resp.citations && resp.citations.length > 0;

  return (
    <div style={{ margin: "18px 0 30px", animation: "lexrise .35s ease both" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".13em", color: "#b4b4ae" }}>
          LEX
        </span>
        {isAnswered && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12.5,
              fontWeight: 600,
              color: conf.color,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: conf.color }} />
            {conf.label}
          </span>
        )}
        {isEscalate && (
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
            Escalated to review
          </span>
        )}
      </div>

      {isEscalate && (
        <div style={{ borderLeft: "2px solid #c9952a", padding: "2px 0 2px 16px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "#9a6b18",
              marginBottom: 6,
            }}
          >
            Why this needs a human
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.7, color: "#33312c" }}>
            {stripRefs(resp.escalationReason ?? "") ||
              "This one needs a finance reviewer's judgement before we can give a grounded answer."}
          </div>
        </div>
      )}

      {isAnswered && (
        <>
          {resp.flaggedPremise && (
            <div
              style={{
                borderLeft: "2px solid #c9952a",
                padding: "2px 0 2px 16px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "#9a6b18",
                  marginBottom: 5,
                }}
              >
                Check this assumption
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5a564d" }}>
                {resp.flaggedPremise}
              </div>
            </div>
          )}
          {cleanAnswer && <Markdown serif size={16.5}>{cleanAnswer}</Markdown>}
        </>
      )}

      {isAnswered && hasReasoning && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={onToggle}
            style={{
              border: "none",
              background: "none",
              padding: "4px 0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "#8a8a85",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 9, width: 9, display: "inline-block" }}>
              {showReasoning ? "▾" : "▸"}
            </span>
            {showReasoning ? "Hide reasoning" : "Show reasoning"}
          </button>
          {showReasoning && (
            <div style={{ marginTop: 8, borderLeft: "2px solid #ececea", paddingLeft: 16 }}>
              <Markdown size={14} color="#6b6b66">
                {cleanReasoning}
              </Markdown>
            </div>
          )}
        </div>
      )}

      {hasCitations && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#b4b4ae",
              marginBottom: 10,
            }}
          >
            Sources
          </div>
          {resp.citations.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "7px 0",
                borderTop: "1px solid #f1f1ee",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14.5, flex: "none" }}>
                {c.articleRef}
              </span>
              <span style={{ fontSize: 12.5, color: "#a8a8a2", flex: 1 }}>
                {c.effectiveDate ? `Effective ${c.effectiveDate}` : ""}
              </span>
              {c.sourceUrl && (
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13,
                    color: "#1a1a1a",
                    fontWeight: 500,
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    textDecorationColor: "#cdcdc8",
                    flex: "none",
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

function TypingIndicator({ label = "Reviewing FTA law" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "18px 0 30px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".13em", color: "#b4b4ae" }}>
        LEX
      </span>
      <span style={{ fontSize: 13, color: "#a8a8a2" }}>{label}</span>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {[0, 0.15, 0.3].map((delay) => (
          <span
            key={delay}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#b4b4ae",
              animation: `lexdot 1s infinite ${delay}s`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

const MAX_FILES = 4;
const FILE_ACCEPT = "image/*,application/pdf";

function Composer({
  q,
  filter,
  loading,
  files,
  onQ,
  onFilter,
  onFiles,
  onKeyDown,
  onAsk,
}: {
  q: string;
  filter: TaxFilter;
  loading: boolean;
  files: File[];
  onQ: (v: string) => void;
  onFilter: (v: TaxFilter) => void;
  onFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAsk: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    onFiles((prev) => {
      const merged = [...prev];
      for (const f of incoming) {
        if (merged.length >= MAX_FILES) break;
        if (!merged.some((p) => p.name === f.name && p.size === f.size)) merged.push(f);
      }
      return merged;
    });
  }

  return (
    <div style={{ flex: "none", borderTop: "1px solid #ececea" }}>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "14px 28px 16px" }}>
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {files.map((f, i) => (
              <span
                key={i}
                title={f.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  maxWidth: 240,
                  background: "#fff",
                  border: "1px solid #e6e6e2",
                  borderRadius: 10,
                  padding: "5px 8px 5px 10px",
                  fontSize: 12,
                  color: "#5a564d",
                }}
              >
                <span style={{ flex: "none" }}>📄</span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
                <button
                  type="button"
                  onClick={() => onFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                  style={{
                    flex: "none",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "#a8a8a2",
                    fontSize: 15,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ position: "relative", flex: "none" }}>
            <select
              value={filter}
              onChange={(e) => onFilter(e.target.value as TaxFilter)}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                border: "1px solid #e0e0db",
                borderRadius: 18,
                background: "#fff",
                padding: "0 34px 0 16px",
                height: 48,
                fontSize: 13.5,
                color: "#3a3a36",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <option>All</option>
              <option>Corporate Tax</option>
              <option>VAT</option>
            </select>
            <span
              style={{
                position: "absolute",
                right: 15,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#a8a8a2",
                fontSize: 10,
              }}
            >
              ▾
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
              border: "1px solid #e0e0db",
              borderRadius: 24,
              background: "#fff",
              padding: "6px 6px 6px 8px",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept={FILE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading || files.length >= MAX_FILES}
              title={
                files.length >= MAX_FILES
                  ? `Up to ${MAX_FILES} files`
                  : "Attach images or PDFs for context"
              }
              style={{
                flex: "none",
                width: 38,
                height: 38,
                border: "none",
                borderRadius: "50%",
                background: "none",
                color: files.length >= MAX_FILES ? "#cdcdc8" : "#8a8a85",
                cursor: loading || files.length >= MAX_FILES ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              value={q}
              onChange={(e) => onQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a UAE tax question…"
              rows={1}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                padding: "11px 0",
                fontSize: 15.5,
                lineHeight: 1.4,
                color: "#1a1a1a",
                resize: "none",
                fontFamily: SERIF,
                maxHeight: 120,
              }}
            />
            <button
              onClick={onAsk}
              disabled={loading}
              style={{
                flex: "none",
                width: 38,
                height: 38,
                border: "none",
                borderRadius: "50%",
                background: "#1a1a1a",
                color: "#fff",
                cursor: loading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {loading ? (
                <span
                  style={{
                    width: 15,
                    height: 15,
                    border: "2px solid rgba(255,255,255,.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "lexspin .7s linear infinite",
                  }}
                />
              ) : (
                <span style={{ fontSize: 18, lineHeight: 1 }}>↑</span>
              )}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#b4b4ae", marginTop: 10, textAlign: "center" }}>
          Decision-support only — a human reviews before use.
        </div>
      </div>
    </div>
  );
}
