"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LabelList,
} from "recharts";
import type { Stats } from "@/lib/types";

const AXIS = {
  stroke: "var(--axis)",
  tick: { fill: "var(--text-muted)", fontSize: 11 },
  tickLine: false,
};

function Box({ label, rows }: { label: string; rows: [string, string][] }) {
  return (
    <div className="tooltip">
      <div className="t-lab">{label}</div>
      {rows.map(([k, v]) => (
        <div className="t-row" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

const bps = (v: number | null | undefined) =>
  v === null || v === undefined ? "--" : `${v > 0 ? "+" : ""}${v.toFixed(2)} bps`;

/* ------------------------------------------------------------------ */
/* 1. The cost wall - one series, so no legend; the title names it.    */
/* ------------------------------------------------------------------ */

export function CostWall({
  data,
  breakeven,
  assumed,
}: {
  data: { cost_bps: number; net_bps: number | null; win_rate: number | null; compounded_pct: number | null }[];
  breakeven: number;
  assumed: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 16, right: 26, left: 4, bottom: 20 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="cost_bps"
          type="number"
          domain={[0, Math.max(...data.map((d) => d.cost_bps))]}
          ticks={data.map((d) => d.cost_bps)}
          {...AXIS}
          label={{
            value: "Round-trip cost assumption (bps)",
            position: "insideBottom",
            offset: -12,
            fill: "var(--text-secondary)",
            fontSize: 12,
          }}
        />
        <YAxis
          {...AXIS}
          width={54}
          label={{
            value: "Net bps / night",
            angle: -90,
            position: "insideLeft",
            fill: "var(--text-secondary)",
            fontSize: 12,
            dy: 44,
          }}
        />
        <ReferenceLine y={0} stroke="var(--axis)" strokeWidth={1} />
        <ReferenceLine
          x={breakeven}
          stroke="var(--text-muted)"
          strokeDasharray="4 4"
          label={{
            value: `breakeven ${breakeven.toFixed(2)}`,
            fill: "var(--text-muted)",
            fontSize: 11,
            position: "top",
          }}
        />
        <ReferenceLine
          x={assumed}
          stroke="var(--series-2)"
          strokeDasharray="2 3"
          label={{
            value: `assumed ${assumed}`,
            fill: "var(--series-2)",
            fontSize: 11,
            position: "insideBottom",
          }}
        />
        <Tooltip
          cursor={{ stroke: "var(--axis)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Box
                label={`${payload[0].payload.cost_bps} bps round-trip cost`}
                rows={[
                  ["Net per night", bps(payload[0].payload.net_bps)],
                  ["Win rate", `${payload[0].payload.win_rate?.toFixed(1)}%`],
                  ["Compounded", `${payload[0].payload.compounded_pct?.toFixed(1)}%`],
                ]}
              />
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="net_bps"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface-1)", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Equity curve - two series, legend rendered above in the page.    */
/* ------------------------------------------------------------------ */

export function EquityCurve({
  data,
  costBps,
}: {
  data: { date: string; gross: number; net: number }[];
  costBps: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="date"
          {...AXIS}
          minTickGap={64}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
        <YAxis
          {...AXIS}
          width={50}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `${v.toFixed(2)}x`}
        />
        <ReferenceLine y={1} stroke="var(--axis)" />
        <Tooltip
          cursor={{ stroke: "var(--axis)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Box
                label={String(label)}
                rows={[
                  ["Gross", `${Number(payload[0]?.value).toFixed(3)}x`],
                  [`Net (${costBps} bps)`, `${Number(payload[1]?.value).toFixed(3)}x`],
                ]}
              />
            ) : null
          }
        />
        <Line
          dataKey="gross"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="net"
          stroke="var(--series-2)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Signed bar cut - blue positive, red negative (diverging).        */
/* ------------------------------------------------------------------ */

export function SignedBars({
  data,
  height = 240,
  angled = false,
}: {
  data: Stats[];
  height?: number;
  angled?: boolean;
}) {
  const rows = data.map((d) => ({
    label: d.label ?? "",
    avg_bps: d.avg_bps ?? 0,
    trades: d.trades,
    win_rate: d.win_rate,
    t_stat: d.t_stat,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 18, right: 12, left: 4, bottom: angled ? 46 : 12 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="label"
          {...AXIS}
          interval={0}
          angle={angled ? -28 : 0}
          textAnchor={angled ? "end" : "middle"}
          height={angled ? 56 : 30}
        />
        <YAxis {...AXIS} width={46} />
        <ReferenceLine y={0} stroke="var(--axis)" />
        <Tooltip
          cursor={{ fill: "var(--grid)", opacity: 0.4 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Box
                label={payload[0].payload.label}
                rows={[
                  ["Net per night", bps(payload[0].payload.avg_bps)],
                  ["Trades", payload[0].payload.trades.toLocaleString()],
                  ["Win rate", `${payload[0].payload.win_rate?.toFixed(1)}%`],
                  ["t-stat", payload[0].payload.t_stat?.toFixed(2) ?? "--"],
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="avg_bps" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={54}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.avg_bps >= 0 ? "var(--dv-pos)" : "var(--dv-neg)"} />
          ))}
          <LabelList
            dataKey="avg_bps"
            position="top"
            formatter={(v: unknown) => {
              const n = Number(v);
              return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
            }}
            style={{ fill: "var(--text-secondary)", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Evidence scatter - every name against the luck threshold.        */
/* ------------------------------------------------------------------ */

export function EvidenceScatter({
  data,
  threshold,
  median,
}: {
  data: { ticker: string; trades: number; t_stat: number | null; avg_bps: number | null; sector: string }[];
  threshold: number;
  median: number;
}) {
  const pts = data
    .filter((d) => d.t_stat !== null)
    .map((d) => ({ ...d, t: d.t_stat as number }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 16, right: 22, left: 4, bottom: 22 }}>
        <CartesianGrid stroke="var(--grid)" />
        <XAxis
          type="number"
          dataKey="trades"
          {...AXIS}
          name="Trades"
          label={{
            value: "Independent trades (sample size)",
            position: "insideBottom",
            offset: -14,
            fill: "var(--text-secondary)",
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="t"
          {...AXIS}
          width={46}
          label={{
            value: "t-stat, net of costs",
            angle: -90,
            position: "insideLeft",
            fill: "var(--text-secondary)",
            fontSize: 12,
            dy: 50,
          }}
        />
        <ReferenceLine y={0} stroke="var(--axis)" />
        <ReferenceLine
          y={median}
          stroke="var(--text-muted)"
          strokeDasharray="3 3"
          label={{
            value: `typical best under pure luck (${median.toFixed(2)})`,
            fill: "var(--text-muted)",
            fontSize: 11,
            position: "insideTopLeft",
          }}
        />
        <ReferenceLine
          y={threshold}
          stroke="var(--series-2)"
          strokeWidth={2}
          label={{
            value: `evidence bar: t > ${threshold.toFixed(2)}`,
            fill: "var(--series-2)",
            fontSize: 11.5,
            position: "insideBottomLeft",
          }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "var(--axis)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Box
                label={`${payload[0].payload.ticker} · ${payload[0].payload.sector}`}
                rows={[
                  ["t-stat", payload[0].payload.t.toFixed(2)],
                  ["Net per night", bps(payload[0].payload.avg_bps)],
                  ["Trades", payload[0].payload.trades.toLocaleString()],
                ]}
              />
            ) : null
          }
        />
        <Scatter
          data={pts}
          fill="var(--series-1)"
          stroke="var(--surface-1)"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Gap behaviour - what the next session did, given the gap.        */
/* ------------------------------------------------------------------ */

export function GapBehaviour({
  data,
}: {
  data: {
    label: string;
    trades: number;
    share_pct: number | null;
    avg_gap_bps: number | null;
    next_session_bps: number | null;
    next_session_win_rate: number | null;
  }[];
}) {
  const rows = data.map((d) => ({
    ...d,
    short: d.label.split(" (")[0],
    next: d.next_session_bps ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 18, right: 12, left: 4, bottom: 42 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="short"
          {...AXIS}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={54}
        />
        <YAxis
          {...AXIS}
          width={46}
          label={{
            value: "Next session, open to close (bps)",
            angle: -90,
            position: "insideLeft",
            fill: "var(--text-secondary)",
            fontSize: 12,
            dy: 84,
          }}
        />
        <ReferenceLine y={0} stroke="var(--axis)" />
        <Tooltip
          cursor={{ fill: "var(--grid)", opacity: 0.4 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Box
                label={payload[0].payload.label}
                rows={[
                  ["Avg gap you woke up to", bps(payload[0].payload.avg_gap_bps)],
                  ["If you held, open to close", bps(payload[0].payload.next_session_bps)],
                  ["Held win rate", `${payload[0].payload.next_session_win_rate?.toFixed(1)}%`],
                  ["Share of nights", `${payload[0].payload.share_pct?.toFixed(1)}%`],
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="next" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={60}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.next >= 0 ? "var(--dv-pos)" : "var(--dv-neg)"} />
          ))}
          <LabelList
            dataKey="next"
            position="top"
            formatter={(v: unknown) => {
              const n = Number(v);
              return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
            }}
            style={{ fill: "var(--text-secondary)", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
