"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  canonicalize,
  computePackId,
  stripDelivery,
  hasDelivery,
  sha256Hex,
  normalizePath,
  isNormalizedPath,
  type JsonValue,
  type Pack,
  type PxDelivery,
  type PxManifestCoreV1,
  type PxPackFile,
} from "@/lib/pack/index.ts";
import { unzipSync } from "fflate";
import { PackView } from "../PackView";

// Send-a-pack composer — entirely client-side. Files are read with the File
// API and never leave the browser; PX receives nothing. The pack_id recomputes
// live from the manifest, and the share link carries the manifest itself (file
// list, notes, content hashes — not the bytes), so opening it rebuilds the
// receiver's view with no server in the loop.
//
// Drop is primary: a folder or a handful of files lands first, with notes; the
// title/sender metadata is secondary. Folder drop uses the DataTransferItem
// entries API (webkitGetAsEntry + recursive traversal) — the only reliable way
// to get a folder's *contents* on drop — with a webkitdirectory picker as the
// click fallback. (Patterns ported from the px-layer0 pack composer.)

// A leaf file, or a container (dropped folder, or an expanded .zip) holding
// nested files. The editor keeps containers' contents flat (relative paths);
// the receiver view rebuilds the tree.
type ContainedFile = { path: string; bytes: number; sha256: string; note: string };
type LeafEntry = {
  id: string;
  kind: "file";
  name: string;
  bytes: number;
  sha256: string;
  note: string;
};
type ContainerEntry = {
  id: string;
  kind: "folder" | "archive";
  name: string;
  note: string;
  contents: ContainedFile[];
};
type Entry = LeafEntry | ContainerEntry;

// A delivery is category-agnostic; it carries a valid category for the manifest
// without surfacing one in this flow.
const DELIVERY_CATEGORY = "service";

const rid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);

// ── share-link codec (unicode-safe base64url) ────────────────────────────

function encodeManifest(core: PxManifestCoreV1): string {
  const bytes = new TextEncoder().encode(JSON.stringify(core));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeManifest(encoded: string): PxManifestCoreV1 {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as PxManifestCoreV1;
}

// ── folder traversal (DataTransferItem entries API) ──────────────────────

type DropFile = { file: File; path: string };

function traverseEntry(
  entry: FileSystemEntry,
  basePath: string,
  out: DropFile[],
): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push({ file, path: basePath ? `${basePath}/${entry.name}` : entry.name });
          resolve();
        },
        () => resolve(),
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const all: FileSystemEntry[] = [];
      const readAll = () =>
        reader.readEntries(
          (entries) => {
            if (!entries.length) {
              const next = basePath ? `${basePath}/${entry.name}` : entry.name;
              Promise.all(all.map((e) => traverseEntry(e, next, out))).then(() =>
                resolve(),
              );
            } else {
              all.push(...Array.from(entries));
              readAll();
            }
          },
          () => resolve(),
        );
      readAll();
    } else {
      resolve();
    }
  });
}

// ── upload (sender → delivery storage) ───────────────────────────────────
//
// Each file is PUT to /api/upload/{pack_id}/{path}; the Function streams it into
// R2 and PX holds it for 30 days. We use XMLHttpRequest (not fetch) purely for
// its upload-progress events, so the sender sees per-file progress. The content
// pack_id is computed before any upload and used as the storage prefix, so the
// share link's identity is fixed before a single byte leaves the browser.

type UploadItem = { fullPath: string; blob: Blob };
type FileState = "pending" | "uploading" | "done" | "error";
type FileProgress = { pct: number; state: FileState };
type UploadResponse = { ok: boolean; base: string; expires_at: string; error?: string };

const encodeSegments = (p: string) =>
  p.split("/").map(encodeURIComponent).join("/");

// Where the /api/* Functions live. Same-origin when we are already on the Pages
// deployment (pages.dev) or running locally. But the canonical surface,
// app.px-registry.org, is fronted by the px-registry.org zone router, which only
// proxies GET to Pages — a PUT to the apex never reaches the upload Function. So
// from any non-Pages host we target the Pages origin directly; the permissive
// CORS on the Functions lets the browser PUT cross-origin, and the download base
// the Function returns is then on that same Pages origin (portable for any
// receiver). When a public R2 custom domain (files.px-registry.org) is wired up,
// this whole hop goes away.
const PAGES_ORIGIN = "https://px-app.pages.dev";
function apiOrigin(): string {
  const { hostname, origin } = window.location;
  if (
    hostname.endsWith(".pages.dev") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return origin;
  }
  return PAGES_ORIGIN;
}

function putWithProgress(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResponse);
        } catch {
          reject(new Error("Upload response was not readable"));
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText) as UploadResponse;
          if (j?.error) msg = j.error;
        } catch {
          /* non-JSON error body */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}

async function uploadAll(
  packId: string,
  items: UploadItem[],
  origin: string,
  onItemProgress: (fullPath: string, pct: number, state: FileState) => void,
  concurrency = 6,
): Promise<PxDelivery> {
  let base = "";
  let expires_at = "";
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const it = items[next++];
      const url = `${origin}/api/upload/${packId}/${encodeSegments(it.fullPath)}`;
      onItemProgress(it.fullPath, 0, "uploading");
      try {
        const res = await putWithProgress(url, it.blob, (p) =>
          onItemProgress(it.fullPath, p, "uploading"),
        );
        base = res.base;
        expires_at = res.expires_at;
        onItemProgress(it.fullPath, 1, "done");
      } catch (err) {
        onItemProgress(it.fullPath, 0, "error");
        throw err;
      }
    }
  }
  const pool = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(pool);
  return { base, expires_at };
}

// ── component ─────────────────────────────────────────────────────────────

export function ComposePack() {
  const [shared, setShared] = useState<PxManifestCoreV1 | null>(null);
  const [decodeError, setDecodeError] = useState(false);

  useEffect(() => {
    const match = window.location.hash.match(/[#&]pack=([^&]+)/);
    if (!match) return;
    try {
      setShared(decodeManifest(decodeURIComponent(match[1])));
    } catch {
      setDecodeError(true);
    }
  }, []);

  if (decodeError) {
    return (
      <section className="compose">
        <h1 className="compose-h">This share link could not be read</h1>
        <p className="compose-intro">
          The link may be truncated. <a href="/compose/pack/">Compose a new pack →</a>
        </p>
      </section>
    );
  }

  if (shared) return <SharedView core={shared} />;
  return <Editor />;
}

// ── shared (receiver) view ──────────────────────────────────────────────

function SharedView({ core }: { core: PxManifestCoreV1 }) {
  const [pack, setPack] = useState<Pack | null>(null);

  useEffect(() => {
    let live = true;
    computePackId(core).then((pack_id) => {
      if (live) setPack({ pack_id, core });
    });
    return () => {
      live = false;
    };
  }, [core]);

  const delivered = hasDelivery(core);
  return (
    <section className="compose">
      <p className="demo-banner">
        {delivered ? (
          <>
            Rebuilt from the link. The files were briefly relayed through PX into
            delivery storage and are held for 30 days, then automatically
            deleted. PX does not read file contents. Each download is verified
            against its hash below.
          </>
        ) : (
          <>
            Demo pack — rebuilt from the link. PX stored nothing; the manifest
            travelled in the URL. File contents are not carried, so downloads are
            a later phase.
          </>
        )}
      </p>
      {pack ? (
        <PackView pack={pack} ancestors={[]} mode="preview" />
      ) : (
        <p className="compose-intro">Reading pack…</p>
      )}
      <p className="send-your-own">
        <a href="/compose/pack/">Send a pack of your own →</a>
      </p>
    </section>
  );
}

// ── editor ────────────────────────────────────────────────────────────────

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

function Editor() {
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
      const d = await uploadAll(
        id,
        items,
        apiOrigin(),
        (fullPath, pct, state) =>
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

  // Aggregate upload progress for the status line.
  const progressValues = Object.values(progress);
  const uploadTotal = progressValues.length;
  const uploadDone = progressValues.filter((p) => p.state === "done").length;
  const aggregatePct = uploadTotal
    ? Math.round(
        (progressValues.reduce(
          (s, p) => s + (p.state === "done" ? 1 : p.pct),
          0,
        ) /
          uploadTotal) *
          100,
      )
    : 0;

  return (
    <section className="compose">
      <header className="compose-head">
        <h1 className="compose-h">Send a pack</h1>
        <p className="compose-intro" lang="ja">
          ファイルはまずブラウザで読まれ、ハッシュが計算されます。共有の方法はあなたが選びます。
        </p>
      </header>

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
                  <NoteArea
                    value={e.note}
                    onChange={(v) => setLeafNote(e.id, v)}
                  />
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

      {/* Metadata is secondary — folded away until wanted. */}
      <details className="compose-details">
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
          <section className="compose-identity">
            <h2 className="compose-sub-h">Identity</h2>
            <p className="identity-hint">This is your pack&rsquo;s identity.</p>
            <code className="identity-id">{packId ?? "computing…"}</code>
            <details className="identity-manifest">
              <summary>Canonical manifest (what gets hashed)</summary>
              <pre className="identity-json">
                {canonicalize(stripDelivery(core) as unknown as JsonValue)}
              </pre>
            </details>
          </section>

          <section className="compose-preview">
            <h2 className="compose-sub-h">Receiver&rsquo;s view</h2>
            {previewPack ? (
              <div className="preview-frame">
                <PackView pack={previewPack} ancestors={[]} mode="preview" />
              </div>
            ) : (
              <p className="compose-note">Building preview…</p>
            )}
          </section>

          <section className="compose-share">
            <h2 className="compose-sub-h">Share</h2>

            {uploadState !== "done" && (
              <p className="delivery-articulation">
                PX briefly relays your files to delivery storage. PX does not
                read file contents. They are held for 30 days, then automatically
                deleted — long-term storage is not PX&rsquo;s role. The receiver
                verifies each file against its hash.
              </p>
            )}

            {/* Per-file upload progress. */}
            {uploadState === "uploading" && (
              <div className="upload-progress">
                <p className="compose-note">
                  Relaying {uploadDone}/{uploadTotal} file(s) to delivery
                  storage… ({aggregatePct}%)
                </p>
                <ul className="upload-list">
                  {Object.entries(progress).map(([path, fp]) => (
                    <li className="upload-item" key={path}>
                      <span className="upload-path">{path}</span>
                      <span className="upload-bar" aria-hidden>
                        <span
                          className="upload-bar-fill"
                          style={{
                            width: `${Math.round(
                              (fp.state === "done" ? 1 : fp.pct) * 100,
                            )}%`,
                          }}
                        />
                      </span>
                      <span className={`upload-state upload-state-${fp.state}`}>
                        {fp.state === "done"
                          ? "✓"
                          : fp.state === "error"
                            ? "failed"
                            : `${Math.round(fp.pct * 100)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {uploadState === "error" && (
              <p className="upload-error" role="alert">
                Upload failed: {uploadError}. Nothing was shared.{" "}
                <button
                  type="button"
                  className="share-retry"
                  onClick={uploadAndShare}
                >
                  Try again
                </button>
              </p>
            )}

            {!shareUrl ? (
              <div className="share-actions">
                {fileCount > 0 && (
                  <button
                    type="button"
                    className="share-btn"
                    onClick={uploadAndShare}
                    disabled={uploadState === "uploading"}
                  >
                    {uploadState === "uploading"
                      ? "Uploading…"
                      : "Upload & create share link"}
                  </button>
                )}
                <button
                  type="button"
                  className="share-btn-secondary"
                  onClick={createShareLink}
                  disabled={!hasContent || uploadState === "uploading"}
                >
                  Share file list only (no upload)
                </button>
              </div>
            ) : (
              <div className="share-result">
                <p
                  className={
                    delivery ? "delivery-confirmed" : "metadata-only-note"
                  }
                >
                  {delivery ? (
                    <>
                      Files uploaded. This link delivers the bytes and expires{" "}
                      {new Date(delivery.expires_at).toLocaleDateString()} (30
                      days). The receiver downloads and verifies each file.
                    </>
                  ) : (
                    <>
                      Metadata-only link — the file list and hashes travel in the
                      URL; no bytes were uploaded.
                    </>
                  )}
                </p>
                <div className="share-out">
                  <input className="share-url" readOnly value={shareUrl} />
                  <button
                    type="button"
                    className="share-copy"
                    onClick={copyLink}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            )}
          </section>
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
