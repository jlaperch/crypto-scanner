"use client";

import { useMemo, useState } from "react";
import type { TickerRow } from "@/lib/types";

type Key = keyof TickerRow;

const COLS: { key: Key; label: string; fmt: (r: TickerRow) => string; help: string }[] = [
  { key: "ticker", label: "Name", fmt: (r) => r.ticker, help: "Ticker" },
  { key: "sector", label: "Sector", fmt: (r) => r.sector, help: "Sector" },
  { key: "trades", label: "Trades", fmt: (r) => r.trades.toLocaleString(), help: "Independent overnight trades" },
  { key: "gross_bps", label: "Gross", fmt: (r) => n(r.gross_bps), help: "Average bps per night before costs" },
  { key: "avg_bps", label: "Net", fmt: (r) => n(r.avg_bps), help: "Average bps per night after the cost assumption" },
  { key: "win_rate", label: "Win %", fmt: (r) => (r.win_rate === null ? "--" : r.win_rate.toFixed(1)), help: "Share of nights that closed positive" },
  { key: "profit_factor", label: "PF", fmt: (r) => (r.profit_factor === null ? "--" : r.profit_factor.toFixed(2)), help: "Gross wins divided by gross losses" },
  { key: "t_stat", label: "t-stat", fmt: (r) => (r.t_stat === null ? "--" : r.t_stat.toFixed(2)), help: "How many standard errors the net mean sits above zero" },
  { key: "max_dd_pct", label: "Max DD", fmt: (r) => (r.max_dd_pct === null ? "--" : `${r.max_dd_pct.toFixed(1)}%`), help: "Worst peak-to-trough on this name alone" },
  { key: "first_half_bps", label: "1st half", fmt: (r) => n(r.first_half_bps), help: "Net bps in the earlier half of the window" },
  { key: "second_half_bps", label: "2nd half", fmt: (r) => n(r.second_half_bps), help: "Net bps in the later half - a real edge shows up in both" },
  { key: "tier", label: "Verdict", fmt: (r) => r.tier, help: "Gate result" },
];

function n(v: number | null) {
  return v === null ? "--" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

function pillClass(tier: string) {
  if (tier === "Qualified") return "pill qualified";
  if (tier === "Worth watching") return "pill watch";
  if (tier === "Interesting") return "pill interesting";
  return "pill";
}

export default function TickerTable({ rows, threshold }: { rows: TickerRow[]; threshold: number }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "t_stat", dir: -1 });
  const [onlyEvidence, setOnlyEvidence] = useState(false);

  const view = useMemo(() => {
    const base = onlyEvidence ? rows.filter((r) => r.tier !== "Rejected") : rows;
    return [...base].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (typeof x === "string" || typeof y === "string") {
        return String(x).localeCompare(String(y)) * sort.dir;
      }
      const xn = x === null || x === undefined ? -Infinity : Number(x);
      const yn = y === null || y === undefined ? -Infinity : Number(y);
      return (xn - yn) * sort.dir;
    });
  }, [rows, sort, onlyEvidence]);

  const click = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));

  return (
    <>
      <div className="legend">
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={onlyEvidence}
            onChange={(e) => setOnlyEvidence(e.target.checked)}
          />
          Hide rejected names
        </label>
        <span style={{ marginLeft: "auto" }}>
          Click a column to sort. Evidence bar for this run: t &gt; {threshold.toFixed(2)}
        </span>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={String(c.key)} onClick={() => click(c.key)} title={c.help}>
                  {c.label}
                  {sort.key === c.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.ticker}>
                {COLS.map((c) => (
                  <td key={String(c.key)}>
                    {c.key === "tier" ? (
                      <span className={pillClass(r.tier)}>{r.tier}</span>
                    ) : (
                      c.fmt(r)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
