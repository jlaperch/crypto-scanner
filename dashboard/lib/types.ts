export type Stats = {
  label?: string;
  trades: number;
  names?: number;
  win_rate: number | null;
  avg_bps: number | null;
  median_bps: number | null;
  std_bps: number | null;
  avg_win_bps: number | null;
  avg_loss_bps: number | null;
  profit_factor: number | null;
  expectancy_bps: number | null;
  t_stat: number | null;
  sharpe_ann: number | null;
  best_pct: number | null;
  worst_pct: number | null;
};

export type TickerRow = Stats & {
  ticker: string;
  sector: string;
  gross_bps: number | null;
  breakeven_bps: number | null;
  max_dd_pct: number | null;
  top1pct_share: number | null;
  gap_thru_stop_pct: number | null;
  avg_price: number | null;
  first_half_bps: number | null;
  second_half_bps: number | null;
  tier: "Qualified" | "Worth watching" | "Interesting" | "Rejected" | "Insufficient sample";
};

export type Backtest = {
  meta: {
    generated_at: string;
    phase: number;
    data_source: string;
    granularity: string;
    cost_bps: number;
    cost_note: string;
    start: string;
    end: string;
    min_trades_for_evidence: number;
    min_profit_factor: number;
    not_yet_tested: string[];
    not_yet_tested_note: string;
  };
  headline: {
    gross: Stats;
    net: Stats;
    breakeven_cost_bps: number | null;
    compounded_gross_pct: number | null;
    compounded_net_pct: number | null;
    max_dd_gross_pct: number | null;
    max_dd_net_pct: number | null;
    sessions: number;
    top1pct_share: number | null;
    intraday_avg_bps: number | null;
    gap_thru_stop_pct: number | null;
  };
  multiple_testing: {
    p50: number;
    p95: number;
    p99: number;
    n_names: number;
    n_bootstrap: number;
  };
  tier_counts: Record<string, number>;
  equity_curve: { date: string; gross: number; net: number }[];
  by_year: Stats[];
  cost_sensitivity: {
    cost_bps: number;
    net_bps: number | null;
    win_rate: number | null;
    compounded_pct: number | null;
    max_dd_pct: number | null;
  }[];
  tickers: TickerRow[];
  by_sector: Stats[];
  by_regime_vol: Stats[];
  by_regime_trend: Stats[];
  by_dow: Stats[];
  by_price: Stats[];
  by_momentum: Stats[];
  gap_behavior: {
    label: string;
    trades: number;
    share_pct: number | null;
    avg_gap_bps: number | null;
    next_session_bps: number | null;
    next_session_win_rate: number | null;
  }[];
};
