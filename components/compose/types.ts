// Editor entry types for the send-a-pack composer.
//
// A leaf file, or a container (dropped folder, or an expanded .zip) holding
// nested files. The editor keeps containers' contents flat (relative paths);
// the receiver view (PackView) rebuilds the tree. Shared by PackComposerBody
// and the Day-8 Mode-2 composer so the two cannot drift apart.

/** One file inside a container, keyed by its path relative to that container. */
export type ContainedFile = {
  path: string;
  bytes: number;
  sha256: string;
  note: string;
};

export type LeafEntry = {
  id: string;
  kind: "file";
  name: string;
  bytes: number;
  sha256: string;
  note: string;
};

export type ContainerEntry = {
  id: string;
  kind: "folder" | "archive";
  name: string;
  note: string;
  contents: ContainedFile[];
};

export type Entry = LeafEntry | ContainerEntry;

/** Live upload state for one file, surfaced as a per-file progress row. */
export type FileState = "pending" | "uploading" | "done" | "error";
export type FileProgress = { pct: number; state: FileState };

/** A short, collision-tolerant id for keying editor rows (not content-bearing). */
export const rid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);
