import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categories, bySlug } from "../categories";
import { Footer } from "../Footer";

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

export default async function CategoryPage({ params }: { params: Params }) {
  const { category } = await params;
  const cat = bySlug(category);
  if (!cat) notFound();

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
        <span className="entries-num">0</span> entries
      </p>

      <Footer />
    </main>
  );
}
