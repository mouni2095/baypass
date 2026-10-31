"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLive, useToast } from "@/components/useStore";
import { slug, totalBays, validateVenue } from "@/lib/layout";
import { CITIES } from "@/lib/samples";
import type { Level, Venue, VehicleType } from "@/lib/types";

const blank = (): Venue => ({
  id: "", name: "", city: "Bengaluru", area: "", kind: "Mall", carPrice: 100, bikePrice: 40,
  levels: [{ name: "P1", rows: [{ label: "A", n: 12, type: "car" }, { label: "B", n: 12, type: "car" }, { label: "T", n: 20, type: "bike" }] }],
});

function Editor() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const { store, venues, ready } = useLive();
  const { toast, Toast } = useToast();
  const [v, setV] = useState<Venue>(blank());
  const [loaded, setLoaded] = useState(false);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded || !ready) return;
    if (editId) {
      const ex = venues.find((x) => x.id === editId && !x.sample);
      if (ex) setV(JSON.parse(JSON.stringify(ex)));
    }
    setLoaded(true);
  }, [editId, venues, ready, loaded]);

  const upd = (patch: Partial<Venue>) => setV((x) => ({ ...x, ...patch }));
  const updLevel = (i: number, patch: Partial<Level>) => setV((x) => ({ ...x, levels: x.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const updRow = (i: number, r: number, patch: Partial<Level["rows"][number]>) =>
    setV((x) => ({ ...x, levels: x.levels.map((l, j) => (j === i ? { ...l, rows: l.rows.map((row, k) => (k === r ? { ...row, ...patch } : row)) } : l)) }));

  async function parse() {
    if (!desc.trim() && !photo) return toast("Describe the parking first, or add a photo.");
    setParsing(true);
    try {
      const res = await fetch("/api/parse-layout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: desc, image: photo }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setV((x) => ({ ...x, ...(data.name && !x.name ? { name: data.name } : {}), ...(data.city && !x.area ? { city: data.city } : {}), ...(data.area && !x.area ? { area: data.area } : {}), ...(data.kind ? { kind: data.kind } : {}), levels: data.levels }));
      toast(`Read ${data.levels.length} level${data.levels.length === 1 ? "" : "s"}. Check the rows below and fix anything that is off.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the description.");
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    const clean: Venue = {
      ...v, name: v.name.trim(), city: v.city.trim(), area: v.area.trim(), carPrice: Number(v.carPrice) || 0, bikePrice: Number(v.bikePrice) || 0,
      levels: v.levels.map((l) => ({ name: l.name.trim(), rows: l.rows.map((r) => ({ label: r.label.trim().toUpperCase(), n: Number(r.n), type: r.type })) })),
    };
    const err = validateVenue(clean);
    if (err) return toast(err);
    if (!clean.id) { let id = slug(clean.name); if (venues.some((x) => x.id === id)) id += "-" + Math.floor(Math.random() * 900 + 100); clean.id = id; }
    setSaving(true);
    try { await store.saveVenue(clean); toast("Venue saved. It is live for every phone now."); router.push("/venues"); }
    catch { toast("Could not save. Check your connection and try again."); setSaving(false); }
  }

  const isNew = !v.id;
  return (
    <>
      <button className="back" onClick={() => router.push("/venues")}>← All venues</button>

      {isNew && (
        <section className="card">
          <h3 style={{ fontSize: 22 }}>Describe the parking, Claude fills in the layout</h3>
          <p className="note">Type what you saw, in any words. Example: &quot;Phoenix Marketcity Whitefield. P1 has rows A to F with about 15 cars each, bikes in rows T1 and T2 with 30 each. P2 has A to H, 15 cars each.&quot; You can also add a photo of the parking signboard.</p>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe levels, rows and bay counts…" />
          <div className="row">
            <label className="btn ghost sm" style={{ cursor: "pointer" }}>
              {photo ? "Photo added ✓" : "Add a photo of the signboard"}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(f); }} />
            </label>
            {photo && <button className="btn ghost sm" onClick={() => setPhoto(null)}>Remove photo</button>}
          </div>
          <button className="btn paint" onClick={parse} disabled={parsing}>{parsing ? "Reading…" : "Fill in the layout for me"}</button>
        </section>
      )}

      <section className="card">
        <h2 style={{ fontSize: 26 }}>{isNew ? "Set up a venue" : `Edit ${v.name}`}</h2>
        <label className="label" htmlFor="vn">Venue name</label>
        <input id="vn" value={v.name} onChange={(e) => upd({ name: e.target.value })} placeholder="e.g. Phoenix Marketcity" />
        <div className="frow">
          <div><label className="label" htmlFor="vc">City</label><input id="vc" list="citylist" value={v.city} onChange={(e) => upd({ city: e.target.value })} /><datalist id="citylist">{CITIES.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div><label className="label" htmlFor="va">Area</label><input id="va" value={v.area} onChange={(e) => upd({ area: e.target.value })} placeholder="e.g. Whitefield" /></div>
        </div>
        <div className="frow">
          <div><label className="label" htmlFor="vk">Type</label><select id="vk" value={v.kind} onChange={(e) => upd({ kind: e.target.value })}>{["Mall", "Hospital", "Office", "Stadium", "Other"].map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><span className="label">Advance booking ₹ (car / bike)</span><div className="frow"><input type="number" min={0} value={v.carPrice} onChange={(e) => upd({ carPrice: Number(e.target.value) })} aria-label="Car price" /><input type="number" min={0} value={v.bikePrice} onChange={(e) => upd({ bikePrice: Number(e.target.value) })} aria-label="Bike price" /></div></div>
        </div>
      </section>

      <section className="card">
        <span className="label">Levels and rows</span>
        <p className="note">One row = one line of bays with a painted letter. Write the letter as it appears on the pillars so drivers can match it.</p>
        {v.levels.map((l, i) => (
          <div key={i} className="lvlbox">
            <div className="rrow" style={{ gridTemplateColumns: "1fr auto" }}>
              <input value={l.name} onChange={(e) => updLevel(i, { name: e.target.value })} placeholder="Level name, e.g. P1" style={{ font: "700 18px var(--f-display)" }} />
              <button className="x" aria-label="Remove level" onClick={() => setV((x) => ({ ...x, levels: x.levels.filter((_, j) => j !== i) }))}>×</button>
            </div>
            {l.rows.map((r, k) => (
              <div key={k} className="rrow">
                <input value={r.label} maxLength={3} aria-label="Row letter" onChange={(e) => updRow(i, k, { label: e.target.value })} />
                <input type="number" min={1} max={80} value={r.n} aria-label="Number of bays" onChange={(e) => updRow(i, k, { n: Number(e.target.value) })} />
                <select value={r.type} onChange={(e) => updRow(i, k, { type: e.target.value as VehicleType })}><option value="car">Car</option><option value="bike">Two-wheeler</option></select>
                <button className="x" aria-label="Remove row" onClick={() => updLevel(i, { rows: l.rows.filter((_, j) => j !== k) })}>×</button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => updLevel(i, { rows: [...l.rows, { label: String.fromCharCode(65 + l.rows.filter((r) => r.type === "car").length), n: 12, type: "car" }] })}>+ Add row</button>
          </div>
        ))}
        <button className="btn ghost" onClick={() => setV((x) => ({ ...x, levels: [...x.levels, { name: "P" + (x.levels.length + 1), rows: [{ label: "A", n: 12, type: "car" }, { label: "B", n: 12, type: "car" }] }] }))}>+ Add level</button>
      </section>

      <section className="card">
        <dl className="sum"><dt>Car bays</dt><dd>{totalBays(v.levels, "car")}</dd><dt>Two-wheeler bays</dt><dd>{totalBays(v.levels, "bike")}</dd></dl>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : isNew ? "Save and go live" : "Save changes"}</button>
        {!isNew && <button className="btn ghost" onClick={async () => { await store.deleteVenue(v.id); router.push("/venues"); }}>Remove this venue</button>}
      </section>
      {Toast}
    </>
  );
}

export default function NewVenuePage() {
  return <Suspense fallback={<p className="note">Loading…</p>}><Editor /></Suspense>;
}
