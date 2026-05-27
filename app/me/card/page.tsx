import type { Metadata } from "next";
import { BusinessCard } from "./BusinessCard";

export const metadata: Metadata = {
  title: "Card — PX Registry",
  description: "Your PX card — a verifiable hand-off.",
};

// A quiet surface; the card wants room to breathe (no footer). Gated client-side
// in BusinessCard, like the rest of /me/.
export default function CardPage() {
  return (
    <main className="page">
      <a className="back" href="/me/">
        ← your identity
      </a>
      <BusinessCard />
    </main>
  );
}
