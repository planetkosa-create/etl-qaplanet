create table if not exists public.etl_execution_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete set null,
  validation_pack_id uuid references public.etl_validation_packs(id) on delete set null,
  run_name text not null,
  database_type text,
  environment_name text,
  execution_method text default 'manual',
  status text default 'not_started',
  total_scripts integer default 0,
  passed_count integer default 0,
  failed_count integer default 0,
  warning_count integer default 0,
  skipped_count integer default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.etl_execution_results (
  id uuid primary key default gen_random_uuid(),
  execution_run_id uuid references public.etl_execution_runs(id) on delete cascade,
  script_id uuid references public.etl_validation_scripts(id) on delete set null,
  project_id uuid,
  user_id uuid,
  script_name text,
  validation_category text,
  source_table text,
  target_table text,
  status text default 'not_run',
  expected_result text,
  actual_result text,
  row_count integer,
  difference_count integer,
  difference_amount numeric,
  error_message text,
  evidence_notes text,
  executed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.etl_evidence_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  execution_run_id uuid references public.etl_execution_runs(id) on delete cascade,
  execution_result_id uuid references public.etl_execution_results(id) on delete cascade,
  script_id uuid references public.etl_validation_scripts(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size bigint,
  storage_path text,
  evidence_type text,
  notes text,
  uploaded_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.etl_audit_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  execution_run_id uuid references public.etl_execution_runs(id) on delete set null,
  validation_pack_id uuid references public.etl_validation_packs(id) on delete set null,
  report_name text not null,
  report_type text not null,
  report_content text,
  file_name text,
  storage_path text,
  created_at timestamptz default now()
);

create table if not exists public.etl_export_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  validation_pack_id uuid references public.etl_validation_packs(id) on delete set null,
  package_name text not null,
  package_type text not null,
  file_name text,
  storage_path text,
  manifest_json jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_etl_execution_runs_project_id on public.etl_execution_runs(project_id);
create index if not exists idx_etl_execution_runs_user_id on public.etl_execution_runs(user_id);
create index if not exists idx_etl_execution_runs_analysis_run_id on public.etl_execution_runs(analysis_run_id);
create index if not exists idx_etl_execution_runs_validation_pack_id on public.etl_execution_runs(validation_pack_id);

create index if not exists idx_etl_execution_results_run_id on public.etl_execution_results(execution_run_id);
create index if not exists idx_etl_execution_results_script_id on public.etl_execution_results(script_id);
create index if not exists idx_etl_execution_results_project_id on public.etl_execution_results(project_id);
create index if not exists idx_etl_execution_results_user_id on public.etl_execution_results(user_id);

create index if not exists idx_etl_evidence_files_run_id on public.etl_evidence_files(execution_run_id);
create index if not exists idx_etl_evidence_files_result_id on public.etl_evidence_files(execution_result_id);
create index if not exists idx_etl_evidence_files_script_id on public.etl_evidence_files(script_id);
create index if not exists idx_etl_evidence_files_project_id on public.etl_evidence_files(project_id);
create index if not exists idx_etl_evidence_files_user_id on public.etl_evidence_files(user_id);

create index if not exists idx_etl_audit_reports_run_id on public.etl_audit_reports(execution_run_id);
create index if not exists idx_etl_audit_reports_pack_id on public.etl_audit_reports(validation_pack_id);
create index if not exists idx_etl_audit_reports_project_id on public.etl_audit_reports(project_id);
create index if not exists idx_etl_audit_reports_user_id on public.etl_audit_reports(user_id);

create index if not exists idx_etl_export_packages_pack_id on public.etl_export_packages(validation_pack_id);
create index if not exists idx_etl_export_packages_project_id on public.etl_export_packages(project_id);
create index if not exists idx_etl_export_packages_user_id on public.etl_export_packages(user_id);

insert into storage.buckets (id, name, public)
values ('etl-evidence', 'etl-evidence', false)
on conflict (id) do nothing;

alter table public.etl_execution_runs enable row level security;
alter table public.etl_execution_results enable row level security;
alter table public.etl_evidence_files enable row level security;
alter table public.etl_audit_reports enable row level security;
alter table public.etl_export_packages enable row level security;

drop policy if exists "Allow authenticated users to read ETL execution runs" on public.etl_execution_runs;
create policy "Allow authenticated users to read ETL execution runs"
on public.etl_execution_runs
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL execution runs" on public.etl_execution_runs;
create policy "Allow authenticated users to insert ETL execution runs"
on public.etl_execution_runs
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to update ETL execution runs" on public.etl_execution_runs;
create policy "Allow authenticated users to update ETL execution runs"
on public.etl_execution_runs
for update
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to read ETL execution results" on public.etl_execution_results;
create policy "Allow authenticated users to read ETL execution results"
on public.etl_execution_results
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL execution results" on public.etl_execution_results;
create policy "Allow authenticated users to insert ETL execution results"
on public.etl_execution_results
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to update ETL execution results" on public.etl_execution_results;
create policy "Allow authenticated users to update ETL execution results"
on public.etl_execution_results
for update
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to read ETL evidence files" on public.etl_evidence_files;
create policy "Allow authenticated users to read ETL evidence files"
on public.etl_evidence_files
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL evidence files" on public.etl_evidence_files;
create policy "Allow authenticated users to insert ETL evidence files"
on public.etl_evidence_files
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to read ETL audit reports" on public.etl_audit_reports;
create policy "Allow authenticated users to read ETL audit reports"
on public.etl_audit_reports
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL audit reports" on public.etl_audit_reports;
create policy "Allow authenticated users to insert ETL audit reports"
on public.etl_audit_reports
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to read ETL export packages" on public.etl_export_packages;
create policy "Allow authenticated users to read ETL export packages"
on public.etl_export_packages
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL export packages" on public.etl_export_packages;
create policy "Allow authenticated users to insert ETL export packages"
on public.etl_export_packages
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to upload ETL evidence files" on storage.objects;
create policy "Allow authenticated users to upload ETL evidence files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'etl-evidence');

drop policy if exists "Allow authenticated users to read ETL evidence files" on storage.objects;
create policy "Allow authenticated users to read ETL evidence files"
on storage.objects
for select
to authenticated
using (bucket_id = 'etl-evidence');

drop policy if exists "Allow authenticated users to delete ETL evidence files" on storage.objects;
create policy "Allow authenticated users to delete ETL evidence files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'etl-evidence');
