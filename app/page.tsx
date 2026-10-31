"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLive, usePass } from "@/components/useStore";
import { CITIES } from "@/lib/samples";

export default function Home() {
  const { venues, ready, mode } = useLive();
  const [pass] = usePass();
  const [city, setCity] = useState<string>("Bengaluru");
  useEffect(() => {
    try {
      const c = localStorage.getItem("baypass.city");
      if (c) setCity(c);
    } catch {}
  }, []);
  const cities = useMemo(() => [...new Set([...venues.map((v) => v.city), ...CITIES.slice(0, 4)])], [venues]);
  const list = venues.filter((v) => v.city === city);
  const passVenue = pass ? venues.find((v) => v.id === pass.venueId) : null;

  return (
    <>
      {mode === "demo" && <div className="banner info">Demo mode: data stays on this device. Connect Supabase to go live.</div>}
      <section className="card">
        <span className="label">Your city</span>
        <div className="row">
          {cities.map((c) => (
            <button key={c} className="chip" aria-pressed={c === city} onClick={() => { setCity(c); try { localStorage.setItem("baypass.city", c); } catch {} }}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {pass && (
        <Link href="/pass" className="card" style={{ borderColor: "var(--paint)" }}>
          <span className="label">Your active pass</span>
          <span className="row"><span className="tag">{pass.level} · {pass.bay}</span> {passVenue?.name ?? "Parking pass"}</span>
        </Link>
      )}

      <span className="label">Venues with BayPass in {city}</span>
      {!ready && <p className="note">Loading venues…</p>}
      {ready && !list.length && <p className="note">No venues here yet. Add one under Venues.</p>}
      {list.map((v) => (
        <Link key={v.id} href={`/v/${v.id}`} className="venue">
          <h3>{v.name}{v.sample && <span className="sample">SAMPLE</span>}</h3>
          <span className="avail">
            <span className="note">{v.levels.map((l) => l.name).join(" / ")}</span>
          </span>
          <span className="meta">{v.kind} · {v.area}</span>
        </Link>
      ))}
    </>
  );
}
