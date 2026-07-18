-- ─────────────────────────────────────────────────────────────────────
-- Revoke write privileges on every view in `public`.
--
-- 20260718000005 ran `grant all on all tables in schema public`, and in
-- Postgres `ALL TABLES` includes VIEWS. The `public_*` projection views
-- carry no RLS of their own and are declared `security_invoker = false`
-- with `postgres` as owner (which has BYPASSRLS), so a write through an
-- auto-updatable view executes as the owner and skips RLS on the base
-- table entirely. Table-level grants are therefore the *only* access
-- control on them.
--
-- `public_directors` and `public_event_owners` are single-table selects
-- and thus auto-updatable: `anon` could UPDATE or DELETE rows in
-- `profiles` through them holding nothing but the public anon key.
-- The baseline granted SELECT only (20260716000001 l.1011); 000005
-- silently widened that to full write.
--
-- Every view here is a read projection, so revoke write on all of them
-- rather than enumerating — that also covers the two views that are not
-- currently auto-updatable but would become writable if their
-- definition were ever simplified to a single table.
--
-- NOTE: 000005's `alter default privileges ... grant all on tables`
-- still applies to views created later by `postgres`. The regression
-- probe in tests/probes/h1-public-views.test.ts asserts that no view in
-- `public` is writable by anon/authenticated, which catches that case.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  v record;
begin
  for v in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'v'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger '
      'on public.%I from anon, authenticated',
      v.relname
    );
  end loop;
end $$;
