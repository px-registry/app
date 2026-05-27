import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { bySlug } from "../../categories";
import { Footer } from "../../Footer";
import { PackView } from "../../PackView";
import { getListingPacks, getPackById, getAncestors } from "@/data/packs";

// One static route per listing-form pack: { category, pack_id } for each.
// Send-a-pack deliveries are not public-register listings, so they live only
// at /pack/[pack_id] — not here.
export async function generateStaticParams() {
  const packs = await getListingPacks();
  return packs.map((p) => ({ category: p.core.category, pack_id: p.pack_id }));
}
export const dynamicParams = false;

type Params = Promise<{ category: string; pack_id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { pack_id } = await params;
  const pack = await getPackById(pack_id);
  const title = pack?.core.listing?.title;
  return {
    title: title ? `${title} — PX Registry` : "PX Registry",
    description: pack?.core.listing?.description,
  };
}

export default async function ListingDetail({ params }: { params: Params }) {
  const { category, pack_id } = await params;
  const cat = bySlug(category);
  const pack = await getPackById(pack_id);
  if (!cat || !pack || pack.core.category !== category) notFound();

  const ancestors = await getAncestors(pack);

  return (
    <main className="page">
      <a className="back" href={`/${cat.slug}/`}>
        ← {cat.name}
      </a>

      <PackView pack={pack} ancestors={ancestors} mode="listing" />

      <Footer />
    </main>
  );
}
