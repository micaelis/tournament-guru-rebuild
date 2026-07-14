-- =====================================================================
-- H5 — DB-side burst cap on public writes
--
-- App layer (lib/rate-limit.ts) enforces a per-IP burst limit at the
-- Vercel edge. This is the second line: a *global* per-minute cap on
-- the two writable anon endpoints, so a distributed flood can't push
-- more than N inserts/min into the table regardless of IP diversity.
--
-- The cap is intentionally generous (well above expected legit
-- traffic) — its job is to catch runaway abuse, not to shape normal
-- use. Real per-user limits belong in the app layer.
--
-- Emits SQLSTATE '22023' (invalid_parameter_value) which PostgREST
-- surfaces as HTTP 400 — the app already treats any error as "logging
-- best-effort".
--
-- CRITICAL: `rate_limit_touch` must NOT be granted EXECUTE to `anon` or
-- `authenticated`. Direct callers could poison the per-minute counter
-- (`select rate_limit_touch('search_queries', 999999999)` ×1001) so
-- legitimate inserts hit the cap and are rejected — a global-shutoff
-- DoS on both anon endpoints. The two trigger wrappers below are
-- themselves SECURITY DEFINER so their internal call works without
-- the caller needing EXECUTE. Belt-and-braces: rate_limit_touch also
-- whitelists the bucket + p_limit range inline, so a widened grant
-- can't be abused with arbitrary parameters.
-- =====================================================================

-- Rolling per-minute counter. `bucket` is the table name; `window_start`
-- is the truncated minute; `hits` is the count so far.
create table if not exists public.rate_limit_windows (
  bucket        text        not null,
  window_start  timestamptz not null,
  hits          int         not null default 0,
  primary key (bucket, window_start)
);

-- Only service_role inspects/prunes this table.
alter table public.rate_limit_windows enable row level security;
-- (No policies — the trigger runs under the invoker but bypasses via
-- the DEFINER function below.)

-- Prune helper. Deletes windows older than an hour. Idempotent, safe
-- to run from a scheduled job (pg_cron / Supabase Scheduler) — or just
-- ignored; the table stays tiny either way (~one row per (table,
-- minute) so at most a few thousand rows per hour).
create or replace function public.rate_limit_prune()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limit_windows
  where window_start < now() - interval '1 hour';
$$;

-- Global per-minute cap enforcer. Bumps the current-minute counter for
-- a bucket and raises if it would exceed `p_limit`.
--
-- Callable ONLY from the trigger wrappers below (which are SECURITY
-- DEFINER themselves). Anon/authenticated must never have EXECUTE.
create or replace function public.rate_limit_touch(
  p_bucket text,
  p_limit  int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window  timestamptz := date_trunc('minute', now());
  v_hits    int;
begin
  -- Only the two buckets the triggers use are valid. Any other value
  -- is a bug or an attack — refuse loudly.
  if p_bucket not in ('search_queries', 'contact_requests') then
    raise exception 'rate_limit_touch: unknown bucket %', p_bucket
      using errcode = '22023';
  end if;

  -- Cap the limit range so a caller can't ask for unlimited headroom
  -- and silence the burst cap. The real per-bucket ceilings are baked
  -- into the trigger callers (search_queries → 1000, contact_requests
  -- → 60). A p_limit outside this range is a signal the caller isn't
  -- one of ours.
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'rate_limit_touch: p_limit out of range: %', p_limit
      using errcode = '22023';
  end if;

  insert into public.rate_limit_windows (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = rate_limit_windows.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'rate limit exceeded for %', p_bucket
      using errcode = '22023';
  end if;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function; strip it so
-- neither anon nor authenticated inherit it.
revoke execute on function public.rate_limit_touch(text, int) from public;
revoke execute on function public.rate_limit_touch(text, int) from anon;
revoke execute on function public.rate_limit_touch(text, int) from authenticated;

comment on function public.rate_limit_touch(text, int) is
  'DB-side burst counter. Callable only from the two trigger functions on search_queries / contact_requests (both SECURITY DEFINER). Never re-grant EXECUTE to anon/authenticated — direct-caller access enables a self-DoS by poisoning the per-minute counter.';

-- ── Search log burst cap ────────────────────────────────────────────
-- 1000 inserts/minute globally. Legit hero-search traffic sits at
-- <100/min even during a marketing spike.
create or replace function public.trg_search_queries_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.rate_limit_touch('search_queries', 1000);
  return new;
end;
$$;

drop trigger if exists t_search_queries_rate_limit on public.search_queries;
create trigger t_search_queries_rate_limit
  before insert on public.search_queries
  for each row execute function public.trg_search_queries_rate_limit();

-- ── Contact requests burst cap ──────────────────────────────────────
-- 60 inserts/minute globally. Real traffic is a handful per day.
create or replace function public.trg_contact_requests_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.rate_limit_touch('contact_requests', 60);
  return new;
end;
$$;

drop trigger if exists t_contact_requests_rate_limit on public.contact_requests;
create trigger t_contact_requests_rate_limit
  before insert on public.contact_requests
  for each row execute function public.trg_contact_requests_rate_limit();
