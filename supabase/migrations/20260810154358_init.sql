-- Bootstrap migration. No tables yet — introduced per-feature starting with
-- Ticket 3 (task CRUD). Every table added from here on must enable RLS in
-- the same migration that creates it; there is no grace period.
create extension if not exists pgcrypto;
