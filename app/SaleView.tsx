"use client";

// SaleView — the buyer's view of a sale offer (sale/v1 form). Rendered in the
// same three contexts as PackView (listing / viewer / preview), and dispatched
// to from PackView when a pack carries a `sale` payload, so a sale share opening
// at /pack/[id]/ or a decoded share link renders here. The price is the hero;
// the photos are a gallery; the verifiable-record block is shared verbatim with
// PackView so the two cannot drift.
//
// PX implements no payment and holds no money (§ "持たない"). What is verifiable
// here is the *offer*: title, price and photos hash into the pack_id, so the
// terms can't be altered after the fact without minting a new id. The purchase
// itself happens on the seller's own domain.

import { useState } from "react";
import {
  formatPrice,
  shortId,
  type Pack,
  type PxDelivery,
  type PxSalePhoto,
} from "@/lib/pack/index.ts";
import { VerifyPopover } from "./VerifyPopover";
import { LighthouseNote } from "./LighthouseNote";

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

const encodeSegments = (p: string) =>
  p.split("/").map(encodeURIComponent).join("/");

type Deliverable = { delivery: PxDelivery; expired: boolean } | null;

// One photo tile. Shows the real image when its bytes are live in delivery
// storage; otherwise a quiet placeholder naming the file — honest about the fact
// that a metadata-only share carries no bytes (mirrors the file-pack preview).
function PhotoTile({
  photo,
  deliverable,
}: {
  photo: PxSalePhoto;
  deliverable: Deliverable;
}) {
  const [failed, setFailed] = useState(false);
  const live =
    deliverable !== null && !deliverable.expired && !failed;
  const src = deliverable
    ? deliverable.delivery.base + encodeSegments(photo.name)
    : "";

  return (
    <figure className="sale-photo">
      {live ? (
        <img
          className="sale-photo-img"
          src={src}
          alt={photo.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="sale-photo-placeholder" aria-hidden>
          ◳
        </span>
      )}
      <figcaption className="sale-photo-cap">
        <span className="sale-photo-name">{photo.name}</span>
        {photo.bytes !== undefined && (
          <span className="sale-photo-size">{formatBytes(photo.bytes)}</span>
        )}
        {!deliverable && (
          <span className="sale-photo-note">not uploaded</span>
        )}
        {deliverable?.expired && (
          <span className="sale-photo-note">expired</span>
        )}
      </figcaption>
    </figure>
  );
}

export function SaleView({
  pack,
  mode,
}: {
  pack: Pack;
  mode: "listing" | "viewer" | "preview";
}) {
  const { core, pack_id } = pack;
  const sale = core.sale!;
  const titleVt = `pack-title-${shortId(pack_id)}`;

  const expMs = core.delivery ? Date.parse(core.delivery.expires_at) : NaN;
  const expired = Number.isFinite(expMs) ? Date.now() > expMs : false;
  const deliverable: Deliverable = core.delivery
    ? { delivery: core.delivery, expired }
    : null;

  const photos = sale.photos ?? [];

  return (
    <article className="pack pack-sale">
      <header className="pack-head">
        <p className="pack-meta">
          <span className="pack-type">Sale</span>
          <time className="pack-date">{formatDate(core.created_at)}</time>
        </p>

        <h1 className="pack-title" style={{ viewTransitionName: titleVt }}>
          {sale.title}
        </h1>

        {/* Seller chip — a label, not a (dead) link. PX points at the seller's
            own domain, which is where the transaction and the value sit. */}
        <span className="sender" title="Seller page — coming soon">
          <span className="sender-name">{sale.sender}</span>
          {sale.domain && (
            <span className="sender-domain">{sale.domain}</span>
          )}
        </span>
      </header>

      {/* Price is the hero. */}
      <p className="sale-price">
        <span className="sale-price-amount">
          {formatPrice(sale.price.amount, sale.price.currency)}
        </span>
        <span className="sale-price-cur">{sale.price.currency}</span>
      </p>

      {photos.length > 0 && (
        <section className="sale-gallery" aria-label="Photos">
          <ul className="sale-photos">
            {photos.map((p) => (
              <li key={p.name}>
                <PhotoTile photo={p} deliverable={deliverable} />
              </li>
            ))}
          </ul>
          {deliverable && !expired && (
            <p className="sale-photos-note">
              PX relayed these photos into delivery storage and does not read
              their contents. They are held for 30 days, then deleted.
            </p>
          )}
          {deliverable && expired && (
            <p className="sale-photos-note">
              The photos were held for 30 days and then deleted — long-term
              storage is not PX&rsquo;s role. The offer above stays verifiable.
            </p>
          )}
        </section>
      )}

      {sale.description && <p className="sale-desc">{sale.description}</p>}

      <section className="record" aria-label="Verifiable record">
        <h2 className="record-h">Verifiable record</h2>
        <p className="sale-record-intro">
          PX holds no money and runs no payment. This is a verifiable
          <span> offer</span> — the price, title and photos above hash into the
          id below, so the terms cannot be changed after the fact.
        </p>
        <dl className="record-rows">
          <div className="record-row">
            <dt>pack id</dt>
            <dd className="record-id">{pack_id}</dd>
          </div>
          <div className="record-row">
            <dt>Sigstore Rekor</dt>
            <dd className="record-pending">awaiting log entry</dd>
          </div>
          <div className="record-row">
            <dt>Bitcoin anchor</dt>
            <dd className="record-pending">awaiting block</dd>
          </div>
        </dl>
        <VerifyPopover packId={pack_id} />
      </section>

      {mode === "viewer" && <LighthouseNote />}

      {mode === "preview" && (
        <aside className="lighthouse">
          <span className="lighthouse-line">
            In a published offer, Lighthouse records each open here.
          </span>
          <span className="lighthouse-sub">The event, not who you are.</span>
        </aside>
      )}

      {(mode === "viewer" || mode === "preview") && (
        <p className="send-your-own">
          Want to sell something verifiable?{" "}
          <a href="/compose/?mode=sale">Compose a sale →</a>
        </p>
      )}
    </article>
  );
}
