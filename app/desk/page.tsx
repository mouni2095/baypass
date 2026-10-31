"use client";
import { useEffect, useState } from "react";
import LotMap, { Legend } from "@/components/LotMap";
import { useLive, useToast } from "@/components/useStore";
import { bayKey, freeCount, nearestFree, rowsOf } from "@/lib/layout";
import type { Booking, VehicleType } from "@/lib/types";

export default function DeskPage() {
  const [venueId, setVenueId] = useState<string>("");
  const { store, venues, occ, bookings, ready } = useLive(venueId || null);
  const { toast, Toast } = useToast();
  const [level, setLevel] = useState("");
  const [code, setCode] = useState("");
  const [verify, setVerify] = useState<{ ok: boolean; msg?: string; b?: Booking } | null>(null);
  const [wtype, setWtype] = useState<VehicleType>("car");
  const [wplate, setWplate] = useState("");

  useEffect(() => {
    if (!venueId && venues.length) {
      let saved = "";
      try { saved = localStorage.getItem("baypass.desk") || ""; } catch {}
      setVenueId(venues.some((v) => v.id === saved) ? saved : venues[0].id);
    }
  }, [venues, venueId]);
  const v = venues.find((x) => x.id === venueId);
  useEffect(() => {
    if (v && !v.levels.some((l) => l.name === level)) setLevel(v.levels[0]?.name ?? "");
  }, [v, level]);

  if (!ready || !v) return <p className="note">Loading desk…</p>;
  const mine = bookings.filter((b) => b.venueId === v.id);

  async function doVerify() {
    const c = code.trim().toUpperCase();
    const b = bookings.find((x) => x.code === c);
    if (!c) return setVerify({ ok: false, msg: "Type the 6-letter code from the driver's pass." });
    if (!b) return setVerify({ ok: false, msg: `No booking with code ${c}. Check the letters, or give a walk-in token.` });
    if (b.venueId !== v!.id) return setVerify({ ok: false, msg: `This pass is for another venue, not this one.` });
    if (b.status === "parked") return setVerify({ ok: false, msg: `Already checked in at ${b.level} · ${b.bay}.` });
    try { await store.checkIn(b.code); setVerify({ ok: true, b }); setCode(""); }
    catch { toast("Could not check in. Try again."); }
  }
  async function walkIn() {
    const n = nearestFree(v!, occ, wtype);
    if (!n) return toast("No free slots left. Show the FULL board at the gate");
    try {
      const b = await store.book({ venueId: v!.id, level: n.level, bay: n.bay, type: wtype, plate: wplate.trim(), source: "walk-in" });
      toast(`Token ${b.code}: send to ${b.level} · ${b.bay}`); setWplate("");
    } catch { toast("Could not assign. Try again."); }
  }
  async function flipBay(b: string) {
    const k = bayKey(level, b);
    await store.setBay(v!.id, k, occ[k] ? "free" : "taken");
  }

  return (
    <div className="desk" style={{ display: "contents" }}>
      <section className="card">
        <label className="label" htmlFor="dv">Desk at</label>
        <select id="dv" value={venueId} onChange={(e) => { setVenueId(e.target.value); setVerify(null); try { localStorage.setItem("baypass.desk", e.target.value); } catch {} }}>
          {venues.map((x) => <option key={x.id} value={x.id}>{x.name}, {x.city}{x.sample ? " (sample)" : ""}</option>)}
        </select>
        <div className="stats" style={{ gridTemplateColumns: `repeat(${Math.min(3, v.levels.length)}, 1fr)` }}>
          {v.levels.map((l) => <div key={l.name} className="stat"><div className="big">{freeCount(v, occ, l.name, "car")}</div><span>{l.name} car free</span></div>)}
        </div>
      </section>

      <section className="card">
        <h3 style={{ fontSize: 22 }}>Check a pre-booked pass</h3>
        <input className="code-in" maxLength={6} placeholder="6-letter code" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doVerify()} />
        <button className="btn" onClick={doVerify}>Verify &amp; let in</button>
        {verify && (verify.ok
          ? <div className="result ok"><b>Valid.</b> Send to <b>{verify.b!.level} · {verify.b!.bay}</b> · {verify.b!.plate}</div>
          : <div className="result bad">{verify.msg}</div>)}
      </section>

      <section className="card">
        <h3 style={{ fontSize: 22 }}>Walk-in: give a slot token</h3>
        <div className="row">
          {(["car", "bike"] as VehicleType[]).map((t) => <button key={t} className="chip" aria-pressed={wtype === t} onClick={() => setWtype(t)}>{t === "car" ? "Car" : "Two-wheeler"}</button>)}
        </div>
        <input placeholder="Vehicle number, e.g. KA 51 AB 1234" autoComplete="off" value={wplate} onChange={(e) => setWplate(e.target.value)} />
        <button className="btn paint" onClick={walkIn}>Assign nearest free slot</button>
        <p className="note">Fills the first level first, then deeper levels. Tell the driver the level and bay, or write it on the paper token.</p>
      </section>

      <section className="card">
        <h3 style={{ fontSize: 22 }}>Mark bays as cars come and go</h3>
        <p className="note">Tap a bay to flip it between free and parked. This is how the map stays right without sensors.</p>
        <div className="levels">
          {v.levels.map((l) => <button key={l.name} className="lvl" aria-pressed={l.name === level} onClick={() => setLevel(l.name)}><b>{l.name}</b><span>{freeCount(v, occ, l.name)} free</span></button>)}
        </div>
        <div className="lot">
          <LotMap venue={v} level={level} type="car" occ={occ} desk onPick={flipBay} />
          {rowsOf(v, level, "bike").length > 0 && <><div className="drive" aria-hidden="true" /><LotMap venue={v} level={level} type="bike" occ={occ} desk onPick={flipBay} /></>}
        </div>
        <Legend />
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ fontSize: 22 }}>Today at this desk</h3><span className="note">{mine.length} token{mine.length === 1 ? "" : "s"}</span></div>
        {mine.length ? (
          <div className="list">
            {mine.map((b) => (
              <div key={b.code} className="item">
                <span className="tag">{b.level} · {b.bay}</span>
                <span>{b.plate || "No number"}<br /><span className="note">{b.code} · {new Date(b.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></span>
                {b.status === "parked"
                  ? <button className="pill in" title="Car has left" onClick={async () => { await store.release(b.code); toast(`${b.level} · ${b.bay} is free again`); }}>Parked · exit?</button>
                  : <span className={`pill ${b.source === "walk-in" ? "walk" : "pre"}`}>{b.source === "walk-in" ? "Walk-in" : "Pre-booked"}</span>}
              </div>
            ))}
          </div>
        ) : <p className="note">No tokens yet today. Book a slot in &quot;I&apos;m parking&quot; or assign a walk-in above.</p>}
        {mine.length > 0 && (
          <button className="btn ghost sm" onClick={async () => { for (const b of mine) await store.release(b.code); toast("Day closed. Held bays released"); }}>
            Close the day: clear tokens, free held bays
          </button>
        )}
      </section>
      {Toast}
    </div>
  );
}
