import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Level } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM = `You turn a plain-language description (and optionally a photo of a parking signboard) of a mall or hospital car park in India into a structured layout.

Return ONLY a JSON object, no prose, in exactly this shape:
{
  "name": string | null,      // venue name if mentioned
  "city": string | null,
  "area": string | null,      // locality, e.g. "Whitefield"
  "kind": "Mall" | "Hospital" | "Office" | "Stadium" | "Other",
  "levels": [
    { "name": "P1", "rows": [ { "label": "A", "n": 12, "type": "car" }, { "label": "T", "n": 20, "type": "bike" } ] }
  ]
}

Rules:
- Level names as written on the venue's signs: P1, P2, B1, B2, LG, UG, G, Ground, etc. Keep their order from entry downwards.
- "rows A to F, 15 each" expands to six rows A,B,C,D,E,F with n=15.
- Two-wheeler / bike / scooter rows get type "bike"; everything else is "car".
- If a count is approximate ("about 15", "15-ish") use the number given. If a row's count is missing, use 12 for cars and 20 for bikes.
- If the description only gives totals per level (e.g. "P1 has 80 cars"), split into rows of 12-16 with letters A, B, C...
- Row labels are short (1-3 characters), uppercase.
- Never invent levels or rows that were not described. If nothing usable is given, return {"levels": []}.`;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server. Add it in Vercel → Settings → Environment Variables (or .env.local)." }, { status: 503 });

  let body: { text?: string; image?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const text = (body.text || "").slice(0, 4000);
  const image = body.image || null;
  if (!text.trim() && !image) return NextResponse.json({ error: "Describe the parking or add a photo." }, { status: 400 });

  const content: Anthropic.MessageParam["content"] = [];
  if (image) {
    const m = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(image);
    if (!m) return NextResponse.json({ error: "Photo must be a PNG, JPEG, WEBP or GIF." }, { status: 400 });
    content.push({ type: "image", source: { type: "base64", media_type: m[1].replace("jpg", "jpeg") as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: m[2] } });
  }
  content.push({ type: "text", text: text.trim() || "Read the parking layout from this signboard photo." });

  const client = new Anthropic({ apiKey: key });
  try {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const raw = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { name?: string | null; city?: string | null; area?: string | null; kind?: string; levels?: Level[] };
    const levels = cleanLevels(parsed.levels || []);
    if (!levels.length) return NextResponse.json({ error: "I could not find any levels or rows in that. Try: 'P1 has rows A to D, 12 cars each'." }, { status: 422 });
    return NextResponse.json({ name: parsed.name ?? null, city: parsed.city ?? null, area: parsed.area ?? null, kind: parsed.kind ?? "Mall", levels });
  } catch (e) {
    console.error("parse-layout", e);
    return NextResponse.json({ error: "Claude could not read that right now. Try again in a moment." }, { status: 502 });
  }
}

function cleanLevels(levels: Level[]): Level[] {
  const out: Level[] = [];
  const seenLevels = new Set<string>();
  for (const l of levels) {
    const name = String(l?.name ?? "").trim().slice(0, 8);
    if (!name || seenLevels.has(name)) continue;
    const rows: Level["rows"] = [];
    const seen = new Set<string>();
    for (const r of l.rows ?? []) {
      const label = String(r?.label ?? "").trim().toUpperCase().slice(0, 3);
      const n = Math.min(80, Math.max(1, Math.round(Number(r?.n) || (r?.type === "bike" ? 20 : 12))));
      if (!label || seen.has(label)) continue;
      seen.add(label);
      rows.push({ label, n, type: r?.type === "bike" ? "bike" : "car" });
    }
    if (rows.length) { seenLevels.add(name); out.push({ name, rows }); }
  }
  return out;
}
