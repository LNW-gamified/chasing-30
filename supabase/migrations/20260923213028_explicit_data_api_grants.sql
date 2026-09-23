-- Supabase stopped auto-granting Data API access to new public tables as
-- of Oct 30, 2026. This project's tables were all created before that
-- change and already have their grants — this migration changes nothing
-- for the live database. What it does fix: 16 of this project's own
-- earlier migrations created tables without an explicit GRANT statement,
-- relying entirely on the auto-grant behavior that no longer exists. If
-- this project's migrations were ever replayed from scratch after Oct 30
-- — a new environment, a preview branch, a local `supabase db reset` —
-- those tables would come back with no Data API access at all, even
-- though the app's own code never changed.
--
-- Rather than hand-list table names (and risk missing one, or grant a
-- since-renamed name that no longer exists — see special_visits, later
-- renamed to special_events), this loops over every table actually
-- present in the public schema at migration time and grants each one,
-- matching the exact grant shape Supabase's own announcement specifies.
-- Safe to run repeatedly: GRANT is idempotent, re-granting an already-
-- granted privilege is a no-op, not an error.

do $$
declare
  t record;
begin
  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('grant select on public.%I to anon', t.table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', t.table_name);
  end loop;
end $$;
