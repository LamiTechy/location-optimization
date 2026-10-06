"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface BottomSheetProps {
  /** Whether the sheet shows its full content (route steps, results). */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  title?: string;
  children: React.ReactNode;
  /** Extra controls rendered next to the title (swap, close...). */
  actions?: React.ReactNode;
}

/**
 * Draggable bottom sheet (the "Optimized Route Panel" of the report).
 *
 * The drag handle snaps between peek and expanded states; tapping the header
 * does the same, so pointer, touch and keyboard users can all operate it.
 */
export function BottomSheet({
  expanded,
  onExpandedChange,
  title,
  children,
  actions,
}: BottomSheetProps) {
  const [dragDy, setDragDy] = useState(0);
  const startY = useRef<number | null>(null);

  function onPointerDown(event: React.PointerEvent) {
    startY.current = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (startY.current === null) return;
    setDragDy(event.clientY - startY.current);
  }

  function onPointerUp() {
    if (startY.current === null) return;
    if (dragDy > 60) onExpandedChange(false);
    else if (dragDy < -40) onExpandedChange(true);
    startY.current = null;
    setDragDy(0);
  }

  return (
    <section
      className="pointer-events-auto flex max-h-[78dvh] flex-col rounded-t-3xl border border-b-0 border-line bg-surface shadow-sheet transition-[height] duration-300"
      style={{
        transform: `translateY(${Math.max(dragDy, 0)}px)`,
        maxHeight: expanded ? "78dvh" : undefined,
      }}
      aria-label={title ?? "Route details"}
    >
      <div
        className="cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-expanded={expanded}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate text-sm font-extrabold text-ink">
              {title}
            </span>
          </button>

          {actions && <span className="flex shrink-0 items-center gap-2">{actions}</span>}

          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            aria-hidden
            tabIndex={-1}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted"
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 ${
          expanded ? "" : "max-h-[38dvh]"
        }`}
      >
        {children}
      </div>
    </section>
  );
}
