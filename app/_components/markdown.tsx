"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MONO, SERIF } from "../_lib/lex-data";

// Renders the model's markdown (bold, lists, tables, links) styled to match the
// app. The model already emits markdown — this just displays it properly.
export function Markdown({
  children,
  serif = false,
  size = 14,
  color = "#1f1f1c",
}: {
  children: string;
  serif?: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <div style={{ fontFamily: serif ? SERIF : undefined, fontSize: size, color, lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: "0 0 12px" }}>{children}</p>,
          strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => (
            <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "0 0 12px", paddingLeft: 20 }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ margin: "3px 0", lineHeight: 1.6 }}>{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#1a1a1a",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                textDecorationColor: "#cdcdc8",
              }}
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code
              style={{
                background: "#f0efec",
                borderRadius: 4,
                padding: "1px 5px",
                fontSize: "0.88em",
                fontFamily: MONO,
              }}
            >
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h3 style={{ fontSize: "1.12em", fontWeight: 700, margin: "4px 0 8px" }}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 style={{ fontSize: "1.08em", fontWeight: 700, margin: "4px 0 8px" }}>{children}</h3>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: "1.04em", fontWeight: 700, margin: "4px 0 6px" }}>{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{ borderLeft: "2px solid #e0e0db", paddingLeft: 12, margin: "0 0 12px", color: "#6b6b66" }}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="lex-xscroll" style={{ margin: "0 0 12px", maxWidth: "100%" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9em" }}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              style={{
                textAlign: "left",
                padding: "6px 10px",
                borderBottom: "2px solid #ececea",
                fontWeight: 600,
                fontSize: "0.86em",
                letterSpacing: ".02em",
                color: "#6b6b66",
                whiteSpace: "nowrap",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f1ee", verticalAlign: "top" }}>
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
