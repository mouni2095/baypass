export type VehicleType = "car" | "bike";
export type BayState = "free" | "taken" | "held";

export interface Row {
  label: string; // painted letter on the pillars, e.g. "A"
  n: number; // number of bays in the row
  type: VehicleType;
}

export interface Level {
  name: string; // e.g. "P1", "B2", "Ground"
  rows: Row[];
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  area: string;
  kind: string; // Mall | Hospital | Office | Stadium | Other
  carPrice: number;
  bikePrice: number;
  levels: Level[];
  sample?: boolean;
}

export type Occupancy = Record<string, BayState>; // key "P1|A-01" -> state (free bays omitted)

export interface Booking {
  code: string;
  venueId: string;
  level: string;
  bay: string;
  type: VehicleType;
  plate: string;
  source: "app" | "walk-in";
  status: "booked" | "parked";
  until: string; // display text, e.g. "7:45 pm"
  createdAt: number; // epoch ms
}
