-- H-4 · Orphaned moderation rows: clean up at the DB, not per call site.
--
-- flagged_content and content_hidden are polymorphic (content_type +
-- content_id), so no FK and no cascade is possible — app code had to
-- clean up after every delete, and 5 of 6 delete paths didn't. An
-- orphaned flag row returns from the moderation-queue list query,
-- matches no content in the join, and is therefore never rendered and
-- never dismissable. AFTER DELETE triggers on reviews and comments
-- cover every path — including FK-cascaded deletes (review → comments,
-- comment → child replies), which fire row triggers on the child table.
--
-- SECURITY DEFINER: the deleting user is usually NOT allowed to delete
-- other users' flag rows (p_flag_delete is admin-only), so the cleanup
-- must run as the function owner. search_path is pinned per RG1.

create or replace function public.purge_moderation_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from flagged_content
   where content_type = tg_argv[0]::flag_content_type
     and content_id = old.id;
  delete from content_hidden
   where content_type = tg_argv[0]::flag_content_type
     and content_id = old.id;
  return old;
end;
$$;

-- Trigger-only helper: never client-callable (RG1 convention).
revoke execute on function public.purge_moderation_rows() from public, anon, authenticated;

create trigger t_reviews_purge_moderation
  after delete on reviews
  for each row execute function purge_moderation_rows('review');

create trigger t_comments_purge_moderation
  after delete on comments
  for each row execute function purge_moderation_rows('comment');
