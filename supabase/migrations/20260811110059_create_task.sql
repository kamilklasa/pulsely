-- Ticket 3 (task CRUD): task table + RLS, isolation enforced in Postgres
-- rather than application code — every table enables RLS in the same
-- migration that creates it (see 20260810154358_init.sql).
create type task_status as enum ('backlog', 'this_week', 'today', 'done');

create table task (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'backlog',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every policy reads owner_id, so index it for RLS-filtered queries.
create index task_owner_id_idx on task (owner_id);

-- Stamped by the DB on every update, not by the client — so every write path
-- (present and future) gets a correct updated_at without having to remember to set it.
create function set_task_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger task_set_updated_at before update on task
  for each row execute function set_task_updated_at();

-- RLS restricts rows; PostgREST also needs the table-level grant to let the
-- role attempt the operation at all.
grant select, insert, update, delete on task to authenticated;

alter table task enable row level security;

create policy "task_select_own" on task for select using (auth.uid() = owner_id);

create policy "task_insert_own" on task for insert with check (auth.uid() = owner_id);

create policy "task_update_own" on task for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "task_delete_own" on task for delete using (auth.uid() = owner_id);
