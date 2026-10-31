"use client";
import Link from "next/link";
import { useLive } from "@/components/useStore";
import { totalBays } from "@/lib/layout";
import { SAMPLE_VENUES } from "@/lib/samples";

export default function VenuesPage() {
  const { venues, ready } = useLive();
  const real = venues.filter((v) => !v.sample);
  return (
    <>
      <section className="card">
        <h2 style={{ fontSize: 26 }}>Venues</h2>
        <p className="note">Walk the parking levels of a mall or hospital, count the bays in each row, and enter them here. The venue goes live for every phone immediately. Sample venues are only for demos.</p>
        <Link href="/venues/new" className="btn">+ Set up a real venue</Link>
      </section>
      <section className="card">
        <span className="label">Real venues ({real.length})</span>
        {!ready && <p className="note">Loading…</p>}
        {ready && !real.length && <p className="note">None yet. The first real venue is the one you&apos;ll show a facility manager.</p>}
        {real.length > 0 && (
          <div className="list">
            {real.map((v) => (
              <div key={v.id} className="item">
                <span className="tag">{v.levels.length} lvl</span>
                <span><b>{v.name}</b><br /><span className="note">{v.kind} · {v.area}, {v.city} · {totalBays(v.levels, "car")} car + {totalBays(v.levels, "bike")} bike bays</span></span>
                <Link href={`/venues/new?id=${encodeURIComponent(v.id)}`} className="pill">Edit</Link>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <span className="label">Sample venues ({SAMPLE_VENUES.length})</span>
        <p className="note">{SAMPLE_VENUES.map((v) => v.name).join(" · ")}</p>
      </section>
    </>
  );
}
