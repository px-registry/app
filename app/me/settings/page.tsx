import type { Metadata } from "next";
import { Footer } from "../../Footer";
import { Settings } from "./Settings";

export const metadata: Metadata = {
  title: "Settings — PX Registry",
  description: "Your PX profile settings.",
};

export default function SettingsPage() {
  return (
    <main className="page">
      <a className="back" href="/me/">
        ← your identity
      </a>
      <Settings />
      <Footer />
    </main>
  );
}
