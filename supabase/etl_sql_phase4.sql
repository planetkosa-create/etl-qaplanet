create table if not exists public.etl_validation_scripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete set null,
  script_name text not null,
  script_type text not null,
  database_type text not null,
  validation_category text not null,
  source_table text,
  target_table text,
  source_column text,
  target_column text,
  sql_text text not null,
  description text,
  generated_from text,
  confidence_score integer,
  execution_status text default 'not_run',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.etl_validation_packs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  analysis_run_id uuid references public.etl_analysis_runs(id) on delete set null,
  pack_name text not null,
  pack_type text not null,
  description text,
  script_count integer default 0,
  database_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.etl_validation_pack_scripts (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.etl_validation_packs(id) on delete cascade,
  script_id uuid references public.etl_validation_scripts(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.etl_script_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  pack_id uuid references public.etl_validation_packs(id) on delete set null,
  export_type text not null,
  file_name text not null,
  file_content text,
  storage_path text,
  created_at timestamptz default now()
);

create index if not exists etl_validation_scripts_project_id_idx on public.etl_validation_scripts(project_id);
create index if not exists etl_validation_scripts_user_id_idx on public.etl_validation_scripts(user_id);
create index if not exists etl_validation_scripts_analysis_run_id_idx on public.etl_validation_scripts(analysis_run_id);
create index if not exists etl_validation_scripts_script_type_idx on public.etl_validation_scripts(script_type);
create index if not exists etl_validation_scripts_database_type_idx on public.etl_validation_scripts(database_type);
create index if not exists etl_validation_scripts_validation_category_idx on public.etl_validation_scripts(validation_category);

create index if not exists etl_validation_packs_project_id_idx on public.etl_validation_packs(project_id);
create index if not exists etl_validation_packs_user_id_idx on public.etl_validation_packs(user_id);
create index if not exists etl_validation_packs_analysis_run_id_idx on public.etl_validation_packs(analysis_run_id);

create index if not exists etl_validation_pack_scripts_pack_id_idx on public.etl_validation_pack_scripts(pack_id);
create index if not exists etl_validation_pack_scripts_script_id_idx on public.etl_validation_pack_scripts(script_id);

create index if not exists etl_script_exports_project_id_idx on public.etl_script_exports(project_id);
create index if not exists etl_script_exports_user_id_idx on public.etl_script_exports(user_id);
create index if not exists etl_script_exports_pack_id_idx on public.etl_script_exports(pack_id);

alter table public.etl_validation_scripts enable row level security;
alter table public.etl_validation_packs enable row level security;
alter table public.etl_validation_pack_scripts enable row level security;
alter table public.etl_script_exports enable row level security;

drop policy if exists "Allow authenticated users to read ETL validation scripts" on public.etl_validation_scripts;
drop policy if exists "Allow authenticated users to insert ETL validation scripts" on public.etl_validation_scripts;
drop policy if exists "Allow authenticated users to update ETL validation scripts" on public.etl_validation_scripts;
drop policy if exists "Allow authenticated users to delete ETL validation scripts" on public.etl_validation_scripts;
drop policy if exists "Allow authenticated users to read ETL validation packs" on public.etl_validation_packs;
drop policy if exists "Allow authenticated users to insert ETL validation packs" on public.etl_validation_packs;
drop policy if exists "Allow authenticated users to update ETL validation packs" on public.etl_validation_packs;
drop policy if exists "Allow authenticated users to delete ETL validation packs" on public.etl_validation_packs;
drop policy if exists "Allow authenticated users to read ETL pack script links" on public.etl_validation_pack_scripts;
drop policy if exists "Allow authenticated users to insert ETL pack script links" on public.etl_validation_pack_scripts;
drop policy if exists "Allow authenticated users to delete ETL pack script links" on public.etl_validation_pack_scripts;
drop policy if exists "Allow authenticated users to read ETL script exports" on public.etl_script_exports;
drop policy if exists "Allow authenticated users to insert ETL script exports" on public.etl_script_exports;

drop policy if exists "Allow authenticated users to read ETL validation scripts" on public.etl_validation_scripts;
create policy "Allow authenticated users to read ETL validation scripts"
on public.etl_validation_scripts
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL validation scripts" on public.etl_validation_scripts;
create policy "Allow authenticated users to insert ETL validation scripts"
on public.etl_validation_scripts
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to update ETL validation scripts" on public.etl_validation_scripts;
create policy "Allow authenticated users to update ETL validation scripts"
on public.etl_validation_scripts
for update
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to delete ETL validation scripts" on public.etl_validation_scripts;
create policy "Allow authenticated users to delete ETL validation scripts"
on public.etl_validation_scripts
for delete
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to read ETL validation packs" on public.etl_validation_packs;
create policy "Allow authenticated users to read ETL validation packs"
on public.etl_validation_packs
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL validation packs" on public.etl_validation_packs;
create policy "Allow authenticated users to insert ETL validation packs"
on public.etl_validation_packs
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to update ETL validation packs" on public.etl_validation_packs;
create policy "Allow authenticated users to update ETL validation packs"
on public.etl_validation_packs
for update
to authenticated
using (user_id is null or user_id = auth.uid())
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to delete ETL validation packs" on public.etl_validation_packs;
create policy "Allow authenticated users to delete ETL validation packs"
on public.etl_validation_packs
for delete
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to read ETL pack script links" on public.etl_validation_pack_scripts;
create policy "Allow authenticated users to read ETL pack script links"
on public.etl_validation_pack_scripts
for select
to authenticated
using (
  exists (
    select 1
    from public.etl_validation_packs packs
    where packs.id = pack_id
    and (packs.user_id is null or packs.user_id = auth.uid())
  )
);

drop policy if exists "Allow authenticated users to insert ETL pack script links" on public.etl_validation_pack_scripts;
create policy "Allow authenticated users to insert ETL pack script links"
on public.etl_validation_pack_scripts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.etl_validation_packs packs
    where packs.id = pack_id
    and (packs.user_id is null or packs.user_id = auth.uid())
  )
);

drop policy if exists "Allow authenticated users to delete ETL pack script links" on public.etl_validation_pack_scripts;
create policy "Allow authenticated users to delete ETL pack script links"
on public.etl_validation_pack_scripts
for delete
to authenticated
using (
  exists (
    select 1
    from public.etl_validation_packs packs
    where packs.id = pack_id
    and (packs.user_id is null or packs.user_id = auth.uid())
  )
);

drop policy if exists "Allow authenticated users to read ETL script exports" on public.etl_script_exports;
create policy "Allow authenticated users to read ETL script exports"
on public.etl_script_exports
for select
to authenticated
using (user_id is null or user_id = auth.uid());

drop policy if exists "Allow authenticated users to insert ETL script exports" on public.etl_script_exports;
create policy "Allow authenticated users to insert ETL script exports"
on public.etl_script_exports
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

with ranked_scripts as (
  select
    id,
    row_number() over (
      partition by
        coalesce(analysis_run_id::text, ''),
        database_type,
        validation_category,
        coalesce(generated_from, ''),
        script_name
      order by created_at desc
    ) as duplicate_rank
  from public.etl_validation_scripts
)
delete from public.etl_validation_scripts scripts
using ranked_scripts ranked
where scripts.id = ranked.id
and ranked.duplicate_rank > 1;

update public.etl_validation_scripts
set confidence_score = 75,
    updated_at = now()
where coalesce(confidence_score, 0) = 0
and (source_table is not null or target_table is not null)
and (source_column is not null or target_column is not null)
and sql_text !~* '(TODO_|SOURCE_TABLE|TARGET_TABLE|SOURCE_COLUMN|TARGET_COLUMN)';

update public.etl_validation_scripts
set confidence_score = 65,
    updated_at = now()
where coalesce(confidence_score, 0) = 0
and (source_table is not null or target_table is not null)
and sql_text !~* '(TODO_|SOURCE_TABLE|TARGET_TABLE|SOURCE_COLUMN|TARGET_COLUMN)';

update public.etl_validation_scripts
set confidence_score = 40,
    updated_at = now()
where coalesce(confidence_score, 0) = 0;
