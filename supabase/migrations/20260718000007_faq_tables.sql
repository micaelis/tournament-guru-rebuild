-- FAQ system: upgrade to audience-targeted entries with draft/publish + visibility

-- Add missing columns to existing faqs table
alter table faqs
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published')),
  add column if not exists is_visible boolean not null default true;

-- Rename body → content for consistency with the scope doc
alter table faqs rename column body to content;

-- Drop the old enum-based audience column — replaced by faq_audiences child table
alter table faqs drop column if exists audience;
drop type if exists faq_audience;

-- Child table for per-type + optional per-role audience targeting
create table faq_audiences (
  id         uuid primary key default gen_random_uuid(),
  faq_id     uuid not null references faqs(id) on delete cascade,
  user_type  user_type not null,
  role_title role_title
);

create index idx_faq_audiences_faq on faq_audiences(faq_id);
create unique index idx_faq_audiences_with_role
  on faq_audiences(faq_id, user_type, role_title) where role_title is not null;
create unique index idx_faq_audiences_no_role
  on faq_audiences(faq_id, user_type) where role_title is null;

-- RLS on faq_audiences
alter table faq_audiences enable row level security;

create policy faq_audiences_admin_all on faq_audiences
  for all using (
    exists (select 1 from profiles where id = auth.uid() and user_type = 'admin')
  );

create policy faq_audiences_public_read on faq_audiences
  for select using (
    exists (select 1 from faqs where id = faq_id and status = 'published' and is_visible = true)
  );

-- Update existing faqs policies: keep admin all, restrict public read to published+visible
drop policy if exists p_faqs_read on faqs;
drop policy if exists p_faqs_admin on faqs;

create policy faqs_admin_all on faqs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and user_type = 'admin')
  );

create policy faqs_public_read on faqs
  for select using (status = 'published' and is_visible = true);

-- Grants
grant select on faq_audiences to anon, authenticated;
grant insert, update, delete on faq_audiences to authenticated;
