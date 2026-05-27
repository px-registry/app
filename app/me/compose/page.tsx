import type { Metadata } from "next";
import { MeCompose } from "./MeCompose";

export const metadata: Metadata = {
  title: "Compose — PX Registry",
  description: "Your composer dashboard.",
};

// Full-bleed shell (rail + center pane); auth-gated client-side in MeCompose.
export default function MeComposePage() {
  return (
    <main className="shell-main">
      <MeCompose />
    </main>
  );
}
