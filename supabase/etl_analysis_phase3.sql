create extension if not exists pgcrypto;

create table if not exists public.etl_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  user_id uuid null,
  run_name text,
  status text default 'queued',
  artifact_count integer default 0,
  model_name text,
  input_summary text,
  output_summary text,
  processing_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint etl_analysis_runs_status_check check (status in ('queued', 'running', 'completed', 'failed'))
);

create table if not exists public.etl_mapping_items (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete cascade,
  artifact_id uuid references public.etl_artifacts(id) on delete set null,
  project_id uuid null,
  user_id uuid null,
  source_system text,
  source_table text,
  source_column text,
  target_system text,
  target_table text,
  target_column text,
  data_type text,
  transformation_rule text,
  business_rule text,
  mapping_type text,
  join_condition text,
  filter_condition text,
  is_required boolean default false,
  is_key boolean default false,
  confidence_score integer,
  created_at timestamptz default now()
);

create table if not exists public.etl_rule_items (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete cascade,
  artifact_id uuid references public.etl_artifacts(id) on delete set null,
  project_id uuid null,
  user_id uuid null,
  rule_reference text,
  rule_type text,
  title text,
  description text,
  source_expression text,
  target_expression text,
  validation_intent text,
  affected_tables text[],
  affected_columns text[],
  severity text,
  confidence_score integer,
  created_at timestamptz default now()
);

create table if not exists public.etl_data_quality_items (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete cascade,
  artifact_id uuid references public.etl_artifacts(id) on delete set null,
  project_id uuid null,
  user_id uuid null,
  check_type text,
  table_name text,
  column_name text,
  description text,
  expected_condition text,
  suggested_validation text,
  severity text,
  confidence_score integer,
  created_at timestamptz default now()
);

create table if not exists public.etl_analysis_gaps (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete cascade,
  artifact_id uuid references public.etl_artifacts(id) on delete set null,
  project_id uuid null,
  user_id uuid null,
  gap_type text,
  title text,
  description text,
  impact text,
  recommendation text,
  severity text,
  created_at timestamptz default now()
);

create index if not exists etl_analysis_runs_project_id_idx on public.etl_analysis_runs(project_id);
create index if not exists etl_analysis_runs_user_id_idx on public.etl_analysis_runs(user_id);
create index if not exists etl_mapping_items_analysis_run_id_idx on public.etl_mapping_items(analysis_run_id);
create index if not exists etl_mapping_items_artifact_id_idx on public.etl_mapping_items(artifact_id);
create index if not exists etl_rule_items_analysis_run_id_idx on public.etl_rule_items(analysis_run_id);
create index if not exists etl_rule_items_artifact_id_idx on public.etl_rule_items(artifact_id);
create index if not exists etl_data_quality_items_analysis_run_id_idx on public.etl_data_quality_items(analysis_run_id);
create index if not exists etl_data_quality_items_artifact_id_idx on public.etl_data_quality_items(artifact_id);
create index if not exists etl_analysis_gaps_analysis_run_id_idx on public.etl_analysis_gaps(analysis_run_id);
create index if not exists etl_analysis_gaps_artifact_id_idx on public.etl_analysis_gaps(artifact_id);

alter table public.etl_analysis_runs enable row level security;
alter table public.etl_mapping_items enable row level security;
alter table public.etl_rule_items enable row level security;
alter table public.etl_data_quality_items enable row level security;
alter table public.etl_analysis_gaps enable row level security;

drop policy if exists "Allow authenticated users to manage analysis runs" on public.etl_analysis_runs;
create policy "Allow authenticated users to manage analysis runs"
on public.etl_analysis_runs for all to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to manage mapping items" on public.etl_mapping_items;
create policy "Allow authenticated users to manage mapping items"
on public.etl_mapping_items for all to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to manage rule items" on public.etl_rule_items;
create policy "Allow authenticated users to manage rule items"
on public.etl_rule_items for all to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to manage data quality items" on public.etl_data_quality_items;
create policy "Allow authenticated users to manage data quality items"
on public.etl_data_quality_items for all to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to manage analysis gaps" on public.etl_analysis_gaps;
create policy "Allow authenticated users to manage analysis gaps"
on public.etl_analysis_gaps for all to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());
