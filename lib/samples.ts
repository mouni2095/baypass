import type { Level, Occupancy, Venue } from "./types";
import { bayId, bayKey } from "./layout";

const std = (names: string[]): Level[] =>
  names.map((n) => ({
    name: n,
    rows: [
      { label: "A", n: 10, type: "car" },
      { label: "B", n: 10, type: "car" },
      { label: "C", n: 10, type: "car" },
      { label: "T", n: 10, type: "bike" },
    ],
  }));

/** Made-up venues so the app has something to show before a real venue is mapped. */
export const SAMPLE_VENUES: Venue[] = [
  { id: "sample-lakeview", name: "Lakeview Central Mall", city: "Bengaluru", area: "Whitefield", kind: "Mall", carPrice: 100, bikePrice: 40, levels: std(["P1", "P2", "P3"]), sample: true },
  { id: "sample-sanjeevani", name: "Sanjeevani Multispeciality Hospital", city: "Bengaluru", area: "Jayanagar", kind: "Hospital", carPrice: 60, bikePrice: 20, levels: std(["P1", "P2"]), sample: true },
  { id: "sample-hitech", name: "Hitech Mall Avenue", city: "Hyderabad", area: "Madhapur", kind: "Mall", carPrice: 100, bikePrice: 30, levels: std(["P1", "P2", "P3"]), sample: true },
  { id: "sample-riverside", name: "Riverside Retail Park", city: "Pune", area: "Kharadi", kind: "Mall", carPrice: 80, bikePrice: 30, levels: std(["P1", "P2", "P3"]), sample: true },
];

/** Deterministic pretend occupancy for sample venues: P1 nearly full, deeper levels emptier. */
export function sampleOccupancy(v: Venue): Occupancy {
  let seed = v.id.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const occ: Occupancy = {};
  v.levels.forEach((lv, i) => {
    const fill = [0.93, 0.7, 0.45][i] ?? 0.5;
    for (const r of lv.rows) for (let n = 1; n <= r.n; n++) if (rnd() < fill) occ[bayKey(lv.name, bayId(r.label, n))] = "taken";
  });
  return occ;
}

export const CITIES = ["Bengaluru", "Hyderabad", "Pune", "Mumbai", "Chennai", "Delhi NCR", "Kolkata"];
