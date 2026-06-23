"use client";

import { SERIF, type QueueItem } from "../_lib/lex-data";

interface DrawerProps {
  item: QueueItem | null;
  onClose: () => void;
}

export function Drawer({ item, onClose }: DrawerProps) {
  if (!item) return null;

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
          width: 440,
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

        <div
          className="lex-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}
        >
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
            <div style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5a564d" }}>
              {item.reason}
            </div>
          </div>
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
            Suggested response (for review)
          </div>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: 15.5,
              lineHeight: 1.7,
              color: "#1f1f1c",
              margin: "0 0 8px",
            }}
          >
            Lex could not ground this with confidence. A reviewer should confirm the
            treatment, attach the governing article, and either approve, edit, or send
            back to the requester.
          </p>
        </div>

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
            onClick={onClose}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 99,
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "11px 0",
              cursor: "pointer",
            }}
          >
            Approve
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              border: "1px solid #e0e0db",
              borderRadius: 99,
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "11px 0",
              cursor: "pointer",
            }}
          >
            Edit answer
          </button>
          <button
            onClick={onClose}
            style={{
              flex: "none",
              border: "1px solid #e0e0db",
              borderRadius: 99,
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "11px 16px",
              cursor: "pointer",
              color: "#b0453a",
            }}
          >
            Send back
          </button>
        </div>
      </div>
    </>
  );
}
