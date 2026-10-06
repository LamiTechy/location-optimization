"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitBranch,
  MapPinned,
  MessageSquareHeart,
  Users,
  Zap,
} from "lucide-react";

const TABS = [
  { href: "/admin", label: "Overview", icon: Zap, exact: true },
  { href: "/admin/locations", label: "Places", icon: MapPinned, exact: false },
  { href: "/admin/graph", label: "Graph", icon: GitBranch, exact: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareHeart, exact: false },
];

/** Section switcher rendered on every admin screen. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`tap inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-primary-600 text-white shadow-card"
                : "text-ink-muted hover:bg-surface-3 hover:text-ink"
            }`}
          >
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
