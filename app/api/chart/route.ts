import { NextRequest, NextResponse } from "next/server";

// Revalidation TTL per Yahoo Finance interval (seconds)
const REVALIDATE: Record<string, number> = {
  "1h":  5  * 60,       // 5 min  — intraday ticks fast
  "1d":  15 * 60,       // 15 min — daily bar updates slowly
  "1wk": 60 * 60,       // 1 hour
  "1mo": 4  * 60 * 60,  // 4 hours
};

// In-flight request deduplication: collapses concurrent identical requests into one upstream fetch
interface InflightResult { status: number; data: unknown }
const inFlight = new Map<string, Promise<InflightResult>>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") ?? "1d";
  const range = searchParams.get("range") ?? "2y";

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const period1 = searchParams.get("period1");
  const period2 = searchParams.get("period2");

  // Fix: include interval only once regardless of branch
  const qs = period1 && period2
    ? `period1=${period1}&period2=${period2}&interval=${interval}`
    : `interval=${interval}&range=${range}`;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?${qs}` +
    `&includePrePost=false&events=div%2Csplit`;

  const revalidate = REVALIDATE[interval] ?? 15 * 60;

  try {
    if (!inFlight.has(url)) {
      const promise = fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json",
        },
        next: { revalidate },
      })
        .then(async (res) => ({ status: res.status, data: await res.json() }))
        .finally(() => inFlight.delete(url));

      inFlight.set(url, promise);
    }

    const { status, data } = await inFlight.get(url)!;

    if (status !== 200) {
      return NextResponse.json(
        { error: `Yahoo Finance responded with ${status}` },
        { status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Yahoo Finance" },
      { status: 502 }
    );
  }
}
