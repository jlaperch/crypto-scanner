"use client";

import { useEffect, useState } from "react";

type LiveResponse = {
  configured: boolean;
  asOf: string;
  message: string;
  candidates: { ticker: string; price: number; relVolume: number; tier: string; reason: string }[];
};

export default function LivePanel() {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/live")
      .then((r) => r.json())
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <p style={{ color: "var(--critical)", margin: 0 }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--text-muted)", margin: 0 }}>Checking…</p>;

  return (
    <>
      <div className="legend">
        <span>
          <i
            className="swatch"
            style={{ background: data.configured ? "var(--good)" : "var(--text-muted)" }}
          />
          {data.configured ? "Provider configured" : "No provider configured"}
        </span>
        <span style={{ marginLeft: "auto" }}>
          checked {new Date(data.asOf).toLocaleString()}
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--text-secondary)" }}>{data.message}</p>
      {data.candidates.length > 0 && (
        <div className="scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th style={{ cursor: "default" }}>Ticker</th>
                <th style={{ cursor: "default" }}>Price</th>
                <th style={{ cursor: "default" }}>Rel vol</th>
                <th style={{ cursor: "default" }}>Tier</th>
                <th style={{ cursor: "default" }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((c) => (
                <tr key={c.ticker}>
                  <td>{c.ticker}</td>
                  <td>{c.price.toFixed(2)}</td>
                  <td>{c.relVolume.toFixed(2)}x</td>
                  <td>{c.tier}</td>
                  <td style={{ textAlign: "left", whiteSpace: "normal" }}>{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
