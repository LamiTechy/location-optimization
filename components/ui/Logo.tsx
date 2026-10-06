import { MapPin } from "lucide-react";

/** App mark: navy tile + amber pin, used in headers and the auth screens. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center rounded-xl bg-primary-900 text-accent-400 shadow-card"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <MapPin className="size-[60%]" strokeWidth={2.4} />
    </span>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={compact ? 32 : 40} />
      <span className="leading-tight">
        <span className="block text-base font-extrabold tracking-tight text-ink">
          MAPOLY Navigator
        </span>
        {!compact && (
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Location Optimization System
          </span>
        )}
      </span>
    </span>
  );
}
