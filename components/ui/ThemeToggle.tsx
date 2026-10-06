"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/client/api";

const STORAGE_KEY = "mapoly-theme";
const CLASS_ATTR = "class";

function resolveTheme(): "light" | "dark" {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  // The `.dark` class on <html> is the source of truth after a toggle.
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [CLASS_ATTR],
  });
  return () => {
    window.removeEventListener("storage", onChange);
    observer.disconnect();
  };
}

/** SSR always renders the light icon; the inline script fixes it pre-paint. */
const getServerSnapshot = () => "light" as const;

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, resolveTheme, getServerSnapshot);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage disabled - theme lasts for this page view only */
    }
    // Best-effort sync with the stored preference (ignored when signed out).
    void apiFetch("/api/preferences", {
      method: "PATCH",
      json: { theme: next },
    }).catch(() => undefined);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="tap grid place-items-center rounded-lg border border-line bg-surface text-ink-muted transition hover:bg-surface-3 hover:text-ink"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/** Applies a theme chosen in profile preferences to the document + storage. */
export function applyDocumentTheme(theme: "light" | "dark" | "system") {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    /* storage disabled */
  }
}
