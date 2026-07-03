"use client";

import { useEffect, useRef, useState } from "react";
import { SERIF, relativeTime, type NotificationItem } from "../_lib/lex-data";

// Top-right bell. Polls for answers a reviewer has sent back into the user's
// sessions and, on click, opens the relevant session and marks the ping read.
// Guests (no username) get nothing.
export function NotificationBell({
  username,
  onOpen,
}: {
  username: string | null;
  onOpen: (n: NotificationItem) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Poll on mount + every 20s while signed in. When signed out the component
  // renders null, so stale items stay hidden until the next username loads.
  useEffect(() => {
    if (!username) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const data = await res.json();
        if (active) setItems(data.items ?? []);
      } catch {
        /* transient — try again next tick */
      }
    };
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [username]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!username) return null;
  const count = items.length;

  async function handleOpen(n: NotificationItem) {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    setOpen(false);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    } catch {
      /* best-effort mark-read */
    }
    onOpen(n);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 9,
          border: "1px solid #ececea",
          background: "#fff",
          cursor: "pointer",
          color: "#5a564d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 17,
              height: 17,
              padding: "0 4px",
              borderRadius: 9,
              background: "#b0453a",
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 320,
            maxHeight: 380,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ececea",
            borderRadius: 14,
            boxShadow: "0 10px 34px rgba(0,0,0,0.12)",
            zIndex: 50,
            animation: "lexrise .16s ease both",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f1f1ee",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#5a564d",
            }}
          >
            Notifications
          </div>
          {count === 0 ? (
            <div style={{ padding: "22px 16px", textAlign: "center", fontSize: 13, color: "#9a9a93" }}>
              You’re all caught up.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid #f5f5f2",
                  background: "transparent",
                  padding: "12px 16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#2f7a52", marginBottom: 3 }}>
                  A reviewer answered your question
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 13.5,
                    color: "#1a1a1a",
                    lineHeight: 1.4,
                    marginBottom: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.title}
                </div>
                <div style={{ fontSize: 11.5, color: "#a8a8a2" }}>{relativeTime(n.createdAt)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
