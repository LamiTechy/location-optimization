"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ApiError, apiFetch } from "@/lib/client/api";
import { loginSchema } from "@/lib/validators";

type FieldErrors = Partial<Record<"email" | "password", string>>;

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", json: parsed.data });
      router.push(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.code === "VALIDATION_ERROR"
            ? (error.issues?.[0]?.message ?? error.message)
            : error.message,
        );
      } else {
        setFormError("Could not reach the server. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Log in to search campus locations and get walking directions.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-medium text-danger-500"
          >
            {formError}
          </div>
        )}

        <Field label="Email address" error={errors.email}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@mapoly.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>

        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="current-password"
        />

        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        New to MAPOLY Navigator?{" "}
        <Link
          href={`/register${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-primary-600 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
