import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "../../Footer";
import { PackView } from "../../PackView";
import { getAllPacks, getPackById, getAncestors } from "@/data/packs";

// The shareable pack viewer — the viral entry point. Every pack has one, both
// the file deliveries (the .pack wedge) and the public listings. No signup to
// open; the open itself is a public register event (see LighthouseNote).
export async function generateStaticParams() {
  const packs = await getAllPacks();
  return packs.map((p) => ({ pack_id: p.pack_id }));
}
export const dynamicParams = false;

type Params = Promise<{ pack_id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { pack_id } = await params;
  const pack = await getPackById(pack_id);
  const title = pack?.core.listing?.title;
  return {
    title: title ? `${title} — PX pack` : "PX pack",
    description: pack?.core.listing?.description ?? pack?.core.note,
  };
}

export default async function PackViewer({ params }: { params: Params }) {
  const { pack_id } = await params;
  const pack = await getPackById(pack_id);
  if (!pack) notFound();

  const ancestors = await getAncestors(pack);

  return (
    <main className="page">
      <a className="back" href="/">
        ← Public register
      </a>

      <PackView pack={pack} ancestors={ancestors} mode="viewer" />

      <Footer />
    </main>
  );
}
