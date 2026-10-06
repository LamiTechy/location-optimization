"use client";

import { CheckCircle2, MessageSquareHeart, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDistance } from "@/lib/geo/eta";
import { clockTime } from "@/lib/format";

/**
 * Shown when GPS says the walker is inside the arrival radius of the
 * destination (report: arrival confirmation).
 */
export function ArrivalCard({
  destinationName,
  walkedDistanceM,
  onDone,
}: {
  destinationName: string;
  walkedDistanceM: number;
  onDone: () => void;
}) {
  return (
    <div className="animate-fade-up rounded-2xl border border-success-500/30 bg-success-500/10 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success-500 text-white">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <PartyPopper className="size-4 text-success-500" aria-hidden />
            You have arrived
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">
            {destinationName} · {formatDistance(walkedDistanceM)} walked ·{" "}
            {clockTime()}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
        <a href="/feedback" className="btn btn-ghost min-h-9 px-3 text-sm">
          <MessageSquareHeart className="size-4" aria-hidden />
          Rate this route
        </a>
      </div>
    </div>
  );
}
