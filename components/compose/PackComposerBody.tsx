"use client";

// PackComposerBody — the send-a-pack composing surface, extracted from
// ComposePack so the Day-8 Mode-2 dashboard can mount the same body. It owns the
// genuinely local editor state (file entries, the out-of-React blob store, live
// pack_id, upload progress); the presentational pieces it composes — the
// dropzone + contents, the identity bar, the receiver preview, the share bar —
// are shared components, so Mode 1 and Mode 2 render an identical experience.
//
// Files are read with the File API and never leave the browser until the sender
// chooses to upload; the pack_id recomputes live from the manifest. PX receives
// nothing unless an upload is requested, and even then only relays the bytes.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  computePackId,
  sha256Hex,
  normalizePath,
  isNormalizedPath,
  type Pack,
  type PxDelivery,
  type PxManifestCoreV1,
  type PxPackFile,
} from "@/lib/pack/index.ts";
import { unzipSync } from "fflate";
import {
  rid,
  type ContainedFile,
  type ContainerEntry,
  type Entry,
  type FileProgress,
  type FileState,
  type LeafEntry,
} from "./types.ts";
import { encodeManifest } from "./share-codec.ts";
import { uploadAll, type UploadItem } from "./upload.ts";
import { traverseEntry, type DropFile } from "./folder-intake.ts";
import { PackIdentityBar } from "./PackIdentityBar.tsx";
import { ReceiverPreview } from "./ReceiverPreview.tsx";
import { ShareBar } from "./ShareBar.tsx";
import type { ComposerIdentity } from "@/lib/auth-client.ts";

// Re-exported so existing importers (ComposePack) keep their import path; the
// canonical definition now lives with the auth client (lib/auth-client.ts).
export type { ComposerIdentity };

// A delivery is category-agnostic; it carries a valid category for the manifest
// without surfacing one in this flow.
const DELIVERY_CATEGORY = "service";

function mergeEntries(
  prev: Entry[],
  newLeaves: LeafEntry[],
  folders: Map<string, ContainedFile[]>,
  archives: ContainerEntry[],
): Entry[] {
  const next = [...prev];

  for (const leaf of newLeaves) {
    if (
      !next.some(
        (e) => e.kind === "file" && e.name === leaf.name && e.bytes === leaf.bytes,
      )
    ) {
      next.push(leaf);
    }
  }

  for (const [name, incoming] of folders) {
    const existing = next.find(
      (e) => e.kind === "folder" && e.name === name,
    ) as ContainerEntry | undefined;
    if (existing) {
      for (const c of incoming) {
        if (!existing.contents.some((x) => x.path === c.path)) {
          existing.contents.push(c);
        }
      }
    } else {
      next.push({ id: rid(), kind: "folder", name, note: "", contents: incoming });
    }
  }

  // Archives are added as-is; a re-dropped archive of the same name is skipped.
  for (const archive of archives) {
    if (!next.some((e) => e.kind === "archive" && e.name === archive.name)) {
      next.push(archive);
    }
  }

  return next;
}

export function PackComposerBody({
  mode = "mode1",
  identity = null,
}: {
  mode?: "mode1" | "mode2";
  identity?: ComposerIdentity | null;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("");
  const [domain, setDomain] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [hashing, setHashing] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [packId, setPackId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delivery custody: the file bytes, once relayed to storage. Attached only
  // after a successful upload, and stripped from the pack_id, so it never
  // changes the pack's content identity.
  const [delivery, setDelivery] = useState<PxDelivery | null>(null);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState<Record<string, FileProgress>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [createdAt] = useState(() => new Date().toISOString());
  // The actual bytes, held outside React state (too large for it), keyed by the
  // pack-relative path. Populated on intake, read at upload time.
  const blobsRef = useRef<Map<string, Blob>>(new Map());
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // Owner auto-fill (Phase E): when a signed-in identity arrives and the field
  // is still empty, seed sender/domain from it. Runs only when `identity`
  // changes, so anything the sender has typed is preserved and stays editable.
  useEffect(() => {
    if (!identity) return;
    setSender((s) => s || identity.sender);
    setDomain((d) => d || identity.domain);
  }, [identity]);

  // Build the manifest core from the current editor state. `deliveryArg`, when
  // given, is embedded — but computePackId strips it, so the content identity is
  // identical whether or not bytes were uploaded.
  const buildCore = useCallback(
    (deliveryArg?: PxDelivery): PxManifestCoreV1 => {
      const files: PxPackFile[] = entries.map((e) =>
        e.kind === "file"
          ? {
              name: e.name,
              bytes: e.bytes,
              sha256: e.sha256,
              ...(e.note.trim() ? { note: e.note.trim() } : {}),
            }
          : {
              name: e.name,
              kind: e.kind,
              ...(e.note.trim() ? { note: e.note.trim() } : {}),
              // Sort contents so the pack_id is independent of OS/browser
              // enumeration order (spec §8.4: order by normalized path).
              contents: [...e.contents]
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((c) => ({
                  name: c.path,
                  bytes: c.bytes,
                  sha256: c.sha256,
                  ...(c.note.trim() ? { note: c.note.trim() } : {}),
                })),
            },
      );
      return {
        px: "1.0",
        kind: "px.pack",
        created_at: createdAt,
        category: DELIVERY_CATEGORY,
        ...(coverNote.trim() ? { note: coverNote.trim() } : {}),
        listing: {
          title: title.trim() || "Untitled pack",
          sender: sender.trim() || "Unnamed sender",
          domain: domain.trim(),
          type: "Delivery",
        },
        ...(files.length ? { files } : {}),
        ...(deliveryArg ? { delivery: deliveryArg } : {}),
      };
    },
    [entries, title, sender, domain, coverNote, createdAt],
  );

  const core: PxManifestCoreV1 = useMemo(
    () => buildCore(delivery ?? undefined),
    [buildCore, delivery],
  );

  useEffect(() => {
    let live = true;
    computePackId(core).then((id) => {
      if (live) setPackId(id);
    });
    return () => {
      live = false;
    };
  }, [core]);

  // Editing the *content* invalidates the link, the upload, and the delivery:
  // the pack_id changes, so any already-uploaded bytes no longer match. (Adding
  // a delivery only changes the delivery field, so it does not trip this.)
  useEffect(() => {
    setShareUrl(null);
    setCopied(false);
    setDelivery(null);
    setUploadState("idle");
    setProgress({});
    setUploadError(null);
  }, [entries, title, sender, domain, coverNote]);

  const hasContent = entries.length > 0 || title.trim() !== "";
  const fileCount = entries.reduce(
    (n, e) => n + (e.kind === "file" ? 1 : e.contents.length),
    0,
  );

  async function processIntake(items: DropFile[]) {
    setHashing((h) => h + items.length);
    const newLeaves: LeafEntry[] = [];
    const folders = new Map<string, ContainedFile[]>();
    const archives: ContainerEntry[] = [];
    for (const { file, path } of items) {
      const norm = normalizePath(path);
      if (!isNormalizedPath(norm)) {
        setHashing((h) => h - 1);
        continue;
      }
      const slash = norm.indexOf("/");
      try {
        // A top-level .zip is expanded in the browser into an archive entry.
        if (slash === -1 && /\.zip$/i.test(norm)) {
          const buf = new Uint8Array(await file.arrayBuffer());
          const expanded = await expandZip(norm, buf);
          if (expanded) {
            archives.push(expanded);
            continue;
          }
          // Not a readable zip — keep it as an opaque file.
          newLeaves.push({
            id: rid(),
            kind: "file",
            name: norm,
            bytes: file.size,
            sha256: await sha256Hex(buf),
            note: "",
          });
          blobsRef.current.set(norm, file);
          continue;
        }

        const sha = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
        if (slash === -1) {
          newLeaves.push({
            id: rid(),
            kind: "file",
            name: norm,
            bytes: file.size,
            sha256: sha,
            note: "",
          });
          blobsRef.current.set(norm, file);
        } else {
          const top = norm.slice(0, slash);
          const rest = norm.slice(slash + 1);
          if (!folders.has(top)) folders.set(top, []);
          folders.get(top)!.push({ path: rest, bytes: file.size, sha256: sha, note: "" });
          // Keyed by the full pack-relative path (top/rest === norm).
          blobsRef.current.set(norm, file);
        }
      } finally {
        setHashing((h) => h - 1);
      }
    }
    setEntries((prev) => mergeEntries(prev, newLeaves, folders, archives));
  }

  // Expand a .zip in the browser (fflate). Returns null if it is not a valid
  // archive. Directory records and any unsafe paths are skipped.
  async function expandZip(
    name: string,
    buf: Uint8Array,
  ): Promise<ContainerEntry | null> {
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(buf);
    } catch {
      return null;
    }
    const contents: ContainedFile[] = [];
    for (const [entryName, data] of Object.entries(unzipped)) {
      if (entryName.endsWith("/")) continue; // directory record
      const inorm = normalizePath(entryName);
      if (!isNormalizedPath(inorm)) continue;
      contents.push({
        path: inorm,
        bytes: data.length,
        sha256: await sha256Hex(data),
        note: "",
      });
      // The decompressed bytes, keyed by the full pack-relative path so the
      // uploader (and the receiver's download URL) find them under name/inorm.
      blobsRef.current.set(`${name}/${inorm}`, new Blob([data as BlobPart]));
    }
    return { id: rid(), kind: "archive", name, note: "", contents };
  }

  function addFileList(list: FileList | null) {
    if (!list || !list.length) return;
    const items: DropFile[] = Array.from(list).map((f) => ({
      file: f,
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }));
    void processIntake(items);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
    // Capture entries synchronously — the DataTransfer is cleared after the
    // event, but the FileSystemEntry objects stay usable across the awaits.
    const fsEntries: FileSystemEntry[] = [];
    if (dt.items && dt.items.length && "webkitGetAsEntry" in dt.items[0]) {
      for (let i = 0; i < dt.items.length; i++) {
        const en = dt.items[i].webkitGetAsEntry?.();
        if (en) fsEntries.push(en);
      }
    }
    const plain = Array.from(dt.files);
    void (async () => {
      const items: DropFile[] = [];
      for (const en of fsEntries) await traverseEntry(en, "", items);
      if (!items.length) {
        for (const f of plain) if (f.size > 0) items.push({ file: f, path: f.name });
      }
      if (items.length) await processIntake(items);
    })();
  }

  // ── mutations ──
  function setLeafNote(id: string, note: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id && e.kind === "file" ? { ...e, note } : e)),
    );
  }
  function setContainerNote(id: string, note: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id && e.kind !== "file" ? { ...e, note } : e)),
    );
  }
  function setContainedNote(id: string, path: string, note: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id && e.kind !== "file"
          ? {
              ...e,
              contents: e.contents.map((c) => (c.path === path ? { ...c, note } : c)),
            }
          : e,
      ),
    );
  }
  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }
  function removeContained(id: string, path: string) {
    setEntries((prev) =>
      prev
        .map((e) =>
          e.id === id && e.kind !== "file"
            ? { ...e, contents: e.contents.filter((c) => c.path !== path) }
            : e,
        )
        .filter((e) => e.kind === "file" || e.contents.length > 0),
    );
  }

  // Metadata-only link: the file list, notes and hashes travel in the URL; no
  // bytes are uploaded (the original 持たない share). Built from a delivery-free
  // core so it carries no delivery field even if an upload happened earlier.
  function createShareLink() {
    setShareUrl(
      `${window.location.origin}/compose/pack/#pack=${encodeManifest(buildCore())}`,
    );
    setCopied(false);
  }

  // Gather the actual bytes for every file currently listed, in manifest order.
  function collectUploadItems(): UploadItem[] {
    const items: UploadItem[] = [];
    for (const e of entries) {
      if (e.kind === "file") {
        const blob = blobsRef.current.get(e.name);
        if (blob) items.push({ fullPath: e.name, blob });
      } else {
        for (const c of e.contents) {
          const fullPath = `${e.name}/${c.path}`;
          const blob = blobsRef.current.get(fullPath);
          if (blob) items.push({ fullPath, blob });
        }
      }
    }
    return items;
  }

  // Real delivery: relay every file's bytes into storage (held 30 days), then
  // embed the returned base + expiry into the share link's manifest.
  async function uploadAndShare() {
    const items = collectUploadItems();
    if (!items.length) return;
    setUploadState("uploading");
    setUploadError(null);
    setProgress(
      Object.fromEntries(
        items.map((it) => [it.fullPath, { pct: 0, state: "pending" as FileState }]),
      ),
    );
    try {
      // Identity first: the content pack_id (delivery-free) is the storage prefix.
      const id = await computePackId(buildCore());
      const d = await uploadAll(id, items, (fullPath, pct, state) =>
        setProgress((p) => ({ ...p, [fullPath]: { pct, state } })),
      );
      setDelivery(d);
      setShareUrl(
        `${window.location.origin}/compose/pack/#pack=${encodeManifest(buildCore(d))}`,
      );
      setUploadState("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("error");
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — link is selectable in the field */
    }
  }

  const previewPack: Pack | null = packId ? { pack_id: packId, core } : null;

  return (
    <section className="compose" data-mode={mode}>
      {/* In Mode 2 (the dashboard) the left rail already names the active mode,
          so the body's own header would be redundant — suppress it. The "Send a
          pack" title + intro only render in Mode 1 (the standalone composer). */}
      {mode === "mode1" && (
        <header className="compose-head">
          <h1 className="compose-h">Send a pack</h1>
          <p className="compose-intro" lang="ja">
            ファイルはまずブラウザで読まれ、ハッシュが計算されます。共有の方法はあなたが選びます。
          </p>
          {identity && (
            <p className="compose-signedin-hint">
              Signed in as{" "}
              <span className="signedin-handle">@{identity.handle}</span> — your
              sender and domain are pre-filled below.{" "}
              <a className="compose-dashboard-link" href="/me/compose/?mode=pack">
                Try the dashboard →
              </a>
            </p>
          )}
        </header>
      )}

      {/* Drop is the hero. */}
      <div
        className={`dropzone dropzone-hero${dragOver ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="dropzone-line">Drop files or a folder</p>
        <div className="dropzone-actions">
          <button
            type="button"
            className="dropzone-btn"
            onClick={() => filesRef.current?.click()}
          >
            Choose files
          </button>
          <button
            type="button"
            className="dropzone-btn"
            onClick={() => folderRef.current?.click()}
          >
            Add folder
          </button>
        </div>
        <input
          ref={filesRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFileList(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderRef}
          type="file"
          hidden
          // @ts-expect-error webkitdirectory is a non-standard attribute
          webkitdirectory=""
          onChange={(e) => {
            addFileList(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {hashing > 0 && (
        <p className="compose-note">Hashing {hashing} file(s) in your browser…</p>
      )}

      {entries.length > 0 && (
        <section className="compose-contents">
          <h2 className="compose-sub-h">
            Contents · {fileCount} {fileCount === 1 ? "file" : "files"}
          </h2>
          <ul className="compose-entries">
            {entries.map((e) =>
              e.kind === "file" ? (
                <li className="compose-entry" key={e.id}>
                  <div className="compose-entry-row">
                    <span className="file-name">{e.name}</span>
                    <button
                      type="button"
                      className="compose-file-rm"
                      onClick={() => removeEntry(e.id)}
                      aria-label={`Remove ${e.name}`}
                    >
                      remove
                    </button>
                  </div>
                  <NoteArea value={e.note} onChange={(v) => setLeafNote(e.id, v)} />
                </li>
              ) : (
                <li className="compose-entry compose-entry-container" key={e.id}>
                  <div className="compose-entry-row">
                    <span className="file-name">{e.name}</span>
                    <span className="file-kind">
                      {e.kind === "archive" ? "archive" : "folder"}
                    </span>
                    <span className="file-size">{e.contents.length} files</span>
                    <button
                      type="button"
                      className="compose-file-rm"
                      onClick={() => removeEntry(e.id)}
                      aria-label={`Remove ${e.name}`}
                    >
                      remove
                    </button>
                  </div>
                  <NoteArea
                    value={e.note}
                    onChange={(v) => setContainerNote(e.id, v)}
                    placeholder="Note for this folder…"
                  />
                  <ul className="compose-contained">
                    {[...e.contents]
                      .sort((a, b) => a.path.localeCompare(b.path))
                      .map((c) => (
                        <li className="compose-contained-item" key={c.path}>
                          <div className="compose-entry-row">
                            <span className="contained-path">{c.path}</span>
                            <button
                              type="button"
                              className="compose-file-rm"
                              onClick={() => removeContained(e.id, c.path)}
                              aria-label={`Remove ${c.path}`}
                            >
                              remove
                            </button>
                          </div>
                          <NoteArea
                            value={c.note}
                            onChange={(v) => setContainedNote(e.id, c.path, v)}
                          />
                        </li>
                      ))}
                  </ul>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {/* Metadata is secondary — folded away until wanted. Opened by default for
          a signed-in sender so the pre-filled sender/domain are visible. */}
      <details className="compose-details" open={!!identity}>
        <summary>Pack details (optional)</summary>
        <div className="compose-details-body">
          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Tide Tables — final files"
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Sender</span>
              <input
                className="field-input"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Asterism Books"
              />
            </label>
            <label className="field">
              <span className="field-label">
                Domain <span className="field-opt">optional</span>
              </span>
              <input
                className="field-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="asterism-books.example"
              />
            </label>
          </div>
          <label className="field">
            <span className="field-label">
              Cover note <span className="field-opt">optional</span>
            </span>
            <textarea
              className="field-input field-area"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Everything you need to sign off is here — read the notes first."
              rows={2}
            />
          </label>
        </div>
      </details>

      {hasContent && (
        <>
          <PackIdentityBar packId={packId} core={core} />
          <ReceiverPreview pack={previewPack} />
          <ShareBar
            hasContent={hasContent}
            fileCount={fileCount}
            uploadState={uploadState}
            progress={progress}
            uploadError={uploadError}
            shareUrl={shareUrl}
            copied={copied}
            delivery={delivery}
            onUploadAndShare={uploadAndShare}
            onCreateShareLink={createShareLink}
            onCopyLink={copyLink}
          />
        </>
      )}
    </section>
  );
}

// Auto-growing note textarea, used for every annotation (leaf and contained).
function NoteArea({
  value,
  onChange,
  placeholder = "Read this first — what changed…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className="field-input field-area note-area"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
    />
  );
}
