"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BayState, Booking, Occupancy, Venue, VehicleType } from "./types";
import { bayKey, makeCode, timeFromNow } from "./layout";
import { SAMPLE_VENUES, sampleOccupancy } from "./samples";

export interface BookInput {
  venueId: string;
  level: string;
  bay: string;
  type: VehicleType;
  plate: string;
  source: "app" | "walk-in";
  arriveMinutes?: number;
}

export interface Store {
  readonly mode: "supabase" | "demo";
  /** Last connection or query problem, in plain words, or null when healthy. */
  lastError?: string | null;
  listVenues(): Promise<Venue[]>;
  saveVenue(v: Venue): Promise<void>;
  deleteVenue(id: string): Promise<void>;
  getOccupancy(venueId: string): Promise<Occupancy>;
  setBay(venueId: string, key: string, state: BayState): Promise<void>;
  listBookings(venueId?: string): Promise<Booking[]>;
  /** Atomically claims the bay. Throws Error("BAY_TAKEN") if it was just taken. */
  book(input: BookInput): Promise<Booking>;
  checkIn(code: string): Promise<void>;
  release(code: string): Promise<void>; // car left or booking cancelled: free the bay, remove booking
  /** Called whenever any venue, occupancy or booking changes anywhere. */
  subscribe(cb: () => void): () => void;
}

export class BayTakenError extends Error {
  constructor() {
    super("BAY_TAKEN");
  }
}

// ---------------- Supabase ----------------
type VenueRow = { id: string; name: string; city: string; area: string; kind: string; car_price: number; bike_price: number; levels: Venue["levels"] };
type BookingRow = { code: string; venue_id: string; level: string; bay: string; type: VehicleType; plate: string; source: Booking["source"]; status: Booking["status"]; until_text: string; created_at: string };

const toVenue = (r: VenueRow): Venue => ({ id: r.id, name: r.name, city: r.city, area: r.area, kind: r.kind, carPrice: r.car_price, bikePrice: r.bike_price, levels: r.levels });
const toBooking = (r: BookingRow): Booking => ({ code: r.code, venueId: r.venue_id, level: r.level, bay: r.bay, type: r.type, plate: r.plate, source: r.source, status: r.status, until: r.until_text, createdAt: new Date(r.created_at).getTime() });

class SupabaseStore implements Store {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key);
  }
  lastError: string | null = null;
  async listVenues() {
    const { data, error } = await this.sb.from("venues").select("*").order("created_at");
    if (error) {
      this.lastError = `Database: ${error.message}`;
      console.warn("venues", error);
      return [...SAMPLE_VENUES];
    }
    this.lastError = null;
    return [...(data as VenueRow[]).map(toVenue), ...SAMPLE_VENUES];
  }
  async saveVenue(v: Venue) {
    const { error } = await this.sb.from("venues").upsert({ id: v.id, name: v.name, city: v.city, area: v.area, kind: v.kind, car_price: v.carPrice, bike_price: v.bikePrice, levels: v.levels });
    if (error) throw error;
  }
  async deleteVenue(id: string) {
    const { error } = await this.sb.from("venues").delete().eq("id", id);
    if (error) throw error;
  }
  async getOccupancy(venueId: string) {
    const sample = SAMPLE_VENUES.find((v) => v.id === venueId);
    const { data } = await this.sb.from("occupancy").select("bays").eq("venue_id", venueId).maybeSingle();
    const live = (data?.bays as Occupancy | undefined) ?? {};
    return sample ? { ...sampleOccupancy(sample), ...live } : live;
  }
  async setBay(venueId: string, key: string, state: BayState) {
    await this.ensureSampleRow(venueId);
    const { error } = await this.sb.rpc("set_bay", { p_venue: venueId, p_key: key, p_state: state });
    if (error) throw error;
  }
  async listBookings(venueId?: string) {
    let q = this.sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(300);
    if (venueId) q = q.eq("venue_id", venueId);
    const { data, error } = await q;
    if (error) throw error;
    return (data as BookingRow[]).map(toBooking);
  }
  async book(i: BookInput) {
    await this.ensureSampleRow(i.venueId);
    const until = timeFromNow(i.source === "walk-in" ? 15 : (i.arriveMinutes ?? 30) + 30);
    const { data, error } = await this.sb.rpc("book_bay", { p_code: makeCode(), p_venue: i.venueId, p_level: i.level, p_bay: i.bay, p_type: i.type, p_plate: i.plate, p_source: i.source, p_until: until });
    if (error) {
      if (/BAY_TAKEN/.test(error.message)) throw new BayTakenError();
      throw error;
    }
    return toBooking(data as BookingRow);
  }
  async checkIn(code: string) {
    const { data, error } = await this.sb.from("bookings").update({ status: "parked" }).eq("code", code).select().single();
    if (error) throw error;
    const b = toBooking(data as BookingRow);
    await this.setBay(b.venueId, bayKey(b.level, b.bay), "taken");
  }
  async release(code: string) {
    const { data } = await this.sb.from("bookings").select("*").eq("code", code).maybeSingle();
    if (!data) return;
    const b = toBooking(data as BookingRow);
    await this.setBay(b.venueId, bayKey(b.level, b.bay), "free");
    await this.sb.from("bookings").delete().eq("code", code);
  }
  subscribe(cb: () => void) {
    const ch = this.sb
      .channel("baypass-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "occupancy" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "venues" }, cb)
      .subscribe();
    return () => {
      this.sb.removeChannel(ch);
    };
  }
  /** Sample venues live in code, but bookings against them need a venues row for the foreign key. */
  private async ensureSampleRow(venueId: string) {
    const s = SAMPLE_VENUES.find((v) => v.id === venueId);
    if (!s) return;
    await this.sb.from("venues").upsert({ id: s.id, name: s.name, city: s.city, area: s.area, kind: s.kind, car_price: s.carPrice, bike_price: s.bikePrice, levels: s.levels }, { ignoreDuplicates: true });
  }
}

// ---------------- Demo (no backend; this browser only) ----------------
const LS = "baypass.demo";
type DemoData = { venues: Venue[]; occ: Record<string, Occupancy>; bookings: Booking[] };

class DemoStore implements Store {
  readonly mode = "demo" as const;
  private d: DemoData;
  private subs = new Set<() => void>();
  constructor() {
    let saved: DemoData | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(LS) || "null");
    } catch {}
    this.d = saved ?? { venues: [], occ: {}, bookings: [] };
  }
  private persist() {
    try {
      localStorage.setItem(LS, JSON.stringify(this.d));
    } catch {}
    this.subs.forEach((f) => f());
  }
  private occ(venueId: string) {
    if (!this.d.occ[venueId]) {
      const s = SAMPLE_VENUES.find((v) => v.id === venueId);
      this.d.occ[venueId] = s ? sampleOccupancy(s) : {};
    }
    return this.d.occ[venueId];
  }
  async listVenues() {
    return [...this.d.venues, ...SAMPLE_VENUES];
  }
  async saveVenue(v: Venue) {
    const i = this.d.venues.findIndex((x) => x.id === v.id);
    if (i >= 0) this.d.venues[i] = v;
    else this.d.venues.unshift(v);
    this.persist();
  }
  async deleteVenue(id: string) {
    this.d.venues = this.d.venues.filter((v) => v.id !== id);
    delete this.d.occ[id];
    this.d.bookings = this.d.bookings.filter((b) => b.venueId !== id);
    this.persist();
  }
  async getOccupancy(venueId: string) {
    return { ...this.occ(venueId) };
  }
  async setBay(venueId: string, key: string, state: BayState) {
    const o = this.occ(venueId);
    if (state === "free") delete o[key];
    else o[key] = state;
    this.persist();
  }
  async listBookings(venueId?: string) {
    return this.d.bookings.filter((b) => !venueId || b.venueId === venueId).sort((a, b) => b.createdAt - a.createdAt);
  }
  async book(i: BookInput) {
    const o = this.occ(i.venueId);
    const k = bayKey(i.level, i.bay);
    if (o[k]) throw new BayTakenError();
    o[k] = i.source === "walk-in" ? "taken" : "held";
    const b: Booking = { code: makeCode(), venueId: i.venueId, level: i.level, bay: i.bay, type: i.type, plate: i.plate, source: i.source, status: i.source === "walk-in" ? "parked" : "booked", until: timeFromNow(i.source === "walk-in" ? 15 : (i.arriveMinutes ?? 30) + 30), createdAt: Date.now() };
    this.d.bookings.unshift(b);
    this.persist();
    return b;
  }
  async checkIn(code: string) {
    const b = this.d.bookings.find((x) => x.code === code);
    if (!b) return;
    b.status = "parked";
    this.occ(b.venueId)[bayKey(b.level, b.bay)] = "taken";
    this.persist();
  }
  async release(code: string) {
    const b = this.d.bookings.find((x) => x.code === code);
    if (!b) return;
    delete this.occ(b.venueId)[bayKey(b.level, b.bay)];
    this.d.bookings = this.d.bookings.filter((x) => x.code !== code);
    this.persist();
  }
  subscribe(cb: () => void) {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
}

let store: Store | null = null;
export function getStore(): Store {
  if (store) return store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  store = url && key ? new SupabaseStore(url, key) : new DemoStore();
  return store;
}
