-- supabase/developer-analytics.sql
-- Canonical Mist Maze developer analytics migration.
-- Safe to re-run.
--
-- This replaces the older browser-callable record_developer_usage RPC
-- with a server-only RPC used by /api/developer-usage.

begin;

create table if not exists public.developer_usage_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_player_name text
    check (
      last_player_name is null
      or char_length(last_player_name) between 1 and 20
    ),
  games_started bigint not null default 0
    check (games_started >= 0),
  games_finished bigint not null default 0
    check (games_finished >= 0),
  seconds_played bigint not null default 0
    check (seconds_played >= 0),
  donation_1_attempts bigint not null default 0
    check (donation_1_attempts >= 0),
  donation_2_attempts bigint not null default 0
    check (donation_2_attempts >= 0),
  donation_5_attempts bigint not null default 0
    check (donation_5_attempts >= 0),
  donation_custom_attempts bigint not null default 0
    check (donation_custom_attempts >= 0),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.developer_usage_stats
  add column if not exists active_run_started_at timestamptz;

alter table public.developer_usage_stats
  add column if not exists last_playtime_at timestamptz;

alter table public.developer_usage_stats
  add column if not exists last_game_start_at timestamptz;

alter table public.developer_usage_stats
  add column if not exists last_donation_at timestamptz;

create index if not exists developer_usage_stats_last_seen_idx
  on public.developer_usage_stats (last_seen_at desc);

alter table public.developer_usage_stats
  enable row level security;

revoke all
  on table public.developer_usage_stats
  from anon, authenticated;

grant select
  on table public.developer_usage_stats
  to service_role;

drop function if exists public.record_developer_usage(
  text,
  text,
  integer,
  text
);

create or replace function public.record_developer_usage_server(
  p_user_id uuid,
  p_event text,
  p_donation_key text default null,
  p_seconds integer default 0,
  p_player_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_time timestamptz := clock_timestamp();

  clean_name text := nullif(
    left(trim(coalesce(p_player_name, '')), 20),
    ''
  );

  safe_seconds integer := greatest(
    0,
    least(coalesce(p_seconds, 0), 120)
  );

  wall_seconds integer := 0;
  credited_seconds integer := 0;

  stats public.developer_usage_stats%rowtype;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if p_event is null
     or p_event not in (
       'visitor',
       'game_start',
       'game_finish',
       'playtime',
       'donation'
     ) then
    raise exception 'Invalid analytics event';
  end if;

  if p_event = 'donation'
     and (
       p_donation_key is null
       or p_donation_key not in (
         '1',
         '2',
         '5',
         'custom'
       )
     ) then
    raise exception 'Invalid donation key';
  end if;

  insert into public.developer_usage_stats (
    user_id,
    last_player_name,
    last_seen_at
  )
  values (
    p_user_id,
    clean_name,
    current_time
  )
  on conflict (user_id) do nothing;

  select *
  into stats
  from public.developer_usage_stats
  where user_id = p_user_id
  for update;

  if stats.active_run_started_at is not null then
    wall_seconds := greatest(
      0,
      floor(
        extract(
          epoch from (
            current_time
            - coalesce(
              stats.last_playtime_at,
              stats.active_run_started_at
            )
          )
        )
      )::integer
    );
  end if;

  if p_event = 'visitor' then
    update public.developer_usage_stats
    set
      last_player_name = coalesce(
        clean_name,
        last_player_name
      ),
      last_seen_at = current_time
    where user_id = p_user_id;

    return;
  end if;

  if p_event = 'game_start' then
    if stats.last_game_start_at is null
       or current_time - stats.last_game_start_at
          >= interval '2 seconds' then

      credited_seconds := least(
        wall_seconds,
        120
      );

      update public.developer_usage_stats
      set
        last_player_name = coalesce(
          clean_name,
          last_player_name
        ),
        games_started = games_started + 1,
        seconds_played =
          seconds_played + credited_seconds,
        active_run_started_at = current_time,
        last_playtime_at = current_time,
        last_game_start_at = current_time,
        last_seen_at = current_time
      where user_id = p_user_id;
    else
      update public.developer_usage_stats
      set
        last_player_name = coalesce(
          clean_name,
          last_player_name
        ),
        last_seen_at = current_time
      where user_id = p_user_id;
    end if;

    return;
  end if;

  if p_event = 'playtime' then
    if stats.active_run_started_at is not null then
      credited_seconds := least(
        safe_seconds,
        wall_seconds,
        120
      );

      update public.developer_usage_stats
      set
        last_player_name = coalesce(
          clean_name,
          last_player_name
        ),
        seconds_played =
          seconds_played + credited_seconds,
        last_playtime_at = current_time,
        last_seen_at = current_time
      where user_id = p_user_id;
    end if;

    return;
  end if;

  if p_event = 'game_finish' then
    if stats.active_run_started_at is not null
       and current_time - stats.active_run_started_at
          >= interval '1 second' then

      credited_seconds := least(
        safe_seconds,
        wall_seconds,
        120
      );

      update public.developer_usage_stats
      set
        last_player_name = coalesce(
          clean_name,
          last_player_name
        ),
        games_finished = games_finished + 1,
        seconds_played =
          seconds_played + credited_seconds,
        active_run_started_at = null,
        last_playtime_at = null,
        last_seen_at = current_time
      where user_id = p_user_id;
    end if;

    return;
  end if;

  if p_event = 'donation' then
    if stats.last_donation_at is null
       or current_time - stats.last_donation_at
          >= interval '2 seconds' then

      update public.developer_usage_stats
      set
        donation_1_attempts =
          donation_1_attempts
          + case
              when p_donation_key = '1' then 1
              else 0
            end,
        donation_2_attempts =
          donation_2_attempts
          + case
              when p_donation_key = '2' then 1
              else 0
            end,
        donation_5_attempts =
          donation_5_attempts
          + case
              when p_donation_key = '5' then 1
              else 0
            end,
        donation_custom_attempts =
          donation_custom_attempts
          + case
              when p_donation_key = 'custom' then 1
              else 0
            end,
        last_donation_at = current_time,
        last_seen_at = current_time
      where user_id = p_user_id;
    else
      update public.developer_usage_stats
      set last_seen_at = current_time
      where user_id = p_user_id;
    end if;
  end if;
end;
$$;

revoke all
  on function public.record_developer_usage_server(
    uuid,
    text,
    text,
    integer,
    text
  )
  from public, anon, authenticated;

grant execute
  on function public.record_developer_usage_server(
    uuid,
    text,
    text,
    integer,
    text
  )
  to service_role;

commit;
