-- ============================================================================
-- Phase 3I — Course PDF ingestion: course_materials & course_material_pages
-- ============================================================================
-- Uploaded course PDFs are extracted server-side into per-page text and a
-- journal proposal is derived from them. Tables:
--
--   course_materials       one row per uploaded PDF (metadata + proposal)
--   course_material_pages  one row per extracted PDF page
--
-- Security model:
--   - Private storage bucket `course-materials` (owner-scoped path prefix).
--   - Owner-only RLS on both tables; no anonymous access.
--   - course_material_pages has no profile_id of its own; its policies join
--     through course_materials so ownership cannot be forged.
--   - No secrets are ever stored here.
-- ============================================================================

-- ─── course_materials ───────────────────────────────────────────────────────

create table public.course_materials (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  file_name         text not null,
  storage_path      text not null unique,
  page_count        integer not null default 0 check (page_count >= 0),
  processing_status text not null default 'pending'
                    check (processing_status in ('pending','processing','completed','failed')),
  error_code        text,
  journal_proposal  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table  public.course_materials              is 'Uploaded course PDF documents and their processing results.';
comment on column public.course_materials.storage_path is 'Private-bucket path: {profile_id}/{document_id}/{file_name}.';
comment on column public.course_materials.journal_proposal is 'Validated CourseJournalProposal JSONB (typed shape, see src/types/course-material.ts).';

alter table public.course_materials enable row level security;

create policy "cm_select_own" on public.course_materials
  for select using (auth.uid() = profile_id);
create policy "cm_insert_own" on public.course_materials
  for insert with check (auth.uid() = profile_id);
create policy "cm_update_own" on public.course_materials
  for update using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
create policy "cm_delete_own" on public.course_materials
  for delete using (auth.uid() = profile_id);

create trigger course_materials_set_updated_at
  before update on public.course_materials
  for each row execute function public.handle_updated_at();

create index idx_cm_profile_id on public.course_materials (profile_id);
create index idx_cm_status     on public.course_materials (profile_id, processing_status);

-- ─── course_material_pages ──────────────────────────────────────────────────

create table public.course_material_pages (
  id                 uuid primary key default gen_random_uuid(),
  course_material_id uuid not null references public.course_materials(id) on delete cascade,
  page_number        integer not null check (page_number >= 1),
  extracted_text     text not null default '',
  created_at         timestamptz not null default now(),
  constraint course_material_pages_page_unique
    unique (course_material_id, page_number)
);

comment on table public.course_material_pages is 'Per-page extracted text for an uploaded course PDF.';

alter table public.course_material_pages enable row level security;

create policy "cmp_select_own" on public.course_material_pages
  for select using (
    exists (
      select 1 from public.course_materials cm
      where cm.id = course_material_pages.course_material_id
        and cm.profile_id = auth.uid()
    )
  );
create policy "cmp_insert_own" on public.course_material_pages
  for insert with check (
    exists (
      select 1 from public.course_materials cm
      where cm.id = course_material_pages.course_material_id
        and cm.profile_id = auth.uid()
    )
  );
create policy "cmp_delete_own" on public.course_material_pages
  for delete using (
    exists (
      select 1 from public.course_materials cm
      where cm.id = course_material_pages.course_material_id
        and cm.profile_id = auth.uid()
    )
  );

-- Pages are written once by the owner's session during ingestion; updates are
-- not permitted (replace rows instead).

create index idx_cmp_document on public.course_material_pages (course_material_id, page_number);

-- ─── Storage: private course-materials bucket ───────────────────────────────

insert into storage.buckets (id, name, public)
  values ('course-materials', 'course-materials', false)
  on conflict (id) do nothing;

drop policy if exists "course_materials_select_own" on storage.objects;
drop policy if exists "course_materials_insert_own" on storage.objects;
drop policy if exists "course_materials_delete_own" on storage.objects;

create policy "course_materials_select_own" on storage.objects
  for select using (
    bucket_id = 'course-materials'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "course_materials_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'course-materials'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "course_materials_delete_own" on storage.objects
  for delete using (
    bucket_id = 'course-materials'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
