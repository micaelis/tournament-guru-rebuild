-- ─────────────────────────────────────────────────────────────────────
-- Dates stay nullable (drafts don't require them). The existing CHECK
-- constraint (end_after_start) already passes when either date is null,
-- so no new CHECK is needed — published events have dates enforced at
-- the application layer. This migration is intentionally a no-op; it
-- replaces the earlier NOT NULL version before it shipped.
-- ─────────────────────────────────────────────────────────────────────

-- no-op: columns stay nullable; publish validation enforces dates
