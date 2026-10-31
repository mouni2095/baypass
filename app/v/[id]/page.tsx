"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LotMap, { Legend } from "@/components/LotMap";
import { useLive, usePass, useToast } from "@/components/useStore";
import { BayTakenError } from "@/lib/store";
import { freeCount, nearestFree, timeFromNow } from "@/lib/layout";
import type { VehicleType } from "@/lib/types";

export default function VenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { store, venues, occ, ready } = useLive(id);
  const [, setPass] = usePass();
  const { toast, Toast } = useToast();
  const v = venues.find((x) => x.id === id);

  const [type, setType] = useState<VehicleType>("car");
  const [level, setLevel] = useState<string>("");
  const [bay, setBay] = useState<string | null>(null);
  const [arrive, setArrive] = useState(30);
  const [plate, setPlate] = useState("");
  const [step, setStep] = useState<"pick" | "pay">("pick");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setPlate(localStorage.getItem("baypass.plate") || ""); } catch {}
  }, []);
  useEffect(() => {
    if (v && !v.levels.some((l) => l.name === level)) setLevel(v.levels[0]?.name ?? "");
  }, [v, level]);

  if (!ready) return <p className="note">Loading…</p>;
  if (!v) return <p className="note">This venue does not exist any more.</p>;
  const price = type === "car" ? v.carPrice : v.bikePrice;

  async function confirm() {
    if (!v || !bay) return;
    setBusy(true);
    try {
      const b = await store.book({ venueId: v.id, level, bay, type, plate, source: "app", arriveMinutes: arrive });
      setPass(b);
      toast("Paid. Slot blocked and sent to the parking desk");
      router.push("/pass");
    } catch (e) {
      if (e instanceof BayTakenError) { toast("Someone just took that bay. Pick another."); setBay(null); setStep("pick"); }
      else toast("Could not book. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "pay")
    return (
      <>
        <button className="back" onClick={() => setStep("pick")}>← Change slot</button>
        <section className="card">
          <h2 style={{ fontSize: 26 }}>Confirm payment</h2>
          <dl className="sum">
            <dt>Venue</dt><dd>{v.name}</dd>
            <dt>Slot</dt><dd>{level} · {bay}</dd>
            <dt>Vehicle</dt><dd>{plate || "Not given"}</dd>
            <dt>Arriving</dt><dd>~{timeFromNow(arrive)}</dd>
            <dt className="total">Pay to {v.name.split(" ")[0]} Parking</dt><dd className="total">₹{price}</dd>
          </dl>
          <span className="label">Pay using</span>
          <div className="row"><button className="chip" aria-pressed="true">UPI app</button><button className="chip">Card</button><button className="chip">Wallet</button></div>
          <button className="btn" onClick={confirm} disabled={busy}>{busy ? "Blocking your slot…" : `Pay ₹${price}`}</button>
          <p className="note">Simulated in this pilot. No money moves. A payment gateway (Razorpay or PhonePe) plugs in here.</p>
        </section>
        {Toast}
      </>
    );

  return (
    <>
      <button className="back" onClick={() => router.push("/")}>← All venues</button>
      <section className="card">
        <div>
          <h2 style={{ fontSize: 28 }}>{v.name}{v.sample && <span className="sample">SAMPLE</span>}</h2>
          <span className="note">{v.kind} · {v.area}, {v.city}</span>
        </div>
        <div className="row">
          {(["car", "bike"] as VehicleType[]).map((t) => (
            <button key={t} className="chip" aria-pressed={type === t} onClick={() => { setType(t); setBay(null); }}>{t === "car" ? "Car" : "Two-wheeler"}</button>
          ))}
        </div>
        <span className="label">Pick a level</span>
        <div className="levels">
          {v.levels.map((l) => (
            <button key={l.name} className="lvl" aria-pressed={l.name === level} onClick={() => { setLevel(l.name); setBay(null); }}>
              <b>{l.name}</b><span>{freeCount(v, occ, l.name, type)} free</span>
            </button>
          ))}
        </div>
        <div className="lot">
          <LotMap venue={v} level={level} type={type} occ={occ} picked={bay} onPick={setBay} />
        </div>
        <Legend />
        <button className="btn ghost" onClick={() => { const n = nearestFree(v, occ, type, level); if (n) { setLevel(n.level); setBay(n.bay); } else toast("This venue is full right now"); }}>
          Pick the nearest free slot for me
        </button>
      </section>
      <section className="card">
        <span className="label">When will you arrive?</span>
        <div className="row">
          {[[30, "In 30 min"], [60, "In 1 hr"], [120, "In 2 hr"]].map(([m, l]) => (
            <button key={m} className="chip" aria-pressed={arrive === m} onClick={() => setArrive(m as number)}>{l}</button>
          ))}
        </div>
        <label className="label" htmlFor="plate">Vehicle number</label>
        <input id="plate" value={plate} placeholder="e.g. KA 03 MN 4521" autoComplete="off" onChange={(e) => { setPlate(e.target.value); try { localStorage.setItem("baypass.plate", e.target.value); } catch {} }} />
        <dl className="sum">
          <dt>Slot</dt><dd>{bay ? `${level} · ${bay}` : "Not picked yet"}</dd>
          <dt>Held until</dt><dd>{timeFromNow(arrive + 30)} (30 min grace)</dd>
          <dt className="total">Advance booking</dt><dd className="total">₹{price}</dd>
        </dl>
        <button className="btn" disabled={!bay} onClick={() => setStep("pay")}>Pay ₹{price} with UPI &amp; block slot</button>
        <p className="note">Not booking ahead? Just drive in. The desk at the entry gate gives you a free slot token on arrival.</p>
      </section>
      {Toast}
    </>
  );
}
