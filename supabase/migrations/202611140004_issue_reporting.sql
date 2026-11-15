-- FullBookkeepingAI v4: human-submitted issue reporting, company scoped.
-- Apply AFTER 202611140003_decision_audit.sql.
-- A reported mistake is not an approved correction and must NEVER train or post automatically.

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  company_id uuid not null references public.companies(id),
  reported_by uuid not null references public.users(id),
  document_id uuid references public.extracted_documents(id),
  issue_type text not null check (issue_type in ('ai_decision','extraction','system_bug','feature_request','other')),
  priority text not null default 'normal' check (priority in ('low','normal','urgent')),
  description text not null check (char_length(btrim(description)) between 10 and 3000),
  status text not null default 'new' check (status in ('new','investigating','resolved','closed')),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists issue_reports_company_created on public.issue_reports(company_id,created_at desc);
create index if not exists issue_reports_reporter_created on public.issue_reports(reported_by,created_at desc);
create index if not exists issue_reports_document on public.issue_reports(document_id) where document_id is not null;

create table if not exists public.issue_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.issue_reports(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  actor_id uuid not null references public.users(id),
  action text not null check (action in ('submitted','status_changed')),
  old_status text,
  new_status text not null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists issue_events_report_created on public.issue_report_events(report_id,created_at asc);

alter table public.issue_reports enable row level security;
alter table public.issue_report_events enable row level security;
-- No direct INSERT, UPDATE or DELETE policies: all mutations go through validated functions.
revoke all on public.issue_reports, public.issue_report_events from anon;
revoke all on public.issue_reports, public.issue_report_events from authenticated;
grant select on public.issue_reports, public.issue_report_events to authenticated;

create or replace function public.is_issue_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and public.has_company_access(p_company_id)
    and exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin');
$$;
revoke all on function public.is_issue_admin(uuid) from public,anon;
grant execute on function public.is_issue_admin(uuid) to authenticated;

create policy issue_report_read on public.issue_reports for select to authenticated
using (public.has_company_access(company_id) and (reported_by=auth.uid() or public.is_issue_admin(company_id)));
create policy issue_report_events_read on public.issue_report_events for select to authenticated
using (exists (
  select 1 from public.issue_reports r where r.id=public.issue_report_events.report_id and r.company_id=public.issue_report_events.company_id
));

-- Existing event vocabulary extended without losing any earlier events.
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (
 action in ('submitted','approved','rejected','edited','posted','voided','failed','retried','override',
   'export_prepared','config_changed','feedback_submitted','feedback_status_changed')
);

create or replace function public.submit_issue_report(
  p_company_id uuid, p_type text, p_priority text, p_description text, p_document_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_ticket bigint; v_job uuid; v_ref text; v_workflow public.workflow_type;
  v_description text := btrim(coalesce(p_description,''));
begin
  if auth.uid() is null or not public.has_company_access(p_company_id) then
    raise exception 'Company access denied';
  end if;
  if p_type not in ('ai_decision','extraction','system_bug','feature_request','other') then
    raise exception 'Invalid issue type';
  end if;
  if p_priority not in ('low','normal','urgent') then raise exception 'Invalid priority'; end if;
  if char_length(v_description) not between 10 and 3000 then
    raise exception 'Describe the issue in 10 to 3000 characters';
  end if;
  -- Basic abuse protection; production should also add per-IP and org-level limits.
  if (select count(*) from public.issue_reports r where r.reported_by=auth.uid()
      and r.company_id=p_company_id and r.created_at > now()-interval '1 hour') >= 10 then
    raise exception 'Too many reports in the last hour. Try again later';
  end if;
  if p_document_id is not null then
    select e.job_id,coalesce(nullif(e.final_fields->>'reference',''),nullif(e.extracted_fields->>'reference',''),e.source_filename),
           case when e.document_type='receipt' then 'receipt'::public.workflow_type else 'invoice'::public.workflow_type end
      into v_job,v_ref,v_workflow from public.extracted_documents e
      where e.id=p_document_id and e.company_id=p_company_id;
    if not found then raise exception 'Document does not belong to this company'; end if;
  end if;
  insert into public.issue_reports(company_id,reported_by,document_id,issue_type,priority,description)
    values(p_company_id,auth.uid(),p_document_id,p_type,p_priority,v_description)
    returning id,ticket_number into v_id,v_ticket;
  insert into public.issue_report_events(report_id,company_id,actor_id,action,new_status,note)
    values(v_id,p_company_id,auth.uid(),'submitted','new','Issue report submitted by user.');
  insert into public.audit_log(actor_type,actor_id,workflow,action,document_ref,company_id,job_id,final_values,note)
    values('human',auth.uid(),v_workflow,'feedback_submitted',coalesce(v_ref,'ISS-'||v_ticket),
      p_company_id,v_job,jsonb_build_object('issue_id',v_id,'ticket_number',v_ticket,'type',p_type,'priority',p_priority),
      'User submitted issue report; report contents stored in restricted issue_reports; no AI rule or accounting entry changed.');
  return jsonb_build_object('id',v_id,'ticket_number',v_ticket,'status','new');
end;
$$;
revoke all on function public.submit_issue_report(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.submit_issue_report(uuid,text,text,text,uuid) to authenticated;

create or replace function public.update_issue_report(
  p_company_id uuid, p_report_id uuid, p_status text, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_report public.issue_reports%rowtype;
  v_note text := btrim(coalesce(p_note,''));
  v_job uuid; v_ref text; v_workflow public.workflow_type;
begin
  if not public.is_issue_admin(p_company_id) then raise exception 'Only an assigned administrator may update issue status'; end if;
  if p_status not in ('new','investigating','resolved','closed') then raise exception 'Invalid issue status'; end if;
  if char_length(v_note) not between 8 and 1000 then raise exception 'An update note of 8 to 1000 characters is required'; end if;
  select * into v_report from public.issue_reports
    where id=p_report_id and company_id=p_company_id for update;
  if not found then raise exception 'Issue not found'; end if;
  if v_report.status=p_status then raise exception 'Choose a different status'; end if;
  -- Do not permit closing an open report without recorded investigation/resolution.
  if p_status='closed' and v_report.status not in ('resolved','closed') then
    raise exception 'Resolve the report before closing it';
  end if;
  if v_report.document_id is not null then
    select e.job_id,coalesce(nullif(e.final_fields->>'reference',''),nullif(e.extracted_fields->>'reference',''),e.source_filename),
         case when e.document_type='receipt' then 'receipt'::public.workflow_type else 'invoice'::public.workflow_type end
      into v_job,v_ref,v_workflow from public.extracted_documents e
      where e.id=v_report.document_id and e.company_id=p_company_id;
  end if;
  update public.issue_reports set status=p_status,updated_by=auth.uid(),updated_at=now(),
    resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end
    where id=p_report_id;
  insert into public.issue_report_events(report_id,company_id,actor_id,action,old_status,new_status,note)
    values(p_report_id,p_company_id,auth.uid(),'status_changed',v_report.status,p_status,v_note);
  insert into public.audit_log(actor_type,actor_id,workflow,action,document_ref,company_id,job_id,original_values,final_values,note)
    values('human',auth.uid(),v_workflow,'feedback_status_changed',coalesce(v_ref,'ISS-'||v_report.ticket_number),
      p_company_id,v_job,jsonb_build_object('issue_id',p_report_id,'status',v_report.status),
      jsonb_build_object('issue_id',p_report_id,'status',p_status),
      'Issue ticket ISS-'||v_report.ticket_number||' status changed. See restricted issue event for resolution note.');
  return jsonb_build_object('id',p_report_id,'status',p_status);
end;
$$;
revoke all on function public.update_issue_report(uuid,uuid,text,text) from public,anon;
grant execute on function public.update_issue_report(uuid,uuid,text,text) to authenticated;

-- Once written, issue activity is append-only for app users AND guarded against accidental mutations.
drop trigger if exists issue_report_events_no_update on public.issue_report_events;
create trigger issue_report_events_no_update before update or delete on public.issue_report_events
for each row execute function public.prevent_audit_mutation();
