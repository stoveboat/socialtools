-- Initial schema for the script diagnostic tool.
-- See design doc 05_data_schema.md for the source of truth.

-- ============================================================================
-- pieces
-- ============================================================================
create table pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled piece',
  current_phase text not null default 'phase_0',
  source_script text not null,
  refined_script text,
  word_count int generated always as (
    array_length(regexp_split_to_array(source_script, '\s+'), 1)
  ) stored,
  estimated_seconds int generated always as (
    array_length(regexp_split_to_array(source_script, '\s+'), 1) * 60 / 150
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pieces_user_id_idx on pieces(user_id);
create index pieces_updated_at_idx on pieces(updated_at desc);

-- ============================================================================
-- phase_0_contexts
-- ============================================================================
create table phase_0_contexts (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  topic_summary text,
  audience_candidates jsonb,
  channel_candidates jsonb,
  is_low_confidence boolean default false,
  evidence_notes text,
  audience_selection text,
  custom_audience text,
  channel_selection text,
  custom_channel text,
  traction_selection text,
  custom_traction text,
  created_at timestamptz not null default now()
);

create index phase_0_contexts_piece_id_idx on phase_0_contexts(piece_id);

-- ============================================================================
-- diagnostics
-- ============================================================================
create table diagnostics (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  script_version text not null,
  routing_recommendation text,
  overall_label text,
  created_at timestamptz not null default now()
);

create index diagnostics_piece_id_idx on diagnostics(piece_id);

-- ============================================================================
-- dimension_grades
-- ============================================================================
create table dimension_grades (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references diagnostics(id) on delete cascade,
  dimension_id text not null,
  dimension_name text not null,
  grade text not null,
  evidence text not null,
  repair_suggestion text,
  user_overridden_grade text,
  created_at timestamptz not null default now()
);

create index dimension_grades_diagnostic_id_idx on dimension_grades(diagnostic_id);
create index dimension_grades_dimension_id_idx on dimension_grades(dimension_id);

-- ============================================================================
-- repair_plans
-- ============================================================================
create table repair_plans (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  diagnostic_id uuid not null references diagnostics(id) on delete cascade,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index repair_plans_piece_id_idx on repair_plans(piece_id);

-- ============================================================================
-- repair_choices
-- ============================================================================
create table repair_choices (
  id uuid primary key default gen_random_uuid(),
  repair_plan_id uuid not null references repair_plans(id) on delete cascade,
  dimension_id text not null,
  chosen_fix text not null,
  custom_fix text,
  status text not null default 'pending',
  applied_at timestamptz,
  original_sentences jsonb,
  replacement_sentences jsonb,
  user_edited_replacement text,
  created_at timestamptz not null default now()
);

create index repair_choices_repair_plan_id_idx on repair_choices(repair_plan_id);

-- ============================================================================
-- derivation_briefs
-- ============================================================================
create table derivation_briefs (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  source_script_version text not null,
  format text not null,
  register text not null,
  brief_content jsonb not null,
  status text not null default 'generated',
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

create index derivation_briefs_piece_id_idx on derivation_briefs(piece_id);
create unique index derivation_briefs_piece_format_active_idx
  on derivation_briefs(piece_id, format)
  where status != 'discarded';

-- ============================================================================
-- skeleton_modes
-- ============================================================================
create table skeleton_modes (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  diagnostic_id uuid not null references diagnostics(id) on delete cascade,
  salvageable_seeds jsonb,
  selected_seed jsonb,
  selected_audience text,
  selected_payoff_type text,
  generated_skeleton jsonb,
  user_filled_skeleton text,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index skeleton_modes_piece_id_idx on skeleton_modes(piece_id);

-- ============================================================================
-- usage_events
-- ============================================================================
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  piece_id uuid references pieces(id) on delete set null,
  event_type text not null,
  event_data jsonb,
  created_at timestamptz not null default now()
);

create index usage_events_user_id_idx on usage_events(user_id);
create index usage_events_event_type_idx on usage_events(event_type);
create index usage_events_created_at_idx on usage_events(created_at desc);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

-- pieces: owned directly by the user.
alter table pieces enable row level security;

create policy "pieces_select_own"
  on pieces for select
  using (auth.uid() = user_id);

create policy "pieces_insert_own"
  on pieces for insert
  with check (auth.uid() = user_id);

create policy "pieces_update_own"
  on pieces for update
  using (auth.uid() = user_id);

create policy "pieces_delete_own"
  on pieces for delete
  using (auth.uid() = user_id);

-- Helper: child tables route through the parent piece's user_id.
-- A reusable function keeps the policies consistent.
create or replace function public.user_owns_piece(piece uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pieces
    where pieces.id = piece
      and pieces.user_id = auth.uid()
  );
$$;

-- phase_0_contexts
alter table phase_0_contexts enable row level security;
create policy "phase_0_contexts_select" on phase_0_contexts for select
  using (public.user_owns_piece(piece_id));
create policy "phase_0_contexts_insert" on phase_0_contexts for insert
  with check (public.user_owns_piece(piece_id));
create policy "phase_0_contexts_update" on phase_0_contexts for update
  using (public.user_owns_piece(piece_id));
create policy "phase_0_contexts_delete" on phase_0_contexts for delete
  using (public.user_owns_piece(piece_id));

-- diagnostics
alter table diagnostics enable row level security;
create policy "diagnostics_select" on diagnostics for select
  using (public.user_owns_piece(piece_id));
create policy "diagnostics_insert" on diagnostics for insert
  with check (public.user_owns_piece(piece_id));
create policy "diagnostics_update" on diagnostics for update
  using (public.user_owns_piece(piece_id));
create policy "diagnostics_delete" on diagnostics for delete
  using (public.user_owns_piece(piece_id));

-- dimension_grades: routed through diagnostic -> piece.
alter table dimension_grades enable row level security;
create policy "dimension_grades_select" on dimension_grades for select
  using (
    exists (
      select 1 from diagnostics
      where diagnostics.id = dimension_grades.diagnostic_id
        and public.user_owns_piece(diagnostics.piece_id)
    )
  );
create policy "dimension_grades_insert" on dimension_grades for insert
  with check (
    exists (
      select 1 from diagnostics
      where diagnostics.id = dimension_grades.diagnostic_id
        and public.user_owns_piece(diagnostics.piece_id)
    )
  );
create policy "dimension_grades_update" on dimension_grades for update
  using (
    exists (
      select 1 from diagnostics
      where diagnostics.id = dimension_grades.diagnostic_id
        and public.user_owns_piece(diagnostics.piece_id)
    )
  );
create policy "dimension_grades_delete" on dimension_grades for delete
  using (
    exists (
      select 1 from diagnostics
      where diagnostics.id = dimension_grades.diagnostic_id
        and public.user_owns_piece(diagnostics.piece_id)
    )
  );

-- repair_plans
alter table repair_plans enable row level security;
create policy "repair_plans_select" on repair_plans for select
  using (public.user_owns_piece(piece_id));
create policy "repair_plans_insert" on repair_plans for insert
  with check (public.user_owns_piece(piece_id));
create policy "repair_plans_update" on repair_plans for update
  using (public.user_owns_piece(piece_id));
create policy "repair_plans_delete" on repair_plans for delete
  using (public.user_owns_piece(piece_id));

-- repair_choices: routed through repair_plan -> piece.
alter table repair_choices enable row level security;
create policy "repair_choices_select" on repair_choices for select
  using (
    exists (
      select 1 from repair_plans
      where repair_plans.id = repair_choices.repair_plan_id
        and public.user_owns_piece(repair_plans.piece_id)
    )
  );
create policy "repair_choices_insert" on repair_choices for insert
  with check (
    exists (
      select 1 from repair_plans
      where repair_plans.id = repair_choices.repair_plan_id
        and public.user_owns_piece(repair_plans.piece_id)
    )
  );
create policy "repair_choices_update" on repair_choices for update
  using (
    exists (
      select 1 from repair_plans
      where repair_plans.id = repair_choices.repair_plan_id
        and public.user_owns_piece(repair_plans.piece_id)
    )
  );
create policy "repair_choices_delete" on repair_choices for delete
  using (
    exists (
      select 1 from repair_plans
      where repair_plans.id = repair_choices.repair_plan_id
        and public.user_owns_piece(repair_plans.piece_id)
    )
  );

-- derivation_briefs
alter table derivation_briefs enable row level security;
create policy "derivation_briefs_select" on derivation_briefs for select
  using (public.user_owns_piece(piece_id));
create policy "derivation_briefs_insert" on derivation_briefs for insert
  with check (public.user_owns_piece(piece_id));
create policy "derivation_briefs_update" on derivation_briefs for update
  using (public.user_owns_piece(piece_id));
create policy "derivation_briefs_delete" on derivation_briefs for delete
  using (public.user_owns_piece(piece_id));

-- skeleton_modes
alter table skeleton_modes enable row level security;
create policy "skeleton_modes_select" on skeleton_modes for select
  using (public.user_owns_piece(piece_id));
create policy "skeleton_modes_insert" on skeleton_modes for insert
  with check (public.user_owns_piece(piece_id));
create policy "skeleton_modes_update" on skeleton_modes for update
  using (public.user_owns_piece(piece_id));
create policy "skeleton_modes_delete" on skeleton_modes for delete
  using (public.user_owns_piece(piece_id));

-- usage_events: a user reads only their own events; writes always require the
-- caller to be the row's user.
alter table usage_events enable row level security;
create policy "usage_events_select_own" on usage_events for select
  using (auth.uid() = user_id);
create policy "usage_events_insert_own" on usage_events for insert
  with check (auth.uid() = user_id);
