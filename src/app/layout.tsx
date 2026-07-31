import type { Metadata, Viewport } from "next";
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// "Kopitiam After Dark" type system (docs/design-system.md), self-hosted by
// next/font — no runtime request to Google, no layout shift.
//   Archivo        — display / signage: brand, nav, headings, keys, buttons
//   Hanken Grotesk — body / labels: item names, descriptions, form labels
//   IBM Plex Mono  — money / numbers: prices, totals, quantities, keypad
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

// Plex Mono is not a variable font, so weights must be listed explicitly.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Caffeine Cravers POS",
  description: "Point-of-sale for the Caffeine Cravers coffee stall.",
};

// Next 16: viewport and themeColor are a SEPARATE export, not part of `metadata`
// (metadata.viewport / metadata.themeColor are deprecated).
export const viewport: Viewport = {
  themeColor: "#17110E", // matches --bg (Kopitiam After Dark ground)
  width: "device-width",
  initialScale: 1,
  // Dedicated POS terminal: lock zoom so rapid tapping can't pinch-zoom the till.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${hanken.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
