"use client";

import { useState } from "react";
import { SERIF, type QueueItem } from "../_lib/lex-data";

interface DrawerProps {
  item: QueueItem | null;
  onClose: () => void;
  // When provided, the drawer shows an answer composer that sends the human
  // reply back to the asker's session. Without it, the drawer is read-only.
  onSend?: (answer: string) => Promise<void>;
  canAnswer?: boolean;
}

export function Drawer({ item, onClose, onSend, canAnswer = true }: DrawerProps) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!item) return null;

  async function send() {
    if (!onSend || !answer.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(answer.trim());
      setAnswer("");
    } catch (e) {
      setError((e as Error).message || "Could not send the answer.");
      setSending(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,20,20,.28)",
          zIndex: 40,
          animation: "lexfade .2s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: "92vw",
          background: "#fff",
          borderLeft: "1px solid #ececea",
          zIndex: 41,
          boxShadow: "-12px 0 40px rgba(0,0,0,.08)",
          display: "flex",
          flexDirection: "column",
          animation: "lexslide .26s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div
          style={{
            flex: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 22px",
            borderBottom: "1px solid #ececea",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#9a6b18",
            }}
          >
            {item.type}
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: 20,
              color: "#9a9a93",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div className="lex-scroll" style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}>
          <div style={{ fontSize: 12, color: "#a8a8a2", marginBottom: 6 }}>
            {item.from} · {item.when}
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.4,
              marginBottom: 16,
            }}
          >
            {item.q}
          </div>
          <div
            style={{
              borderLeft: "2px solid #c9952a",
              padding: "2px 0 2px 14px",
              marginBottom: 20,
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
              Escalation reason
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5a564d" }}>{item.reason}</div>
          </div>

          {onSend && (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "#b4b4ae",
                  marginBottom: 8,
                }}
              >
                Your answer
              </div>
              {canAnswer ? (
                <>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Write the answer to send back to the person who asked…"
                    rows={7}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #e0e0db",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      fontFamily: SERIF,
                      resize: "vertical",
                      outline: "none",
                    }}
                  />
                  {error && (
                    <div style={{ fontSize: 13, color: "#9a3b30", marginTop: 8 }}>{error}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13.5, color: "#6b6b66", lineHeight: 1.6 }}>
                  Choose a username (top of the sidebar) to answer questions and send
                  them back.
                </div>
              )}
            </>
          )}
        </div>

        {onSend && canAnswer && (
          <div
            style={{
              flex: "none",
              display: "flex",
              gap: 8,
              padding: "16px 22px",
              borderTop: "1px solid #ececea",
            }}
          >
            <button
              onClick={send}
              disabled={!answer.trim() || sending}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 99,
                background: !answer.trim() || sending ? "#e2e1dc" : "#1a1a1a",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "11px 0",
                cursor: !answer.trim() || sending ? "default" : "pointer",
              }}
            >
              {sending ? "Sending…" : "Send answer to asker"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
