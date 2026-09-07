import Link from "next/link";

export default function Nav({ page }: { page: "backtest" | "live" }) {
  return (
    <div className="nav">
      <h1>Overnight Edge</h1>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
        buy the close, sell the next open
      </span>
      <div className="links">
        <Link href="/" className={page === "backtest" ? "on" : ""}>
          Backtest
        </Link>
        <Link href="/live" className={page === "live" ? "on" : ""}>
          Live
        </Link>
      </div>
    </div>
  );
}
