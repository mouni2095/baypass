"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLive, usePass, useToast } from "@/components/useStore";
import { DIRECTIONS } from "@/lib/layout";

function PassPattern({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const x = c.getContext("2d")!; const n = 13; const s = 84 / n;
    let seed = code.split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 0) || 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    x.fillStyle = "#fff"; x.fillRect(0, 0, 84, 84); x.fillStyle = "#152036";
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const corner = (i < 4 && j < 4) || (i < 4 && j > n - 5) || (i > n - 5 && j < 4);
      if (corner) { const a = i % (n - 4) % 4, b = j % (n - 4) % 4; if (a === 0 || a === 3 || b === 0 || b === 3 || (a > 0 && a < 3 && b > 0 && b < 3 && a === b)) x.fillRect(j * s, i * s, s, s); }
      else if (rnd() < 0.5) x.fillRect(j * s, i * s, s, s);
    }
  }, [code]);
  return <canvas ref={ref} width={84} height={84} style={{ background: "#fff", borderRadius: 6, padding: 6, width: 96, height: 96 }} aria-label="Pass pattern" />;
}

export default function PassPage() {
  const [pass, setPass] = usePass();
  const { store, venues, bookings } = useLive(pass?.venueId);
  const { toast, Toast } = useToast();
  const [lang, setLang] = useState("en");

  // keep the saved pass in step with the live booking (e.g. desk checked us in)
  useEffect(() => {
    if (!pass) return;
    const live = bookings.find((b) => b.code === pass.code);
    if (live && live.status !== pass.status) setPass(live);
  }, [bookings, pass, setPass]);

  if (!pass) return <section className="card"><p className="note">No pass on this phone. <Link href="/" style={{ color: "var(--sign)", fontWeight: 600 }}>Book a slot</Link> or get a token at the desk.</p></section>;
  const v = venues.find((x) => x.id === pass.venueId);
  const d = DIRECTIONS[lang];

  return (
    <>
      <Link href="/" className="back">← Home</Link>
      <div className="banner ok">✓ Saved on this phone. Opens even with no network in the basement.</div>
      <section className="ticket" aria-label="Parking pass">
        <span className="tl">{pass.source === "walk-in" ? "Desk token" : "Pre-booked pass"} · {v?.name ?? pass.venueId}{pass.status === "parked" ? " · checked in" : ""}</span>
        <div className="slot"><div className="lv">{pass.level}</div><div className="by">{pass.bay}</div></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div><span className="tl">Show at entry desk</span><div className="code">{pass.code}</div><span className="tl">{pass.plate} · held till {pass.until}</span></div>
          <PassPattern code={pass.code} />
        </div>
      </section>
      <section className="card">
        <h3 style={{ fontSize: 22 }}>{d.title}</h3>
        <div className="row">
          {Object.entries(DIRECTIONS).map(([k, x]) => <button key={k} className="chip" aria-pressed={lang === k} onClick={() => setLang(k)}>{x.label}</button>)}
        </div>
        <ol className="steps">{d.steps(pass.level, pass.bay).map((s, i) => <li key={i}>{s}</li>)}</ol>
      </section>
      {pass.status !== "parked" ? (
        <button className="btn ghost" onClick={async () => { try { await store.release(pass.code); } catch {} setPass(null); toast("Booking cancelled. Refund goes back to your UPI app"); }}>Cancel booking</button>
      ) : (
        <button className="btn ghost" onClick={() => setPass(null)}>Remove pass from this phone</button>
      )}
      {Toast}
    </>
  );
}
