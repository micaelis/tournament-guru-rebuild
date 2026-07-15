-- ─────────────────────────────────────────────────────────────────────
-- Tighten comment reads to require the parent review to be visible.
--
-- The baseline policy was:
--   p_comments_read: NOT (this user hid this comment) OR is_admin()
-- which lets any caller read comments on a *draft* review as long as
-- they hadn't personally flagged the comment. That leaks the fact that
-- a draft-review author has been getting comments (there shouldn't be
-- any yet — RLS on comments.insert requires auth.uid() to be the author
-- and comment INSERT requires review visibility in the app layer — but
-- defence in depth belongs here).
--
-- New rule: a caller can read a comment iff they can read the review it
-- hangs off (published, or authored by them, or admin) AND haven't
-- personally hidden the comment; admin still sees everything.
-- ─────────────────────────────────────────────────────────────────────

drop policy p_comments_read on comments;

create policy p_comments_read on comments for select using (
  is_admin()
  or (
    exists (
      select 1 from reviews r
      where r.id = comments.review_id
        and (r.status = 'published' or r.author_id = auth.uid())
    )
    and not exists (
      select 1 from content_hidden h
      where h.user_id = auth.uid()
        and h.content_type = 'comment'
        and h.content_id = comments.id
    )
  )
);
