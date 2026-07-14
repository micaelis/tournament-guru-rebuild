-- =====================================================================
-- R1 — Close the rate_limit_touch self-DoS
--
-- Hostile-review finding: `rate_limit_touch(text, int)` was granted
-- EXECUTE to `anon` and `authenticated`. Any anon key holder could:
--
--   1. Poison the counter for a given bucket by calling
--      `select rate_limit_touch('search_queries', 999999999)` 1001x —
--      the counter for the current minute ticks past 1000, and the
--      very next legitimate insert into `search_queries` fires the
--      trigger (limit=1000) which now raises. Bucket is DoS'd for the
--      rest of the minute. Repeat forever. Same for `contact_requests`.
--   2. Insert arbitrary bucket names to grow `rate_limit_windows`
--      without bound.
--
-- Fix: revoke EXECUTE from `anon` and `authenticated`. The trigger
-- functions (`trg_search_queries_rate_limit`, `trg_contact_requests_
-- rate_limit`) are themselves SECURITY DEFINER, so their internal
-- `perform rate_limit_touch(...)` call runs with the trigger's own
-- privileges — not the invoker's. Revoking the direct grant closes
-- the exploit without breaking the triggers.
--
-- Defense in depth: also whitelist `p_bucket` inside the function so
-- even if a future migration re-grants EXECUTE, arbitrary bucket names
-- and inflated limits are rejected.
-- =====================================================================

revoke execute on function public.rate_limit_touch(text, int) from anon;
revoke execute on function public.rate_limit_touch(text, int) from authenticated;
-- PUBLIC gets EXECUTE on every new function by default; also strip it.
revoke execute on function public.rate_limit_touch(text, int) from public;

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
  -- is a bug or an attack; refuse loudly.
  if p_bucket not in ('search_queries', 'contact_requests') then
    raise exception 'rate_limit_touch: unknown bucket %', p_bucket
      using errcode = '22023';
  end if;

  -- Cap the limit range so a caller can't ask for effectively unlimited
  -- headroom. The real per-bucket ceilings live in the trigger callers
  -- (search_queries → 1000, contact_requests → 60); accepting anything
  -- outside a sane range is a defense-in-depth signal that the caller
  -- is not one of our triggers.
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

comment on function public.rate_limit_touch(text, int) is
  'DB-side burst counter. Callable only from the two trigger functions on search_queries / contact_requests (both SECURITY DEFINER). Never re-grant EXECUTE to anon/authenticated — direct-caller access enables a self-DoS by poisoning the per-minute counter.';
