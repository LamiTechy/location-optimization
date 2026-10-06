"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ApiError, apiFetch } from "@/lib/client/api";
import { registerSchema } from "@/lib/validators";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
  { value: "visitor", label: "Visitor" },
] as const;

type FieldErrors = Partial<Record<"fullName" | "email" | "password" | "role", string>>;

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("student");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse({ fullName, email, password, role });
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
      await apiFetch("/api/auth/register", {
        method: "POST",
        json: parsed.data,
      });
      router.push(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "EMAIL_TAKEN") {
          setErrors({ email: error.message });
        } else {
          setFormError(
            error.code === "VALIDATION_ERROR"
              ? (error.issues?.[0]?.message ?? error.message)
              : error.message,
          );
        }
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
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Save favourite places, track your route history and navigate campus faster.
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

        <Field label="Full name" error={errors.fullName}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              autoComplete="name"
              placeholder="Adebayo Ogunlesi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Email address"
          error={errors.email}
          hint="Use your school email if you have one."
        >
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
          autoComplete="new-password"
          showStrength
        />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">
            I am a...
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {ROLES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={role === option.value}
                data-active={role === option.value}
                onClick={() => setRole(option.value)}
                className="chip tap px-4"
              >
                {option.label}
              </button>
            ))}
          </div>
          {errors.role && (
            <p className="mt-1.5 text-xs font-medium text-danger-500">
              {errors.role}
            </p>
          )}
        </fieldset>

        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already registered?{" "}
        <Link
          href={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-primary-600 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
