"use client";

import { useState } from "react";

interface Citation {
  chunkId: number;
  articleRef: string;
  sourceUrl: string;
  effectiveDate: string | null;
}

interface AnswerResult {
  status: "answered" | "escalate";
  answer: string;
  reasoning: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low";
  flaggedPremise: string | null;
  escalationReason: string | null;
  error?: string;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [taxType, setTaxType] = useState<"" | "CT" | "VAT">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, taxType: taxType || undefined }),
      });
      setResult(await res.json());
    } catch {
      setResult({
        status: "escalate",
        answer: "",
        reasoning: "",
        citations: [],
        confidence: "low",
        flaggedPremise: null,
        escalationReason: null,
        error: "Request failed. Is the server running and configured?",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-medium">Project Lex — UAE Tax Assistant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cited answers on UAE Corporate Tax &amp; VAT. Decision-support only —
          a human reviews before use.
        </p>
      </header>

      <form onSubmit={ask} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Is the first sale of a new residential building zero-rated for VAT?"
          rows={3}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-gray-500 focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <select
            value={taxType}
            onChange={(e) => setTaxType(e.target.value as "" | "CT" | "VAT")}
            className="rounded-lg border border-gray-300 p-2 text-sm"
          >
            <option value="">All</option>
            <option value="CT">Corporate Tax</option>
            <option value="VAT">VAT</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      {result && (
        <section className="mt-8 rounded-lg border border-gray-200 p-5">
          {result.error && (
            <p className="text-sm text-red-700">{result.error}</p>
          )}

          {!result.error && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    CONFIDENCE_STYLES[result.confidence] ?? ""
                  }`}
                >
                  {result.confidence} confidence
                </span>
                {result.status === "escalate" && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    escalated to F&amp;A
                  </span>
                )}
              </div>

              {result.flaggedPremise && (
                <div className="mb-3 rounded border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Check this assumption:</strong> {result.flaggedPremise}
                </div>
              )}

              {result.status === "escalate" ? (
                <p className="text-sm text-gray-700">
                  {result.escalationReason ??
                    "This needs F&A review — not enough grounded source to answer."}
                </p>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-gray-900">
                    {result.answer}
                  </p>
                  {result.reasoning && (
                    <details className="mt-3 text-sm text-gray-600">
                      <summary className="cursor-pointer">Reasoning</summary>
                      <p className="mt-2 whitespace-pre-wrap">
                        {result.reasoning}
                      </p>
                    </details>
                  )}
                </>
              )}

              {result.citations.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Sources
                  </h2>
                  <ul className="space-y-1 text-sm">
                    {result.citations.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium">{c.articleRef}</span>
                        {c.effectiveDate && (
                          <span className="text-gray-500"> · {c.effectiveDate}</span>
                        )}
                        {c.sourceUrl && (
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-blue-600 underline"
                          >
                            source
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
