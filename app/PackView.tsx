import { isSendAPack, shortId, type Pack } from "@/lib/pack/index.ts";
import { bySlug } from "./categories";
import { VerifyPopover } from "./VerifyPopover";
import { LighthouseNote } from "./LighthouseNote";

// One view for a pack, rendered in two contexts:
//   • "listing" — the public-register detail at /[category]/[pack_id]
//   • "viewer"  — the shareable .pack viewer at /pack/[pack_id]
// A send-a-pack (a file delivery) adds a cover note and a file list with the
// sender's per-file annotations. Everything else — the framing, the verifiable
// record, the chain — is shared, so the two contexts cannot drift apart.

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

export function PackView({
  pack,
  ancestors,
  mode,
}: {
  pack: Pack;
  ancestors: Pack[];
  mode: "listing" | "viewer";
}) {
  const { core, pack_id } = pack;
  const listing = core.listing;
  const delivery = isSendAPack(core);
  const titleVt = `pack-title-${shortId(pack_id)}`;

  return (
    <article className="pack">
      <header className="pack-head">
        <p className="pack-meta">
          {listing && <span className="pack-type">{listing.type}</span>}
          <time className="pack-date">{formatDate(core.created_at)}</time>
        </p>

        {listing && (
          <h1 className="pack-title" style={{ viewTransitionName: titleVt }}>
            {listing.title}
          </h1>
        )}

        {listing && (
          // Owner chip. The sender's own page is a later phase, so this is a
          // label, not a (dead) link — it names the domain the activity lives
          // on, which is where the value actually sits. PX only points here.
          <span className="sender" title="Owner page — coming soon">
            <span className="sender-name">{listing.sender}</span>
            <span className="sender-domain">{listing.domain}</span>
          </span>
        )}
      </header>

      {listing?.description && (
        <p className="pack-desc">{listing.description}</p>
      )}

      {listing?.fact && (
        <dl className="pack-facts">
          {Object.entries(listing.fact).map(([k, v]) => (
            <div className="fact" key={k}>
              <dt>{k.replace(/_/g, " ")}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {delivery && (
        <section className="delivery">
          {core.note && <p className="delivery-note">{core.note}</p>}
          <ul className="files">
            {core.files!.map((f) => (
              <li className="file" key={f.name}>
                <div className="file-row">
                  <span className="file-name">{f.name}</span>
                  {f.bytes !== undefined && (
                    <span className="file-size">{formatBytes(f.bytes)}</span>
                  )}
                  <button type="button" className="file-dl" disabled title="Example pack — files are illustrative">
                    Download
                  </button>
                </div>
                {f.note && <p className="file-note">{f.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="record" aria-label="Verifiable record">
        <h2 className="record-h">Verifiable record</h2>
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

      {ancestors.length > 0 && (
        <section className="chain" aria-label="Previous in chain">
          <h2 className="chain-h">Earlier in this chain</h2>
          <ol className="chain-list">
            {ancestors.map((a) => {
              const cat = bySlug(a.core.category);
              const href = cat
                ? `/${a.core.category}/${a.pack_id}/`
                : `/pack/${a.pack_id}/`;
              return (
                <li key={a.pack_id}>
                  <a className="chain-link" href={href}>
                    <span className="chain-title">
                      {a.core.listing?.title ?? "untitled pack"}
                    </span>
                    <span className="chain-id">{shortId(a.pack_id)}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {mode === "viewer" && (
        <>
          <LighthouseNote />
          <p className="send-your-own">
            Want to send your own pack? <a href="/">Public register →</a>
          </p>
        </>
      )}
    </article>
  );
}
