// Folder traversal for drop intake (DataTransferItem entries API).
//
// Folder drop uses the entries API (webkitGetAsEntry + recursive traversal) —
// the only reliable way to get a folder's *contents* on drop — with a
// webkitdirectory picker as the click fallback. (Patterns ported from the
// px-layer0 pack composer.)

export type DropFile = { file: File; path: string };

export function traverseEntry(
  entry: FileSystemEntry,
  basePath: string,
  out: DropFile[],
): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push({
            file,
            path: basePath ? `${basePath}/${entry.name}` : entry.name,
          });
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
