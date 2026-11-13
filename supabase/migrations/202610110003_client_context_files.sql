create table public.client_context_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  context_type text not null check (context_type in ('profile','vendors','gl_codes','policies')),
  logical_filename text not null,
  original_filename text not null,
  storage_path text not null,
  mime_type text not null default 'text/markdown' check (mime_type in ('text/markdown','text/plain')),
  content_sha256 text not null,
  size_bytes integer not null check (size_bytes between 1 and 524288),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','active','superseded')),
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (company_id, context_type, version)
);

create unique index client_context_files_one_active_idx
  on public.client_context_files(company_id, context_type)
  where status = 'active';

create index client_context_files_company_idx
  on public.client_context_files(company_id, status, context_type);

alter table public.client_context_files enable row level security;

create policy client_context_files_read_scoped
  on public.client_context_files for select
  using (public.has_company_access(company_id));

create policy client_context_files_insert_scoped
  on public.client_context_files for insert
  with check (public.has_company_access(company_id) and uploaded_by = auth.uid());

create policy client_context_files_update_scoped
  on public.client_context_files for update
  using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));

comment on table public.client_context_files is
  'Versioned metadata for private per-client Markdown context uploads. File content remains in private object storage.';
