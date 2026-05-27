import type { Metadata } from "next";
import { ComposeAdaptive } from "@/components/compose/ComposeAdaptive.tsx";

export const metadata: Metadata = {
  title: "Start something — PX Registry",
  description: "Compose a pack: send files, or list owner-domain activity.",
};

// Adaptive entry: the public chooser (signed out) or the Mode-2 dashboard
// (signed in). All branching is client-side in ComposeAdaptive; static export is
// preserved (the chooser is the prerendered default).
export default function ComposeHome() {
  return <ComposeAdaptive />;
}
