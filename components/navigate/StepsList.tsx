"use client";

import {
  ArrowUpLeft,
  ArrowUpRight,
  CornerDownLeft,
  CornerUpLeft,
  Flag,
  MoveDown,
  RotateCcw,
} from "lucide-react";
import type { DirectionStep } from "@/lib/routing/directions";

const ICONS: Record<DirectionStep["type"], typeof MoveDown> = {
  depart: MoveDown,
  continue: MoveDown,
  arrive: Flag,
  left: CornerUpLeft,
  right: CornerDownLeft,
  "slight-left": ArrowUpLeft,
  "slight-right": ArrowUpRight,
  "sharp-left": CornerUpLeft,
  "sharp-right": CornerDownLeft,
  uturn: RotateCcw,
};

function iconFor(type: DirectionStep["type"]) {
  return ICONS[type] ?? MoveDown;
}

/** Turn-by-turn instruction list (report Figure 4.x). */
export function StepsList({
  steps,
  activeIndex = -1,
  onStepClick,
}: {
  steps: DirectionStep[];
  activeIndex?: number;
  onStepClick?: (index: number) => void;
}) {
  if (steps.length === 0) return null;

  return (
    <ol className="mt-3 space-y-1">
      {steps.map((step, index) => {
        const Icon = iconFor(step.type);
        const active = index === activeIndex;
        return (
          <li key={`${step.instruction}-${index}`}>
            <button
              type="button"
              onClick={() => onStepClick?.(index)}
              className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                active ? "bg-primary-50 ring-1 ring-primary-200" : "hover:bg-surface-3"
              }`}
            >
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                  step.type === "arrive"
                    ? "bg-accent-100 text-accent-700"
                    : step.type === "depart"
                      ? "bg-primary-100 text-primary-700"
                      : "bg-surface-3 text-ink-muted"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-ink">
                  {step.instruction}
                </span>
                <span className="block text-xs text-ink-muted">
                  {Math.round(step.distanceM)} m
                  {index < steps.length - 1 ? "" : " · destination"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
