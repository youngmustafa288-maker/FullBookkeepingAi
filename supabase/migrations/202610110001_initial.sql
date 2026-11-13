create extension if not exists pgcrypto;

create type public.job_status as enum ('queued','processing','pending_approval','approved','posted','failed','dead_letter');
create type public.workflow_type as enum ('receipt','invoice','bank_reconciliation','reporting');

create table public.users (
  id uuid primary key references auth.users(id),
  email text unique not null,
  display_name text not null,
  role text not null default 'bookkeeper' check (role in ('bookkeeper','admin')),
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  accounting_url_encrypted text not null,
  accounting_api_key_encrypted text not null,
  accounting_api_secret_encrypted text not null,
  currency text not null default 'MYR',
  tax_regime text not null default 'SST' check (tax_regime in ('SST','exempt')),
  timezone text not null default 'Asia/Kuala_Lumpur',
  whatsapp_number text,
  report_day integer check (report_day between 1 and 31),
  report_delivery text check (report_delivery in ('email','whatsapp','both','none')),
  created_at timestamptz not null default now()
);

create table public.company_users (
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.users(id),
  workflow workflow_type not null,
  status job_status not null default 'queued',
  retry_count integer not null default 0 check (retry_count between 0 and 3),
  input_payload jsonb,
  output_payload jsonb,
  idempotency_key text unique,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.extracted_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs(id),
  company_id uuid not null references public.companies(id),
  document_type text not null check (document_type in ('receipt','purchase_invoice','sales_invoice')),
  source_filename text not null,
  raw_ocr_json jsonb not null,
  extracted_fields jsonb not null,
  confidence_scores jsonb not null,
  agent_notes text[] not null default '{}',
  duplicate_of uuid references public.extracted_documents(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  final_fields jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  actor_type text not null check (actor_type in ('workflow','human')),
  actor_id uuid references public.users(id),
  workflow workflow_type,
  action text not null check (action in ('submitted','approved','rejected','edited','posted','voided','failed','retried','override')),
  document_ref text,
  company_id uuid not null references public.companies(id),
  original_values jsonb,
  final_values jsonb,
  note text,
  job_id uuid references public.agent_jobs(id)
);

create table public.recon_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.users(id),
  bank_name text not null check (bank_name in ('maybank','cimb','rhb','publicbank')),
  period_start date not null,
  period_end date not null,
  status text not null default 'processing' check (status in ('processing','pending_approval','completed','failed')),
  difference_amount numeric(15,2),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (period_end >= period_start)
);

create table public.recon_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.recon_sessions(id) on delete cascade,
  bank_transaction_id text not null,
  ledger_entry_id text,
  confidence_score integer not null check (confidence_score between 0 and 100),
  match_tier text not null check (match_tier in ('auto_confirmed','needs_review','manual_review','unmatched')),
  exception_type text check (exception_type in ('bank_charge_or_fee','timing_difference','missing_ledger_entry','duplicate_transaction','unknown')),
  suggested_journal jsonb,
  rationale jsonb not null default '{}',
  status text not null default 'proposed' check (status in ('proposed','confirmed','rejected','overridden')),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  unique(session_id,bank_transaction_id)
);

create table public.vendor_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  vendor_pattern text not null,
  default_category text not null,
  gl_code text not null,
  tax_code text not null,
  status text not null default 'approved' check (status in ('pending','approved','inactive')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(company_id,vendor_pattern)
);

create table public.gl_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('Asset','Liability','Equity','Revenue','Expense')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,code)
);

create table public.client_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  policy_key text not null,
  policy_value jsonb not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(company_id,policy_key)
);

create index agent_jobs_company_status_idx on public.agent_jobs(company_id,status);
create index extracted_documents_company_status_idx on public.extracted_documents(company_id,status);
create index audit_log_company_timestamp_idx on public.audit_log(company_id,timestamp desc);
create index recon_matches_session_status_idx on public.recon_matches(session_id,status);

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.extracted_documents enable row level security;
alter table public.audit_log enable row level security;
alter table public.recon_sessions enable row level security;
alter table public.recon_matches enable row level security;
alter table public.vendor_rules enable row level security;
alter table public.gl_codes enable row level security;
alter table public.client_policies enable row level security;

create function public.has_company_access(target_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.company_users cu where cu.company_id = target_company and cu.user_id = auth.uid());
$$;

create policy users_self on public.users for select using (id = auth.uid());
create policy companies_assigned on public.companies for select using (public.has_company_access(id));
create policy company_users_self on public.company_users for select using (user_id = auth.uid());
create policy jobs_scoped on public.agent_jobs for all using (public.has_company_access(company_id)) with check (public.has_company_access(company_id) and user_id = auth.uid());
create policy documents_scoped on public.extracted_documents for all using (public.has_company_access(company_id)) with check (public.has_company_access(company_id));
create policy audit_read_scoped on public.audit_log for select using (public.has_company_access(company_id));
create policy audit_insert_scoped on public.audit_log for insert with check (public.has_company_access(company_id));
create policy recon_sessions_scoped on public.recon_sessions for all using (public.has_company_access(company_id)) with check (public.has_company_access(company_id));
create policy recon_matches_scoped on public.recon_matches for all using (exists(select 1 from public.recon_sessions rs where rs.id = session_id and public.has_company_access(rs.company_id))) with check (exists(select 1 from public.recon_sessions rs where rs.id = session_id and public.has_company_access(rs.company_id)));
create policy vendor_rules_scoped on public.vendor_rules for all using (public.has_company_access(company_id)) with check (public.has_company_access(company_id));
create policy gl_codes_scoped on public.gl_codes for all using (public.has_company_access(company_id)) with check (public.has_company_access(company_id));
create policy client_policies_scoped on public.client_policies for all using (public.has_company_access(company_id)) with check (public.has_company_access(company_id));

create function public.prevent_audit_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;
create trigger audit_log_no_update before update or delete on public.audit_log for each row execute function public.prevent_audit_mutation();
