import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { APP_FOOTER, INSTITUTION } from "@/lib/config";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-2">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="MAPOLY Navigator home">
            <Wordmark compact />
          </Link>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <ThemeToggle />
            <Link href="/login" className="btn btn-ghost text-sm">
              Log in
            </Link>
            <Link href="/register" className="btn btn-primary text-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{APP_FOOTER}</p>
          <p>{INSTITUTION}</p>
        </div>
      </footer>
    </div>
  );
}
