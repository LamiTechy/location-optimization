import bcrypt from "bcryptjs";

/** bcrypt cost: 12 (~250ms on a modern laptop) per the security spec. */
const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Password policy shared by the register form (client) and the register route
 * (server) so both always agree.
 */
export const PASSWORD_MIN_LENGTH = 8;

export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  issues: string[];
} {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) issues.push("A lowercase letter");
  if (!/[A-Z]/.test(password)) issues.push("An uppercase letter");
  if (!/[0-9]/.test(password)) issues.push("A number");

  const lengthPoints = Math.min(2, Math.floor(password.length / 8));
  const variety =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  const raw = lengthPoints + variety - issues.length;
  const score = Math.max(0, Math.min(4, raw)) as 0 | 1 | 2 | 3 | 4;
  const labels = [
    "Very weak",
    "Weak",
    "Fair",
    "Strong",
    "Excellent",
  ] as const;
  return { score, label: labels[score], issues };
}
