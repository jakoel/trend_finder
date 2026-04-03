import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = new URL(req.url).searchParams.get("q");
  if (!query) return NextResponse.json({ quotes: [] });

  const url =
    `https://query1.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0` +
    `&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ quotes: [] }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Yahoo Finance" },
      { status: 502 }
    );
  }
}
