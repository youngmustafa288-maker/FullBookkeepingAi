insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bookkeeping-evidence','bookkeeping-evidence',false,3000000,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do nothing;
create policy bookkeeping_evidence_insert on storage.objects for insert to authenticated
with check(bucket_id='bookkeeping-evidence' and public.has_company_access(((storage.foldername(name))[1])::uuid));
create policy bookkeeping_evidence_read on storage.objects for select to authenticated
using(bucket_id='bookkeeping-evidence' and public.has_company_access(((storage.foldername(name))[1])::uuid));
-- Originals are immutable: no authenticated update/delete policy is created.
