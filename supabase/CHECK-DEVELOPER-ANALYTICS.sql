-- Read-only developer analytics verification.

select
  to_regclass(
    'public.developer_usage_stats'
  ) is not null as usage_table_exists,
  to_regprocedure(
    'public.record_developer_usage_server(uuid,text,text,integer,text)'
  ) is not null as server_rpc_exists,
  has_function_privilege(
    'service_role',
    'public.record_developer_usage_server(uuid,text,text,integer,text)',
    'EXECUTE'
  ) as service_role_can_execute;

select
  count(*) as tracked_users,
  coalesce(sum(games_started), 0) as games_started,
  coalesce(sum(games_finished), 0) as games_finished,
  coalesce(sum(seconds_played), 0) as seconds_played,
  coalesce(sum(donation_1_attempts), 0)
    + coalesce(sum(donation_2_attempts), 0)
    + coalesce(sum(donation_5_attempts), 0)
    + coalesce(sum(donation_custom_attempts), 0)
      as donation_clicks
from public.developer_usage_stats;
