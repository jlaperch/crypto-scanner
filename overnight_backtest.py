#!/usr/bin/env python3
"""
Overnight hold backtest: buy at the close, sell at the next open.

Stocks:  $10-$100, >=2M avg daily volume, 5 years, results split by year.
Crypto:  finds the highest-volume window, then tests holding through it.

Setup:
    pip install yfinance pandas numpy

Run:
    python overnight_backtest.py              # stocks
    python overnight_backtest.py --crypto     # crypto volume window + hold test
    python overnight_backtest.py --all
"""

import argparse
import sys
from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MIN_PRICE = 10.0
MAX_PRICE = 100.0
MIN_AVG_VOLUME = 2_000_000
VOLUME_LOOKBACK = 20          # trading days for the rolling volume average
STOP_PCT = 0.02               # 2% stop (see note in report about overnight gaps)
YEARS = 5

# ~45 liquid names spread across sectors. The script re-checks price and volume
# against live data every day, so anything that drifts outside the filters just
# stops generating signals. No need to hand-maintain this list.
UNIVERSE = [
    # Tech / semis
    "INTC", "AMD", "MU", "HPQ", "WDC", "ON", "STX", "CSCO", "NTAP",
    # Financials
    "BAC", "WFC", "SCHW", "USB", "KEY", "RF", "HBAN", "SOFI",
    # Energy
    "OXY", "DVN", "APA", "HAL", "BKR", "KMI", "EQT",
    # Healthcare / pharma
    "PFE", "VTRS", "TEVA", "OGN", "BAX",
    # Consumer / retail
    "F", "GM", "KSS", "M", "GAP", "BBWI", "DKS", "CPB", "KHC",
    # Industrials / materials
    "CLF", "CCL", "AA", "FCX", "NEM", "DAL", "AAL", "UAL",
    # Comms / media
    "T", "WBD", "PARA", "SIRI",
]

CRYPTO = ["BTC-USD", "XRP-USD", "LTC-USD"]


# ---------------------------------------------------------------------------
# Stocks
# ---------------------------------------------------------------------------

def fetch_stocks(tickers, years=YEARS):
    print(f"Downloading {len(tickers)} tickers, {years}y of daily bars...")
    df = yf.download(
        tickers,
        period=f"{years}y",
        interval="1d",
        auto_adjust=True,     # handles splits so gaps aren't fake
        group_by="ticker",
        progress=False,
        threads=True,
    )
    if df.empty:
        sys.exit("No data came back. Check your connection or the ticker list.")
    return df


def build_trades(df, tickers):
    """One row per (ticker, day) that passes the screen. Buy close, sell next open."""
    rows = []
    for t in tickers:
        try:
            d = df[t].dropna(subset=["Close", "Open", "Volume"]).copy()
        except KeyError:
            continue
        if len(d) < VOLUME_LOOKBACK + 5:
            continue

        d["avg_vol"] = d["Volume"].rolling(VOLUME_LOOKBACK).mean()
        d["next_open"] = d["Open"].shift(-1)
        d["next_close"] = d["Close"].shift(-1)
        d["next_low"] = d["Low"].shift(-1)

        eligible = (
            d["Close"].between(MIN_PRICE, MAX_PRICE)
            & (d["avg_vol"] >= MIN_AVG_VOLUME)
            & d["next_open"].notna()
        )
        d = d[eligible]
        if d.empty:
            continue

        d["ticker"] = t
        d["entry"] = d["Close"]
        d["exit"] = d["next_open"]
        d["overnight_ret"] = d["exit"] / d["entry"] - 1
        # What the same dollar would have made staying in the next session instead
        d["intraday_ret"] = d["next_close"] / d["next_open"] - 1
        # The 2% stop can't fire while the market is shut. Flag the nights where
        # the open blew through it -- those are the ones the stop did NOT protect.
        d["stop_level"] = d["entry"] * (1 - STOP_PCT)
        d["gapped_through_stop"] = d["exit"] < d["stop_level"]

        d = d.reset_index()
        d.rename(columns={d.columns[0]: "date"}, inplace=True)
        rows.append(
            d[[
                "date", "ticker", "entry", "exit", "overnight_ret",
                "intraday_ret", "stop_level", "gapped_through_stop", "avg_vol",
            ]]
        )

    if not rows:
        sys.exit("Nothing passed the screen. Loosen the filters.")

    trades = pd.concat(rows, ignore_index=True)
    trades["date"] = pd.to_datetime(trades["date"])
    trades["year"] = trades["date"].dt.year
    return trades.sort_values("date").reset_index(drop=True)


def summarize(trades):
    def block(g):
        r = g["overnight_ret"]
        return pd.Series({
            "trades": len(g),
            "names": g["ticker"].nunique(),
            "win_rate": (r > 0).mean(),
            "avg_ret_bps": r.mean() * 10_000,
            "median_bps": r.median() * 10_000,
            "std_bps": r.std() * 10_000,
            "sharpe_ann": (r.mean() / r.std() * np.sqrt(252)) if r.std() else np.nan,
            "best": r.max(),
            "worst": r.min(),
            "gap_thru_stop": g["gapped_through_stop"].mean(),
            "intraday_avg_bps": g["intraday_ret"].mean() * 10_000,
        })

    by_year = trades.groupby("year").apply(block)
    overall = block(trades).to_frame("ALL").T
    return by_year, overall


def equity_curve(trades):
    """Equal-weight every signal each day, compound the daily average."""
    daily = trades.groupby("date")["overnight_ret"].mean()
    return (1 + daily).cumprod()


def report_stocks():
    df = fetch_stocks(UNIVERSE)
    trades = build_trades(df, UNIVERSE)
    by_year, overall = summarize(trades)

    pd.set_option("display.width", 200)
    pd.set_option("display.float_format", lambda x: f"{x:,.3f}")

    print("\n" + "=" * 78)
    print("OVERNIGHT HOLD -- buy at close, sell at next open")
    print(f"Screen: ${MIN_PRICE:.0f}-${MAX_PRICE:.0f}, "
          f"{MIN_AVG_VOLUME/1e6:.0f}M+ avg volume ({VOLUME_LOOKBACK}d)")
    print("=" * 78)
    print("\nBY YEAR")
    print(by_year.to_string())
    print("\nOVERALL")
    print(overall.to_string())

    curve = equity_curve(trades)
    total = curve.iloc[-1] - 1
    days = len(curve)
    print(f"\nCompounded (equal-weight, all signals): {total:+.2%} over {days} sessions")
    print(f"Max drawdown: {(curve / curve.cummax() - 1).min():.2%}")

    print("\nSTOP-LOSS NOTE")
    breached = trades["gapped_through_stop"].mean()
    print(f"  A {STOP_PCT:.0%} stop cannot fire while the market is closed. On "
          f"{breached:.2%} of nights the open was already below the stop level,")
    print("  meaning the fill was worse than the stop, not protected by it. The "
          "stop only does real work if you hold into the session.")

    print("\nCOMPARISON")
    print(f"  Avg overnight (close->open): {trades['overnight_ret'].mean()*10_000:+.2f} bps")
    print(f"  Avg intraday  (open->close): {trades['intraday_ret'].mean()*10_000:+.2f} bps")
    print("  If overnight is positive and intraday is flat or negative, the edge is real-ish.")

    print("\nCOST SENSITIVITY -- the number that actually decides this")
    gross = trades["overnight_ret"].mean() * 10_000
    for cost_bps in (0, 2, 4, 6, 8, 10):
        net = trades["overnight_ret"] - cost_bps / 10_000
        curve_n = (1 + net.groupby(trades["date"]).mean()).cumprod()
        print(f"  round-trip cost {cost_bps:>2} bps -> net {net.mean()*10_000:+6.2f} bps/night, "
              f"compounded {curve_n.iloc[-1]-1:+8.2%}, win rate {(net>0).mean():.1%}")
    print(f"\n  Breakeven round-trip cost: {gross:.2f} bps. Above that, the strategy loses money.")
    print("  MOC-to-MOO on $10-100 names realistically runs 4-10 bps. Judge accordingly.")

    trades.to_csv("overnight_trades.csv", index=False)
    by_year.to_csv("overnight_by_year.csv")
    print("\nWrote overnight_trades.csv and overnight_by_year.csv")
    return trades


# ---------------------------------------------------------------------------
# Crypto
# ---------------------------------------------------------------------------

def report_crypto(tickers=CRYPTO):
    """Find the hours where volume actually clusters, then test holding through them."""
    print("\nDownloading crypto hourly bars (yfinance caps hourly at ~730 days)...")
    for sym in tickers:
        d = yf.download(sym, period="730d", interval="1h",
                        auto_adjust=True, progress=False)
        if d.empty:
            print(f"  {sym}: no data")
            continue

        # yfinance returns MultiIndex columns even for a single ticker
        if isinstance(d.columns, pd.MultiIndex):
            d.columns = d.columns.get_level_values(0)

        d = d.tz_convert("America/New_York") if d.index.tz else d.tz_localize("UTC").tz_convert("America/New_York")
        d["hour"] = d.index.hour
        d["ret"] = d["Close"] / d["Open"] - 1

        prof = d.groupby("hour").agg(
            avg_volume=("Volume", "mean"),
            avg_ret_bps=("ret", lambda x: x.mean() * 10_000),
            win_rate=("ret", lambda x: (x > 0).mean()),
        )
        prof["vol_share"] = prof["avg_volume"] / prof["avg_volume"].sum()

        print("\n" + "=" * 60)
        print(f"{sym} -- hourly profile (ET)")
        print("=" * 60)
        print(prof.to_string(float_format=lambda x: f"{x:,.4f}"))

        top = prof["vol_share"].idxmax()
        window = prof.nlargest(6, "vol_share").index.sort_values()
        print(f"\n  Peak volume hour: {top:02d}:00 ET")
        print(f"  Top-6 volume hours: {', '.join(f'{h:02d}:00' for h in window)}")
        print(f"  Avg return across those hours: "
              f"{prof.loc[window, 'avg_ret_bps'].mean():+.2f} bps/hr")


# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--crypto", action="store_true")
    p.add_argument("--all", action="store_true")
    a = p.parse_args()

    if a.crypto:
        report_crypto()
    elif a.all:
        report_stocks()
        report_crypto()
    else:
        report_stocks()


if __name__ == "__main__":
    main()
