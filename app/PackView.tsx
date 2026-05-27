"use client";

import {
  isSendAPack,
  isContainer,
  shortId,
  type Pack,
  type PxPackFile,
} from "@/lib/pack/index.ts";
import { bySlug } from "./categories";
import { VerifyPopover } from "./VerifyPopover";
import { LighthouseNote } from "./LighthouseNote";

// One view for a pack, rendered in three contexts:
//   • "listing" — the public-register detail at /[category]/[pack_id]
//   • "viewer"  — the shareable .pack viewer at /pack/[pack_id]
//   • "preview" — a live render inside the compose flow / a decoded share link,
//                 viewer layout but without claiming an open was recorded
// A send-a-pack (a file delivery) adds a cover note and a file list with the
// sender's per-file annotations. Everything else — the framing, the verifiable
// record, the chain — is shared, so the contexts cannot drift apart.
//
// This is a client component so the compose flow can re-render it live as the
// author types. Server routes (detail/viewer) render it too; static export
// still SSRs identical HTML, so their output is unchanged.

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

// A container's `contents` is a flat list whose names are relative paths; the
// tree is rebuilt here for display (the data stays flat and canonical-stable).
type TreeNode = {
  dirs: Map<string, TreeNode>;
  leaves: { file: PxPackFile; label: string }[];
};

function buildTree(files: PxPackFile[]): TreeNode {
  const root: TreeNode = { dirs: new Map(), leaves: [] };
  for (const file of files) {
    const parts = file.name.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node.dirs.has(dir)) node.dirs.set(dir, { dirs: new Map(), leaves: [] });
      node = node.dirs.get(dir)!;
    }
    node.leaves.push({ file, label: parts[parts.length - 1] });
  }
  return root;
}

function FileLeaf({
  file,
  label,
  dlTitle,
}: {
  file: PxPackFile;
  label: string;
  dlTitle: string;
}) {
  return (
    <>
      <div className="file-row">
        <span className="file-name">{label}</span>
        {file.bytes !== undefined && (
          <span className="file-size">{formatBytes(file.bytes)}</span>
        )}
        <button type="button" className="file-dl" disabled title={dlTitle}>
          Download
        </button>
      </div>
      {file.note && <p className="file-note">{file.note}</p>}
    </>
  );
}

// Native <details> gives collapsible folders with no client state.
function FileTree({ node, dlTitle }: { node: TreeNode; dlTitle: string }) {
  const dirNames = [...node.dirs.keys()].sort();
  return (
    <ul className="ftree">
      {dirNames.map((name) => (
        <li className="ftree-dir" key={`dir:${name}`}>
          <details open>
            <summary className="ftree-dir-name">{name}</summary>
            <FileTree node={node.dirs.get(name)!} dlTitle={dlTitle} />
          </details>
        </li>
      ))}
      {node.leaves.map(({ file, label }) => (
        <li className="ftree-leaf" key={`file:${file.name}`}>
          <FileLeaf file={file} label={label} dlTitle={dlTitle} />
        </li>
      ))}
    </ul>
  );
}

export function PackView({
  pack,
  ancestors,
  mode,
}: {
  pack: Pack;
  ancestors: Pack[];
  mode: "listing" | "viewer" | "preview";
}) {
  const { core, pack_id } = pack;
  const listing = core.listing;
  const delivery = isSendAPack(core);
  const titleVt = `pack-title-${shortId(pack_id)}`;
  const dlTitle =
    mode === "preview"
      ? "Demo — the file stays in your browser"
      : "Example pack — files are illustrative";

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
            {listing.domain && (
              <span className="sender-domain">{listing.domain}</span>
            )}
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
            {core.files!.map((f) =>
              isContainer(f) ? (
                <li className="file file-container" key={f.name}>
                  <div className="file-row">
                    <span className="file-name">{f.name}</span>
                    <span className="file-kind">
                      {f.kind === "archive" ? "archive" : "folder"}
                    </span>
                    <span className="file-size">
                      {f.contents!.length}{" "}
                      {f.contents!.length === 1 ? "file" : "files"}
                    </span>
                  </div>
                  {f.note && <p className="file-note">{f.note}</p>}
                  <FileTree node={buildTree(f.contents!)} dlTitle={dlTitle} />
                </li>
              ) : (
                <li className="file" key={f.name}>
                  <FileLeaf file={f} label={f.name} dlTitle={dlTitle} />
                </li>
              ),
            )}
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

      {mode === "viewer" && <LighthouseNote />}

      {mode === "preview" && (
        // The receiver's view, shown before any real open exists. State the
        // Lighthouse event descriptively rather than claim it happened.
        <aside className="lighthouse">
          <span className="lighthouse-line">
            In a published pack, Lighthouse records each open here.
          </span>
          <span className="lighthouse-sub">The event, not who you are.</span>
        </aside>
      )}

      {(mode === "viewer" || mode === "preview") && (
        <p className="send-your-own">
          Want to send your own pack? <a href="/compose/pack/">Send a pack →</a>
        </p>
      )}
    </article>
  );
}
