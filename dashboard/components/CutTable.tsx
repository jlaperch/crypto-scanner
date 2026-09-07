import type { Stats } from "@/lib/types";

function n(v: number | null | undefined, d = 2) {
  return v === null || v === undefined ? "--" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
}

export default function CutTable({ rows, first = "Cut" }: { rows: Stats[]; first?: string }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th style={{ cursor: "default" }}>{first}</th>
            <th style={{ cursor: "default" }}>Trades</th>
            <th style={{ cursor: "default" }}>Net bps</th>
            <th style={{ cursor: "default" }}>Win %</th>
            <th style={{ cursor: "default" }}>PF</th>
            <th style={{ cursor: "default" }}>t-stat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.trades.toLocaleString()}</td>
              <td style={{ color: (r.avg_bps ?? 0) >= 0 ? "var(--dv-pos)" : "var(--dv-neg)" }}>
                {n(r.avg_bps)}
              </td>
              <td>{r.win_rate === null ? "--" : r.win_rate.toFixed(1)}</td>
              <td>{r.profit_factor === null ? "--" : r.profit_factor.toFixed(2)}</td>
              <td>{r.t_stat === null ? "--" : r.t_stat.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
