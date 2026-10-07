"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  Compass,
  Gauge,
  LayoutGrid,
  LogOut,
  MessageSquareHeart,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client/api";

export interface ShellUser {
  id: number;
  fullName: string;
  email: string;
  role: "student" | "staff" | "visitor" | "admin";
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
  /** Show only on the desktop sidebar (mobile keeps the 4 core tabs). */
  desktopOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/navigate", label: "Navigate", icon: Compass },
  { href: "/history", label: "History", icon: Clock },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/feedback", label: "Feedback", icon: MessageSquareHeart, desktopOnly: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Authenticated application frame: desktop sidebar + mobile bottom tab bar,
 * with a top header carrying the wordmark, theme toggle and logout.
 */
export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const items = [...NAV_ITEMS];
  if (user.role === "admin") {
    items.push({ href: "/admin", label: "Admin", icon: ShieldCheck });
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign you out. Try again.");
    }
  }

  const mobileItems = items.filter((item) => !item.desktopOnly);

  return (
    <div className="flex h-dvh flex-col bg-surface-2 lg:flex-row lg:overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="MAPOLY Navigator home">
            <Wordmark compact />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="App">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`tap flex items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                  active
                    ? "bg-primary-600 text-white shadow-card"
                    : "text-ink-muted hover:bg-surface-3 hover:text-ink"
                }`}
              >
                <item.icon className="size-[18px]" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-surface-3 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary-600">
              <Gauge className="size-3" aria-hidden /> {user.role}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="tap mt-2 flex w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-muted transition hover:bg-surface-3 hover:text-danger-500"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <Link href="/dashboard" aria-label="MAPOLY Navigator home" className="lg:hidden">
            <Wordmark compact />
          </Link>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-ink">
              {items.find((item) => isActive(pathname, item.href))?.label ?? "MAPOLY Navigator"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-3 hover:text-ink sm:px-3"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>

        {/* Mobile tab bar */}
        <nav
          className="flex h-16 shrink-0 items-stretch border-t border-line bg-surface lg:hidden"
          aria-label="App"
        >
          {mobileItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                  active ? "text-primary-600" : "text-ink-muted"
                }`}
              >
                <span
                  className={`grid size-9 place-items-center rounded-full transition ${
                    active ? "bg-primary-50" : ""
                  }`}
                >
                  <item.icon className="size-5" aria-hidden />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
