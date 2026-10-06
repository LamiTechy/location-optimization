import { redirect } from "next/navigation";
import { AppShell, type ShellUser } from "@/components/app/AppShell";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { findUserById, toPublicUser } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/**
 * Frame for every authenticated screen. Middleware already rejects anonymous
 * visitors; this re-check keeps the server component safe on its own.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const user = await findUserById(db, Number(session.sub));
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user) as ShellUser;

  return <AppShell user={publicUser}>{children}</AppShell>;
}
