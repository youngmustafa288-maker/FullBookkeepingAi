-- Keep existing original attachments private; add document export formats for the restored uploader.
update storage.buckets
set public=false, allowed_mime_types = array(
 select distinct value from unnest(coalesce(allowed_mime_types,array[]::text[]) || array[
 'image/jpeg','image/png','application/pdf','text/csv','text/plain',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 ]::text[]) as value
)
where id='bookkeeping-evidence';
