-- Mist Maze private developer analytics.
-- Run this once in Supabase Dashboard -> SQL Editor.
-- Players can write only their own aggregate counters through the RPC.
-- Players have no SELECT access to this table.

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

alter table public.developer_usage_stats enable row level security;

revoke all on table public.developer_usage_stats from anon;
revoke all on table public.developer_usage_stats from authenticated;

create or replace function public.record_developer_usage(
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
  current_user_id uuid := auth.uid();
  clean_name text := nullif(
    left(trim(coalesce(p_player_name, '')), 20),
    ''
  );
  safe_seconds integer := greatest(
    0,
    least(coalesce(p_seconds, 0), 120)
  );
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_event is null
     or p_event not in ('game_start', 'game_finish', 'playtime', 'donation') then
    raise exception 'Invalid analytics event';
  end if;

  if p_event = 'donation'
     and (
       p_donation_key is null
       or p_donation_key not in ('1', '2', '5', 'custom')
     ) then
    raise exception 'Invalid donation key';
  end if;

  insert into public.developer_usage_stats (
    user_id,
    last_player_name,
    games_started,
    games_finished,
    seconds_played,
    donation_1_attempts,
    donation_2_attempts,
    donation_5_attempts,
    donation_custom_attempts,
    last_seen_at
  )
  values (
    current_user_id,
    clean_name,
    case when p_event = 'game_start' then 1 else 0 end,
    case when p_event = 'game_finish' then 1 else 0 end,
    case when p_event = 'playtime' then safe_seconds else 0 end,
    case when p_event = 'donation' and p_donation_key = '1' then 1 else 0 end,
    case when p_event = 'donation' and p_donation_key = '2' then 1 else 0 end,
    case when p_event = 'donation' and p_donation_key = '5' then 1 else 0 end,
    case when p_event = 'donation' and p_donation_key = 'custom' then 1 else 0 end,
    now()
  )
  on conflict (user_id)
  do update set
    last_player_name = coalesce(
      excluded.last_player_name,
      developer_usage_stats.last_player_name
    ),
    games_started =
      developer_usage_stats.games_started + excluded.games_started,
    games_finished =
      developer_usage_stats.games_finished + excluded.games_finished,
    seconds_played =
      developer_usage_stats.seconds_played + excluded.seconds_played,
    donation_1_attempts =
      developer_usage_stats.donation_1_attempts
      + excluded.donation_1_attempts,
    donation_2_attempts =
      developer_usage_stats.donation_2_attempts
      + excluded.donation_2_attempts,
    donation_5_attempts =
      developer_usage_stats.donation_5_attempts
      + excluded.donation_5_attempts,
    donation_custom_attempts =
      developer_usage_stats.donation_custom_attempts
      + excluded.donation_custom_attempts,
    last_seen_at = now();
end;
$$;

revoke all
  on function public.record_developer_usage(text, text, integer, text)
  from public;

grant execute
  on function public.record_developer_usage(text, text, integer, text)
  to authenticated;
