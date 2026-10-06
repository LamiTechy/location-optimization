import { clearSessionCookie } from "@/lib/auth/session";
import { handleRoute } from "@/lib/services/handle-route";
import { jsonOk } from "@/lib/services/response";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return handleRoute(async () => {
    await clearSessionCookie();
    return jsonOk({ message: "Logged out" });
  });
}
