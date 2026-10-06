"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { EmptyState, Spinner } from "@/components/ui/Feedback";
import { apiFetch, ApiError } from "@/lib/client/api";
import { timeAgo } from "@/lib/format";

interface FeedbackRow {
  id: number;
  rating: number;
  message: string | null;
  createdAt: string;
  author: string | null;
  email: string | null;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={`size-4 ${
            step <= value ? "fill-accent-500 text-accent-500" : "text-line"
          }`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function FeedbackAdminScreen() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ feedback: FeedbackRow[]; averageRating: number | null }>(
      "/api/admin/feedback",
    )
      .then((data) => {
        if (cancelled) return;
        setRows(data.feedback ?? []);
        setAverage(data.averageRating);
      })
      .catch((err: unknown) => {
        if (!cancelled && err instanceof ApiError) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid h-48 place-items-center">
        <Spinner label="Loading feedback..." />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600">
        {error}
      </p>
    );
  }

  return (
    <section aria-labelledby="feedback-title">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 id="feedback-title" className="text-sm font-bold text-ink">
          Feedback <span className="text-ink-muted">({rows.length})</span>
        </h2>
        {average !== null && (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-3 px-3 py-1 text-xs font-bold text-ink">
            <Stars value={Math.round(average)} /> {average.toFixed(1)} average
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          description="Ratings submitted from the Feedback tab will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="card px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={row.rating} />
                <p className="text-sm font-bold text-ink">
                  {row.author ?? "Anonymous"}
                </p>
                {row.email && (
                  <p className="text-xs text-ink-muted">{row.email}</p>
                )}
                <p className="ml-auto text-xs text-ink-muted">
                  {timeAgo(row.createdAt)}
                </p>
              </div>
              {row.message && (
                <p className="mt-1.5 text-sm text-ink-muted">{row.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
