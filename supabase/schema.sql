-- BayPass database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-- A mall, hospital or other venue, with its parking layout.
create table if not exists venues (
  id          text primary key,
  name        text not null,
  city        text not null,
  area        text not null default '',
  kind        text not null default 'Mall',
  car_price   integer not null default 100,
  bike_price  integer not null default 40,
  -- [{ "name": "P1", "rows": [{ "label": "A", "n": 12, "type": "car" }, ...] }, ...]
  levels      jsonb not null,
  created_at  timestamptz not null default now()
);

-- Which bays are not free right now. Only non-free bays are stored.
-- bays: { "P1|A-01": "taken", "P2|B-07": "held" }
create table if not exists occupancy (
  venue_id    text primary key references venues(id) on delete cascade,
  bays        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Pre-bookings from the app and walk-in tokens from the desk.
create table if not exists bookings (
  code        text primary key,
  venue_id    text not null references venues(id) on delete cascade,
  level       text not null,
  bay         text not null,
  type        text not null check (type in ('car','bike')),
  plate       text not null default '',
  source      text not null check (source in ('app','walk-in')),
  status      text not null default 'booked' check (status in ('booked','parked')),
  until_text  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists bookings_venue_idx on bookings(venue_id, created_at desc);

-- Atomically claim a bay: fails if someone else took it a moment ago.
create or replace function book_bay(
  p_code text, p_venue text, p_level text, p_bay text, p_type text,
  p_plate text, p_source text, p_until text
) returns bookings
language plpgsql as $$
declare
  k text := p_level || '|' || p_bay;
  cur jsonb;
  b bookings;
  new_state text := case when p_source = 'walk-in' then 'taken' else 'held' end;
begin
  insert into occupancy(venue_id) values (p_venue) on conflict do nothing;
  select bays into cur from occupancy where venue_id = p_venue for update;
  if cur ? k then
    raise exception 'BAY_TAKEN' using errcode = 'P0001';
  end if;
  update occupancy set bays = cur || jsonb_build_object(k, new_state), updated_at = now()
    where venue_id = p_venue;
  insert into bookings(code, venue_id, level, bay, type, plate, source, status, until_text)
    values (p_code, p_venue, p_level, p_bay, p_type, p_plate, p_source,
            case when p_source = 'walk-in' then 'parked' else 'booked' end, p_until)
    returning * into b;
  return b;
end $$;

-- Set one bay's state ('free' removes it from the map).
create or replace function set_bay(p_venue text, p_key text, p_state text)
returns void language plpgsql as $$
begin
  insert into occupancy(venue_id) values (p_venue) on conflict do nothing;
  if p_state = 'free' then
    update occupancy set bays = bays - p_key, updated_at = now() where venue_id = p_venue;
  else
    update occupancy set bays = bays || jsonb_build_object(p_key, p_state), updated_at = now()
      where venue_id = p_venue;
  end if;
end $$;

-- Realtime: let the app hear changes as they happen.
alter publication supabase_realtime add table occupancy;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table venues;

-- PILOT ACCESS RULES. Anyone with the app can read and write.
-- Before a public launch, replace these with policies tied to Supabase Auth
-- (drivers write only their own bookings; venue staff write their venue's occupancy).
alter table venues    enable row level security;
alter table occupancy enable row level security;
alter table bookings  enable row level security;
create policy "pilot read venues"    on venues    for select using (true);
create policy "pilot write venues"   on venues    for all using (true) with check (true);
create policy "pilot read occupancy" on occupancy for select using (true);
create policy "pilot write occupancy" on occupancy for all using (true) with check (true);
create policy "pilot read bookings"  on bookings  for select using (true);
create policy "pilot write bookings" on bookings  for all using (true) with check (true);
