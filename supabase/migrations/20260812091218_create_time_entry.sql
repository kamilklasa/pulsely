-- Ticket 6 (manual timer): a run of work on one task. A row with
-- `stopped_at is null` is a timer that is currently running; stopping it fixes
-- the duration as `stopped_at - started_at`.

-- Only 'manual' is ever written in Phase 1. 'wakatime' is declared now so the
-- Phase 2 heartbeat import has somewhere to land without redefining the column.
create type time_entry_source as enum ('manual', 'wakatime');

create table time_entry (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Cascade: an entry is a fact about a task, so it has no meaning once the
  -- task is gone, and nothing in the app reads orphaned time.
  task_id uuid not null references task(id) on delete cascade,
  -- The client supplies both timestamps rather than leaning on now(): the
  -- ticking display is driven by the browser's clock, so measuring the run
  -- against a different one would make the fixed duration disagree with the
  -- number the user watched count up. The defaults only cover a caller that
  -- omits them entirely.
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  source time_entry_source not null default 'manual',
  created_at timestamptz not null default now()
);

-- Serves the board's only read: one owner's entries, per task, oldest first.
create index time_entry_owner_task_idx on time_entry (owner_id, task_id, started_at);

-- The single-active-timer rule is enforced in the domain layer (startTimer in
-- entities/time-entry closes the open run before opening the next), so it stays
-- unit testable without a database. This index is the backstop that keeps two
-- devices from racing past it — no owner can ever hold two open entries.
create unique index time_entry_one_running_per_owner on time_entry (owner_id)
  where stopped_at is null;

grant select, insert, update, delete on time_entry to authenticated;

alter table time_entry enable row level security;

create policy "time_entry_select_own" on time_entry for select using (auth.uid() = owner_id);

-- Owning the entry is not enough on its own: without the task check a caller
-- could file their own time against somebody else's task, which is authorizing
-- the target row rather than just authenticating the caller. `task`'s own RLS
-- would already hide such a row from the subquery — the predicate is spelled
-- out anyway so the rule survives any later change to that policy.
create policy "time_entry_insert_own" on time_entry for insert with check (
  auth.uid() = owner_id
  and exists (
    select 1 from task where task.id = time_entry.task_id and task.owner_id = auth.uid()
  )
);

create policy "time_entry_update_own" on time_entry for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from task where task.id = time_entry.task_id and task.owner_id = auth.uid()
    )
  );

create policy "time_entry_delete_own" on time_entry for delete using (auth.uid() = owner_id);
