"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getStore, type Store } from "@/lib/store";
import type { Booking, Occupancy, Venue } from "@/lib/types";

/** Live venues, occupancy and bookings. Re-fetches whenever the store reports a change. */
export function useLive(venueId?: string | null) {
  const storeRef = useRef<Store | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [occ, setOcc] = useState<Occupancy>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"supabase" | "demo" | null>(null);

  const refresh = useCallback(async () => {
    const s = storeRef.current!;
    try {
      const [vs, bs] = await Promise.all([s.listVenues(), s.listBookings(venueId ?? undefined)]);
      setVenues(vs);
      setBookings(bs);
      if (venueId) setOcc(await s.getOccupancy(venueId));
    } catch (e) {
      console.warn("refresh failed", e);
    } finally {
      setReady(true);
    }
  }, [venueId]);

  useEffect(() => {
    storeRef.current = getStore();
    setMode(storeRef.current.mode);
    refresh();
    const off = storeRef.current.subscribe(() => {
      refresh();
    });
    return off;
  }, [refresh]);

  return { store: storeRef.current ?? getStore(), venues, occ, bookings, ready, mode, refresh };
}

/** The driver's own pass, kept on this phone so it opens with no signal. */
export function usePass() {
  const [pass, setPassState] = useState<Booking | null>(null);
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("baypass.pass") || "null");
      if (p) setPassState(p);
    } catch {}
  }, []);
  const setPass = (b: Booking | null) => {
    setPassState(b);
    try {
      if (b) localStorage.setItem("baypass.pass", JSON.stringify(b));
      else localStorage.removeItem("baypass.pass");
    } catch {}
  };
  return [pass, setPass] as const;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = (m: string) => {
    setMsg(m);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 3000);
  };
  const Toast = msg ? <div className="toast" role="status">{msg}</div> : null;
  return { toast, Toast };
}
