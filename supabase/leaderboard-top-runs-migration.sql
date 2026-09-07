-- supabase/leaderboard-top-runs-migration.sql
-- Run once in the Supabase SQL Editor after the existing setup.sql.
-- Changes the leaderboard from one PB row per user/mode to top completed runs,
-- allows the same user to appear multiple times, and adds Level 0 support.

begin;

drop index if exists public.leaderboard_scores_personal_best_uidx;
drop index if exists public.leaderboard_scores_user_best_idx;

create index if not exists leaderboard_scores_user_runs_idx
  on public.leaderboard_scores (
    user_id,
    level_key,
    mode,
    time_seconds,
    created_at
  );

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_level_key_check;

alter table public.leaderboard_scores
  add constraint leaderboard_scores_level_key_check
  check (
    level_key in (
      'level0',
      'level1',
      'level2',
      'level3'
    )
  );

alter table public.leaderboard_runs
  drop constraint if exists leaderboard_runs_level_key_check;

alter table public.leaderboard_runs
  add constraint leaderboard_runs_level_key_check
  check (
    level_key in (
      'level0',
      'level1',
      'level2',
      'level3'
    )
  );

create or replace function public.start_leaderboard_run(
  p_level_key text,
  p_mode text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_run_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_level_key not in (
    'level0',
    'level1',
    'level2',
    'level3'
  ) then
    raise exception 'Invalid level';
  end if;

  if p_mode not in ('2d', '3d') then
    raise exception 'Invalid mode';
  end if;

  delete from public.leaderboard_runs
  where user_id = current_user_id;

  insert into public.leaderboard_runs (
    user_id,
    level_key,
    mode
  )
  values (
    current_user_id,
    p_level_key,
    p_mode
  )
  returning id into new_run_id;

  return new_run_id;
end;
$$;

revoke all
  on function public.start_leaderboard_run(text, text)
  from public, anon;

grant execute
  on function public.start_leaderboard_run(text, text)
  to authenticated;

create or replace function public.finish_leaderboard_run(
  p_run_id uuid,
  p_player_name text,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  run_record public.leaderboard_runs%rowtype;
  clean_name text := nullif(
    left(trim(coalesce(p_player_name, '')), 20),
    ''
  );
  clean_country text :=
    nullif(
      upper(trim(coalesce(p_country_code, ''))),
      ''
    );
  elapsed_seconds numeric;
  rounded_seconds numeric(10, 3);
  minimum_seconds numeric;
  previous_best numeric;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.leaderboard_runs
  where id = p_run_id
    and user_id = current_user_id
  returning * into run_record;

  if not found then
    raise exception
      'Leaderboard run is missing or already finished';
  end if;

  elapsed_seconds := extract(
    epoch from (
      clock_timestamp() - run_record.started_at
    )
  );

  minimum_seconds := case run_record.level_key
    when 'level0' then 1
    when 'level1' then 2
    when 'level2' then 3
    when 'level3' then 4
    else 2
  end;

  if elapsed_seconds < minimum_seconds
     or elapsed_seconds >= 21600 then
    raise exception
      'Leaderboard run duration is invalid';
  end if;

  rounded_seconds := round(elapsed_seconds, 3);

  if clean_country is not null
     and clean_country !~ '^[A-Z]{2}$' then
    clean_country := null;
  end if;

  select min(scores.time_seconds)
  into previous_best
  from public.leaderboard_scores as scores
  where scores.user_id = current_user_id
    and scores.level_key = run_record.level_key
    and scores.mode = run_record.mode;

  insert into public.leaderboard_scores (
    user_id,
    player_name,
    level_key,
    mode,
    time_seconds,
    country_code,
    created_at
  )
  values (
    current_user_id,
    coalesce(clean_name, 'You'),
    run_record.level_key,
    run_record.mode,
    rounded_seconds,
    clean_country,
    clock_timestamp()
  );

  return jsonb_build_object(
    'improved',
    previous_best is null
      or rounded_seconds < previous_best,
    'timeSeconds',
    rounded_seconds
  );
end;
$$;

revoke all
  on function public.finish_leaderboard_run(
    uuid,
    text,
    text
  )
  from public, anon;

grant execute
  on function public.finish_leaderboard_run(
    uuid,
    text,
    text
  )
  to authenticated;

create or replace function public.get_global_leaderboard()
returns table (
  level_key text,
  mode text,
  player_name text,
  country_code text,
  time_seconds numeric,
  created_at timestamptz,
  global_rank bigint,
  is_current_user boolean
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      scores.id,
      scores.user_id,
      scores.level_key,
      scores.mode,
      scores.player_name,
      scores.country_code,
      scores.time_seconds,
      scores.created_at,
      row_number() over (
        partition by
          scores.level_key,
          scores.mode
        order by
          scores.time_seconds asc,
          scores.created_at asc,
          scores.id asc
      ) as global_rank,
      row_number() over (
        partition by
          scores.user_id,
          scores.level_key,
          scores.mode
        order by
          scores.time_seconds asc,
          scores.created_at asc,
          scores.id asc
      ) as user_best_rank
    from public.leaderboard_scores as scores
  )
  select
    ranked.level_key,
    ranked.mode,
    ranked.player_name,
    ranked.country_code,
    ranked.time_seconds,
    ranked.created_at,
    ranked.global_rank,
    (
      ranked.user_id = (select auth.uid())
      and ranked.user_best_rank = 1
    ) as is_current_user
  from ranked
  where
    ranked.global_rank <= 10
    or (
      ranked.user_id = (select auth.uid())
      and ranked.user_best_rank = 1
    )
  order by
    ranked.level_key,
    ranked.mode,
    ranked.global_rank;
$$;

revoke all
  on function public.get_global_leaderboard()
  from public, anon;

grant execute
  on function public.get_global_leaderboard()
  to authenticated;

commit;
