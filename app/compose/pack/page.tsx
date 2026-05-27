import type { Metadata } from "next";
import { Footer } from "../../Footer";
import { ComposePack } from "../ComposePack";

export const metadata: Metadata = {
  title: "Send a pack — PX Registry",
  description:
    "Compose a file delivery. Files stay in your browser; PX receives nothing.",
};

// Static shell; all the work happens client-side in ComposePack (File API,
// live pack_id, share-link encoding). Static export is preserved.
export default function ComposePackPage() {
  return (
    <main className="page">
      <a className="back" href="/compose/">
        ← compose
      </a>
      <ComposePack />
      <Footer />
    </main>
  );
}
