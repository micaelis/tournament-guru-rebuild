-- =====================================================================
-- M11 — Remove the `KA` typo from us_states (Kansas is `KS`)
--
-- The us_states lookup migration (000002:146) inserted `('KA','Kansas')`
-- alongside the correct `('KS','Kansas')` at line 138. `KA` is not a
-- USPS code, so no real event matches it, but if a form typo ever
-- writes `KA` into `events.state` the facet list will surface it as a
-- valid option. Idempotent.
-- =====================================================================

delete from public.us_states where code = 'KA';
