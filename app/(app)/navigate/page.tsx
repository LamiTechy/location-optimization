import { NavigateScreen } from "@/components/navigate/NavigateScreen";

export const dynamic = "force-dynamic";

/**
 * Map + route planning screen.
 *
 * Shareable: `/navigate?from=12&to=7` (location ids) or
 * `/navigate?from=gps:7.156600,3.340800&to=19`.
 */
export default async function NavigatePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  return <NavigateScreen fromParam={from} toParam={to} />;
}
