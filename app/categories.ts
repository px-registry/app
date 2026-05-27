// The eight owner-domain activity categories. Single source of truth for the
// top-page list and the per-category routes. Slugs are the URL identity;
// `name` is the English label, `ja` the Japanese reading.
export type Category = {
  slug: string;
  name: string;
  ja: string;
};

export const categories: Category[] = [
  { slug: "auction", name: "Auction", ja: "オークション" },
  { slug: "crowdfund", name: "Crowdfund", ja: "クラウドファンディング" },
  { slug: "sale", name: "Sale", ja: "販売" },
  { slug: "video", name: "Video", ja: "動画" },
  { slug: "music", name: "Music", ja: "音楽" },
  { slug: "writing", name: "Writing", ja: "文章" },
  { slug: "service", name: "Service & Membership", ja: "サービス・会員" },
  { slug: "matching", name: "Matching", ja: "マッチング" },
];

export function bySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
