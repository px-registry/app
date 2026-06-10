"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MEET } from "@/lib/meet/copy.ts";

const ITEMS = [
  { href: "/meet/", label: MEET.nav.home },
  { href: "/meet/memory/", label: MEET.nav.memory },
  { href: "/meet/start/", label: MEET.nav.start },
] as const;

export function MeetNav({ variant = "bar" }: { variant?: "bar" | "top" }) {
  const pathname = usePathname();
  // 第5便: two renderings of the same nav — the mobile thumb bar (fixed; must
  // NOT sit inside the backdrop-filtered header, which would become its
  // containing block) and the desktop header row. CSS shows exactly one.
  return (
    <nav className={variant === "top" ? "m-nav-top" : "m-nav"} aria-label={MEET.title}>
      <div className="m-nav-inner">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="m-nav-item"
            data-active={pathname === it.href || pathname === it.href.replace(/\/$/, "")}
          >
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
