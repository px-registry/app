"use client";

// PXのやくそく — the boundary facts. Shown OPEN on a device's first visit,
// collapsed (but always present) afterwards: the promises don't repeat at full
// volume on every page, and they never disappear either.

import { useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import { boundarySeen, markBoundarySeen } from "@/lib/meet-net";

export function BoundaryNote({ lines }: { lines: readonly string[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!boundarySeen()) {
      setOpen(true);
      markBoundarySeen();
    }
  }, []);

  return (
    <details className="m-promise" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{MEET.boundaryTitle}</summary>
      <div className="m-boundary">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </details>
  );
}
