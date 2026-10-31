"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "I'm parking", match: (p: string) => p === "/" || p.startsWith("/v/") || p === "/pass" },
  { href: "/desk", label: "Parking desk", match: (p: string) => p.startsWith("/desk") },
  { href: "/venues", label: "Venues", match: (p: string) => p.startsWith("/venues") },
];

export default function Nav() {
  const path = usePathname() || "/";
  return (
    <nav className="modes" aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.match(path) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
