import type { Metadata } from "next";
import { Footer } from "../Footer";
import { MeHome } from "./MeHome";

export const metadata: Metadata = {
  title: "Your identity — PX Registry",
  description: "Your PX identity.",
};

export default function MePage() {
  return (
    <main className="page">
      <a className="back" href="/">
        ← PX Registry
      </a>
      <MeHome />
      <Footer />
    </main>
  );
}
