-- ─────────────────────────────────────────────────────────────────────
-- Stamp reviews.published_at on the draft → published transition.
--
-- The baseline's trg_reviews_write already:
--   - keeps `overall` in sync (avg of non-null category scores)
--   - increments platform_counters.published_reviews_total
-- …but it never sets `published_at`. Since the column is not in the
-- authenticated UPDATE grant (correct — the client shouldn't be able
-- to backdate a review), publish would leave the timestamp NULL.
--
-- Extend the trigger so that:
--   - INSERT with status='published' stamps published_at = now()
--   - UPDATE where status flips draft → published stamps published_at
--   - Other transitions leave the value alone (published → draft or
--     published → published preserves the original publish time).
-- ─────────────────────────────────────────────────────────────────────

create or replace function trg_reviews_write()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.overall = review_overall(new);

    if tg_op = 'INSERT' and new.status = 'published' then
      new.published_at = coalesce(new.published_at, now());
      update platform_counters set value = value + 1
        where key = 'published_reviews_total';
    elsif tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published' then
      new.published_at = coalesce(new.published_at, now());
      update platform_counters set value = value + 1
        where key = 'published_reviews_total';
    end if;

    return new;
  end if;
  return old;
end;
$$;
