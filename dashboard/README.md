# Overnight Edge — dashboard

Renders the phase 1 backtest of the close-to-open overnight hold, plus a live
tracker that stays inert until a market-data provider is configured.

## How the pieces fit

```
overnight_backtest.py   fetches daily bars, writes overnight_trades.csv   (needs network, run on your Mac)
analyze.py              reads that CSV, writes dashboard/public/data/backtest.json   (no network)
dashboard/              Next.js app that renders the JSON                 (deployed on Vercel)
```

The backtest is a batch job, not a serverless function. It runs locally, its
output is committed to the repo, and Vercel just renders it. The only thing the
Vercel runtime does is serve `/api/live`, which is where a real data provider
plugs in later.

## Refreshing the numbers

```bash
cd ~/overnight
source .venv/bin/activate
python overnight_backtest.py                 # refetch bars -> overnight_trades.csv
python analyze.py                            # recompute -> dashboard/public/data/backtest.json
git add -A && git commit -m "Refresh backtest" && git push
```

Vercel redeploys on push. Every headline number, verdict sentence and threshold
on the page is computed from the JSON, so the page tells the truth about
whatever the latest run found — including if the verdict flips.

## Local dev

```bash
cd ~/overnight/dashboard
npm install
npm run dev
```

## Deploying

Set the Vercel project's **Root Directory** to `dashboard`. Everything else is
default (Next.js preset, `npm run build`).

## Arming the live tracker

`app/api/live/route.ts` returns a stable shape and is deliberately empty. To
turn it on:

1. Set `MARKET_DATA_PROVIDER` and `MARKET_DATA_KEY` in Vercel project settings.
2. Implement `fetchCandidates()`.

Use a consolidated-tape source. Free IEX-only feeds miss the closing auction and
the opening print, which are the only two prices this strategy touches.

## What analyze.py does that a plain backtest does not

- **Costs first.** Every stat on the page is net of a stated round-trip
  assumption, and the cost-sensitivity curve shows exactly where the edge dies.
- **Multiple-testing guard.** Testing 49 names guarantees a good-looking winner.
  Each name's returns are sign-flipped a few thousand times to build the
  distribution of the best t-stat in a world with no edge; the 95th percentile
  of that becomes the bar a name has to clear.
- **A strict gate.** Minimum sample, positive net expectancy, profit factor
  floor, and the luck bar. "Rejected" is the default outcome.
- **Split-half check.** First-half and second-half columns per name, so an edge
  that only existed in one stretch of the window is visible.
- **Regime and gap cuts** derived from the data itself, no external index feed.
