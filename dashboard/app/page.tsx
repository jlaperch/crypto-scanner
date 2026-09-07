import Nav from "@/components/Nav";
import CutTable from "@/components/CutTable";
import TickerTable from "@/components/TickerTable";
import {
  CostWall,
  EquityCurve,
  SignedBars,
  EvidenceScatter,
  GapBehaviour,
} from "@/components/Charts";
import raw from "@/public/data/backtest.json";
import type { Backtest } from "@/lib/types";

const d = raw as unknown as Backtest;

function sign(v: number | null | undefined, unit = "", digits = 2) {
  if (v === null || v === undefined) return "--";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}${unit}`;
}

function cls(v: number | null | undefined) {
  if (v === null || v === undefined) return "";
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

export default function Page() {
  const h = d.headline;
  const m = d.meta;
  const mt = d.multiple_testing;
  const qualified = d.tier_counts["Qualified"] ?? 0;
  const passes = qualified > 0;

  const grossBps = h.gross.avg_bps ?? 0;
  const netBps = h.net.avg_bps ?? 0;
  const breakeven = h.breakeven_cost_bps ?? 0;

  return (
    <main className="wrap">
      <Nav page="backtest" />

      <div className={`verdict${passes ? " pass" : ""}`}>
        <div className="tag">Phase 1 verdict — daily bars</div>
        <h2>
          {passes
            ? `${qualified} name${qualified === 1 ? "" : "s"} clears the evidence bar after costs.`
            : "No name clears the evidence bar after costs."}
        </h2>
        <p>
          Across {h.gross.trades.toLocaleString()} overnight trades on {mt.n_names} names from{" "}
          {m.start} to {m.end}, the raw close-to-open effect is worth{" "}
          <strong>{sign(grossBps)} bps a night</strong>. That is the entire budget. A realistic
          round-trip from the closing auction to the opening print costs 4–10 bps, so at the{" "}
          {m.cost_bps} bps assumption used here the strategy nets{" "}
          <strong>{sign(netBps)} bps</strong> and compounds to{" "}
          <strong>{sign(h.compounded_net_pct, "%", 1)}</strong> over {h.sessions.toLocaleString()}{" "}
          sessions. The edge is real and it is smaller than the toll.
        </p>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="k">Gross edge</div>
          <div className={`v ${cls(grossBps)}`}>{sign(grossBps)}</div>
          <div className="sub">bps per night, before costs</div>
        </div>
        <div className="tile">
          <div className="k">Breakeven cost</div>
          <div className="v">{breakeven.toFixed(2)}</div>
          <div className="sub">bps. Above this it loses money.</div>
        </div>
        <div className="tile">
          <div className="k">Net at {m.cost_bps} bps</div>
          <div className={`v ${cls(netBps)}`}>{sign(netBps)}</div>
          <div className="sub">
            win rate {h.net.win_rate?.toFixed(1)}%, PF {h.net.profit_factor?.toFixed(2)}
          </div>
        </div>
        <div className="tile">
          <div className="k">Qualified names</div>
          <div className={`v ${qualified ? "pos" : "neg"}`}>
            {qualified} / {d.tickers.length}
          </div>
          <div className="sub">passed the full gate</div>
        </div>
      </div>

      <section>
        <h3>The cost wall</h3>
        <p className="lede">
          This is the chart that decides the whole thing. The gross edge is{" "}
          {breakeven.toFixed(2)} bps a night, so the line crosses zero at{" "}
          {breakeven.toFixed(2)} bps of round-trip cost. Everything to the right of that
          crossing is a losing strategy, and market-on-close to market-on-open on $10–100
          names lands to the right of it.
        </p>
        <div className="card">
          <CostWall
            data={d.cost_sensitivity}
            breakeven={breakeven}
            assumed={m.cost_bps}
          />
        </div>
      </section>

      <section>
        <h3>Gross versus net, compounded</h3>
        <p className="lede">
          Same trades, same days. The only difference between the two lines is the{" "}
          {m.cost_bps} bps toll. Max drawdown goes from{" "}
          {sign(h.max_dd_gross_pct, "%", 1)} gross to {sign(h.max_dd_net_pct, "%", 1)} net.
        </p>
        <div className="card">
          <div className="legend">
            <span>
              <i className="swatch" style={{ background: "var(--series-1)" }} /> Gross (no costs)
            </span>
            <span>
              <i className="swatch" style={{ background: "var(--series-2)" }} /> Net ({m.cost_bps}{" "}
              bps round trip)
            </span>
          </div>
          <EquityCurve data={d.equity_curve} costBps={m.cost_bps} />
        </div>
      </section>

      <section>
        <h3>Is any single name good enough?</h3>
        <p className="lede">
          Your theory is that the effect is uneven, and that some names carry it. Testing{" "}
          {mt.n_names} names means the best-looking one will beat costs by luck alone. To find
          out how much luck, each name&apos;s returns were sign-flipped {mt.n_bootstrap.toLocaleString()}{" "}
          times to simulate a world with no edge at all. Even in that dead world the best name
          typically printed a t-stat of {mt.p50.toFixed(2)}, and cleared {mt.p95.toFixed(2)} one
          run in twenty. So {mt.p95.toFixed(2)} is the bar. Anything under it is a name that
          looks good the way a coin that came up heads eight times looks good.
        </p>
        <div className="card">
          <EvidenceScatter
            data={d.tickers.map((t) => ({
              ticker: t.ticker,
              trades: t.trades,
              t_stat: t.t_stat,
              avg_bps: t.avg_bps,
              sector: t.sector,
            }))}
            threshold={mt.p95}
            median={mt.p50}
          />
        </div>
      </section>

      <section>
        <h3>Every name, and why it failed</h3>
        <p className="lede">
          The gate is strict on purpose: at least {m.min_trades_for_evidence} trades, positive
          net expectancy, profit factor above {m.min_profit_factor}, and a t-stat past the luck
          bar. Watch the first-half and second-half columns — a name that only worked in one
          half of the window is a name that stopped working.
        </p>
        <div className="card flush">
          <TickerTable rows={d.tickers} threshold={mt.p95} />
        </div>
      </section>

      <section>
        <h3>Has it decayed?</h3>
        <p className="lede">
          Net of {m.cost_bps} bps, by calendar year. 2022 is the one that matters — a bear
          market and a high-volatility year, and the effect went sharply negative rather than
          merely flat.
        </p>
        <div className="card">
          <SignedBars data={d.by_year} height={250} />
        </div>
      </section>

      <section>
        <h3>Where the effect hides, if anywhere</h3>
        <p className="lede">
          Same trades, cut different ways, all net of costs. Volatility regime is the sharpest
          split in the data: the effect is negative when the tape is choppy and mildly positive
          when it is calm. That is a real pattern and it is also the pattern you would expect
          from a risk premium you get paid for only when nothing goes wrong.
        </p>
        <div className="card">
          <SignedBars data={d.by_sector} height={250} angled />
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", marginTop: 12 }}>
          <div className="card flush">
            <div className="legend">Volatility regime</div>
            <CutTable rows={d.by_regime_vol} first="Regime" />
          </div>
          <div className="card flush">
            <div className="legend">Market trend</div>
            <CutTable rows={d.by_regime_trend} first="Regime" />
          </div>
          <div className="card flush">
            <div className="legend">Prior-day momentum quintile</div>
            <CutTable rows={d.by_momentum} first="Quintile" />
          </div>
          <div className="card flush">
            <div className="legend">Day of week</div>
            <CutTable rows={d.by_dow} first="Day" />
          </div>
          <div className="card flush">
            <div className="legend">Entry price</div>
            <CutTable rows={d.by_price} first="Bucket" />
          </div>
        </div>
      </section>

      <section>
        <h3>Sell at the open, or hold?</h3>
        <p className="lede">
          Given the gap you woke up to, this is what the next session did from open to close.
          Large positive gaps gave back {sign(d.gap_behavior.at(-1)?.next_session_bps)} bps on
          average, which is the case for selling into strength rather than holding it. Nothing
          here is large enough to trade on its own.
        </p>
        <div className="card">
          <GapBehaviour data={d.gap_behavior} />
        </div>
      </section>

      <section>
        <h3>The stop-loss problem</h3>
        <p className="lede">
          A 2% stop cannot fire while the market is shut. On{" "}
          <strong>{h.gap_thru_stop_pct?.toFixed(1)}%</strong> of nights the open was already
          below the stop level, so the fill was worse than the stop rather than protected by it.
          Overnight risk is a position-sizing problem, not a stop-loss problem — which is what
          your own theory doc says, and the data agrees.
        </p>
      </section>

      <section>
        <h3>What phase 1 cannot answer</h3>
        <p className="lede">{m.not_yet_tested_note}</p>
        <div className="card flush">
          <ul className="notes">
            {m.not_yet_tested.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="foot">
        {m.data_source} · {m.granularity} granularity · cost assumption {m.cost_bps} bps ·{" "}
        {m.cost_note} · generated {m.generated_at.slice(0, 19).replace("T", " ")} UTC
      </div>
    </main>
  );
}
