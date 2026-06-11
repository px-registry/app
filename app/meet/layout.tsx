import type { Metadata } from "next";
import { Shippori_Mincho, Inter } from "next/font/google";
import { MEET } from "@/lib/meet/copy.ts";
import { THEME_INIT_SCRIPT } from "@/lib/meet-net";
import { MeetNav } from "./MeetNav.tsx";
import { MeetToggles } from "./MeetToggles.tsx";
import "./meet.css";

// Headings only — body text uses the system JA sans stack (user-written text can
// never tofu). next/font/google self-hosts the sliced chunks with unicode-range,
// so glyphs load lazily and nothing renders as tofu.
const shippori = Shippori_Mincho({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-shippori",
  display: "swap",
  preload: false,
});

// Visual refresh: the v3 ui stack leads with Inter (latin); JA still falls to
// the system sans, so user-written text keeps its no-tofu guarantee.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: MEET.title,
  description: MEET.lede,
};

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`meet-scope ${shippori.variable} ${inter.variable}`}>
      {/* Resolve the theme phase (stored pref → prefers-color-scheme) and set
          <html data-theme> before this surface paints — no flash. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <header className="m-top">
        <div className="m-top-inner">
          <a href="/meet/" className="m-wordmark">
            <span className="m-word">{MEET.title}</span>
            <span className="m-ringlet" aria-hidden="true" />
          </a>
          {/* desktop-only header row (hidden under 64rem) */}
          <MeetNav variant="top" />
          <MeetToggles />
        </div>
      </header>
      <main className="m-main">{children}</main>
      <footer className="m-foot">
        <span className="m-ringlet" aria-hidden="true" />
        <span className="m-kk">{MEET.footerKk}</span>
      </footer>
      {/* mobile thumb bar (hidden at ≥64rem); lives OUTSIDE the blurred header
          so position:fixed keeps the viewport as its containing block */}
      <MeetNav />
    </div>
  );
}
