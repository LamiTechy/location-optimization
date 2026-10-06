"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { passwordStrength } from "@/lib/auth/password";
import { Field, Input } from "./Field";

interface PasswordInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoComplete?: string;
  /** Shows the live strength meter (register form). */
  showStrength?: boolean;
  id?: string;
}

export function PasswordInput({
  label = "Password",
  value,
  onChange,
  error,
  autoComplete = "current-password",
  showStrength = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);

  return (
    <div className="space-y-2">
      <Field label={label} error={error}>
        {(fieldProps) => (
          <div className="relative">
            <Input
              {...fieldProps}
              id={fieldProps.id}
              type={visible ? "text" : "password"}
              value={value}
              autoComplete={autoComplete}
              onChange={(e) => onChange(e.target.value)}
              className="pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="absolute right-1 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-lg text-ink-muted hover:bg-surface-3"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        )}
      </Field>

      {showStrength && value.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < strength.score
                    ? strength.score <= 1
                      ? "bg-danger-500"
                      : strength.score === 2
                        ? "bg-warning-500"
                        : "bg-success-500"
                    : "bg-surface-3"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-ink-muted" aria-live="polite">
            Strength: <span className="font-semibold">{strength.label}</span>
            {strength.issues.length > 0 && (
              <> - add {strength.issues.slice(0, 2).join(", ")}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
