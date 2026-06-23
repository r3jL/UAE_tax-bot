import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// IBM Plex Sans — the UI typeface. Non-variable on Google Fonts, so weights
// are listed explicitly. Exposed as --font-sans (the body default).
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

// Source Serif 4 — used for questions, answers and headings, matching the comp.
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project Lex — UAE Corporate Tax & VAT",
  description:
    "Cited answers on UAE Corporate Tax & VAT, grounded in official FTA law. Decision-support only — a human reviews before use.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
