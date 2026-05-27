import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categories, bySlug } from "../../categories";
import { Footer } from "../../Footer";

// Scaffolding for the per-category compose flows. Only the eight known slugs
// pre-render; each is a "coming soon" placeholder for now (the send-a-pack
// flow at /compose/pack/ is the one built out this phase).
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
    title: cat ? `Compose ${cat.name} — PX Registry` : "Compose — PX Registry",
  };
}

export default async function ComposeCategory({ params }: { params: Params }) {
  const { category } = await params;
  const cat = bySlug(category);
  if (!cat) notFound();

  return (
    <main className="page">
      <a className="back" href="/compose/">
        ← compose
      </a>

      <header className="head cat-head">
        <h1 className="title cat-title">
          <span className="cat-en">{cat.name}</span>
          <span className="cat-ja" lang="ja">
            {cat.ja}
          </span>
        </h1>
        <p className="cat-sub">Compose · {cat.name}</p>
      </header>

      <section className="compose-soon">
        <p className="compose-soon-line">This flow is coming soon.</p>
        <p className="compose-soon-sub">
          Listing {cat.name.toLowerCase()} activity will compose here. For now,
          you can{" "}
          <a className="compose-soon-link" href="/compose/pack/">
            send a pack
          </a>{" "}
          or browse the{" "}
          <a className="compose-soon-link" href={`/${cat.slug}/`}>
            {cat.name.toLowerCase()} register
          </a>
          .
        </p>
      </section>

      <Footer />
    </main>
  );
}
