import Link from "next/link";
import { Compass, MapPinned, Route, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";
import { APP_FOOTER, INSTITUTION } from "@/lib/config";

const points = [
  { icon: MapPinned, title: "Digital campus directory", body: "Every hall, lab, hostel and office in one searchable database." },
  { icon: Route, title: "Shortest walking route", body: "Dijkstra's algorithm returns the true shortest path in milliseconds." },
  { icon: Compass, title: "Turn-by-turn guidance", body: "Distance, walking time and clear instructions for every step." },
  { icon: ShieldCheck, title: "Built for campus life", body: "Student, staff and visitor accounts with saved favourites." },
];

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-surface-2 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-primary-950 px-12 py-10 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(247,158,27,0.35), transparent 45%), radial-gradient(circle at 85% 70%, rgba(54,97,241,0.5), transparent 50%)",
          }}
        />
        <Link href="/" className="relative">
          <Wordmark />
        </Link>

        <div className="relative mt-auto max-w-md space-y-8">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Never walk in circles around campus again.
          </h1>
          <ul className="space-y-5">
            {points.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-accent-300">
                  <point.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{point.title}</span>
                  <span className="block text-sm text-white/70">{point.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-white/50">{APP_FOOTER}</p>
      </aside>

      {/* Form column */}
      <main className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:min-h-0 lg:justify-center">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Link href="/">
            <Wordmark compact />
          </Link>
        </div>

        <div className="mx-auto w-full max-w-md animate-fade-up">
          {children}
        </div>

        <p className="mt-10 text-center text-xs text-ink-muted lg:hidden">
          {APP_FOOTER}
        </p>
        <p className="mt-6 hidden text-center text-xs text-ink-muted lg:block">
          {INSTITUTION}
        </p>
      </main>
    </div>
  );
}
