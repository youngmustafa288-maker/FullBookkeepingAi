-- FullBookkeepingAI review-feedback learning. Run AFTER 202611140001_automation_layer.sql.
-- The confidence score remains a single uncalibrated AI self-estimate. Learning DOES NOT adjust it.
-- This feature never posts to an accounting system and never activates an AI-suggested rule without review.

create table public.review_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null unique references public.extracted_documents(id) on delete cascade,
  reviewer_id uuid references public.users(id),
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index review_feedback_company_created_idx on public.review_feedback(company_id, created_at desc);
alter table public.review_feedback enable row level security;
revoke all on public.review_feedback from anon, authenticated;
grant select on public.review_feedback to authenticated;
create policy feedback_company_read on public.review_feedback for select to authenticated
using (public.has_company_access(company_id));

create table public.vendor_rule_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_key text not null,
  vendor_name text not null,
  proposed_gl_code text not null,
  proposed_category text not null,
  proposed_tax_code text not null,
  support_count integer not null check (support_count >= 3),
  status text not null default 'pending' check (status in ('pending','approved','dismissed','stale')),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,vendor_key),
  check (vendor_key=lower(btrim(vendor_key)) and length(vendor_key) > 1)
);
create index vendor_suggestions_company_status_idx on public.vendor_rule_suggestions(company_id,status);
alter table public.vendor_rule_suggestions enable row level security;
revoke all on public.vendor_rule_suggestions from anon, authenticated;
grant select on public.vendor_rule_suggestions to authenticated;
create policy suggested_rules_company_read on public.vendor_rule_suggestions for select to authenticated
using (public.has_company_access(company_id));

-- Only exact normalized vendor names count as the same vendor. Multiple classifications or
-- overlapping existing mappings mean NO new rule recommendation.
create or replace function public.refresh_vendor_suggestion(p_company_id uuid, p_vendor text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_key text := lower(btrim(coalesce(p_vendor,'')));
  v_count integer;
  v_gl_count integer;
  v_cat_count integer;
  v_tax_count integer;
  v_gl text;
  v_category text;
  v_tax text;
  v_display text;
begin
  if length(v_key) < 2 then return; end if;
  select count(*)::integer,
    count(distinct coalesce(btrim(e.final_fields->>'gl_code'),'__NULL__'))::integer,
    count(distinct coalesce(btrim(e.final_fields->>'category'),'__NULL__'))::integer,
    count(distinct coalesce(btrim(e.final_fields->>'tax_code'),'__NULL__'))::integer,
    min(btrim(e.final_fields->>'gl_code')),
    min(btrim(e.final_fields->>'category')),
    min(btrim(e.final_fields->>'tax_code')),
    min(btrim(e.final_fields->>'vendor'))
  into v_count,v_gl_count,v_cat_count,v_tax_count,v_gl,v_category,v_tax,v_display
  from public.extracted_documents e
  where e.company_id=p_company_id and e.status='approved'
    and lower(btrim(e.final_fields->>'vendor'))=v_key;

  if v_count < 3 or v_gl_count<>1 or v_cat_count<>1 or v_tax_count<>1
     or coalesce(v_gl,'')='' or coalesce(v_category,'')='' or coalesce(v_tax,'')=''
     or not exists(select 1 from public.gl_codes g where g.company_id=p_company_id and g.code=v_gl and g.active)
     or exists(select 1 from public.vendor_rules r where r.company_id=p_company_id and r.status='approved'
       and position(lower(btrim(r.vendor_pattern)) in v_key)>0)
  then
    update public.vendor_rule_suggestions set status='stale',updated_at=now()
      where company_id=p_company_id and vendor_key=v_key and status='pending';
    return;
  end if;

  insert into public.vendor_rule_suggestions(
    company_id,vendor_key,vendor_name,proposed_gl_code,proposed_category,proposed_tax_code,support_count
  ) values (p_company_id,v_key,v_display,v_gl,v_category,v_tax,v_count)
  on conflict (company_id,vendor_key) do update set
    vendor_name=excluded.vendor_name,
    proposed_gl_code=excluded.proposed_gl_code,
    proposed_category=excluded.proposed_category,
    proposed_tax_code=excluded.proposed_tax_code,
    support_count=excluded.support_count,
    updated_at=now()
  where public.vendor_rule_suggestions.status='pending';
end;
$$;
revoke all on function public.refresh_vendor_suggestion(uuid,text) from public, anon, authenticated;

-- Runs in the same SQL transaction as human approval. No LLM call is made here.
create or replace function public.capture_approved_correction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_fields text[] := array['vendor','reference','date','amount','subtotal','tax_amount','currency','gl_code','category','tax_code','description'];
  v_key text;
  v_changes text[] := array[]::text[];
begin
  if new.status <> 'approved' or old.status <> 'pending' then return new; end if;
  foreach v_key in array v_fields loop
    if v_key in ('amount','subtotal','tax_amount') then
      if nullif(new.extracted_fields->>v_key,'')::numeric is distinct from
         nullif(new.final_fields->>v_key,'')::numeric then
        v_changes := array_append(v_changes,v_key);
      end if;
    elsif btrim(coalesce(new.extracted_fields->>v_key,'')) is distinct from
          btrim(coalesce(new.final_fields->>v_key,'')) then
      v_changes := array_append(v_changes,v_key);
    end if;
  end loop;

  insert into public.review_feedback(company_id,document_id,reviewer_id,changed_fields)
  values (new.company_id,new.id,new.approved_by,v_changes)
  on conflict (document_id) do nothing;
  perform public.refresh_vendor_suggestion(new.company_id,new.final_fields->>'vendor');
  return new;
end;
$$;
revoke all on function public.capture_approved_correction() from public, anon, authenticated;
drop trigger if exists extracted_document_feedback on public.extracted_documents;
create trigger extracted_document_feedback after update of status on public.extracted_documents
for each row when (old.status='pending' and new.status='approved')
execute function public.capture_approved_correction();

-- Read-only summary: compares original AI drafts against approved reviewer values.
-- It does NOT claim independently verified model accuracy or calibrated confidence.
create or replace function public.get_review_feedback_summary(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total bigint; v_untouched bigint; v_gl_same bigint; v_amount_same bigint;
begin
  if auth.uid() is null or not public.has_company_access(p_company_id) then
    raise exception 'Company access denied';
  end if;
  select count(*),
    count(*) filter (where cardinality(changed_fields)=0),
    count(*) filter (where not ('gl_code'=any(changed_fields))),
    count(*) filter (where not ('amount'=any(changed_fields)))
  into v_total,v_untouched,v_gl_same,v_amount_same
  from public.review_feedback where company_id=p_company_id;
  return jsonb_build_object('reviewed',v_total,'unchanged',v_untouched,'gl_unchanged',v_gl_same,'amount_unchanged',v_amount_same);
end;
$$;
revoke all on function public.get_review_feedback_summary(uuid) from public, anon;
grant execute on function public.get_review_feedback_summary(uuid) to authenticated;

create or replace function public.resolve_vendor_rule_suggestion(
  p_company_id uuid, p_suggestion_id uuid, p_decision text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_s public.vendor_rule_suggestions%rowtype;
  v_count integer; v_variants integer;
begin
  if auth.uid() is null or not public.has_company_access(p_company_id) then
    raise exception 'Company access denied';
  end if;
  if p_decision not in ('approve','dismiss') then raise exception 'Invalid decision'; end if;
  select * into v_s from public.vendor_rule_suggestions where id=p_suggestion_id
    and company_id=p_company_id for update;
  if not found or v_s.status <> 'pending' then raise exception 'Suggestion is no longer pending'; end if;

  if p_decision='approve' then
    if not exists (select 1 from public.gl_codes g where g.company_id=p_company_id
       and g.code=v_s.proposed_gl_code and g.active) then
      raise exception 'Suggested GL is no longer active';
    end if;
    if exists (select 1 from public.vendor_rules r where r.company_id=p_company_id
       and position(lower(btrim(r.vendor_pattern)) in v_s.vendor_key)>0 and r.status='approved') then
      raise exception 'A mapping for this vendor already exists; review it manually';
    end if;
    -- Recheck historical support before activation; ambiguous vendors never qualify.
    select count(*)::integer,
      count(distinct jsonb_build_array(e.final_fields->>'gl_code', e.final_fields->>'category', e.final_fields->>'tax_code'))::integer
    into v_count,v_variants from public.extracted_documents e
    where e.company_id=p_company_id and e.status='approved'
      and lower(btrim(e.final_fields->>'vendor'))=v_s.vendor_key;
    if v_count<3 or v_variants<>1 or not exists (
      select 1 from public.extracted_documents e where e.company_id=p_company_id and e.status='approved'
        and lower(btrim(e.final_fields->>'vendor'))=v_s.vendor_key
        and btrim(e.final_fields->>'gl_code')=v_s.proposed_gl_code
        and btrim(e.final_fields->>'category')=v_s.proposed_category
        and btrim(e.final_fields->>'tax_code')=v_s.proposed_tax_code
    ) then raise exception 'Supporting accounting decisions have changed'; end if;
    insert into public.vendor_rules(company_id,vendor_pattern,gl_code,default_category,tax_code,status,created_by)
    values(p_company_id,v_s.vendor_name,v_s.proposed_gl_code,v_s.proposed_category,v_s.proposed_tax_code,'approved',auth.uid());
  end if;

  update public.vendor_rule_suggestions set
    status=case when p_decision='approve' then 'approved' else 'dismissed' end,
    reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
  where id=p_suggestion_id;
  insert into public.audit_log(actor_type,actor_id,workflow,action,document_ref,company_id,original_values,final_values,note)
  values ('human',auth.uid(),'invoice',case when p_decision='approve' then 'edited' else 'override' end,
    v_s.vendor_name,p_company_id,to_jsonb(v_s),
    case when p_decision='approve' then jsonb_build_object('vendor',v_s.vendor_name,'gl_code',v_s.proposed_gl_code,
      'category',v_s.proposed_category,'tax_code',v_s.proposed_tax_code) else null end,
    case when p_decision='approve' then 'Approved evidence-based vendor mapping; no document automatically posted.'
      else 'Dismissed vendor rule suggestion.' end);
  return jsonb_build_object('status',case when p_decision='approve' then 'approved' else 'dismissed' end);
end;
$$;
revoke all on function public.resolve_vendor_rule_suggestion(uuid,uuid,text) from public, anon;
grant execute on function public.resolve_vendor_rule_suggestion(uuid,uuid,text) to authenticated;

-- Backfill previously approved documents without generating multiple feedback rows.
insert into public.review_feedback(company_id,document_id,reviewer_id,changed_fields,created_at)
select e.company_id,e.id,e.approved_by,
  array(
    select k from unnest(array['vendor','reference','date','amount','subtotal','tax_amount','currency','gl_code','category','tax_code','description']) k
    where case when k in ('amount','subtotal','tax_amount') then
      nullif(e.extracted_fields->>k,'')::numeric is distinct from nullif(e.final_fields->>k,'')::numeric
    else btrim(coalesce(e.extracted_fields->>k,'')) is distinct from btrim(coalesce(e.final_fields->>k,'')) end
  ),coalesce(e.approved_at,e.created_at)
from public.extracted_documents e where e.status='approved' and e.final_fields is not null
on conflict(document_id) do nothing;

do $$
declare r record;
begin
  for r in select distinct company_id, lower(btrim(final_fields->>'vendor')) vendor
    from public.extracted_documents where status='approved' and final_fields is not null
  loop perform public.refresh_vendor_suggestion(r.company_id,r.vendor); end loop;
end $$;
