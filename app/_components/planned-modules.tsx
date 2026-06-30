"use client";

import { MODULES, SERIF, type ModuleKey } from "../_lib/lex-data";
import { InvoiceModule } from "./invoice-module";
import { ReviewQueueModule } from "./review-queue-module";

interface PlannedModulesProps {
  module: Exclude<ModuleKey, "ask">;
}

export function PlannedModules({ module }: PlannedModulesProps) {
  const meta = MODULES[module];

  return (
    <div className="lex-scroll" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 32px 60px" }}>
        {/* heading */}
        <div style={{ marginBottom: 24, maxWidth: 620 }}>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: 25,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-.01em",
            }}
          >
            {meta.title}
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#6b6b66", margin: "9px 0 0" }}>
            {meta.desc}
          </p>
        </div>

        {module === "invoice" ? (
          <InvoiceModule />
        ) : module === "queue" ? (
          <ReviewQueueModule />
        ) : (
          <UnderConstruction />
        )}
      </div>
    </div>
  );
}

// "Under Construction" screen with a yellow hazard-tape cross over the page.
function UnderConstruction() {
  const tape: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "-12%",
    width: "124%",
    height: 50,
    background: "repeating-linear-gradient(45deg, #f4c430 0 24px, #1c1c1c 24px 48px)",
    boxShadow: "0 3px 16px rgba(0,0,0,0.18)",
    border: "1px solid rgba(0,0,0,0.25)",
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "58vh",
        borderRadius: 16,
        border: "1px solid #ececea",
        background: "#fafaf9",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* two crossing tapes → an X across the page */}
      <div style={{ ...tape, transform: "translateY(-50%) rotate(20deg)" }} />
      <div style={{ ...tape, transform: "translateY(-50%) rotate(-20deg)" }} />

      {/* centered message */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #ececea",
          boxShadow: "0 6px 28px rgba(0,0,0,0.10)",
          padding: "22px 32px",
        }}
      >
        <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>🚧</div>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600 }}>Under Construction</div>
        <div style={{ fontSize: 13, color: "#9a9a93", marginTop: 4 }}>
          This module is coming soon.
        </div>
      </div>
    </div>
  );
}
