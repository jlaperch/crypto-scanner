import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Live daily tracker.
 *
 * Deliberately inert until a market-data key exists. Phase 1 concluded that the
 * gross close-to-open edge does not clear realistic costs, so there is nothing
 * worth trading live yet. When a provider is added, set these env vars in
 * Vercel and fill in fetchCandidates():
 *
 *   MARKET_DATA_PROVIDER   massive | alpaca
 *   MARKET_DATA_KEY        the API key
 *
 * The contract this route returns is stable, so the UI does not change when the
 * data source arrives.
 */

export type LiveResponse = {
  configured: boolean;
  asOf: string;
  message: string;
  candidates: {
    ticker: string;
    price: number;
    relVolume: number;
    tier: string;
    reason: string;
  }[];
};

async function fetchCandidates(): Promise<LiveResponse["candidates"]> {
  // Intentionally empty. Phase 2 wires the provider in here.
  return [];
}

export async function GET() {
  const provider = process.env.MARKET_DATA_PROVIDER;
  const key = process.env.MARKET_DATA_KEY;
  const asOf = new Date().toISOString();

  if (!provider || !key) {
    return NextResponse.json<LiveResponse>({
      configured: false,
      asOf,
      message:
        "No market data provider configured. Set MARKET_DATA_PROVIDER and MARKET_DATA_KEY in Vercel to enable live scanning.",
      candidates: [],
    });
  }

  try {
    const candidates = await fetchCandidates();
    return NextResponse.json<LiveResponse>({
      configured: true,
      asOf,
      message:
        candidates.length === 0
          ? "No trade. Nothing met the gate today, which is the expected outcome most days."
          : `${candidates.length} candidate(s) passed the gate.`,
      candidates,
    });
  } catch (err) {
    return NextResponse.json<LiveResponse>(
      {
        configured: true,
        asOf,
        message: `Provider error: ${err instanceof Error ? err.message : "unknown"}`,
        candidates: [],
      },
      { status: 502 }
    );
  }
}
