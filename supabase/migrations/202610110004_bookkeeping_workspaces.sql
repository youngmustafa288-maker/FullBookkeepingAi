-- Operational subledger state. Approval does not execute payments or post to an external GL.
create table public.bookkeeping_workspaces (
 company_id uuid primary key references public.companies(id) on delete cascade,
 revision bigint not null default 0,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.bookkeeping_workspaces enable row level security;
create policy workspace_read on public.bookkeeping_workspaces for select using (public.has_company_access(company_id));
-- Writes are server-only. The server authenticates membership, runs deterministic controls,
-- then uses this row lock + revision guard. Browser roles cannot call this function.
create function public.save_bookkeeping_workspace(target_company uuid, expected_revision bigint, new_state jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare existing_revision bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_company::text,0));
 select revision into existing_revision from public.bookkeeping_workspaces where company_id=target_company for update;
 if coalesce(existing_revision,0)<>expected_revision then raise exception 'Revision conflict'; end if;
 if (new_state->>'revision')::bigint<>expected_revision+1 then raise exception 'Invalid revision'; end if;
 insert into public.bookkeeping_workspaces(company_id,revision,state) values(target_company,expected_revision+1,new_state)
 on conflict(company_id) do update set revision=excluded.revision,state=excluded.state,updated_at=now();
end $$;
revoke all on function public.save_bookkeeping_workspace(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_bookkeeping_workspace(uuid,bigint,jsonb) to service_role;
