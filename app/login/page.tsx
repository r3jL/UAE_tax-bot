"use client";

import { useState } from "react";
import { SERIF } from "../_lib/lex-data";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "Incorrect passcode.");
      }
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafaf9",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 360,
          border: "1px solid #ececea",
          borderRadius: 16,
          background: "#fff",
          padding: "32px 28px",
          textAlign: "center",
          animation: "lexrise .3s ease both",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".14em",
            color: "#b4b4ae",
            marginBottom: 6,
          }}
        >
          PROJECT LEX
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 600, margin: "0 0 4px" }}>
          Enter passcode
        </h1>
        <p style={{ fontSize: 13, color: "#9a9a93", margin: "0 0 22px" }}>
          Sobha UAE Tax Assistant — internal access only.
        </p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          style={{
            width: "100%",
            border: "1px solid #e0e0db",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 16,
            letterSpacing: ".25em",
            textAlign: "center",
            outline: "none",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div style={{ fontSize: 13, color: "#9a3b30", marginBottom: 12 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            border: "1px solid #1a1a1a",
            borderRadius: 99,
            background: loading ? "#f0efec" : "#1a1a1a",
            color: loading ? "#9a9a93" : "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "11px 0",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
