"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";
import { PlannedModules } from "./_components/planned-modules";
import { Drawer } from "./_components/drawer";
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

    setQ("");
    if (filterOverride) setFilter(filterOverride);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setLoading(true);

    let resp: AnswerResult;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          taxType: filterToTaxType(effFilter),
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Request failed");
      resp = data as AnswerResult;
    } catch {
      // Offline / unconfigured backend: fall back to the canned sample matcher
      // so the workspace stays demonstrable on its own.
      resp = resolveSample(trimmed);
    }

    setMessages((m) => [...m, { role: "assistant", resp, showReasoning: false }]);
    setLoading(false);
  }

  function ask() {
    void send(q);
  }

  function pick(key: string) {
    const s = SAMPLES.find((x) => x.key === key);
    if (s && !loading) {
      setModule("ask");
      void send(s.q, s.filter);
    }
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
        <Topbar module={module} role={role} />

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
                        guess when the law can&apos;t settle it.
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
                      <UserMessage key={i} text={m.text} first={i === 0} />
                    ) : (
                      <AssistantMessage
                        key={i}
                        resp={m.resp}
                        showReasoning={m.showReasoning}
                        onToggle={() => toggleMsg(i)}
                      />
                    ),
                  )}

                  {loading && <TypingIndicator />}
                </div>
              </div>

              <Composer
                q={q}
                filter={filter}
                loading={loading}
                onQ={setQ}
                onFilter={setFilter}
                onKeyDown={onKeyDown}
                onAsk={ask}
              />
            </>
          ) : (
            <PlannedModules
              module={module}
              role={role}
              onOpenDrawer={setDrawer}
              onSwitchReviewer={() => setRole("reviewer")}
            />
          )}
        </div>
      </div>

      <Drawer item={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

// ── Ask thread pieces ────────────────────────────────────────────────────────

function UserMessage({ text, first }: { text: string; first: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        margin: first ? "0 0 4px" : "26px 0 4px",
        animation: "lexrise .3s ease both",
      }}
    >
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
  const answerParas = resp.answer ? resp.answer.split("\n\n") : [];
  const reasoningLines = resp.reasoning ? resp.reasoning.split("\n") : [];
  const hasCitations = resp.citations && resp.citations.length > 0;

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
            {resp.escalationReason}
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
          {answerParas.map((para, i) => (
            <p
              key={i}
              style={{
                fontFamily: SERIF,
                fontSize: 16.5,
                lineHeight: 1.72,
                color: "#1f1f1c",
                margin: "0 0 14px",
              }}
            >
              {para}
            </p>
          ))}
        </>
      )}

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
            {reasoningLines.map((line, i) => (
              <div
                key={i}
                style={{ fontSize: 14, lineHeight: 1.6, color: "#6b6b66", marginBottom: 6 }}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

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

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "18px 0 30px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".13em", color: "#b4b4ae" }}>
        LEX
      </span>
      <span style={{ fontSize: 13, color: "#a8a8a2" }}>Reviewing FTA law</span>
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

function Composer({
  q,
  filter,
  loading,
  onQ,
  onFilter,
  onKeyDown,
  onAsk,
}: {
  q: string;
  filter: TaxFilter;
  loading: boolean;
  onQ: (v: string) => void;
  onFilter: (v: TaxFilter) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAsk: () => void;
}) {
  return (
    <div style={{ flex: "none", borderTop: "1px solid #ececea" }}>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "14px 28px 16px" }}>
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
              gap: 8,
              border: "1px solid #e0e0db",
              borderRadius: 24,
              background: "#fff",
              padding: "6px 6px 6px 18px",
            }}
          >
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
