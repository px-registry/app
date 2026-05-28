// Unit tests for the px.pack core. Run with: npm test  (node --test).
//
// Coverage is deliberately narrow and load-bearing:
//   • canonicalization is order/whitespace invariant and escapes minimally
//   • sha256Hex matches a known NIST vector
//   • pack_id is deterministic and ignores authored key order
//   • the chain walker is correct and cycle-safe

import { test } from "node:test";
import assert from "node:assert/strict";

import { canonicalize } from "./canonical.ts";
import { sha256Hex } from "./hash.ts";
import { computePackId, shortId, stripDelivery } from "./pack-id.ts";
import { indexById, ancestorsOf, isGenesis } from "./chain.ts";
import { normalizePath, isNormalizedPath } from "./path.ts";
import { formatPrice, parsePriceInput } from "./price.ts";
import { isSale } from "./types.ts";
import { toPacks } from "./index.ts";
import type { PxManifestCoreV1, Pack } from "./types.ts";

// ── canonical (RFC 8785 JCS) ──────────────────────────────────────────────

test("canonicalize sorts object keys by code unit", () => {
  assert.equal(canonicalize({ b: 1, a: 2, c: 3 }), '{"a":2,"b":1,"c":3}');
});

test("canonicalize is invariant to authored key order", () => {
  const a = canonicalize({ px: "1.0", kind: "px.pack", created_at: "z" });
  const b = canonicalize({ created_at: "z", kind: "px.pack", px: "1.0" });
  assert.equal(a, b);
});

test("canonicalize emits no insignificant whitespace", () => {
  assert.equal(canonicalize({ a: [1, 2, 3], b: "x" }), '{"a":[1,2,3],"b":"x"}');
});

test("canonicalize drops undefined-valued properties", () => {
  assert.equal(
    canonicalize({ a: 1, b: undefined as unknown as null }),
    '{"a":1}',
  );
});

test("canonicalize escapes only what JSON requires", () => {
  // quote, backslash, the short C0 escapes — and nothing else.
  assert.equal(canonicalize('a"b\\c\n'), '"a\\"b\\\\c\\n"');
  // forward slash and non-ASCII pass through unescaped.
  assert.equal(canonicalize("a/b—café"), '"a/b—café"');
  // bare C0 control gets \u00XX.
  assert.equal(canonicalize(""), '"\\u0001"');
});

test("canonicalize rejects non-finite numbers", () => {
  assert.throws(() => canonicalize(Infinity as unknown as number));
  assert.throws(() => canonicalize(NaN as unknown as number));
});

test("canonicalize handles primitives and nesting", () => {
  assert.equal(canonicalize(null), "null");
  assert.equal(canonicalize(true), "true");
  assert.equal(canonicalize(0), "0");
  assert.equal(canonicalize({ n: { deep: [true, null, "x"] } }), '{"n":{"deep":[true,null,"x"]}}');
});

// ── sha256 ────────────────────────────────────────────────────────────────

test("sha256Hex matches the known vector for 'abc'", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("sha256Hex of empty input is the known empty digest", async () => {
  assert.equal(
    await sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

// ── pack_id ─────────────────────────────────────────────────────────────-

const sample: PxManifestCoreV1 = {
  px: "1.0",
  kind: "px.pack",
  created_at: "2026-05-01T00:00:00Z",
  category: "auction",
  listing: {
    title: "Single wood-fired tea bowl",
    sender: "Mariko Kiln",
    domain: "mariko.example",
    type: "Auction",
    description: "One kiln, three days of firing. One bowl released.",
    fact: { time_left: "3 days" },
  },
};

test("computePackId is a 64-char lowercase hex string", async () => {
  const id = await computePackId(sample);
  assert.match(id, /^[0-9a-f]{64}$/);
});

test("computePackId is deterministic across calls", async () => {
  assert.equal(await computePackId(sample), await computePackId(sample));
});

test("computePackId ignores authored key order", async () => {
  const reordered: PxManifestCoreV1 = {
    kind: "px.pack",
    category: "auction",
    px: "1.0",
    created_at: "2026-05-01T00:00:00Z",
    listing: {
      description: "One kiln, three days of firing. One bowl released.",
      fact: { time_left: "3 days" },
      type: "Auction",
      title: "Single wood-fired tea bowl",
      domain: "mariko.example",
      sender: "Mariko Kiln",
    },
  };
  assert.equal(await computePackId(sample), await computePackId(reordered));
});

test("computePackId changes when content changes", async () => {
  const mutated: PxManifestCoreV1 = {
    ...sample,
    listing: { ...sample.listing!, title: "Two tea bowls" },
  };
  assert.notEqual(await computePackId(sample), await computePackId(mutated));
});

test("computePackId strips an injected pack_id from the preimage", async () => {
  const withId = { ...sample, pack_id: "deadbeef" } as PxManifestCoreV1;
  assert.equal(await computePackId(withId), await computePackId(sample));
});

test("shortId returns the requested prefix length", async () => {
  const id = await computePackId(sample);
  assert.equal(shortId(id), id.slice(0, 12));
  assert.equal(shortId(id, 8), id.slice(0, 8));
});

// ── chain ───────────────────────────────────────────────────────────────-

test("ancestorsOf walks previous links oldest-last", async () => {
  const genesis: PxManifestCoreV1 = {
    px: "1.0",
    kind: "px.pack",
    created_at: "2026-01-01T00:00:00Z",
    category: "writing",
    listing: {
      title: "Letter 1",
      sender: "Morning Draft",
      domain: "morning-draft.example",
      type: "Subscription",
      description: "first",
    },
  };
  const [g] = await toPacks([genesis]);
  const child: PxManifestCoreV1 = { ...genesis, created_at: "2026-01-08T00:00:00Z", previous: g.pack_id, listing: { ...genesis.listing!, title: "Letter 2" } };
  const [c] = await toPacks([child]);

  const index = indexById([g, c]);
  assert.equal(isGenesis(g), true);
  assert.equal(isGenesis(c), false);
  const ancestors = ancestorsOf(c, index);
  assert.deepEqual(ancestors.map((p) => p.pack_id), [g.pack_id]);
  assert.deepEqual(ancestorsOf(g, index), []);
});

// ── nested contents (folders / archives) ─────────────────────────────────

const nested: PxManifestCoreV1 = {
  px: "1.0",
  kind: "px.pack",
  created_at: "2026-05-26T15:30:00Z",
  category: "service",
  listing: {
    title: "Project handoff",
    sender: "Studio",
    domain: "",
    type: "Delivery",
  },
  files: [
    { name: "cover.pdf", bytes: 1200, sha256: "a".repeat(64), note: "start here" },
    {
      name: "src",
      kind: "folder",
      contents: [
        { name: "index.ts", bytes: 80, sha256: "b".repeat(64) },
        { name: "util/format.ts", bytes: 40, sha256: "c".repeat(64), note: "helpers" },
      ],
    },
  ],
};

test("computePackId recurses into nested contents deterministically", async () => {
  const id = await computePackId(nested);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(await computePackId(nested), id);
});

test("computePackId is invariant to key order at depth", async () => {
  const reordered: PxManifestCoreV1 = {
    kind: "px.pack",
    px: "1.0",
    created_at: "2026-05-26T15:30:00Z",
    category: "service",
    files: [
      { sha256: "a".repeat(64), note: "start here", name: "cover.pdf", bytes: 1200 },
      {
        kind: "folder",
        name: "src",
        contents: [
          { sha256: "b".repeat(64), name: "index.ts", bytes: 80 },
          { note: "helpers", sha256: "c".repeat(64), name: "util/format.ts", bytes: 40 },
        ],
      },
    ],
    listing: {
      type: "Delivery",
      title: "Project handoff",
      domain: "",
      sender: "Studio",
    },
  };
  assert.equal(await computePackId(reordered), await computePackId(nested));
});

test("a changed nested note changes the pack_id", async () => {
  const before = await computePackId(nested);
  const mutated: PxManifestCoreV1 = {
    ...nested,
    files: [
      nested.files![0],
      {
        ...nested.files![1],
        contents: [
          nested.files![1].contents![0],
          { ...nested.files![1].contents![1], note: "different" },
        ],
      },
    ],
  };
  assert.notEqual(await computePackId(mutated), before);
});

// ── delivery custody is excluded from the pack_id ─────────────────────────

test("attaching a core delivery does not change the pack_id", async () => {
  const before = await computePackId(nested);
  const withDelivery: PxManifestCoreV1 = {
    ...nested,
    delivery: {
      base: "https://app.px-registry.org/api/download/" + "f".repeat(64) + "/",
      expires_at: "2026-06-26T00:00:00.000Z",
    },
  };
  assert.equal(await computePackId(withDelivery), before);
});

test("the delivery target/expiry never perturbs the id", async () => {
  const a: PxManifestCoreV1 = {
    ...nested,
    delivery: { base: "https://a.example/x/", expires_at: "2026-01-01T00:00:00Z" },
  };
  const b: PxManifestCoreV1 = {
    ...nested,
    delivery: { base: "https://b.example/y/", expires_at: "2030-12-31T00:00:00Z" },
  };
  assert.equal(await computePackId(a), await computePackId(b));
  assert.equal(await computePackId(a), await computePackId(nested));
});

test("a per-file delivery (forward-compat) is also stripped", async () => {
  const before = await computePackId(nested);
  const withFileDelivery = {
    ...nested,
    files: [
      { ...nested.files![0], delivery: { base: "https://x/", expires_at: "z" } },
      {
        ...nested.files![1],
        contents: [
          { ...nested.files![1].contents![0], delivery: { base: "https://y/", expires_at: "z" } },
          nested.files![1].contents![1],
        ],
      },
    ],
  } as unknown as PxManifestCoreV1;
  assert.equal(await computePackId(withFileDelivery), before);
});

test("stripDelivery leaves a delivery-free core's content intact", () => {
  // The canonical form of the stripped core must equal that of the original
  // when there was no delivery — the guarantee that existing pack_ids are frozen.
  assert.equal(
    canonicalize(stripDelivery(nested) as unknown as Parameters<typeof canonicalize>[0]),
    canonicalize(nested as unknown as Parameters<typeof canonicalize>[0]),
  );
});

// ── sale offers (sale/v1 form) ────────────────────────────────────────────

const saleCore: PxManifestCoreV1 = {
  px: "1.0",
  kind: "px.pack",
  created_at: "2026-05-29T00:00:00Z",
  category: "sale",
  sale: {
    title: "Wheel-thrown stoneware mug",
    price: { amount: 4800, currency: "JPY" },
    sender: "Mariko Kiln",
    domain: "mariko.example",
    photos: [
      { name: "front.jpg", bytes: 81_200, sha256: "a".repeat(64) },
      { name: "side.jpg", bytes: 77_010, sha256: "b".repeat(64) },
    ],
    description: "One mug, wood-fired. Glaze pools at the foot.",
  },
};

test("isSale discriminates the sale form from listing/send-a-pack", () => {
  assert.equal(isSale(saleCore), true);
  assert.equal(isSale(sample), false); // a listing
  assert.equal(isSale(nested), false); // a send-a-pack
});

test("a sale pack_id is deterministic and content-addressed", async () => {
  const id = await computePackId(saleCore);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(await computePackId(saleCore), id);
});

test("changing the price changes the sale pack_id", async () => {
  const before = await computePackId(saleCore);
  const repriced: PxManifestCoreV1 = {
    ...saleCore,
    sale: { ...saleCore.sale!, price: { amount: 5200, currency: "JPY" } },
  };
  assert.notEqual(await computePackId(repriced), before);
});

test("a sale pack_id ignores authored key order", async () => {
  const reordered: PxManifestCoreV1 = {
    kind: "px.pack",
    category: "sale",
    px: "1.0",
    created_at: "2026-05-29T00:00:00Z",
    sale: {
      description: "One mug, wood-fired. Glaze pools at the foot.",
      domain: "mariko.example",
      sender: "Mariko Kiln",
      price: { currency: "JPY", amount: 4800 },
      title: "Wheel-thrown stoneware mug",
      photos: [
        { sha256: "a".repeat(64), name: "front.jpg", bytes: 81_200 },
        { bytes: 77_010, sha256: "b".repeat(64), name: "side.jpg" },
      ],
    },
  };
  assert.equal(await computePackId(reordered), await computePackId(saleCore));
});

test("attaching a delivery to a sale does not change its pack_id", async () => {
  const before = await computePackId(saleCore);
  const withDelivery: PxManifestCoreV1 = {
    ...saleCore,
    delivery: {
      base: "https://app.px-registry.org/api/download/" + "f".repeat(64) + "/",
      expires_at: "2026-06-28T00:00:00.000Z",
    },
  };
  assert.equal(await computePackId(withDelivery), before);
});

test("adding a sale field never perturbs a listing pack_id", async () => {
  // The byte-identity guarantee: a listing/send-a-pack has no `sale`, so the
  // canonical form (and thus the frozen pack_id) is unchanged by the new field.
  assert.equal(
    canonicalize(stripDelivery(sample) as unknown as Parameters<typeof canonicalize>[0]),
    canonicalize(sample as unknown as Parameters<typeof canonicalize>[0]),
  );
});

// ── price formatting (display layer, pure) ────────────────────────────────

test("formatPrice renders minor units per currency precision", () => {
  assert.equal(formatPrice(1200, "JPY"), "¥1,200");
  assert.equal(formatPrice(4800, "JPY"), "¥4,800");
  assert.equal(formatPrice(1_234_567, "JPY"), "¥1,234,567");
  assert.equal(formatPrice(999, "USD"), "$9.99");
  assert.equal(formatPrice(100_000, "USD"), "$1,000.00");
  assert.equal(formatPrice(5, "USD"), "$0.05");
});

test("formatPrice falls back for an unknown currency", () => {
  assert.equal(formatPrice(42, "EUR"), "42 EUR");
});

test("parsePriceInput converts typed major units to integer minor units", () => {
  assert.equal(parsePriceInput("4800", "JPY"), 4800);
  assert.equal(parsePriceInput("1,200", "JPY"), 1200);
  assert.equal(parsePriceInput("9.99", "USD"), 999);
  assert.equal(parsePriceInput("10", "USD"), 1000);
  assert.equal(parsePriceInput("", "JPY"), 0);
  assert.equal(parsePriceInput("abc", "USD"), 0);
  assert.equal(parsePriceInput("-5", "USD"), 0);
});

test("parsePriceInput then formatPrice round-trips", () => {
  assert.equal(formatPrice(parsePriceInput("9.99", "USD"), "USD"), "$9.99");
  assert.equal(formatPrice(parsePriceInput("4800", "JPY"), "JPY"), "¥4,800");
});

// ── path normalization (spec §5) ─────────────────────────────────────────

test("normalizePath folds separators and drops . segments", () => {
  assert.equal(normalizePath("a\\b\\c.txt"), "a/b/c.txt");
  assert.equal(normalizePath("./a/./b.txt"), "a/b.txt");
  assert.equal(normalizePath("/leading/slash.txt"), "leading/slash.txt");
  assert.equal(normalizePath("a//b///c.txt"), "a/b/c.txt");
});

test("isNormalizedPath rejects leading slash, empty, and traversal", () => {
  assert.equal(isNormalizedPath("a/b.txt"), true);
  assert.equal(isNormalizedPath("/a"), false);
  assert.equal(isNormalizedPath(""), false);
  assert.equal(isNormalizedPath("a/../b"), false);
  assert.equal(isNormalizedPath("a/./b"), false);
});

test("ancestorsOf is cycle-safe", () => {
  const a: Pack = { pack_id: "aaa", core: { px: "1.0", kind: "px.pack", created_at: "x", category: "writing", previous: "bbb" } };
  const b: Pack = { pack_id: "bbb", core: { px: "1.0", kind: "px.pack", created_at: "x", category: "writing", previous: "aaa" } };
  const index = indexById([a, b]);
  // Must terminate, not loop forever.
  const ancestors = ancestorsOf(a, index);
  assert.deepEqual(ancestors.map((p) => p.pack_id), ["bbb"]);
});
