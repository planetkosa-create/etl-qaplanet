create extension if not exists pgcrypto;

create table if not exists public.etl_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  user_id uuid null,
  file_name text not null,
  file_type text not null,
  file_size bigint,
  storage_path text,
  extracted_text text,
  extracted_json jsonb,
  source_kind text,
  processing_status text default 'uploaded',
  processing_error text,
  uploaded_at timestamptz default now(),
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint etl_artifacts_source_kind_check check (
    source_kind in (
      'requirements',
      'source_target_mapping',
      'transformation_logic',
      'data_dictionary',
      'sql_reference',
      'other'
    )
  ),
  constraint etl_artifacts_processing_status_check check (
    processing_status in ('uploaded', 'processing', 'processed', 'failed')
  )
);

create index if not exists etl_artifacts_uploaded_at_idx on public.etl_artifacts (uploaded_at desc);
create index if not exists etl_artifacts_source_kind_idx on public.etl_artifacts (source_kind);
create index if not exists etl_artifacts_processing_status_idx on public.etl_artifacts (processing_status);

create or replace function public.set_etl_artifacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists etl_artifacts_set_updated_at on public.etl_artifacts;
create trigger etl_artifacts_set_updated_at
before update on public.etl_artifacts
for each row
execute function public.set_etl_artifacts_updated_at();

insert into storage.buckets (id, name, public)
values ('etl-artifacts', 'etl-artifacts', false)
on conflict (id) do nothing;

alter table public.etl_artifacts enable row level security;

create policy "Allow authenticated users to read their ETL artifacts"
on public.etl_artifacts
for select
to authenticated
using (user_id is null or user_id = auth.uid());

create policy "Allow authenticated users to insert ETL artifacts"
on public.etl_artifacts
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

create policy "Allow authenticated users to update their ETL artifacts"
on public.etl_artifacts
for update
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

create policy "Allow authenticated users to delete their ETL artifacts"
on public.etl_artifacts
for delete
to authenticated
using (user_id is null or user_id = auth.uid());

create policy "Allow authenticated users to upload ETL artifact files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'etl-artifacts');

create policy "Allow authenticated users to read ETL artifact files"
on storage.objects
for select
to authenticated
using (bucket_id = 'etl-artifacts');

create policy "Allow authenticated users to delete ETL artifact files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'etl-artifacts');
