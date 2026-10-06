"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, ApiError } from "@/lib/client/api";
import { timeAgo } from "@/lib/format";

type Role = "student" | "staff" | "visitor" | "admin";

interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  createdAt: string;
}

const ROLES: Role[] = ["student", "staff", "visitor", "admin"];

export function UsersScreen() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ users: AdminUser[] }>("/api/admin/users")
      .then((data) => {
        if (!cancelled) setUsers(data.users ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError) toast.push(error.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function changeRole(id: number, role: Role) {
    setBusyId(id);
    try {
      const data = await apiFetch<{ user: AdminUser }>("/api/admin/users", {
        method: "PATCH",
        json: { id, role },
      });
      setUsers((prev) =>
        prev.map((row) => (row.id === id ? { ...row, role: data.user.role } : row)),
      );
      toast.success(`${data.user.fullName} is now ${data.user.role}`);
    } catch (error: unknown) {
      toast.error(error instanceof ApiError ? error.message : "Could not change the role");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid h-48 place-items-center">
        <Spinner label="Loading users..." />
      </div>
    );
  }

  const admins = users.filter((row) => row.role === "admin").length;

  return (
    <section aria-labelledby="users-title">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="users-title" className="text-sm font-bold text-ink">
          Users <span className="text-ink-muted">({users.length})</span>
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700">
          <ShieldCheck className="size-3.5" aria-hidden /> {admins} admin
          {admins === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-3 py-2.5 font-bold">Member</th>
              <th className="px-3 py-2.5 font-bold">Joined</th>
              <th className="px-3 py-2.5 font-bold">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-muted">
                      <UserRound className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <p className="truncate font-semibold text-ink">{user.fullName}</p>
                      <p className="truncate text-xs text-ink-muted">{user.email}</p>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-ink-muted">
                  {timeAgo(user.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <select
                    className="input min-h-9 py-1 text-sm"
                    value={user.role}
                    disabled={busyId === user.id}
                    aria-label={`Role for ${user.fullName}`}
                    onChange={(event) =>
                      changeRole(user.id, event.target.value as Role)
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Roles decide what the router allows: students and staff plan routes and
        save favourites, visitors can browse and search, admins also edit the
        campus graph.
      </p>
    </section>
  );
}
