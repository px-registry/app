"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  canonicalize,
  computePackId,
  sha256Hex,
  type JsonValue,
  type Pack,
  type PxManifestCoreV1,
  type PxPackFile,
} from "@/lib/pack/index.ts";
import { PackView } from "../PackView";

// Send-a-pack composer — entirely client-side. Files are read with the File
// API and never leave the browser; PX receives nothing. The pack_id recomputes
// live from the manifest, and the share link carries the manifest itself (file
// list, notes, content hashes — not the bytes), so opening it rebuilds the
// receiver's view with no server in the loop. That is the honest shape of a
// demo under "PX holds nothing": the pack travels in the link.

type LocalFile = {
  name: string;
  bytes: number;
  sha256: string;
  note: string;
};

// A delivery is category-agnostic; it carries a valid category for the manifest
// without surfacing one in this flow.
const DELIVERY_CATEGORY = "service";

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

// ── component ─────────────────────────────────────────────────────────────

export function ComposePack() {
  // If the page is opened with a #pack=… fragment, it is a shared link: decode
  // and show the receiver's view instead of the editor.
  const [shared, setShared] = useState<PxManifestCoreV1 | null>(null);
  const [decodeError, setDecodeError] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[#&]pack=([^&]+)/);
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

  return (
    <section className="compose">
      <p className="demo-banner">
        Demo pack — rebuilt from the link. PX stored nothing; the manifest
        travelled in the URL. File contents are not carried, so downloads are a
        later phase.
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

function Editor() {
  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("");
  const [domain, setDomain] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [hashing, setHashing] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [packId, setPackId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // created_at is fixed at mount so the pack_id reflects content alone.
  const [createdAt] = useState(() => new Date().toISOString());
  const inputRef = useRef<HTMLInputElement>(null);

  // The manifest core, rebuilt whenever any input changes.
  const core: PxManifestCoreV1 = useMemo(() => {
    const packFiles: PxPackFile[] = files.map((f) => ({
      name: f.name,
      bytes: f.bytes,
      sha256: f.sha256,
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
    }));
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
      ...(packFiles.length ? { files: packFiles } : {}),
    };
  }, [title, sender, domain, coverNote, files, createdAt]);

  // Recompute pack_id live. A stale async result is dropped via the flag.
  useEffect(() => {
    let live = true;
    computePackId(core).then((id) => {
      if (live) setPackId(id);
    });
    return () => {
      live = false;
    };
  }, [core]);

  // A new share link must be regenerated after edits.
  useEffect(() => {
    setShareUrl(null);
    setCopied(false);
  }, [core]);

  const hasContent = title.trim() !== "" || files.length > 0;

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    setHashing((n) => n + incoming.length);
    for (const file of incoming) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const digest = await sha256Hex(buf);
        setFiles((prev) =>
          prev.some((p) => p.name === file.name && p.bytes === file.size)
            ? prev
            : [
                ...prev,
                { name: file.name, bytes: file.size, sha256: digest, note: "" },
              ],
        );
      } finally {
        setHashing((n) => n - 1);
      }
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    void addFiles(e.dataTransfer.files);
  }

  function setNote(index: number, note: string) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, note } : f)));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function createShareLink() {
    const url = `${window.location.origin}/compose/pack/#pack=${encodeManifest(core)}`;
    setShareUrl(url);
    setCopied(false);
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — the link is selectable in the field.
    }
  }

  const previewPack: Pack | null = packId ? { pack_id: packId, core } : null;

  return (
    <section className="compose">
      <header className="compose-head">
        <h1 className="compose-h">Send a pack</h1>
        <p className="compose-intro" lang="ja">
          ファイルはあなたのブラウザに留まります。PX は受け取りません。
        </p>
      </header>

      {/* 1 — details */}
      <fieldset className="compose-field">
        <legend>Pack</legend>
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
      </fieldset>

      {/* 2 — files */}
      <fieldset className="compose-field">
        <legend>Files</legend>
        <div
          className={`dropzone${dragOver ? " is-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <p className="dropzone-line">Drop files here</p>
          <button
            type="button"
            className="dropzone-btn"
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {hashing > 0 && (
          <p className="compose-note">Hashing {hashing} file(s)…</p>
        )}

        {files.length > 0 && (
          <ul className="compose-files">
            {files.map((f, i) => (
              <li className="compose-file" key={`${f.name}-${f.sha256}`}>
                <div className="compose-file-row">
                  <span className="file-name">{f.name}</span>
                  <button
                    type="button"
                    className="compose-file-rm"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.name}`}
                  >
                    remove
                  </button>
                </div>
                <textarea
                  className="field-input field-area"
                  value={f.note}
                  onChange={(e) => setNote(i, e.target.value)}
                  placeholder="Read this first — what changed since the proof."
                  rows={2}
                />
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* 3 — identity */}
      <section className="compose-identity">
        <h2 className="compose-sub-h">Identity</h2>
        <p className="identity-hint">This is your pack&rsquo;s identity.</p>
        <code className="identity-id">{packId ?? "computing…"}</code>
        <details className="identity-manifest">
          <summary>Canonical manifest (what gets hashed)</summary>
          <pre className="identity-json">
            {canonicalize(core as unknown as JsonValue)}
          </pre>
        </details>
      </section>

      {/* 4 — receiver preview */}
      <section className="compose-preview">
        <h2 className="compose-sub-h">Receiver&rsquo;s view</h2>
        {hasContent && previewPack ? (
          <div className="preview-frame">
            <PackView pack={previewPack} ancestors={[]} mode="preview" />
          </div>
        ) : (
          <p className="compose-note">
            Add a title and a file or two to see what the receiver sees.
          </p>
        )}
      </section>

      {/* 5 — share */}
      <section className="compose-share">
        <h2 className="compose-sub-h">Share</h2>
        <p className="demo-banner">
          Demo mode — files stay in your browser; PX receives nothing. The link
          carries the manifest (file list, notes, content hashes), not the file
          bytes. Nothing is stored, so a published <code>/pack/&lt;id&gt;/</code>{" "}
          address comes in a later phase.
        </p>
        {!shareUrl ? (
          <button
            type="button"
            className="share-btn"
            onClick={createShareLink}
            disabled={!hasContent}
          >
            Create share link
          </button>
        ) : (
          <div className="share-out">
            <input className="share-url" readOnly value={shareUrl} />
            <button type="button" className="share-copy" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
