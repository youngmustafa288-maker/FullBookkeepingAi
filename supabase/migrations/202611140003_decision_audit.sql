-- FullBookkeepingAI v3: document trace and decision evidence, not model chain-of-thought.
-- Apply AFTER 202611140001 and 202611140002.
-- Model explanations are advisory; independently matched rules are identified separately.

alter table public.extracted_documents
  add column if not exists decision_explanation jsonb not null default '{}'::jsonb,
  add column if not exists processing_context jsonb not null default '{}'::jsonb;

-- Extend the existing append-only audit event vocabulary.
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('submitted','approved','rejected','edited','posted','voided','failed','retried','override','export_prepared','config_changed'));

create index if not exists audit_log_job_timestamp_idx on public.audit_log(job_id,timestamp asc) where job_id is not null;

-- Preserve the same function signature for a safe incremental deployment.
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
    raw_ocr_json,extracted_fields,confidence_scores,agent_notes,decision_explanation,processing_context,status
  ) values (
    p_job_id,v_job.company_id,p_document_type,p_filename,p_storage_path,p_mime_type,
    p_ocr,p_fields,p_confidence - 'explanation' - 'provenance',p_notes,
    coalesce(p_confidence->'explanation','{}'::jsonb),coalesce(p_confidence->'provenance','{}'::jsonb),'pending'
  ) returning id into v_document_id;
  insert into public.audit_log(
    actor_type,actor_id,workflow,action,company_id,document_ref,job_id,original_values,note
  ) values (
    'workflow',v_job.user_id,v_job.workflow,'submitted',v_job.company_id,
    coalesce(nullif(p_fields->>'reference',''),p_filename),p_job_id,
    jsonb_build_object('extracted_fields',p_fields,'source_sha256',v_job.input_payload->>'sha256',
      'ai_model',p_confidence->'provenance'->>'ai_model',
      'client_context_sha256',p_confidence->'provenance'->>'client_context_sha256',
      'workflow_rules_sha256',p_confidence->'provenance'->>'workflow_rules_sha256'),
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


-- A generated CSV is not proof the file was downloaded, imported, or posted.
-- Audit one preparation event per included approved document, in one transaction.
create or replace function public.record_accounting_export(
  p_company_id uuid, p_document_ids uuid[], p_format text default 'csv'
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_expected integer; v_actual integer;
begin
  if auth.uid() is null or not public.has_company_access(p_company_id) then
    raise exception 'Company access denied';
  end if;
  if p_format <> 'csv' then raise exception 'Unsupported export format'; end if;
  v_expected := coalesce(array_length(p_document_ids,1),0);
  if v_expected < 1 or v_expected > 1000 then raise exception 'Export requires 1–1000 documents'; end if;
  if (select count(distinct u.id) from unnest(p_document_ids) u(id)) <> v_expected then
    raise exception 'Duplicate document IDs in export request';
  end if;
  select count(*) into v_actual from public.extracted_documents e
  where e.id = any(p_document_ids) and e.company_id=p_company_id and e.status='approved';
  if v_actual <> v_expected then raise exception 'Export set contains a non-approved or inaccessible document'; end if;
  insert into public.audit_log(
    actor_type,actor_id,workflow,action,document_ref,company_id,job_id,final_values,note
  ) select
    'human',auth.uid(),case when e.document_type='receipt' then 'receipt'::public.workflow_type else 'invoice'::public.workflow_type end,
    'export_prepared',coalesce(e.final_fields->>'reference',e.source_filename),p_company_id,e.job_id,
    jsonb_build_object('format',p_format,'document_id',e.id),
    'Approved transaction included in prepared CSV response; external accounting import and posting NOT confirmed.'
  from public.extracted_documents e
  where e.id = any(p_document_ids) and e.company_id=p_company_id and e.status='approved';
  return v_actual;
end;
$$;
revoke all on function public.record_accounting_export(uuid,uuid[],text) from public, anon;
grant execute on function public.record_accounting_export(uuid,uuid[],text) to authenticated;

-- Make company rule additions/edits/deletions traceable in the same DB transaction.
-- Existing client RLS continues to decide who may make the change.
create or replace function public.audit_client_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
  v_before jsonb;
  v_after jsonb;
  v_reference text;
begin
  if TG_TABLE_NAME = 'companies' then
    if old.tax_regime is not distinct from new.tax_regime then return new; end if;
    v_company := new.id;
    v_reference := 'tax_regime';
    v_before := jsonb_build_object('tax_regime',old.tax_regime);
    v_after := jsonb_build_object('tax_regime',new.tax_regime);
  else
    v_company := case when TG_OP='DELETE' then old.company_id else new.company_id end;
    v_before := case when TG_OP='INSERT' then null else to_jsonb(old) end;
    v_after := case when TG_OP='DELETE' then null else to_jsonb(new) end;
    v_reference := case TG_TABLE_NAME
      when 'vendor_rules' then 'vendor_rule:' || coalesce(v_after->>'vendor_pattern',v_before->>'vendor_pattern','')
      when 'gl_codes' then 'gl_code:' || coalesce(v_after->>'code',v_before->>'code','')
      else 'policy:' || coalesce(v_after->>'policy_key',v_before->>'policy_key','') end;
  end if;
  insert into public.audit_log(actor_type,actor_id,workflow,action,company_id,document_ref,original_values,final_values,note)
  values (case when auth.uid() is null then 'workflow' else 'human' end,auth.uid(),'invoice','config_changed',v_company,v_reference,v_before,v_after,
    'Client configuration ' || case TG_OP when 'INSERT' then 'inserted' when 'UPDATE' then 'updated' else 'deleted' end || '; no historical accounting approval was modified.');
  return case when TG_OP='DELETE' then old else new end;
end;
$$;
revoke all on function public.audit_client_configuration() from public,anon,authenticated;

drop trigger if exists audit_vendor_rules_changes on public.vendor_rules;
create trigger audit_vendor_rules_changes after insert or update or delete on public.vendor_rules
for each row execute function public.audit_client_configuration();
drop trigger if exists audit_gl_codes_changes on public.gl_codes;
create trigger audit_gl_codes_changes after insert or update or delete on public.gl_codes
for each row execute function public.audit_client_configuration();
drop trigger if exists audit_client_policies_changes on public.client_policies;
create trigger audit_client_policies_changes after insert or update or delete on public.client_policies
for each row execute function public.audit_client_configuration();
drop trigger if exists audit_company_tax_changes on public.companies;
create trigger audit_company_tax_changes after update of tax_regime on public.companies
for each row execute function public.audit_client_configuration();

-- Existing audit_log_no_update remains active: entries cannot be edited/deleted by app users.
-- Use database backups and restricted service-role access for stronger tamper resistance.

-- An override with no explanation is not a useful audit record.
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
  if p_decision='reject' and length(btrim(coalesce(p_note,''))) < 5 then
    raise exception 'Explain the rejection in a review note of at least 5 characters';
  end if;
  if p_decision='approve' and p_final_fields is distinct from v_document.extracted_fields
    and length(btrim(coalesce(p_note,''))) < 5 then
    raise exception 'Explain any corrections in a review note of at least 5 characters';
  end if;
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

