-- Ticket 2 of Phase 2 (#29): what a tracked hour was actually spent in.
--
-- A heartbeat describes time that was already measured; it never creates any.
-- Every row therefore belongs to a time_entry, and one that belongs to no run is
-- not stored at all — a table of heartbeats with no reader is a privacy
-- liability, and the manual timer stays the only thing that decides how many
-- hours a day holds.

create table heartbeat (
  id uuid primary key default gen_random_uuid(),
  -- No auth.uid() default, unlike every other table here: the only writer is the
  -- ingest function, acting on a scoped API key rather than a session, so there
  -- is no `auth.uid()` at insert time. Denormalized off time_entry so RLS can
  -- scope reads without a join, the same trade the rest of the schema makes.
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Cascade: a heartbeat is a detail of a run. Deleting the run deletes its
  -- heartbeats, and deleting the task cascades through time_entry to here — so
  -- "delete this time entry" leaves nothing describing it behind.
  time_entry_id uuid not null references time_entry(id) on delete cascade,
  -- wakatime-cli sends this as a unix float; the ingest function converts. Stored
  -- as timestamptz so it is comparable with the entry window it was filed against.
  time timestamptz not null,
  -- The file being worked on.
  entity text not null,
  project text,
  language text,
  category text,
  is_write boolean not null default false,
  -- Derived from user_agent by editorFromUserAgent — the heartbeat body carries
  -- no editor field, only the agent string the plugin identifies itself with.
  editor text,
  -- Kept raw alongside the derived value. The parse is a guess about a format
  -- WakaTime can extend at any time, so keeping the source means a better parser
  -- later is a backfill rather than a migration plus lost data.
  user_agent text not null,
  created_at timestamptz not null default now()
);

-- The per-app split in #21 reads one task's heartbeats through its entries.
create index heartbeat_time_entry_id_idx on heartbeat (time_entry_id);
-- Every policy reads owner_id, and attribution looks up a window by time.
create index heartbeat_owner_time_idx on heartbeat (owner_id, time);

-- Select only, and no insert/update/delete policy to go with it: the ingest
-- function is the sole write path, via the service role, and it writes only once
-- it has established the owner from the token. A client cannot add to, edit or
-- prune its own history of what it was doing — which is what makes that history
-- worth reading.
grant select on heartbeat to authenticated;

-- The ingest function's role. service_role carries BYPASSRLS, so grants are the
-- only thing that bounds it — and it is bounded: insert and select, never update
-- or delete. Even the sole writer may only append, so no code path in this
-- system can rewrite or quietly prune what a person was doing.
--
-- Nothing had been granted to service_role before this table, because until now
-- every write in the schema came from a session. This is the first row a client
-- is not allowed to write, and so the first that something else has to.
grant select, insert on heartbeat to service_role;

alter table heartbeat enable row level security;

create policy "heartbeat_select_own" on heartbeat for select using (auth.uid() = owner_id);
