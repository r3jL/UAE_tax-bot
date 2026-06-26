import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Newsreader — a literary, book-like serif. The website's primary typeface
// (set as the body default in globals.css) for a warm, "reading a book" feel.
// True italics included for emphasis. Exposed as --font-serif.
const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// IBM Plex Sans — kept as --font-sans for any element that wants a neutral UI
// typeface, though the book serif is now the default everywhere.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
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
