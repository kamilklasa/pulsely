-- Ticket 1 of Phase 2 (#28): the scoped API key an editor plugin authenticates
-- with. A long-lived key sitting in ~/.wakatime.cfg on a laptop is a different
-- credential from a browser session — it is revocable on its own, it carries no
-- session, and it can only ever reach the ingest function.

create table ingest_token (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- SHA-256 hex of the whole key the CLI will send, prefix included, so the
  -- ingest function can hash the credential it receives and look it up verbatim.
  -- The plaintext is generated in the browser and never sent here (see
  -- ingest-token.utils.ts), so this column is the only trace the server holds.
  token_hash text not null unique,
  -- Which machine this key lives on. The one thing that makes a list of keys
  -- revocable — without it the user cannot tell which row is the laptop they
  -- no longer have.
  label text not null,
  created_at timestamptz not null default now(),
  -- Stamped by the ingest function on each accepted batch, which is also the
  -- only way a user can tell a key is still reporting from somewhere.
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Serves the Settings list: one owner's keys, newest first.
create index ingest_token_owner_created_at_idx on ingest_token (owner_id, created_at desc);

-- Revocation is write-once. Without this a client holding an `update` grant on
-- revoked_at could clear it and put a key it had already disowned back into
-- service — "it can never authenticate again" would be true of the UI only.
create function freeze_ingest_token_revocation() returns trigger as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'ingest_token.revoked_at is write-once' using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ingest_token_freeze_revocation before update on ingest_token
  for each row execute function freeze_ingest_token_revocation();

-- Column grants rather than a table-wide one, so token_hash is unreachable from
-- any client query: a `select *` is refused outright instead of quietly
-- returning it. The hash of a 122-bit random key is not a credential, but the
-- guarantee worth having is that reading Settings cannot produce a string that
-- looks like one.
grant select (id, label, created_at, last_used_at, revoked_at) on ingest_token to authenticated;
grant insert (owner_id, token_hash, label) on ingest_token to authenticated;
-- Revoking is the only update a client makes; label and hash are fixed at
-- creation, so nothing can be re-pointed at a key that is already in a config file.
grant update (revoked_at) on ingest_token to authenticated;
-- No delete: a revoked key stays as the record of a credential that once
-- existed. Deleting the account still takes them, via owner_id's cascade.

alter table ingest_token enable row level security;

create policy "ingest_token_select_own" on ingest_token for select using (auth.uid() = owner_id);

create policy "ingest_token_insert_own" on ingest_token for insert with check (auth.uid() = owner_id);

create policy "ingest_token_update_own" on ingest_token for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
