"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./_components/sidebar";
import { PlannedModules } from "./_components/planned-modules";
import { Markdown } from "./_components/markdown";
import { UsernameGate } from "./_components/username-gate";
import { NotificationBell } from "./_components/notification-bell";
import {
  CONF_MAP,
  SERIF,
  filterToTaxType,
  resolveSample,
  type AnswerResult,
  type Message,
  type ModuleKey,
  type NotificationItem,
  type SessionSummary,
  type TaxFilter,
} from "./_lib/lex-data";

// Map a persisted session's rows back into the thread's Message shape.
function rowsToMessages(
  rows: { id: number; role: string; content: string; data: unknown }[],
): Message[] {
  return rows.map((r) => {
    const data = (r.data ?? {}) as Record<string, unknown>;
    if (r.role === "assistant") {
      return { role: "assistant", resp: r.data as AnswerResult, showReasoning: false };
    }
    if (r.role === "reviewer") {
      return {
        role: "reviewer",
        text: r.content,
        from: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
        messageId: r.id,
      };
    }
    const files = Array.isArray(data.files) ? (data.files as string[]) : undefined;
    return { role: "user", text: r.content, files: files?.length ? files : undefined };
  });
}

export default function Workspace() {
  const [module, setModule] = useState<ModuleKey>("ask");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<TaxFilter>("All");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Reviewing FTA law");
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // Identity + saved history.
  const [username, setUsername] = useState<string | null>(null);
  const [chosen, setChosen] = useState<boolean | null>(null); // null = still checking
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);

  // Bootstrap identity: has the user picked a username or guest yet?
  useEffect(() => {
    let active = true;
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setUsername(d.username ?? null);
        setChosen(!!d.chosen);
      })
      .catch(() => active && setChosen(true)); // fail open — never block the app
    return () => {
      active = false;
    };
  }, []);

  const refreshSessions = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => {});
  }, []);

  // Load history when a username is present. Guests keep the empty initial list;
  // switchUser() clears it explicitly, so no synchronous reset is needed here.
  useEffect(() => {
    if (username) refreshSessions();
  }, [username, refreshSessions]);

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
        if (activeSessionId) fd.append("sessionId", String(activeSessionId));
        attached.forEach((f) => fd.append("files", f));
        res = await fetch("/api/chat", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, taxType, sessionId: activeSessionId }),
        });
      }
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Request failed");
      resp = data as AnswerResult;
      // The server persists the turn for signed-in users and returns the session
      // it saved to; track it so follow-ups append, and refresh the sidebar.
      if (typeof data.sessionId === "number") {
        setActiveSessionId(data.sessionId);
        refreshSessions();
      }
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
  }

  function newChat() {
    setModule("ask");
    setMessages([]);
    setQ("");
    setFiles([]);
    setActiveSessionId(null);
  }

  // Load a saved thread into the Ask view — including any reviewer answer that
  // was sent back into it.
  async function loadSession(id: number) {
    setModule("ask");
    setQ("");
    setFiles([]);
    try {
      const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(rowsToMessages(data.messages ?? []));
      setActiveSessionId(id);
    } catch {
      /* session may have been deleted — ignore */
    }
  }

  async function deleteSession(id: number) {
    if (!window.confirm("Delete this chat? This can’t be undone.")) return;
    if (activeSessionId === id) newChat();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    } catch {
      refreshSessions();
    }
  }

  // Clicking a notification opens the session the answer landed in.
  function openNotification(n: NotificationItem) {
    void loadSession(n.sessionId);
  }

  async function switchUser() {
    try {
      await fetch("/api/user", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setUsername(null);
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
    setChosen(false); // re-show the identity gate
  }

  // End the session: clear the passcode cookie and go back to the PIN screen.
  async function signOut() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  const empty = messages.length === 0 && !loading;

  const composerEl = (
    <Composer
      q={q}
      loading={loading}
      files={files}
      onQ={setQ}
      onFiles={setFiles}
      onKeyDown={onKeyDown}
      onAsk={ask}
    />
  );

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
      <Sidebar
        module={module}
        onNavigate={go}
        onNewChat={newChat}
        username={username}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onLoadSession={loadSession}
        onDeleteSession={deleteSession}
        onSwitchUser={switchUser}
        onSignOut={signOut}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* top bar — notification bell (signed-in users only) */}
        <div
          style={{
            flex: "none",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "10px 16px 0",
            minHeight: 20,
          }}
        >
          <NotificationBell username={username} onOpen={openNotification} />
        </div>

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
            empty ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px 0 52px",
                }}
              >
                <h1
                  style={{
                    fontFamily: SERIF,
                    fontSize: 30,
                    fontWeight: 600,
                    letterSpacing: "-.01em",
                    textAlign: "center",
                    margin: "0 0 22px",
                    padding: "0 24px",
                  }}
                >
                  How can I help with UAE tax?
                </h1>
                {composerEl}
                <div style={{ fontSize: 11, color: "#cbcbc4", marginTop: 18, textAlign: "center" }}>
                  Decision-support only — a human reviews before use.
                </div>
              </div>
            ) : (
              <>
                <div className="lex-scroll" ref={threadRef} style={{ flex: 1, overflowY: "auto" }}>
                  <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 14px" }}>
                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <UserMessage key={i} text={m.text} files={m.files} first={i === 0} />
                      ) : m.role === "reviewer" ? (
                        <ReviewerMessage key={i} text={m.text} from={m.from} />
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

                <div style={{ flex: "none", padding: "6px 0 14px" }}>
                  {composerEl}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#b4b4ae",
                      marginTop: 9,
                      textAlign: "center",
                    }}
                  >
                    Decision-support only — a human reviews before use.
                  </div>
                </div>
              </>
            )
          ) : (
            <PlannedModules module={module} hasUsername={!!username} />
          )}
        </div>
      </div>

      {chosen === false && (
        <UsernameGate
          onChosen={(u) => {
            setUsername(u);
            setChosen(true);
          }}
        />
      )}
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

// A human answer sent back from the Review Queue, shown inline in the thread.
function ReviewerMessage({ text, from }: { text: string; from?: string }) {
  return (
    <div style={{ margin: "18px 0 30px", animation: "lexrise .35s ease both" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".13em", color: "#2f7a52" }}
        >
          REVIEWER
        </span>
        {from && <span style={{ fontSize: 12.5, color: "#8a8a85" }}>@{from}</span>}
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: ".05em",
            textTransform: "uppercase",
            color: "#2f7a52",
            background: "#eaf3ee",
            borderRadius: 99,
            padding: "2px 8px",
          }}
        >
          Human answer
        </span>
      </div>
      <div
        style={{
          borderLeft: "2px solid #2f7a52",
          padding: "2px 0 2px 16px",
        }}
      >
        <Markdown serif size={16.5}>
          {text}
        </Markdown>
      </div>
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
  loading,
  files,
  onQ,
  onFiles,
  onKeyDown,
  onAsk,
}: {
  q: string;
  loading: boolean;
  files: File[];
  onQ: (v: string) => void;
  onFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAsk: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLTextAreaElement>(null);
  const [multiline, setMultiline] = useState(false);

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

  // Decide single-line vs layered AND size the visible textarea — both measured
  // off-screen at the relevant fixed width via the mirror. Driving everything
  // from the mirror (not the live, mid-switch textarea) means it can't flicker
  // and it reliably collapses back to one line the moment the text fits again.
  useEffect(() => {
    const box = boxRef.current;
    const m = mirrorRef.current;
    const ta = taRef.current;
    if (!box || !m) return;
    const rowWidth = Math.max(box.clientWidth - 14 - 80, 40); // single-row text width
    const fullWidth = Math.max(box.clientWidth - 14, 40); // layered (full) text width

    // one-line baseline + does the text need more than one line at row width?
    m.style.width = `${rowWidth}px`;
    m.value = "x";
    m.style.height = "0px";
    const oneLine = m.scrollHeight;
    m.value = q || "x";
    m.style.height = "0px";
    const layered = m.scrollHeight > oneLine + 4;
    setMultiline(layered);

    // size the visible textarea at the width it will actually have
    if (ta) {
      m.style.width = `${layered ? fullWidth : rowWidth}px`;
      m.value = q;
      m.style.height = "0px";
      ta.style.height = `${Math.min(Math.max(m.scrollHeight, oneLine), 200)}px`;
    }
  }, [q]);

  const canSend = !loading && q.trim().length > 0;
  const atFileLimit = files.length >= MAX_FILES;

  return (
    <div style={{ width: "100%", padding: "0 24px" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        <div
          ref={boxRef}
          style={{
            position: "relative",
            border: "1px solid #e6e6e2",
            borderRadius: 24,
            background: "#fff",
            boxShadow: "0 2px 22px rgba(0,0,0,0.07)",
            padding: "6px 7px",
          }}
        >
          {files.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "2px 2px 8px" }}>
              {files.map((f, i) => (
                <span
                  key={i}
                  title={f.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    maxWidth: 240,
                    background: "#fafaf9",
                    border: "1px solid #ececea",
                    borderRadius: 10,
                    padding: "5px 8px 5px 10px",
                    fontSize: 12,
                    color: "#5a564d",
                  }}
                >
                  <span style={{ flex: "none" }}>📄</span>
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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

          {/* off-screen mirror: measures text wrap at the single-row width */}
          <textarea
            ref={mirrorRef}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: -9999,
              height: 0,
              overflow: "hidden",
              visibility: "hidden",
              pointerEvents: "none",
              boxSizing: "border-box",
              border: "none",
              padding: "7px 6px",
              fontSize: 15.5,
              lineHeight: 1.4,
              fontFamily: SERIF,
              resize: "none",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            }}
          />

          {/* flex-wrap row: single line by default; when layered, the textarea
              takes the full top row and the buttons drop below. Switching is
              CSS-only (order/flex-basis) so the textarea keeps focus. */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 6 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading || atFileLimit}
              title={atFileLimit ? `Up to ${MAX_FILES} files` : "Attach images or PDFs for context"}
              style={{
                order: multiline ? 1 : 0,
                flex: "none",
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "1px solid #e0e0db",
                background: "#fff",
                color: atFileLimit ? "#cdcdc8" : "#5a564d",
                cursor: loading || atFileLimit ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            <textarea
              ref={taRef}
              className="lex-noscroll"
              value={q}
              onChange={(e) => onQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a UAE tax question…"
              rows={1}
              style={{
                order: multiline ? 0 : 1,
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: multiline ? "100%" : "0%",
                boxSizing: "border-box",
                border: "none",
                background: "none",
                padding: "7px 6px",
                fontSize: 15.5,
                lineHeight: 1.4,
                color: "#1a1a1a",
                resize: "none",
                outline: "none",
                fontFamily: SERIF,
                maxHeight: 200,
                overflowY: "auto",
                transition: "height .12s ease",
              }}
            />

            <button
              onClick={onAsk}
              disabled={!canSend}
              title="Send"
              style={{
                order: 2,
                marginLeft: multiline ? "auto" : 0,
                flex: "none",
                width: 34,
                height: 34,
                border: "none",
                borderRadius: "50%",
                background: canSend ? "#1a1a1a" : "#e2e1dc",
                color: "#fff",
                cursor: canSend ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background .15s ease",
              }}
            >
              {loading ? (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "lexspin .7s linear infinite",
                  }}
                />
              ) : (
                <span style={{ fontSize: 17, lineHeight: 1 }}>↑</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
