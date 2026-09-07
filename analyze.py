#!/usr/bin/env python3
"""
Phase 1 analysis: does the close-to-open overnight effect survive at the
individual-stock level after realistic costs?

Reads overnight_trades.csv (produced by overnight_backtest.py) and writes a
single JSON payload the dashboard renders. No network required.

    python analyze.py --trades overnight_trades.csv --out dashboard/public/data/backtest.json
"""

import argparse, json, math
from datetime import datetime

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Assumptions, stated up front so the dashboard can show them
# --------------------------------------------------------------------------

COST_BPS = 6.0          # baseline round-trip cost assumption (MOC -> MOO)
COST_GRID = [0, 2, 4, 6, 8, 10, 12]
MIN_TRADES = 250        # a name below this is research, not evidence
MIN_PROFIT_FACTOR = 1.05
BOOTSTRAP_N = 3000
RNG_SEED = 538

SECTORS = {
    "INTC": "Technology", "AMD": "Technology", "MU": "Technology", "HPQ": "Technology",
    "WDC": "Technology", "ON": "Technology", "STX": "Technology", "CSCO": "Technology",
    "NTAP": "Technology",
    "BAC": "Financials", "WFC": "Financials", "SCHW": "Financials", "USB": "Financials",
    "KEY": "Financials", "RF": "Financials", "HBAN": "Financials", "SOFI": "Financials",
    "OXY": "Energy", "DVN": "Energy", "APA": "Energy", "HAL": "Energy", "BKR": "Energy",
    "KMI": "Energy", "EQT": "Energy",
    "PFE": "Healthcare", "VTRS": "Healthcare", "TEVA": "Healthcare", "OGN": "Healthcare",
    "BAX": "Healthcare",
    "F": "Consumer", "GM": "Consumer", "KSS": "Consumer", "M": "Consumer", "GAP": "Consumer",
    "BBWI": "Consumer", "DKS": "Consumer", "CPB": "Consumer", "KHC": "Consumer",
    "CLF": "Industrials", "CCL": "Industrials", "AA": "Industrials", "FCX": "Industrials",
    "NEM": "Industrials", "DAL": "Industrials", "AAL": "Industrials", "UAL": "Industrials",
    "T": "Communications", "WBD": "Communications", "PARA": "Communications",
    "SIRI": "Communications",
}


def r2(x, n=2):
    """Round for JSON, turning NaN/inf into None so the UI can show a dash."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    return None if not math.isfinite(f) else round(f, n)


# --------------------------------------------------------------------------
# Core stats
# --------------------------------------------------------------------------

def block_stats(r: pd.Series, label=None):
    """Everything the theory doc asks for, on one series of net returns."""
    r = r.dropna()
    n = len(r)
    if n == 0:
        return {"trades": 0}

    wins, losses = r[r > 0], r[r < 0]
    gross_win = wins.sum()
    gross_loss = abs(losses.sum())
    sd = r.std(ddof=1)
    tstat = (r.mean() / (sd / math.sqrt(n))) if sd and n > 1 else np.nan

    out = {
        "trades": int(n),
        "win_rate": r2((r > 0).mean() * 100, 1),
        "avg_bps": r2(r.mean() * 1e4),
        "median_bps": r2(r.median() * 1e4),
        "std_bps": r2(sd * 1e4, 1),
        "avg_win_bps": r2(wins.mean() * 1e4) if len(wins) else None,
        "avg_loss_bps": r2(losses.mean() * 1e4) if len(losses) else None,
        "profit_factor": r2(gross_win / gross_loss, 3) if gross_loss > 0 else None,
        "expectancy_bps": r2(r.mean() * 1e4),
        "t_stat": r2(tstat),
        "sharpe_ann": r2((r.mean() / sd * math.sqrt(252)) if sd else np.nan),
        "best_pct": r2(r.max() * 100),
        "worst_pct": r2(r.min() * 100),
    }
    if label is not None:
        out["label"] = label
    return out


def max_drawdown(returns_by_day: pd.Series):
    curve = (1 + returns_by_day).cumprod()
    return float((curve / curve.cummax() - 1).min())


def top_winner_dependence(r: pd.Series):
    """
    Share of the total return that came from the best 1% of nights. Only
    meaningful when the total is positive -- a ratio against a negative total
    is noise, so it returns None there rather than printing a wild number.
    """
    r = r.dropna()
    if len(r) < 100:
        return None
    total = r.sum()
    if total <= 1e-12:
        return None
    k = max(1, int(len(r) * 0.01))
    return r2(r.nlargest(k).sum() / total * 100, 1)


# --------------------------------------------------------------------------
# Multiple-testing guard
# --------------------------------------------------------------------------

def max_tstat_null(trades: pd.DataFrame, cost_bps: float, n_boot=BOOTSTRAP_N, seed=RNG_SEED):
    """
    With 49 names tested, the best-looking one beats costs by luck alone.
    Sign-flip each name's returns to simulate a true zero-edge world, then
    record the largest t-stat that showed up anyway. The 95th percentile of
    that distribution is the bar a real name has to clear.
    """
    rng = np.random.default_rng(seed)
    groups = [g["overnight_ret"].to_numpy() - cost_bps / 1e4
              for _, g in trades.groupby("ticker", sort=False)]
    groups = [g for g in groups if len(g) > 30]

    # Center each name so the null is genuinely zero-mean, then flip signs.
    centered = [g - g.mean() for g in groups]
    maxes = np.empty(n_boot)
    for b in range(n_boot):
        best = -np.inf
        for g in centered:
            flips = rng.choice([-1.0, 1.0], size=len(g))
            x = g * flips
            sd = x.std(ddof=1)
            if sd > 0:
                t = x.mean() / (sd / math.sqrt(len(x)))
                if t > best:
                    best = t
        maxes[b] = best
    return {
        "p50": r2(np.percentile(maxes, 50)),
        "p95": r2(np.percentile(maxes, 95)),
        "p99": r2(np.percentile(maxes, 99)),
        "n_names": len(groups),
        "n_bootstrap": n_boot,
    }


# --------------------------------------------------------------------------
# Cuts
# --------------------------------------------------------------------------

def cut_by(trades, col, cost_bps, order=None):
    net = trades["overnight_ret"] - cost_bps / 1e4
    rows = []
    for key, idx in trades.groupby(col, sort=False).groups.items():
        s = block_stats(net.loc[idx], label=str(key))
        s["names"] = int(trades.loc[idx, "ticker"].nunique())
        rows.append(s)
    if order:
        rank = {k: i for i, k in enumerate(order)}
        rows.sort(key=lambda r: rank.get(r["label"], 999))
    else:
        rows.sort(key=lambda r: r["label"])
    return rows


def build_regimes(trades):
    """
    Regime labels derived from the data itself -- no external index needed.
    Market proxy = equal-weight daily mean of the next-session open-to-close
    return, which is the closest thing to "what the tape did" in this file.
    """
    daily = trades.groupby("date").agg(
        mkt_intraday=("intraday_ret", "mean"),
        mkt_overnight=("overnight_ret", "mean"),
    )
    daily["vol60"] = daily["mkt_intraday"].rolling(60).std()
    daily["trend60"] = daily["mkt_intraday"].rolling(60).mean()

    vol_med = daily["vol60"].median()
    daily["vol_regime"] = np.where(daily["vol60"].isna(), "Warmup",
                            np.where(daily["vol60"] >= vol_med, "High volatility", "Low volatility"))
    daily["trend_regime"] = np.where(daily["trend60"].isna(), "Warmup",
                              np.where(daily["trend60"] >= 0, "Uptrend", "Downtrend"))

    t = trades.merge(daily[["vol_regime", "trend_regime"]], left_on="date", right_index=True, how="left")
    return t[t["vol_regime"] != "Warmup"].copy()


def gap_behavior(trades):
    """
    Given the size of the gap you woke up to, what did the next session do?
    This is the 'sell at the open or hold' question, and it is answerable
    from daily bars because intraday_ret is open -> close.
    """
    bins = [-np.inf, -0.02, -0.005, 0.005, 0.02, np.inf]
    labels = ["Large negative (< -2%)", "Small negative (-2% to -0.5%)",
              "Flat (-0.5% to +0.5%)", "Small positive (+0.5% to +2%)",
              "Large positive (> +2%)"]
    b = trades.copy()
    b["gap_bucket"] = pd.cut(b["overnight_ret"], bins=bins, labels=labels)
    rows = []
    for lab in labels:
        g = b[b["gap_bucket"] == lab]
        if len(g) == 0:
            continue
        rows.append({
            "label": lab,
            "trades": int(len(g)),
            "share_pct": r2(len(g) / len(b) * 100, 1),
            "avg_gap_bps": r2(g["overnight_ret"].mean() * 1e4),
            "next_session_bps": r2(g["intraday_ret"].mean() * 1e4),
            "next_session_win_rate": r2((g["intraday_ret"] > 0).mean() * 100, 1),
        })
    return rows


def momentum_cut(trades, cost_bps):
    """Does yesterday's move predict tonight's gap? (close-to-close, per name)"""
    t = trades.sort_values(["ticker", "date"]).copy()
    t["prior_ret"] = t.groupby("ticker")["entry"].pct_change()
    t = t.dropna(subset=["prior_ret"])
    t["mom_bucket"] = t.groupby("date")["prior_ret"].transform(
        lambda x: pd.qcut(x, 5, labels=["Q1 weakest", "Q2", "Q3", "Q4", "Q5 strongest"],
                          duplicates="drop") if len(x) >= 10 else np.nan)
    t = t.dropna(subset=["mom_bucket"])
    return cut_by(t, "mom_bucket", cost_bps,
                  order=["Q1 weakest", "Q2", "Q3", "Q4", "Q5 strongest"])


# --------------------------------------------------------------------------
# Per-ticker qualification
# --------------------------------------------------------------------------

def classify(row, t_bar):
    """The strict gate. 'No trade' is the default, not the exception."""
    if row["trades"] < MIN_TRADES:
        return "Insufficient sample"
    if row["avg_bps"] is None or row["avg_bps"] <= 0:
        return "Rejected"
    if row["profit_factor"] is None or row["profit_factor"] < MIN_PROFIT_FACTOR:
        return "Rejected"
    if row["t_stat"] is None or row["t_stat"] < 2.0:
        return "Interesting"
    if row["t_stat"] < t_bar:
        return "Worth watching"
    return "Qualified"


def per_ticker(trades, cost_bps, t_bar):
    rows = []
    for tk, g in trades.groupby("ticker"):
        net = g["overnight_ret"] - cost_bps / 1e4
        s = block_stats(net)
        s["ticker"] = tk
        s["sector"] = SECTORS.get(tk, "Unknown")
        s["gross_bps"] = r2(g["overnight_ret"].mean() * 1e4)
        s["breakeven_bps"] = r2(g["overnight_ret"].mean() * 1e4)
        s["max_dd_pct"] = r2(max_drawdown(net.groupby(g["date"]).mean()) * 100, 1)
        s["top1pct_share"] = top_winner_dependence(g["overnight_ret"])
        s["gap_thru_stop_pct"] = r2(g["gapped_through_stop"].mean() * 100, 1)
        s["avg_price"] = r2(g["entry"].mean(), 2)
        s["first_half_bps"] = r2(net[g["date"] < g["date"].median()].mean() * 1e4)
        s["second_half_bps"] = r2(net[g["date"] >= g["date"].median()].mean() * 1e4)
        s["tier"] = classify(s, t_bar)
        rows.append(s)
    rows.sort(key=lambda r: (r["t_stat"] if r["t_stat"] is not None else -99), reverse=True)
    return rows


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trades", default="overnight_trades.csv")
    ap.add_argument("--out", default="dashboard/public/data/backtest.json")
    ap.add_argument("--cost", type=float, default=COST_BPS)
    ap.add_argument("--bootstrap", type=int, default=BOOTSTRAP_N)
    a = ap.parse_args()

    trades = pd.read_csv(a.trades, parse_dates=["date"])
    trades = trades.dropna(subset=["overnight_ret", "intraday_ret"])
    cost = a.cost

    gross = trades["overnight_ret"]
    net = gross - cost / 1e4

    daily_gross = gross.groupby(trades["date"]).mean()
    daily_net = net.groupby(trades["date"]).mean()
    curve_gross = (1 + daily_gross).cumprod()
    curve_net = (1 + daily_net).cumprod()

    print(f"Bootstrapping the multiple-testing bar ({a.bootstrap} draws)...")
    null = max_tstat_null(trades, cost, n_boot=a.bootstrap)
    t_bar = null["p95"]

    tickers = per_ticker(trades, cost, t_bar)
    tier_counts = {}
    for r in tickers:
        tier_counts[r["tier"]] = tier_counts.get(r["tier"], 0) + 1

    cost_curve = []
    for c in COST_GRID:
        n = gross - c / 1e4
        dn = n.groupby(trades["date"]).mean()
        cost_curve.append({
            "cost_bps": c,
            "net_bps": r2(n.mean() * 1e4),
            "win_rate": r2((n > 0).mean() * 100, 1),
            "compounded_pct": r2(((1 + dn).cumprod().iloc[-1] - 1) * 100, 1),
            "max_dd_pct": r2(max_drawdown(dn) * 100, 1),
        })

    trades["dow"] = trades["date"].dt.day_name()
    trades["price_bucket"] = pd.cut(trades["entry"], [0, 25, 50, 100],
                                    labels=["$10-25", "$25-50", "$50-100"])
    trades["sector"] = trades["ticker"].map(SECTORS).fillna("Unknown")
    regimes = build_regimes(trades)

    payload = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "phase": 1,
            "data_source": "yfinance daily bars (close -> next open)",
            "granularity": "daily",
            "cost_bps": cost,
            "cost_note": "Round-trip market-on-close to market-on-open. 4-10 bps is the realistic range for $10-100 names.",
            "start": trades["date"].min().strftime("%Y-%m-%d"),
            "end": trades["date"].max().strftime("%Y-%m-%d"),
            "min_trades_for_evidence": MIN_TRADES,
            "min_profit_factor": MIN_PROFIT_FACTOR,
            "not_yet_tested": [
                "Entry timing inside the final hour (3:00 / 3:45 / 3:55 / closing print)",
                "Exit timing after the open (opening print / 9:31 / 9:35 / 9:45 / 10:00)",
                "Relative volume and late-day momentum as same-day filters",
                "Earnings and scheduled-event exclusion",
                "News and attention indicators",
            ],
            "not_yet_tested_note": "Each of these needs consolidated-tape minute bars. Daily bars cannot answer them.",
        },
        "headline": {
            "gross": block_stats(gross),
            "net": block_stats(net),
            "breakeven_cost_bps": r2(gross.mean() * 1e4),
            "compounded_gross_pct": r2((curve_gross.iloc[-1] - 1) * 100, 1),
            "compounded_net_pct": r2((curve_net.iloc[-1] - 1) * 100, 1),
            "max_dd_gross_pct": r2(max_drawdown(daily_gross) * 100, 1),
            "max_dd_net_pct": r2(max_drawdown(daily_net) * 100, 1),
            "sessions": int(len(daily_net)),
            "top1pct_share": top_winner_dependence(gross),
            "intraday_avg_bps": r2(trades["intraday_ret"].mean() * 1e4),
            "gap_thru_stop_pct": r2(trades["gapped_through_stop"].mean() * 100, 1),
        },
        "multiple_testing": null,
        "tier_counts": tier_counts,
        "equity_curve": [
            {"date": d.strftime("%Y-%m-%d"), "gross": r2(g, 4), "net": r2(n, 4)}
            for d, g, n in zip(curve_gross.index, curve_gross.values, curve_net.values)
        ],
        "by_year": cut_by(trades.assign(year_str=trades["year"].astype(str)),
                          "year_str", cost),
        "cost_sensitivity": cost_curve,
        "tickers": tickers,
        "by_sector": cut_by(trades, "sector", cost),
        "by_regime_vol": cut_by(regimes, "vol_regime", cost),
        "by_regime_trend": cut_by(regimes, "trend_regime", cost),
        "by_dow": cut_by(trades, "dow", cost,
                         order=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
        "by_price": cut_by(trades.dropna(subset=["price_bucket"]), "price_bucket", cost,
                           order=["$10-25", "$25-50", "$50-100"]),
        "by_momentum": momentum_cut(trades, cost),
        "gap_behavior": gap_behavior(trades),
    }

    import os
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    h = payload["headline"]
    print(f"\n  {h['gross']['trades']:,} trades, {payload['meta']['start']} -> {payload['meta']['end']}")
    print(f"  Gross {h['gross']['avg_bps']:+.2f} bps/night | breakeven cost {h['breakeven_cost_bps']:.2f} bps")
    print(f"  Net at {cost:.0f} bps: {h['net']['avg_bps']:+.2f} bps/night, "
          f"compounded {h['compounded_net_pct']:+.1f}%")
    print(f"  Multiple-testing bar: t > {t_bar} (95th pct of max-t under the null)")
    print(f"  Tiers: {tier_counts}")
    print(f"\nWrote {a.out} ({os.path.getsize(a.out)/1024:.0f} KB)")


if __name__ == "__main__":
    main()
