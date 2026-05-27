// Data layer: turn the authored manifest cores in examples.json into packs
// with computed pack_ids, and expose the few queries the routes need.
//
// pack_ids are derived (sha256 of the canonical manifest), never authored, so
// they are computed once here and memoized for the duration of the build. The
// examples are illustrative: every sender domain is a `.example` placeholder.

import {
  toPacks,
  isSendAPack,
  indexById,
  ancestorsOf,
  type Pack,
  type PxManifestCoreV1,
} from "@/lib/pack/index.ts";
import { categories, bySlug } from "@/app/categories";
import rawExamples from "./examples.json";

// examples.json is the source of truth for example content; assert its shape.
const cores = rawExamples as PxManifestCoreV1[];

// Fail the build loudly if an example names a category that does not exist —
// a typo here would otherwise silently drop a pack from every category page.
for (const core of cores) {
  if (!bySlug(core.category)) {
    throw new Error(
      `examples.json: unknown category "${core.category}" in pack "${core.listing?.title ?? core.note ?? "?"}"`,
    );
  }
}

let cache: Promise<Pack[]> | undefined;

/** All packs (listing- and send-a-pack-form), pack_ids computed, input order. */
export function getAllPacks(): Promise<Pack[]> {
  return (cache ??= toPacks(cores));
}

/** Packs that appear on the public register — listing form only. */
export async function getListingPacks(): Promise<Pack[]> {
  return (await getAllPacks()).filter((p) => !isSendAPack(p.core));
}

/** Listing-form packs in one category, newest first. */
export async function getPacksByCategory(slug: string): Promise<Pack[]> {
  return (await getListingPacks())
    .filter((p) => p.core.category === slug)
    .sort((a, b) => b.core.created_at.localeCompare(a.core.created_at));
}

/** A single pack by full pack_id, or undefined. */
export async function getPackById(id: string): Promise<Pack | undefined> {
  return (await getAllPacks()).find((p) => p.pack_id === id);
}

/** The previous-chain ancestors of a pack, most-recent first. */
export async function getAncestors(pack: Pack): Promise<Pack[]> {
  const all = await getAllPacks();
  return ancestorsOf(pack, indexById(all));
}

/** Per-category listing counts, keyed by slug (categories with none read 0). */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const listings = await getListingPacks();
  const counts: Record<string, number> = {};
  for (const c of categories) counts[c.slug] = 0;
  for (const p of listings) counts[p.core.category]++;
  return counts;
}
