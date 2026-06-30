"use client";

import { useState } from "react";
import {
  MODULES,
  NAV_ORDER,
  REVIEWER_ONLY,
  SERIF,
  type ModuleKey,
  type Role,
} from "../_lib/lex-data";

interface SidebarProps {
  module: ModuleKey;
  role: Role;
  onNavigate: (key: ModuleKey) => void;
  onSetRole: (role: Role) => void;
  onNewChat: () => void;
}

const svg = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function NavIcon({ k }: { k: ModuleKey }) {
  switch (k) {
    case "ask":
      return (
        <svg {...svg}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "invoice":
      return (
        <svg {...svg}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8M16 17H8" />
        </svg>
      );
    case "vendor":
      return (
        <svg {...svg}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "register":
      return (
        <svg {...svg}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "queue":
      return (
        <svg {...svg}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "alerts":
      return (
        <svg {...svg}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "history":
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "reports":
      return (
        <svg {...svg}>
          <path d="M3 3v18h18" />
          <path d="M7 16V9M12 16v-5M17 16v-9" />
        </svg>
      );
  }
}

export function Sidebar({ module, role, onNavigate, onSetRole, onNewChat }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isReviewer = role === "reviewer";

  return (
    <div
      style={{
        flex: "none",
        width: collapsed ? 62 : 252,
        transition: "width .18s ease",
        background: "#fafaf9",
        borderRight: "1px solid #ececea",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* header: brand + retract toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          padding: collapsed ? "16px 0 10px" : "16px 14px 10px",
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "-.01em",
              whiteSpace: "nowrap",
            }}
          >
            Project Lex
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={iconBtn}
        >
          <svg {...svg} width={18} height={18}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      </div>

      {/* new chat */}
      <div style={{ padding: collapsed ? "0 10px 8px" : "0 12px 8px" }}>
        <button
          onClick={onNewChat}
          title="New chat"
          style={{
            width: "100%",
            border: "1px solid #e6e6e2",
            background: "#fff",
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 9,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "9px 0" : "9px 12px",
            color: "#3a3a36",
          }}
        >
          <svg {...svg} width={16} height={16}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {!collapsed && <span style={{ fontSize: 13.5, fontWeight: 600 }}>New chat</span>}
        </button>
      </div>

      {/* nav */}
      <div
        className="lex-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: collapsed ? "4px 9px" : "4px 12px",
        }}
      >
        {NAV_ORDER.map((key) => {
          // Reviewer-only modules (the Review Queue) are hidden unless the
          // current view is Reviewer. POC gate — driven by the role toggle, not
          // real auth.
          if (REVIEWER_ONLY[key] && !isReviewer) return null;
          const active = key === module;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              title={MODULES[key].title}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                background: active ? "#eceae5" : "transparent",
                borderRadius: 9,
                padding: collapsed ? "10px 0" : "9px 11px",
                marginBottom: 2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: collapsed ? "center" : "flex-start",
                color: active ? "#1a1a1a" : "#5a564d",
              }}
            >
              <span style={{ flex: "none", display: "flex" }}>
                <NavIcon k={key} />
              </span>
              {!collapsed && (
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 500,
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {MODULES[key].title}
                </span>
              )}
              {!collapsed && REVIEWER_ONLY[key] && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "#9a6b18",
                    background: "#f7efdd",
                    borderRadius: 4,
                    padding: "2px 5px",
                    flex: "none",
                  }}
                >
                  Reviewer
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* role switcher (only when expanded) */}
      {!collapsed && (
        <div style={{ flex: "none", padding: 14, borderTop: "1px solid #f0f0ee" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#b4b4ae",
              marginBottom: 8,
              paddingLeft: 2,
            }}
          >
            View as
          </div>
          <div style={{ display: "flex", background: "#f0efec", borderRadius: 9, padding: 3 }}>
            <RoleButton active={!isReviewer} onClick={() => onSetRole("staff")}>
              Staff
            </RoleButton>
            <RoleButton active={isReviewer} onClick={() => onSetRole("reviewer")}>
              Reviewer
            </RoleButton>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  flex: "none",
  width: 32,
  height: 32,
  border: "none",
  background: "none",
  borderRadius: 8,
  cursor: "pointer",
  color: "#8a8a85",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function RoleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: "none",
        borderRadius: 7,
        padding: "7px 0",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        background: active ? "#fff" : "transparent",
        color: active ? "#1a1a1a" : "#8a8a85",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,.12)" : "none",
      }}
    >
      {children}
    </button>
  );
}
