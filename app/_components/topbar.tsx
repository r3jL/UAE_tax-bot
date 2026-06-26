"use client";

import { MODULES, type ModuleKey } from "../_lib/lex-data";

interface TopbarProps {
  module: ModuleKey;
}

export function Topbar({ module }: TopbarProps) {
  const meta = MODULES[module];

  return (
    <div
      style={{
        flex: "none",
        height: 62,
        borderBottom: "1px solid #ececea",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        gap: 20,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{meta.title}</div>
        <div style={{ fontSize: 11.5, color: "#9a9a93", marginTop: 1 }}>{meta.sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#c9952a",
            flex: "none",
          }}
        />
        <span style={{ fontSize: 11.5, color: "#9a9a93" }}>
          Decision-support only — a human reviews before use.
        </span>
      </div>
    </div>
  );
}
