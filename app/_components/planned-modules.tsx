"use client";

import { MODULES, SERIF, type ModuleKey } from "../_lib/lex-data";
import { InvoiceModule } from "./invoice-module";
import { ReviewQueueModule } from "./review-queue-module";

interface PlannedModulesProps {
  module: Exclude<ModuleKey, "ask">;
  isReviewer: boolean;
}

export function PlannedModules({ module, isReviewer }: PlannedModulesProps) {
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
          // Tab is visible to everyone, but only Reviewers see the data. Staff
          // get a locked screen; the module (and its data fetch) never mounts
          // for them. POC gate — driven by the role toggle, not real auth.
          isReviewer ? (
            <ReviewQueueModule />
          ) : (
            <Restricted />
          )
        ) : (
          <UnderConstruction />
        )}
      </div>
    </div>
  );
}

// Locked screen shown to non-Reviewers on a reviewer-only tab. The tab is
// visible to everyone (so staff know it exists), but the data stays hidden.
function Restricted() {
  return (
    <div
      style={{
        minHeight: "46vh",
        borderRadius: 16,
        border: "1px solid #ececea",
        background: "#fafaf9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 10 }}>🔒</div>
        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600 }}>
          Reviewers only
        </div>
        <div style={{ fontSize: 13.5, color: "#6b6b66", marginTop: 8, lineHeight: 1.6 }}>
          Escalated questions are visible to Finance Reviewers. Switch to the{" "}
          <strong>Reviewer</strong> view to see the queue.
        </div>
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
