import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { getSessionWithRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Admin-only frame. Middleware already redirects students away from `/admin`;
 * this server-side re-check keeps the area safe without relying on the edge
 * runtime (and matches the "verify the role again in the route handler" rule
 * used by every `/api/admin/*` endpoint).
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionWithRole(["admin"]);
  if (!session) redirect("/dashboard");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-xl font-extrabold text-ink">Admin console</h1>
          <p className="text-sm text-ink-muted">
            Map data, user roles and feedback for the MAPOLY campus graph.
          </p>
        </div>
        <AdminNav />
        {children}
      </div>
    </div>
  );
}
