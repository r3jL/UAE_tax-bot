"use client";

import { MODULES, type ModuleKey, type Role } from "../_lib/lex-data";

interface TopbarProps {
  module: ModuleKey;
  role: Role;
}

export function Topbar({ module, role }: TopbarProps) {
  const meta = MODULES[module];
  const roleLabel = role === "reviewer" ? "Finance Reviewer" : "Staff";

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
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingLeft: 18,
            borderLeft: "1px solid #ececea",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>
              Amira Khalid
            </div>
            <div style={{ fontSize: 11, color: "#9a9a93" }}>{roleLabel}</div>
          </div>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#1a1a1a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600,
              flex: "none",
            }}
          >
            AK
          </div>
        </div>
      </div>
    </div>
  );
}
