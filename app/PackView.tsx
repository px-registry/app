"use client";

import { useState } from "react";
import {
  isSendAPack,
  isContainer,
  shortId,
  sha256Hex,
  type Pack,
  type PxDelivery,
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

// Encode a pack-relative path for a URL, segment by segment (spaces, unicode).
const encodeSegments = (p: string) =>
  p.split("/").map(encodeURIComponent).join("/");

type LeafState =
  | "idle"
  | "downloading"
  | "verified"
  | "mismatch"
  | "expired"
  | "error";

// Shared download context threaded to every leaf in a delivery.
type Deliverable = {
  delivery: PxDelivery;
  expired: boolean;
} | null;

function FileLeaf({
  file,
  label,
  pathPrefix,
  deliverable,
  dlTitle,
}: {
  file: PxPackFile;
  label: string;
  /** Container name for nested files, "" for top-level leaves. */
  pathPrefix: string;
  deliverable: Deliverable;
  dlTitle: string;
}) {
  const [state, setState] = useState<LeafState>("idle");

  const fullPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
  // Functional only when bytes are actually delivered and we can verify them.
  const live =
    deliverable !== null &&
    !deliverable.expired &&
    typeof file.sha256 === "string";

  async function download() {
    if (!deliverable) return;
    setState("downloading");
    try {
      const url = deliverable.delivery.base + encodeSegments(fullPath);
      const res = await fetch(url);
      if (!res.ok) {
        setState(res.status === 404 || res.status === 410 ? "expired" : "error");
        return;
      }
      const buf = await res.arrayBuffer();
      // Verify against the manifest hash before handing the file over.
      const digest = await sha256Hex(new Uint8Array(buf));
      if (file.sha256 && digest !== file.sha256) {
        setState("mismatch");
        return;
      }
      const objUrl = URL.createObjectURL(new Blob([buf]));
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = label;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setState("verified");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <div className="file-row">
        <span className="file-name">{label}</span>
        {file.bytes !== undefined && (
          <span className="file-size">{formatBytes(file.bytes)}</span>
        )}
        {live ? (
          <button
            type="button"
            className="file-dl"
            onClick={download}
            disabled={state === "downloading"}
          >
            {state === "downloading"
              ? "Verifying…"
              : state === "verified"
                ? "Download again"
                : "Download"}
          </button>
        ) : (
          <button
            type="button"
            className="file-dl"
            disabled
            title={deliverable?.expired ? "This delivery has expired" : dlTitle}
          >
            Download
          </button>
        )}
        {state === "verified" && (
          <span className="file-verified" title="Hash matches the manifest">
            Verified ✓
          </span>
        )}
        {state === "mismatch" && (
          <span className="file-tampered">⚠ hash mismatch</span>
        )}
      </div>
      {state === "mismatch" && (
        <p className="file-warning" role="alert">
          This file does not match its manifest hash — it may be corrupted or
          tampered. It was not saved. The pack_id above is unchanged; re-check
          the source.
        </p>
      )}
      {state === "expired" && (
        <p className="file-warning">This file is no longer available — the delivery has expired.</p>
      )}
      {state === "error" && (
        <p className="file-warning">Download failed. The link may be unavailable; try again.</p>
      )}
      {file.note && <p className="file-note">{file.note}</p>}
    </>
  );
}

// Native <details> gives collapsible folders with no client state. `pathPrefix`
// is the container name, threaded down so each leaf can form its download URL.
function FileTree({
  node,
  pathPrefix,
  deliverable,
  dlTitle,
}: {
  node: TreeNode;
  pathPrefix: string;
  deliverable: Deliverable;
  dlTitle: string;
}) {
  const dirNames = [...node.dirs.keys()].sort();
  return (
    <ul className="ftree">
      {dirNames.map((name) => (
        <li className="ftree-dir" key={`dir:${name}`}>
          <details open>
            <summary className="ftree-dir-name">{name}</summary>
            <FileTree
              node={node.dirs.get(name)!}
              pathPrefix={pathPrefix}
              deliverable={deliverable}
              dlTitle={dlTitle}
            />
          </details>
        </li>
      ))}
      {node.leaves.map(({ file, label }) => (
        <li className="ftree-leaf" key={`file:${file.name}`}>
          <FileLeaf
            file={file}
            label={label}
            pathPrefix={pathPrefix}
            deliverable={deliverable}
            dlTitle={dlTitle}
          />
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
  const isDelivery = isSendAPack(core);
  const titleVt = `pack-title-${shortId(pack_id)}`;
  const dlTitle =
    mode === "preview"
      ? "Demo — the file stays in your browser"
      : "Example pack — files are illustrative";

  // Live delivery: bytes really held in storage. Absent on the example packs,
  // so their download buttons stay illustrative (disabled). When present, work
  // out whether the 30-day window has passed.
  const expMs = core.delivery ? Date.parse(core.delivery.expires_at) : NaN;
  const expired = Number.isFinite(expMs) ? Date.now() > expMs : false;
  const daysLeft = Number.isFinite(expMs)
    ? Math.ceil((expMs - Date.now()) / 86_400_000)
    : null;
  const deliverable: Deliverable = core.delivery
    ? { delivery: core.delivery, expired }
    : null;

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

      {isDelivery && (
        <section className="delivery">
          {core.note && <p className="delivery-note">{core.note}</p>}

          {deliverable &&
            (expired ? (
              <p className="delivery-expired">
                This delivery has expired. The files were held for 30 days and
                then deleted — long-term storage is not PX&rsquo;s role.
              </p>
            ) : (
              <p className="delivery-custody">
                Each file is verified against its manifest hash on download. PX
                relayed these bytes into delivery storage and does not read their
                contents.
                {daysLeft !== null && daysLeft <= 7 && (
                  <span className="delivery-expiring">
                    {" "}
                    Expires in {daysLeft} {daysLeft === 1 ? "day" : "days"}.
                  </span>
                )}
              </p>
            ))}

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
                  <FileTree
                    node={buildTree(f.contents!)}
                    pathPrefix={f.name}
                    deliverable={deliverable}
                    dlTitle={dlTitle}
                  />
                </li>
              ) : (
                <li className="file" key={f.name}>
                  <FileLeaf
                    file={f}
                    label={f.name}
                    pathPrefix=""
                    deliverable={deliverable}
                    dlTitle={dlTitle}
                  />
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
