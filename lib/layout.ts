import type { BayState, Level, Occupancy, Venue, VehicleType } from "./types";

export const bayId = (rowLabel: string, n: number) => `${rowLabel}-${String(n).padStart(2, "0")}`;
export const bayKey = (level: string, bay: string) => `${level}|${bay}`;

export function rowsOf(v: Venue, level: string, type?: VehicleType) {
  const lv = v.levels.find((l) => l.name === level);
  return lv ? lv.rows.filter((r) => !type || r.type === type) : [];
}

export function stateOf(occ: Occupancy, level: string, bay: string): BayState {
  return occ[bayKey(level, bay)] ?? "free";
}

export function freeCount(v: Venue, occ: Occupancy, level?: string, type?: VehicleType) {
  let total = 0;
  for (const lv of v.levels) {
    if (level && lv.name !== level) continue;
    for (const r of lv.rows) {
      if (type && r.type !== type) continue;
      for (let n = 1; n <= r.n; n++) if (!occ[bayKey(lv.name, bayId(r.label, n))]) total++;
    }
  }
  return total;
}

export function totalBays(levels: Level[], type?: VehicleType) {
  return levels.reduce(
    (a, l) => a + l.rows.filter((r) => !type || r.type === type).reduce((x, r) => x + (Number(r.n) || 0), 0),
    0,
  );
}

/** First free bay, filling the preferred level first, then the others in order. */
export function nearestFree(v: Venue, occ: Occupancy, type: VehicleType, preferLevel?: string) {
  const order = preferLevel
    ? [preferLevel, ...v.levels.map((l) => l.name).filter((n) => n !== preferLevel)]
    : v.levels.map((l) => l.name);
  for (const L of order) {
    for (const r of rowsOf(v, L, type)) {
      for (let n = 1; n <= r.n; n++) {
        const b = bayId(r.label, n);
        if (!occ[bayKey(L, b)]) return { level: L, bay: b };
      }
    }
  }
  return null;
}

export function makeCode() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += a[Math.floor(Math.random() * a.length)];
  return c;
}

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "venue";

export function timeFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60000).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function validateVenue(v: Venue): string | null {
  if (!v.name.trim()) return "Give the venue a name.";
  if (!v.city.trim()) return "Which city is it in?";
  if (!v.levels.length) return "Add at least one level.";
  const names = new Set<string>();
  for (const lv of v.levels) {
    if (!lv.name.trim()) return "Every level needs a name, like P1.";
    if (names.has(lv.name)) return `Two levels are both called ${lv.name}.`;
    names.add(lv.name);
    if (!lv.rows.length) return `Level ${lv.name} has no rows.`;
    const seen = new Set<string>();
    for (const r of lv.rows) {
      if (!r.label.trim()) return `A row on ${lv.name} has no letter.`;
      if (seen.has(r.label)) return `Row ${r.label} appears twice on ${lv.name}.`;
      seen.add(r.label);
      if (!(Number(r.n) > 0)) return `Row ${r.label} on ${lv.name} needs a bay count.`;
    }
  }
  return null;
}

export const DIRECTIONS: Record<string, { label: string; title: string; steps: (level: string, bay: string) => string[] }> = {
  en: {
    label: "English",
    title: "How to reach your slot",
    steps: (L, b) => [
      `At the entry gate, follow the "${L}" signs down the ramp.`,
      `On ${L}, follow the floor arrows to Row ${b.split("-")[0]}.`,
      `Bay ${b} is painted on the floor and on the pillar beside it.`,
      `No signal in the basement? This pass is saved on your phone.`,
    ],
  },
  hi: {
    label: "हिन्दी",
    title: "अपने स्लॉट तक कैसे पहुँचें",
    steps: (L, b) => [
      `एंट्री गेट पर "${L}" बोर्ड का पालन करें और रैंप से नीचे जाएँ।`,
      `${L} पर तीर के निशान से रो ${b.split("-")[0]} तक जाएँ।`,
      `बे नंबर ${b} ज़मीन और पास के खंभे पर लिखा है।`,
      `नेटवर्क नहीं है? यह पास फ़ोन में सेव है।`,
    ],
  },
  te: {
    label: "తెలుగు",
    title: "మీ స్లాట్‌కు ఎలా చేరుకోవాలి",
    steps: (L, b) => [
      `ఎంట్రీ గేట్ వద్ద "${L}" బోర్డులను అనుసరించి ర్యాంప్ కిందకు వెళ్ళండి.`,
      `${L} లో బాణాలను అనుసరించి వరుస ${b.split("-")[0]} కు వెళ్ళండి.`,
      `బే నంబర్ ${b} నేలపై మరియు పక్క స్తంభంపై రాసి ఉంటుంది.`,
      `సిగ్నల్ లేదా? ఈ పాస్ మీ ఫోన్‌లో సేవ్ అయి ఉంది.`,
    ],
  },
  kn: {
    label: "ಕನ್ನಡ",
    title: "ನಿಮ್ಮ ಸ್ಲಾಟ್ ತಲುಪುವುದು ಹೇಗೆ",
    steps: (L, b) => [
      `ಪ್ರವೇಶ ದ್ವಾರದಲ್ಲಿ "${L}" ಫಲಕವನ್ನು ಅನುಸರಿಸಿ ರ‍್ಯಾಂಪ್ ಕೆಳಗೆ ಹೋಗಿ.`,
      `${L} ನಲ್ಲಿ ಬಾಣಗಳನ್ನು ಅನುಸರಿಸಿ ಸಾಲು ${b.split("-")[0]} ತಲುಪಿ.`,
      `ಬೇ ಸಂಖ್ಯೆ ${b} ನೆಲ ಮತ್ತು ಕಂಬದ ಮೇಲೆ ಬರೆದಿದೆ.`,
      `ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲವೇ? ಈ ಪಾಸ್ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿದಿದೆ.`,
    ],
  },
  ta: {
    label: "தமிழ்",
    title: "உங்கள் இடத்தை அடைவது எப்படி",
    steps: (L, b) => [
      `நுழைவு வாயிலில் "${L}" பலகையைப் பின்தொடர்ந்து சரிவில் கீழே செல்லவும்.`,
      `${L} இல் அம்புகளைப் பின்தொடர்ந்து வரிசை ${b.split("-")[0]} செல்லவும்.`,
      `இட எண் ${b} தரையிலும் அருகிலுள்ள தூணிலும் உள்ளது.`,
      `சிக்னல் இல்லையா? இந்த பாஸ் போனில் சேமிக்கப்பட்டுள்ளது.`,
    ],
  },
};
