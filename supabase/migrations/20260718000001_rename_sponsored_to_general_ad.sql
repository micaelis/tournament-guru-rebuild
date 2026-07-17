-- Rename is_sponsored → is_general_ad
-- The "General Ads" tier (public label "Spotlight") replaces the old
-- "sponsored" concept. One flag, one concept, no second boolean.

-- 1. Rename the column
alter table events rename column is_sponsored to is_general_ad;

-- 2. Rebuild the composite index with the new name
drop index if exists idx_events_flags;
create index idx_events_flags on events(is_premium, is_general_ad);
