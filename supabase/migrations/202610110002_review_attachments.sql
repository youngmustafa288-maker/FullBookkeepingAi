alter table public.extracted_documents
  add column if not exists source_storage_path text,
  add column if not exists source_mime_type text;

comment on column public.extracted_documents.source_storage_path is
  'Private storage object path. The server exchanges this for a short-lived signed URL during review.';

comment on column public.extracted_documents.source_mime_type is
  'Validated MIME type used to choose the image or PDF review renderer.';
