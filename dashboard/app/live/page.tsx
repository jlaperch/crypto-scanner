import Nav from "@/components/Nav";
import raw from "@/public/data/backtest.json";
import type { Backtest } from "@/lib/types";
import LivePanel from "@/components/LivePanel";

const d = raw as unknown as Backtest;

export default function LivePage() {
  const qualified = d.tier_counts["Qualified"] ?? 0;

  return (
    <main className="wrap">
      <Nav page="live" />

      <div className="verdict">
        <div className="tag">Live tracker — not armed</div>
        <h2>Nothing to track yet.</h2>
        <p>
          The live scanner only makes sense once a setup has passed the backtest gate. Right now{" "}
          {qualified} of {d.tickers.length} names qualify, so this page has nothing to watch. It
          stays here, wired and inert, so that the day a setup does qualify the only missing
          piece is an API key.
        </p>
      </div>

      <section>
        <h3>How to arm it</h3>
        <div className="card flush">
          <ul className="notes">
            <li>
              Add a market data provider key in Vercel as{" "}
              <code>MARKET_DATA_PROVIDER</code> and <code>MARKET_DATA_KEY</code>.
            </li>
            <li>
              Fill in <code>fetchCandidates()</code> in <code>app/api/live/route.ts</code> — it
              already returns a stable shape, so this page will not need changing.
            </li>
            <li>
              Consolidated-tape minute bars are required. Free IEX-only feeds miss the closing
              auction and the opening print, which are the two prices this strategy trades.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h3>Current endpoint response</h3>
        <p className="lede">
          Live read from <code>/api/live</code>, so you can see the route is deployed and
          answering.
        </p>
        <div className="card flush">
          <LivePanel />
        </div>
      </section>
    </main>
  );
}
