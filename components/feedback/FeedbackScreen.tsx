"use client";

import { useEffect, useState } from "react";
import { MessageSquareHeart, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client/api";
import { timeAgo } from "@/lib/format";

interface FeedbackRow {
  id: number;
  rating: number;
  message: string | null;
  createdAt: string;
}

const RATING_HINTS: Record<number, string> = {
  1: "Very hard to find my way",
  2: "Confusing in places",
  3: "Good enough",
  4: "Worked well",
  5: "Perfect - got there easily",
};

export function FeedbackScreen() {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ feedback: FeedbackRow[] }>("/api/feedback")
      .then((data) => {
        if (!cancelled) setRows(data.feedback ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: number }>("/api/feedback", {
        method: "POST",
        json: { rating, message: message.trim() || undefined },
      });
      setRows((current) => [
        {
          id: created.id,
          rating,
          message: message.trim() || null,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setMessage("");
      toast.success("Thanks for the feedback!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send feedback",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <h1 className="text-xl font-extrabold text-ink">Feedback</h1>
        <p className="text-sm text-ink-muted">
          Tell us how the navigation worked - it improves the map data for
          everyone.
        </p>

        <form onSubmit={submit} className="card mt-4 p-5">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              How was your last route?
            </legend>
            <div className="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  onClick={() => setRating(value)}
                  className={`tap grid size-11 place-items-center rounded-xl transition ${
                    value <= rating
                      ? "bg-accent-100 text-accent-600"
                      : "bg-surface-3 text-ink-muted"
                  }`}
                >
                  <Star
                    className={`size-5 ${value <= rating ? "fill-current" : ""}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">{RATING_HINTS[rating]}</p>
          </fieldset>

          <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="feedback-message">
            What happened? (optional)
          </label>
          <Textarea
            id="feedback-message"
            className="mt-1.5"
            placeholder="e.g. The path from ELS to the library was unclear..."
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">{message.length}/1000</span>
            <Button type="submit" loading={submitting}>
              <Send className="size-4" aria-hidden />
              Send feedback
            </Button>
          </div>
        </form>

        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink-muted">
            <MessageSquareHeart className="size-4" aria-hidden />
            Your previous feedback
          </h2>

          {loading ? (
            <div className="mt-3">
              <Spinner label="Loading..." />
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-line px-4 py-4 text-sm text-ink-muted">
              No feedback yet - be the first.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {rows.map((row) => (
                <li key={row.id} className="card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="flex items-center gap-0.5 text-accent-500"
                      aria-label={`${row.rating} out of 5`}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className={`size-4 ${value <= row.rating ? "fill-current" : "opacity-30"}`}
                          aria-hidden
                        />
                      ))}
                    </span>
                    <span className="text-xs text-ink-muted">{timeAgo(row.createdAt)}</span>
                  </div>
                  {row.message && (
                    <p className="mt-1.5 text-sm text-ink">{row.message}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
