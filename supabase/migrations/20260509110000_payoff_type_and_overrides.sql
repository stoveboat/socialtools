-- Idempotent: safe to re-run. The column-add and table-create use IF NOT
-- EXISTS; policies are dropped-then-recreated since CREATE POLICY doesn't
-- support IF NOT EXISTS until Postgres 17.

-- Locked payoff type chosen during Pass 1's directional UI. Used as input to
-- payoff-aware grading rubrics (e.g. Specificity) on subsequent re-grades.
alter table pieces add column if not exists locked_payoff_type text;

-- Per-dimension user overrides. The user marks a weak dimension as
-- "intentional" so the diagnostic surface stops surfacing it as needing
-- repair, while the grade itself stays in the diagnostic for transparency.
--
-- Two scopes:
--   'piece' - persistent until the user removes the override
--   'pass'  - applies to the currently active diagnostic only; cleared when
--             a new diagnostic is created (i.e., when a pass is accepted)
create table if not exists dimension_overrides (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  dimension_id text not null,
  scope text not null default 'piece' check (scope in ('piece', 'pass')),
  reason text,
  created_at timestamptz not null default now(),
  unique(piece_id, dimension_id)
);

create index if not exists dimension_overrides_piece_id_idx
  on dimension_overrides(piece_id);

alter table dimension_overrides enable row level security;

drop policy if exists "dimension_overrides_select" on dimension_overrides;
drop policy if exists "dimension_overrides_insert" on dimension_overrides;
drop policy if exists "dimension_overrides_update" on dimension_overrides;
drop policy if exists "dimension_overrides_delete" on dimension_overrides;

create policy "dimension_overrides_select" on dimension_overrides for select
  using (public.user_owns_piece(piece_id));
create policy "dimension_overrides_insert" on dimension_overrides for insert
  with check (public.user_owns_piece(piece_id));
create policy "dimension_overrides_update" on dimension_overrides for update
  using (public.user_owns_piece(piece_id));
create policy "dimension_overrides_delete" on dimension_overrides for delete
  using (public.user_owns_piece(piece_id));
