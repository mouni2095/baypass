# BayPass

**Know your parking slot before you reach the basement.**

BayPass is a slot-level parking app for Indian malls, hospitals and other crowded indoor venues. Drivers see the P1 / P2 / P3 layout, pre-book an exact bay (e.g. *P2 · B-14*) for a small fee, and get a pass that works offline in the basement. A desk app lets parking staff verify passes, hand out free walk-in tokens, and keep the map accurate by tapping bays as cars come and go. No sensors needed.

## What's in the app

| Screen | Who uses it | What it does |
|---|---|---|
| **I'm parking** (`/`, `/v/[id]`, `/pass`) | Drivers | Pick city → venue → level → bay, pay (simulated), get an offline pass with directions in English, Hindi, Telugu, Kannada, Tamil |
| **Parking desk** (`/desk`) | Venue staff | Verify a pass code, assign walk-in tokens, tap bays free/parked, close the day |
| **Venues** (`/venues`, `/venues/new`) | You / venue admin | Add a real venue. Describe the parking in plain words (or upload a signboard photo) and Claude fills in the levels and rows |

Everything syncs live between phones through Supabase. With no Supabase configured the app runs in **demo mode** on one device, so you can try it immediately.

## Tech

- **Next.js 15** (React 19, App Router, TypeScript) — the web app, installable on phones from the browser
- **Supabase** (Postgres + Realtime) — venues, occupancy, bookings; an atomic `book_bay` function prevents double booking
- **Anthropic Claude API** — `/api/parse-layout` turns a description or photo into a venue layout (server-side only; the key never reaches the browser)
- **Vercel** — free hosting with a public URL

## Run it on your laptop

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/mouni2095/baypass.git
cd baypass
npm install
npm run dev
```

Open http://localhost:3000. This is demo mode (data stays in your browser).

## Go live, step by step

### 1. Database (Supabase, free)

1. Go to https://supabase.com → **Start your project** → sign in with GitHub.
2. **New project**. Name: `baypass`. Region: **Mumbai (ap-south-1)**. Set a database password and save it somewhere safe.
3. When it finishes, open **SQL Editor** (left sidebar) → **New query**. Paste the whole contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. You should see "Success".
4. Go to **Project Settings → API**. Copy two values:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Claude API key

Your key from https://console.anthropic.com → **API Keys**. This is `ANTHROPIC_API_KEY`.
Keep it secret: never paste it in chat, email or code. It goes only into step 3.

### 3. Hosting (Vercel, free)

1. Go to https://vercel.com → sign in with GitHub → **Add New → Project** → import `mouni2095/baypass`.
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 |
   | `ANTHROPIC_API_KEY` | from step 2 |

3. Click **Deploy**. In about a minute you get a URL like `https://baypass.vercel.app`. Open it on your phone. In Chrome, **⋮ → Add to Home screen** installs it like an app.

Every time code is pushed to `main` on GitHub, Vercel redeploys automatically.

### Running locally with the real database

Copy `.env.example` to `.env.local`, fill in the same three values, and run `npm run dev`.

## Map your first real venue

1. Walk the parking levels of a mall you know. For each level note the row letters painted on pillars and roughly how many bays per row, and which rows are two-wheeler.
2. Open the app → **Venues → Set up a real venue**.
3. Type what you saw, e.g. *"Phoenix Marketcity Whitefield. P1 rows A to F, 15 cars each, bikes in T1 and T2, 30 each. P2 rows A to H, 15 each."* Press **Fill in the layout for me**. Check the rows, fix anything off, **Save and go live**.
4. Open the **Parking desk** on a second phone, pick that venue, and book a slot from the first phone. The bay turns blue on the desk within a second or two.

## Before taking real money or opening to the public

- **Payments**: `/v/[id]` shows a simulated payment step. Plug in Razorpay or PhonePe (both need a registered business + bank account). Create the booking only after the gateway confirms payment.
- **Access control**: `supabase/schema.sql` ships with open "pilot" policies so anyone with the link can read and write. Before public launch, add Supabase Auth and restrict: drivers write only their own bookings; staff write only their venue.
- **Staff login**: the desk and venue editor are currently open pages. Put them behind a login (or at least a PIN) before sharing the URL widely.
- **Play Store**: once the web app has traction, wrap it with [Capacitor](https://capacitorjs.com) or rebuild in React Native. A Google Play developer account costs about ₹2,000 one-time.

## Project layout

```
app/                 pages (App Router) and the Claude API route
  api/parse-layout/  POST {text, image?} -> {levels, name, city, area, kind}
  v/[id]/            venue booking flow
  desk/              staff desk
  venues/, venues/new/   venue list and editor
components/          LotMap (bay grid), Nav, useStore hooks
lib/
  types.ts           Venue, Level, Row, Booking, Occupancy
  layout.ts          bay keys, free counts, nearest-free, validation, directions text
  store.ts           data layer: SupabaseStore or DemoStore behind one interface
  samples.ts         sample venues for demos
supabase/schema.sql  tables, book_bay/set_bay functions, realtime, pilot policies
```

## License

Copyright © 2026 Mounika P. All rights reserved.
