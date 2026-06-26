import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Inter — a free neo-grotesque that stands in for ChatGPT's Söhne (a licensed
// Klim typeface we can't embed without a licence). The website's UI default,
// exposed as --font-sans.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// IBM Plex Mono — stands in for Söhne Mono, used for code and user inputs.
// Exposed as --font-mono.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
