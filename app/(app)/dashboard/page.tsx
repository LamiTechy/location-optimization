import { redirect } from "next/navigation";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DashboardScreen userName={session.name ?? "there"} />;
}
