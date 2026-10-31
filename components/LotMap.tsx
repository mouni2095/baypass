"use client";
import type { Occupancy, Venue, VehicleType } from "@/lib/types";
import { bayId, rowsOf, stateOf } from "@/lib/layout";

export function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: "var(--free-bg)", outline: "1px solid var(--free)" }} />Free</span>
      <span><i style={{ background: "var(--taken)" }} />Car parked</span>
      <span><i style={{ background: "var(--sign)" }} />Pre-booked</span>
      <span><i style={{ background: "var(--mine)" }} />Your pick</span>
    </div>
  );
}

export default function LotMap({
  venue, level, type, occ, picked, desk, onPick,
}: {
  venue: Venue; level: string; type: VehicleType; occ: Occupancy; picked?: string | null; desk?: boolean; onPick?: (bay: string) => void;
}) {
  const rows = rowsOf(venue, level, type);
  if (!rows.length) return <p className="note" style={{ margin: 4 }}>No {type === "bike" ? "two-wheeler" : "car"} bays on {level}.</p>;
  return (
    <>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="lane" style={{ gridTemplateColumns: `22px repeat(${r.n}, 1fr)`, minWidth: Math.max(200, r.n * 30) }}>
            <span className="rl">{r.label}</span>
            {Array.from({ length: r.n }, (_, n) => {
              const b = bayId(r.label, n + 1);
              const st = stateOf(occ, level, b);
              const mine = picked === b;
              const disabled = !desk && st !== "free";
              return (
                <button
                  key={b}
                  type="button"
                  className={`bay ${r.type === "bike" ? "bike" : ""} ${mine ? "mine" : st}`}
                  disabled={disabled}
                  aria-label={`Bay ${b} ${st}`}
                  onClick={() => onPick?.(b)}
                >
                  {n + 1}
                </button>
              );
            })}
          </div>
          {i < rows.length - 1 && i % 2 === 0 && <div className="drive" aria-hidden="true" />}
        </div>
      ))}
    </>
  );
}
