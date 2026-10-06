import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Database,
  Footprints,
  Map,
  Search,
  Signpost,
} from "lucide-react";

const features = [
  {
    icon: Database,
    title: "Campus location database",
    body: "Lecture theatres, departments, labs, hostels, gates and offices - each with its category, building and opening hours.",
  },
  {
    icon: Search,
    title: "Instant search",
    body: "Type a few letters and pick from ranked suggestions, category chips and your recent or favourite places.",
  },
  {
    icon: Signpost,
    title: "Turn-by-turn directions",
    body: "Every route comes with distance, walking time and instructions such as “turn left at the Library”.",
  },
  {
    icon: Footprints,
    title: "Live walking guidance",
    body: "Follow your position on the map, get re-routed when you stray more than 30 m, and see when you arrive.",
  },
];

const steps = [
  { n: "1", title: "Set your location", body: "Use live GPS or pick a campus place." },
  { n: "2", title: "Search a destination", body: "Find any building, hall or office." },
  { n: "3", title: "Compute the route", body: "Dijkstra finds the shortest walking path." },
  { n: "4", title: "Follow and arrive", body: "Watch the map, get re-routed, arrive." },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-950 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(247,158,27,0.28), transparent 40%), radial-gradient(circle at 80% 60%, rgba(54,97,241,0.45), transparent 45%)",
          }}
        />
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-300">
              Moshood Abiola Polytechnic, Abeokuta
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              The shortest way to anywhere on campus.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              MAPOLY Navigator turns the campus into a searchable map. Pick where
              you are, pick where you are going, and get the optimal walking
              route computed with Dijkstra&apos;s algorithm in under a second.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-accent text-base">
                Get started free <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="btn border border-white/25 bg-white/5 text-base text-white hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Decorative route card */}
          <div className="relative animate-fade-up">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="rounded-2xl bg-surface p-4 text-ink shadow-card">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <span>Optimized route</span>
                  <span className="rounded-full bg-success-500/15 px-2 py-1 text-success-500">
                    Shortest path
                  </span>
                </div>

                <svg
                  viewBox="0 0 320 150"
                  className="mt-3 w-full"
                  role="img"
                  aria-label="Illustration of a shortest route across campus"
                >
                  <defs>
                    <marker id="dot" markerWidth="8" markerHeight="8" refX="4" refY="4">
                      <circle cx="4" cy="4" r="4" fill="#f79e1b" />
                    </marker>
                  </defs>
                  <g stroke="var(--line)" strokeWidth="10" strokeLinecap="round">
                    <path d="M20 120 H120" />
                    <path d="M120 120 V60 H210" />
                    <path d="M210 60 V30 H300" />
                    <path d="M120 60 V130 H300" />
                  </g>
                  <path
                    d="M20 120 H120 V60 H210 V30 H300"
                    fill="none"
                    stroke="#2044d8"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="route-line"
                    strokeDasharray="10 8"
                    style={{ animation: "route-dash 1.4s linear infinite" }}
                    markerEnd="url(#dot)"
                  />
                  <circle cx="20" cy="120" r="7" fill="#16a34a" />
                </svg>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: Footprints, label: "Distance", value: "642 m" },
                    { icon: Clock3, label: "Walking", value: "8 min" },
                    { icon: Map, label: "Steps", value: "6 turns" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-surface-2 p-2">
                      <item.icon className="mx-auto size-4 text-primary-600" aria-hidden />
                      <p className="mt-1 text-[11px] text-ink-muted">{item.label}</p>
                      <p className="text-sm font-bold text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Everything a first-time visitor needs
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="card p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-50 text-primary-600">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li key={step.n} className="relative card p-5">
                <span className="grid size-9 place-items-center rounded-full bg-accent-500 text-sm font-extrabold text-[#2b1500]">
                  {step.n}
                </span>
                <h3 className="mt-3 font-bold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="card flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              Stop asking for directions. Start following them.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-muted">
              Create a free account to save favourite places, review your route
              history and rate the directions you receive.
            </p>
          </div>
          <Link href="/register" className="btn btn-primary shrink-0">
            Create an account <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
