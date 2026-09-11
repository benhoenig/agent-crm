import type { Metadata } from "next";
import { Sarabun, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";

// Type system (decided, Ben 2026-08-15): Sarabun (มีหัว) for all text,
// IBM Plex Mono for numerals (.num). Trialed against IBM Plex Sans Thai
// (loopless + Looped) — Sarabun won.
const sarabun = Sarabun({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
};

// Applies the stored theme before first paint (no flash). Dark is the default.
const themeInit = `try{var t=localStorage.getItem("hb-theme");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${sarabun.variable} ${plexMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
