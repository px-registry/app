"use client";

// SaleComposerBody — the sale-offer composing surface for the Mode-2 dashboard.
// A second active category alongside Send-a-pack: it composes a verifiable
// *offer* (title + price + photos + description) rather than a file delivery.
//
// It reuses the send-a-pack machinery wherever the two genuinely share it —
// the share/upload bar, the identity bar, the receiver (buyer) preview, the R2
// upload relay, the share-link codec, and the drop-intake folder traversal — and
// owns only what is sale-specific: the price model, an image-only intake, and a
// flat (gallery-ordered) photo set. The pack_id recomputes live; PX receives
// nothing until the seller chooses to upload, and even then only relays bytes.
// PX implements no payment and holds no money — the offer is what is verifiable.

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
  parsePriceInput,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  type Pack,
  type PxDelivery,
  type PxManifestCoreV1,
  type PxSalePhoto,
} from "@/lib/pack/index.ts";
import { rid, type FileProgress, type FileState } from "./types.ts";
import { encodeManifest } from "./share-codec.ts";
import { uploadAll, type UploadItem } from "./upload.ts";
import { traverseEntry, type DropFile } from "./folder-intake.ts";
import { PackIdentityBar } from "./PackIdentityBar.tsx";
import { ReceiverPreview } from "./ReceiverPreview.tsx";
import { ShareBar } from "./ShareBar.tsx";
import type { ComposerIdentity } from "@/lib/auth-client.ts";

const SALE_CATEGORY = "sale";
const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)$/i;

/** A photo held in the editor: manifest fields plus a local preview URL. */
type PhotoEntry = {
  id: string;
  name: string;
  bytes: number;
  sha256: string;
  /** Object URL for the in-editor thumbnail (revoked on removal/unmount). */
  url: string;
};

function isImage(file: File, name: string): boolean {
  return file.type.startsWith("image/") || IMAGE_RE.test(name);
}

export function SaleComposerBody({
  identity = null,
  signedIn = false,
  onRequireAuth,
}: {
  identity?: ComposerIdentity | null;
  /** Whether an owner session is live; when false, publishing is gated. */
  signedIn?: boolean;
  /** Summon sign-in before a publish; resolves to the identity, or null if
   *  dismissed. Omitted in any host that doesn't gate (none today). */
  onRequireAuth?: () => Promise<ComposerIdentity | null>;
}) {
  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [description, setDescription] = useState("");
  const [sender, setSender] = useState("");
  const [domain, setDomain] = useState("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [hashing, setHashing] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [packId, setPackId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [delivery, setDelivery] = useState<PxDelivery | null>(null);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState<Record<string, FileProgress>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [createdAt] = useState(() => new Date().toISOString());
  // Bytes held outside React state, keyed by photo name (== upload path).
  const blobsRef = useRef<Map<string, Blob>>(new Map());
  // Live preview object URLs, so we can revoke them all on unmount.
  const urlsRef = useRef<Set<string>>(new Set());
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Owner auto-fill: seed seller/domain from the signed-in identity once, while
  // the field is still empty, so anything typed survives.
  useEffect(() => {
    if (!identity) return;
    setSender((s) => s || identity.sender);
    setDomain((d) => d || identity.domain);
  }, [identity]);

  // Revoke every preview object URL on unmount (the dashboard keeps this body
  // mounted for the session, so this fires only on leaving /compose/).
  useEffect(() => {
    const urls = urlsRef.current;
    const blobs = blobsRef.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
      blobs.clear();
    };
  }, []);

  const amount = parsePriceInput(amountInput, currency);

  const buildCore = useCallback(
    (deliveryArg?: PxDelivery): PxManifestCoreV1 => {
      // Photo order is content the seller chose (the first photo is the hero),
      // so it is preserved as-is — not sorted away like folder enumeration.
      const photoEntries: PxSalePhoto[] = photos.map((p) => ({
        name: p.name,
        bytes: p.bytes,
        sha256: p.sha256,
      }));
      return {
        px: "1.0",
        kind: "px.pack",
        created_at: createdAt,
        category: SALE_CATEGORY,
        sale: {
          title: title.trim() || "Untitled offer",
          price: { amount, currency },
          sender: sender.trim() || "Unnamed seller",
          domain: domain.trim(),
          ...(photoEntries.length ? { photos: photoEntries } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        },
        ...(deliveryArg ? { delivery: deliveryArg } : {}),
      };
    },
    [photos, title, amount, currency, sender, domain, description, createdAt],
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

  // Editing the offer invalidates any link/upload: the pack_id changes, so the
  // already-uploaded bytes no longer match. (Attaching a delivery only sets the
  // delivery field, which is stripped from the id, so it does not trip this.)
  useEffect(() => {
    setShareUrl(null);
    setCopied(false);
    setDelivery(null);
    setUploadState("idle");
    setProgress({});
    setUploadError(null);
  }, [title, amountInput, currency, description, sender, domain, photos]);

  const hasContent = title.trim() !== "" || photos.length > 0 || amount > 0;

  async function processImages(items: DropFile[]) {
    const images = items.filter(({ file, path }) => isImage(file, path));
    if (!images.length) return;
    setHashing((h) => h + images.length);
    // Hash and build entries (each with its File), then merge with dedup-by-name
    // in the state updater — only the kept entries claim the blob/URL slots.
    const candidates: { entry: PhotoEntry; file: File }[] = [];
    for (const { file, path } of images) {
      try {
        // Photos are a flat set — the display name is the file's leaf, not its
        // path inside any dropped folder.
        const norm = normalizePath(path);
        const name = norm.slice(norm.lastIndexOf("/") + 1);
        const sha = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
        candidates.push({
          entry: { id: rid(), name, bytes: file.size, sha256: sha, url: URL.createObjectURL(file) },
          file,
        });
      } finally {
        setHashing((h) => h - 1);
      }
    }
    setPhotos((prev) => {
      const seen = new Set(prev.map((p) => p.name));
      const fresh: PhotoEntry[] = [];
      for (const { entry, file } of candidates) {
        if (seen.has(entry.name)) {
          URL.revokeObjectURL(entry.url); // a same-named photo is already listed
          continue;
        }
        seen.add(entry.name);
        blobsRef.current.set(entry.name, file);
        urlsRef.current.add(entry.url);
        fresh.push(entry);
      }
      return [...prev, ...fresh];
    });
  }

  function addFileList(list: FileList | null) {
    if (!list || !list.length) return;
    const items: DropFile[] = Array.from(list).map((f) => ({
      file: f,
      path: f.name,
    }));
    void processImages(items);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
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
      if (items.length) await processImages(items);
    })();
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) {
        URL.revokeObjectURL(gone.url);
        urlsRef.current.delete(gone.url);
        blobsRef.current.delete(gone.name);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  // Publishing a sale attributes the offer to the seller, so a signed-out seller
  // is asked to sign in first (inline, draft preserved). Returns false if they
  // dismissed it. When already signed in, or when no gate is wired, it's a no-op.
  async function ensureAuth(): Promise<boolean> {
    if (signedIn || !onRequireAuth) return true;
    const id = await onRequireAuth();
    if (!id) return false;
    // Seed seller/domain from the new identity if still empty (best-effort; the
    // parent also re-seeds via the identity effect on its next render).
    setSender((s) => s || id.sender);
    setDomain((d) => d || id.domain);
    return true;
  }

  async function createShareLink() {
    if (!(await ensureAuth())) return;
    setShareUrl(
      `${window.location.origin}/compose/pack/#pack=${encodeManifest(buildCore())}`,
    );
    setCopied(false);
  }

  function collectUploadItems(): UploadItem[] {
    const items: UploadItem[] = [];
    for (const p of photos) {
      const blob = blobsRef.current.get(p.name);
      if (blob) items.push({ fullPath: p.name, blob });
    }
    return items;
  }

  async function uploadAndShare() {
    const items = collectUploadItems();
    if (!items.length) return;
    if (!(await ensureAuth())) return;
    setUploadState("uploading");
    setUploadError(null);
    setProgress(
      Object.fromEntries(
        items.map((it) => [it.fullPath, { pct: 0, state: "pending" as FileState }]),
      ),
    );
    try {
      // The content pack_id (delivery-free) is the storage prefix.
      const id = await computePackId(buildCore());
      const d = await uploadAll(id, items, (fullPath, pct, state) =>
        setProgress((prev) => ({ ...prev, [fullPath]: { pct, state } })),
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
    <section className="compose compose-sale" data-mode="mode2">
      <p className="compose-intro">
        List one thing for sale as a verifiable offer. The price, title and
        photos hash into the pack id — the terms can&rsquo;t change after the
        fact. PX runs no payment; the sale happens on your own domain.
      </p>

      <label className="field">
        <span className="field-label">Title</span>
        <input
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Wheel-thrown stoneware mug"
        />
      </label>

      <div className="field-row">
        <label className="field sale-price-field">
          <span className="field-label">Price</span>
          <input
            className="field-input"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            inputMode="decimal"
            placeholder={currency === "JPY" ? "4800" : "48.00"}
          />
        </label>
        <label className="field sale-currency-field">
          <span className="field-label">Currency</span>
          <select
            className="field-input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Photos — image-only drop. */}
      <div
        className={`dropzone dropzone-hero${dragOver ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="dropzone-line">Drop photos</p>
        <div className="dropzone-actions">
          <button
            type="button"
            className="dropzone-btn"
            onClick={() => photoInputRef.current?.click()}
          >
            Choose photos
          </button>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFileList(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {hashing > 0 && (
        <p className="compose-note">Hashing {hashing} photo(s) in your browser…</p>
      )}

      {photos.length > 0 && (
        <section className="compose-contents">
          <h2 className="compose-sub-h">
            Photos · {photos.length}{" "}
            {photos.length === 1 ? "photo" : "photos"}
          </h2>
          <ul className="sale-photo-edit">
            {photos.map((p) => (
              <li className="sale-photo-edit-item" key={p.id}>
                <img className="sale-photo-edit-img" src={p.url} alt={p.name} />
                <span className="sale-photo-edit-name">{p.name}</span>
                <button
                  type="button"
                  className="compose-file-rm"
                  onClick={() => removePhoto(p.id)}
                  aria-label={`Remove ${p.name}`}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="field">
        <span className="field-label">
          Description <span className="field-opt">optional</span>
        </span>
        <textarea
          className="field-input field-area"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One mug, wood-fired. Glaze pools at the foot — small kiln marks on the base."
          rows={3}
        />
      </label>

      <details className="compose-details" open={!!identity}>
        <summary>Seller</summary>
        <div className="compose-details-body">
          <div className="field-row">
            <label className="field">
              <span className="field-label">Seller</span>
              <input
                className="field-input"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Mariko Kiln"
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
                placeholder="mariko.example"
              />
            </label>
          </div>
        </div>
      </details>

      {hasContent && (
        <>
          <PackIdentityBar packId={packId} core={core} />
          <ReceiverPreview pack={previewPack} label="Buyer’s view" />
          <ShareBar
            hasContent={hasContent}
            fileCount={photos.length}
            uploadState={uploadState}
            progress={progress}
            uploadError={uploadError}
            shareUrl={shareUrl}
            copied={copied}
            delivery={delivery}
            onUploadAndShare={uploadAndShare}
            onCreateShareLink={createShareLink}
            onCopyLink={copyLink}
            noun="photo"
            uploadLabel="Upload photos & create link"
            metadataLabel="Share listing only (no photos)"
          />
        </>
      )}
    </section>
  );
}
