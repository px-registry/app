import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categories, bySlug } from "../categories";
import { Footer } from "../Footer";
import { getPacksByCategory } from "@/data/packs";
import { shortId } from "@/lib/pack/index.ts";

// Static export: pre-render exactly the eight known slugs, nothing else.
export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}
export const dynamicParams = false;

type Params = Promise<{ category: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = bySlug(category);
  return {
    title: cat ? `${cat.name} — PX Registry` : "PX Registry",
    description: cat ? `Public register · ${cat.name}` : undefined,
  };
}

function countLabel(n: number): string {
  return n === 1 ? "1 entry" : `${n} entries`;
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { category } = await params;
  const cat = bySlug(category);
  if (!cat) notFound();

  const packs = await getPacksByCategory(cat.slug);

  return (
    <main className="page">
      <a className="back" href="/">
        ← back
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">{cat.name}</span>
          <span className="cat-ja" lang="ja">
            {cat.ja}
          </span>
        </h1>
        <p className="cat-sub">Public register · {cat.name}</p>
      </header>

      <p className="entries">
        <span className="entries-num">{packs.length}</span>{" "}
        {packs.length === 1 ? "entry" : "entries"}
      </p>

      {packs.length > 0 && (
        <ul className="listings">
          {packs.map(({ pack_id, core }) => {
            const l = core.listing!;
            const factLine = l.fact ? Object.values(l.fact).join(" · ") : null;
            return (
              <li key={pack_id}>
                <a className="listing" href={`/${cat.slug}/${pack_id}/`}>
                  <span className="listing-main">
                    <span
                      className="listing-title"
                      style={{ viewTransitionName: `pack-title-${shortId(pack_id)}` }}
                    >
                      {l.title}
                    </span>
                    <span className="listing-sender">{l.sender}</span>
                  </span>
                  <span className="listing-aside">
                    <span className="listing-type">{l.type}</span>
                    {factLine && (
                      <span className="listing-fact">{factLine}</span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <Footer />
    </main>
  );
}
