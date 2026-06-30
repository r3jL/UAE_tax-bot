"use client";

import { useEffect, useState } from "react";
import {
  CONF_MAP,
  SERIF,
  reviewRowToQueueItem,
  type QueueItem,
  type ReviewQueueRow,
} from "../_lib/lex-data";
import { Drawer } from "./drawer";

type LoadState = "loading" | "ready" | "error";
type QueueData = { items: QueueItem[]; dbReady: boolean };

// Pure fetch — no React state — so it can be shared by the mount effect and the
// Refresh button, and setState only ever happens in the .then/.catch callbacks.
async function fetchQueue(): Promise<QueueData> {
  const res = await fetch("/api/review-queue", { cache: "no-store" });
  const data = (await res.json()) as {
    items?: ReviewQueueRow[];
    dbReady?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "Could not load the review queue.");
  return {
    items: (data.items ?? []).map(reviewRowToQueueItem),
    dbReady: data.dbReady !== false,
  };
}

// The Review Queue: escalated Q&A read from the shared cloud DB (query_log via
// /api/review-queue) and shown to every user. Reuses the existing Drawer for the
// detail view. Read-only listing — reviewer sign-off is a later phase.
export function ReviewQueueModule() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [dbReady, setDbReady] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<QueueItem | null>(null);

  function applyError(e: unknown) {
    setError(e instanceof Error ? e.message : "Could not load the review queue.");
    setState("error");
  }
  function applyData(d: QueueData) {
    setItems(d.items);
    setDbReady(d.dbReady);
    setState("ready");
  }

  // Fetch on mount. setState happens only inside the promise callbacks (the
  // pattern the set-state-in-effect rule endorses), guarded against unmount.
  useEffect(() => {
    let active = true;
    fetchQueue()
      .then((d) => active && applyData(d))
      .catch((e) => active && applyError(e));
    return () => {
      active = false;
    };
  }, []);

  function refresh() {
    setState("loading");
    setError("");
    fetchQueue().then(applyData).catch(applyError);
  }

  // Any user can delete from the shared queue. Optimistic remove, with a reload
  // from the source of truth if the request fails.
  async function remove(item: QueueItem) {
    if (item.id == null) return;
    if (
      !window.confirm(
        "Delete this escalated question? It’s removed from the queue for everyone and can’t be undone.",
      )
    )
      return;
    const id = item.id;
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSelected((s) => (s?.id === id ? null : s));
    try {
      const res = await fetch(`/api/review-queue?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      refresh();
    }
  }

  async function clearAll() {
    if (items.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${items.length} escalated question${
          items.length === 1 ? "" : "s"
        } from the queue? This can’t be undone.`,
      )
    )
      return;
    setItems([]);
    setSelected(null);
    try {
      const res = await fetch("/api/review-queue?all=1", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      refresh();
    }
  }

  return (
    <div>
      {/* header row: count + refresh */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, color: "#9a9a93" }}>
          {state === "ready"
            ? `${items.length} escalation${items.length === 1 ? "" : "s"} awaiting review`
            : " "}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {state === "ready" && items.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                border: "1px solid #f0dcd8",
                borderRadius: 99,
                background: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#b0453a",
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              Clear all
            </button>
          )}
          <button
            onClick={refresh}
            disabled={state === "loading"}
            style={{
              border: "1px solid #e0e0db",
              borderRadius: 99,
              background: "#fff",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#5a564d",
              padding: "6px 14px",
              cursor: state === "loading" ? "default" : "pointer",
              opacity: state === "loading" ? 0.6 : 1,
            }}
          >
            {state === "loading" ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {state === "error" && (
        <Notice
          tone="error"
          title="Couldn’t load the queue"
          body={error}
        />
      )}

      {state === "ready" && !dbReady && (
        <Notice
          tone="muted"
          title="No database connected"
          body="Set DATABASE_URL so escalated questions persist to the cloud and appear here for everyone."
        />
      )}

      {state === "ready" && dbReady && items.length === 0 && (
        <Notice
          tone="muted"
          title="Nothing to review"
          body="When Lex can’t ground an answer in the law, it escalates the question and it lands here for the team."
        />
      )}

      {state === "ready" && items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <QueueCard
              key={item.id ?? item.q}
              item={item}
              onOpen={() => setSelected(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}

      <Drawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function QueueCard({
  item,
  onOpen,
  onDelete,
}: {
  item: QueueItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const conf = item.confidence ? CONF_MAP[item.confidence] : null;
  return (
    // Container (not a button) so the Delete control is a sibling, not nested
    // inside the clickable card — keeps the HTML valid and both keyboard-usable.
    <div
      style={{
        position: "relative",
        border: "1px solid #ececea",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      <button
        onClick={onOpen}
        style={{
          textAlign: "left",
          border: "none",
          background: "transparent",
          borderRadius: 14,
          padding: "16px 18px",
          paddingRight: 90, // leave room for the Delete button
          cursor: "pointer",
          display: "block",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: ".07em",
              textTransform: "uppercase",
              color: "#9a6b18",
              background: "#f7efdd",
              borderRadius: 99,
              padding: "3px 9px",
            }}
          >
            {item.type}
          </span>
          {item.taxType && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "#5a564d",
                background: "#f1f1ee",
                borderRadius: 99,
                padding: "3px 9px",
              }}
            >
              {item.taxType}
            </span>
          )}
          {conf && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: conf.color }}>
              {conf.label}
            </span>
          )}
          <span style={{ fontSize: 12, color: "#a8a8a2" }}>{item.when}</span>
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.4,
            color: "#1a1a1a",
            marginBottom: 6,
          }}
        >
          {item.q}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "#6b6b66",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.reason}
        </div>
      </button>
      <button
        onClick={onDelete}
        title="Delete from the queue"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          border: "1px solid #f0dcd8",
          borderRadius: 8,
          background: "#fff",
          fontSize: 12,
          fontWeight: 600,
          color: "#b0453a",
          padding: "4px 10px",
          cursor: "pointer",
        }}
      >
        Delete
      </button>
    </div>
  );
}

function Notice({
  tone,
  title,
  body,
}: {
  tone: "error" | "muted";
  title: string;
  body: string;
}) {
  const color = tone === "error" ? "#b0453a" : "#1a1a1a";
  const bg = tone === "error" ? "#fbf1ef" : "#fafaf9";
  const border = tone === "error" ? "#f0dcd8" : "#ececea";
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background: bg,
        borderRadius: 14,
        padding: "22px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color }}>
        {title}
      </div>
      <div style={{ fontSize: 13.5, color: "#6b6b66", marginTop: 6, lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  );
}
