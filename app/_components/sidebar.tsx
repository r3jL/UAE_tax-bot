"use client";

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
}

export function Sidebar({ module, role, onNavigate, onSetRole }: SidebarProps) {
  const isReviewer = role === "reviewer";

  return (
    <div
      style={{
        flex: "none",
        width: 256,
        background: "#fafaf9",
        borderRight: "1px solid #ececea",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid #f0f0ee" }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: "-.01em",
          }}
        >
          Project Lex
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "#9a9a93",
            marginTop: 3,
            letterSpacing: ".02em",
          }}
        >
          UAE Corporate Tax &amp; VAT
        </div>
      </div>

      <div
        className="lex-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}
      >
        {NAV_ORDER.map((key) => {
          const active = key === module;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                background: active ? "#eceae5" : "transparent",
                borderRadius: 9,
                padding: "9px 12px",
                marginBottom: 2,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 9,
                color: active ? "#1a1a1a" : "#5a564d",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: active ? "#1a1a1a" : "#cfcfc9",
                  flex: "none",
                }}
              />
              <span
                style={{ fontSize: 13.5, fontWeight: active ? 600 : 500, flex: 1 }}
              >
                {MODULES[key].title}
              </span>
              {REVIEWER_ONLY[key] && (
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
        <div
          style={{ display: "flex", background: "#f0efec", borderRadius: 9, padding: 3 }}
        >
          <RoleButton active={!isReviewer} onClick={() => onSetRole("staff")}>
            Staff
          </RoleButton>
          <RoleButton active={isReviewer} onClick={() => onSetRole("reviewer")}>
            Reviewer
          </RoleButton>
        </div>
      </div>
    </div>
  );
}

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
