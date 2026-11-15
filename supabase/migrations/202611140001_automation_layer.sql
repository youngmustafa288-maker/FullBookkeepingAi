-- FullBookkeepingAI: adapter-neutral automation, not a second general ledger.
-- Run AFTER migrations 202610110001-003. All source files are private.

alter table public.companies alter column accounting_url_encrypted drop not null;
alter table public.companies alter column accounting_api_key_encrypted drop not null;
alter table public.companies alter column accounting_api_secret_encrypted drop not null;

-- Ensure auth users have a corresponding public.users record for existing foreign keys.
create or replace function public.ensure_bookkeeper_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, coalesce(new.email, new.id::text), coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Bookkeeper'))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists auth_user_bookkeeper_profile on auth.users;
create trigger auth_user_bookkeeper_profile after insert or update of email on auth.users
for each row execute function public.ensure_bookkeeper_profile();
insert into public.users (id, email, display_name)
select id, coalesce(email,id::text), coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email,''),'@',1),'Bookkeeper') from auth.users
on conflict (id) do nothing;

-- Explicit onboarding. No fake/unencrypted accounting credentials are required.
create or replace function public.create_company_for_current_user(p_name text, p_currency text default 'MYR')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name)) < 2 or length(trim(p_name)) > 150 then raise exception 'Company name must be 2–150 characters'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be an ISO-style 3-letter code'; end if;
  insert into public.companies(name,currency,tax_regime)
  values (trim(p_name),p_currency,'unknown') returning id into v_company;
  insert into public.company_users(company_id,user_id) values(v_company,auth.uid());
  return v_company;
end;
$$;
revoke all on function public.create_company_for_current_user(text,text) from public;
grant execute on function public.create_company_for_current_user(text,text) to authenticated;

-- Immutable uploads, owned by the selected company via its membership table.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('accounting-sources','accounting-sources',false,8388608,array['image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png'];

create policy accounting_sources_insert on storage.objects for insert to authenticated
with check (bucket_id = 'accounting-sources' and exists (
  select 1 from public.company_users cu where cu.user_id=auth.uid()
  and cu.company_id::text=(storage.foldername(name))[1]
));
create policy accounting_sources_read on storage.objects for select to authenticated
using (bucket_id = 'accounting-sources' and exists (
  select 1 from public.company_users cu where cu.user_id=auth.uid()
  and cu.company_id::text=(storage.foldername(name))[1]
));

-- Review decisions must be made server-side atomically. This function never posts to an accounting platform.
create or replace function public.resolve_accounting_proposal(
  p_company_id uuid, p_document_id uuid, p_decision text, p_final_fields jsonb, p_note text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_document public.extracted_documents%rowtype;
  v_amount numeric;
  v_vendor text;
  v_reference text;
  v_gl text;
  v_date text;
  v_currency text;
  v_expected_currency text;
  v_subtotal numeric;
  v_tax numeric;
begin
  if auth.uid() is null or not public.has_company_access(p_company_id) then
    raise exception 'Company access denied';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid review decision'; end if;
  select * into v_document from public.extracted_documents
    where id=p_document_id and company_id=p_company_id for update;
  if not found then raise exception 'Document not found in this company'; end if;
  if v_document.status <> 'pending' then raise exception 'Document was already resolved'; end if;
  if p_decision = 'approve' then
    if p_final_fields is null or jsonb_typeof(p_final_fields) <> 'object' then raise exception 'Corrected fields are required'; end if;
    v_vendor := trim(coalesce(p_final_fields->>'vendor',''));
    v_reference := trim(coalesce(p_final_fields->>'reference',''));
    v_gl := trim(coalesce(p_final_fields->>'gl_code',''));
    v_date := coalesce(p_final_fields->>'date','');
    v_currency := upper(coalesce(p_final_fields->>'currency',''));
    if v_vendor = '' or v_reference = '' then raise exception 'Vendor and reference are required'; end if;
    if v_date !~ '^\d{4}-\d{2}-\d{2}$' or to_char(to_date(v_date,'YYYY-MM-DD'),'YYYY-MM-DD') <> v_date then
      raise exception 'Date must be valid YYYY-MM-DD';
    end if;
    if coalesce(p_final_fields->>'amount','') !~ '^\d+(\.\d{1,2})?$' then raise exception 'Amount must be a positive number with up to 2 decimals'; end if;
    v_amount := (p_final_fields->>'amount')::numeric;
    if v_amount <= 0 then raise exception 'Amount must be positive'; end if;
    select upper(currency) into v_expected_currency from public.companies where id=p_company_id;
    if v_currency <> v_expected_currency then raise exception 'Foreign currency requires separate validation'; end if;
    if not exists(select 1 from public.gl_codes where company_id=p_company_id and code=v_gl and active) then
      raise exception 'GL code is not active in this company';
    end if;
    if nullif(p_final_fields->>'subtotal','') is not null and nullif(p_final_fields->>'tax_amount','') is not null then
      if (p_final_fields->>'subtotal') !~ '^\d+(\.\d{1,2})?$' or (p_final_fields->>'tax_amount') !~ '^\d+(\.\d{1,2})?$' then
        raise exception 'Subtotal and tax must be nonnegative amounts with up to 2 decimals';
      end if;
      v_subtotal := (p_final_fields->>'subtotal')::numeric;
      v_tax := (p_final_fields->>'tax_amount')::numeric;
      if abs(v_subtotal + v_tax - v_amount) > 0.02 then raise exception 'Subtotal + tax does not match total'; end if;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_company_id::text || ':' || lower(v_vendor) || ':' || lower(v_reference), 0));
    if exists(select 1 from public.extracted_documents e
      where e.company_id=p_company_id and e.id<>p_document_id and e.status='approved'
        and lower(coalesce(e.final_fields->>'vendor',''))=lower(v_vendor)
        and lower(coalesce(e.final_fields->>'reference',''))=lower(v_reference)) then
      raise exception 'Possible duplicate: an approved document has this vendor and reference';
    end if;
    update public.extracted_documents set status='approved',final_fields=p_final_fields,
      approved_by=auth.uid(),approved_at=now() where id=p_document_id;
    update public.agent_jobs set status='approved',updated_at=now() where id=v_document.job_id and company_id=p_company_id;
  else
    update public.extracted_documents set status='rejected',approved_by=auth.uid(),approved_at=now() where id=p_document_id;
    update public.agent_jobs set status='failed',error_message='Rejected by human reviewer',updated_at=now() where id=v_document.job_id and company_id=p_company_id;
  end if;
  insert into public.audit_log(actor_type,actor_id,workflow,action,document_ref,company_id,original_values,final_values,note,job_id)
  values ('human',auth.uid(),case when v_document.document_type='receipt' then 'receipt'::public.workflow_type else 'invoice'::public.workflow_type end,
    case when p_decision='approve' then 'approved' else 'rejected' end,
    coalesce(p_final_fields->>'reference',v_document.extracted_fields->>'reference',v_document.source_filename),
    p_company_id,v_document.extracted_fields,
    case when p_decision='approve' then p_final_fields else null end,
    nullif(trim(coalesce(p_note,'')),''),v_document.job_id);
  return jsonb_build_object('id',p_document_id,'status',case when p_decision='approve' then 'approved' else 'rejected' end);
end;
$$;
revoke all on function public.resolve_accounting_proposal(uuid,uuid,text,jsonb,text) from public;
grant execute on function public.resolve_accounting_proposal(uuid,uuid,text,jsonb,text) to authenticated;

-- Prevent browsers from forging AI results, approvals, or audit events.
-- Server intake uses a service-role key ONLY after checking company membership with the user JWT.
drop policy if exists jobs_scoped on public.agent_jobs;
create policy jobs_read_scoped on public.agent_jobs for select to authenticated using(public.has_company_access(company_id));
drop policy if exists documents_scoped on public.extracted_documents;
create policy documents_read_scoped on public.extracted_documents for select to authenticated using(public.has_company_access(company_id));
drop policy if exists audit_insert_scoped on public.audit_log;

-- Atomically save the AI draft, append an audit event, and transition the job.
-- Browser clients cannot call this function; only the server-side service role can.
create or replace function public.stage_accounting_document(
  p_job_id uuid, p_document_type text, p_filename text, p_storage_path text,
  p_mime_type text, p_ocr jsonb, p_fields jsonb, p_confidence jsonb, p_notes text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_job public.agent_jobs%rowtype; v_document_id uuid;
begin
  select * into v_job from public.agent_jobs where id=p_job_id for update;
  if not found or v_job.status <> 'processing' then raise exception 'Invalid processing job'; end if;
  if p_document_type not in ('purchase_invoice','receipt') then raise exception 'Invalid document type'; end if;
  insert into public.extracted_documents(
    job_id,company_id,document_type,source_filename,source_storage_path,source_mime_type,
    raw_ocr_json,extracted_fields,confidence_scores,agent_notes,status
  ) values (
    p_job_id,v_job.company_id,p_document_type,p_filename,p_storage_path,p_mime_type,
    p_ocr,p_fields,p_confidence,p_notes,'pending'
  ) returning id into v_document_id;
  insert into public.audit_log(
    actor_type,actor_id,workflow,action,company_id,document_ref,job_id,original_values,note
  ) values (
    'workflow',v_job.user_id,v_job.workflow,'submitted',v_job.company_id,
    coalesce(nullif(p_fields->>'reference',''),p_filename),p_job_id,
    jsonb_build_object('extracted_fields',p_fields,'source_sha256',v_job.input_payload->>'sha256'),
    'AI draft staged for mandatory human review. No posting performed.'
  );
  update public.agent_jobs set status='pending_approval',updated_at=now(),
    output_payload=jsonb_build_object('documentId',v_document_id)
  where id=p_job_id;
  return v_document_id;
end;
$$;
revoke all on function public.stage_accounting_document(uuid,text,text,text,text,jsonb,jsonb,jsonb,text[]) from public;
grant execute on function public.stage_accounting_document(uuid,text,text,text,text,jsonb,jsonb,jsonb,text[]) to service_role;

-- Tax treatment is not guessed at onboarding.
alter table public.companies drop constraint if exists companies_tax_regime_check;
alter table public.companies add constraint companies_tax_regime_check check (tax_regime in ('SST','exempt','unknown'));
alter table public.companies alter column tax_regime set default 'unknown';
create or replace function public.set_company_tax_regime(p_company_id uuid, p_regime text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_company_access(p_company_id) then raise exception 'Company access denied'; end if;
  if p_regime not in ('SST','exempt','unknown') then raise exception 'Invalid tax registration setting'; end if;
  update public.companies set tax_regime=p_regime where id=p_company_id;
end;
$$;
revoke all on function public.set_company_tax_regime(uuid,text) from public;
grant execute on function public.set_company_tax_regime(uuid,text) to authenticated;
