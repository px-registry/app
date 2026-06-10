import type { Metadata } from "next";
import { Shippori_Mincho } from "next/font/google";
import { MEET } from "@/lib/meet/copy.ts";
import { MeetNav } from "./MeetNav.tsx";
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

export const metadata: Metadata = {
  title: MEET.title,
  description: MEET.lede,
};

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`meet-scope ${shippori.variable}`}>
      <header className="m-top">
        <div className="m-top-inner">
          <a href="/meet/" className="m-wordmark">
            {MEET.title}
          </a>
        </div>
      </header>
      <main className="m-main">{children}</main>
      <MeetNav />
    </div>
  );
}
