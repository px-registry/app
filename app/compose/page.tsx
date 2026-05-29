import type { Metadata } from "next";
import { ComposerShell } from "@/components/compose/ComposerShell.tsx";

export const metadata: Metadata = {
  title: "Start something — PX Registry",
  description: "Compose a pack: send files, or list owner-domain activity.",
};

// The composer dashboard is the single /compose/ surface for everyone — the
// former signed-out chooser is subsumed. It renders client-side (tools explore,
// drafts, deferred sign-in); static export prerenders the dashboard shell.
export default function ComposeHome() {
  return <ComposerShell />;
}
