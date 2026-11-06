// Exercises analytics SQL in an isolated in-memory PostgreSQL database.
// Supply PGLITE_MODULE_PATH to use an external installation without changing dependencies.
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../', import.meta.url));
const migration=readFileSync(`${root}/supabase/developer-analytics.sql`,'utf8');
const hotfix=readFileSync(`${root}/supabase/analytics-timestamp-hotfix.sql`,'utf8');
const setup=readFileSync(`${root}/supabase/setup.sql`,'utf8');
const uid='00000000-0000-4000-8000-000000000001';
const player='00000000-0000-4000-8000-000000000002';
const signature='public.record_developer_usage_server(uuid,text,text,integer,text)';
const reports=[];
async function boot(){
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${uid}'),('${player}');`);
  return db;
}
async function call(db,event,seconds=0){
  await db.exec('set role service_role');
  try {return await db.query('select public.record_developer_usage_server($1,$2,$3,$4,$5)',[player,event,event==='donation'?'1':null,seconds,'Analytics test']);}
  finally {await db.exec('reset role');}
}
async function permissions(db){
  const result=await db.query(`select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as authenticated,has_function_privilege('service_role',$1,'execute') as service_role`,[signature]);
  assert.deepEqual(result.rows[0],{anon:false,authenticated:false,service_role:true});
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    try {await assert.rejects(db.query('select public.record_developer_usage_server($1,$2)',[player,'visitor']),e=>e.code==='42501');}
    finally{await db.exec('reset role');}
  }
  return result.rows[0];
}
async function exercise(db){
  await call(db,'visitor');
  await call(db,'game_start');
  await db.query("update public.developer_usage_stats set active_run_started_at=clock_timestamp()-interval '60 seconds',last_playtime_at=clock_timestamp()-interval '10 seconds' where user_id=$1",[player]);
  await call(db,'playtime',7);
  let row=(await db.query('select * from public.developer_usage_stats where user_id=$1',[player])).rows[0];
  assert.equal(row.seconds_played,7);
  await db.query("update public.developer_usage_stats set last_playtime_at=clock_timestamp()-interval '10 seconds' where user_id=$1",[player]);
  await call(db,'game_finish',4);
  await call(db,'donation');
  row=(await db.query('select games_started,games_finished,seconds_played,donation_1_attempts,active_run_started_at,last_playtime_at from public.developer_usage_stats where user_id=$1',[player])).rows[0];
  assert.deepEqual(row,{games_started:1,games_finished:1,seconds_played:11,donation_1_attempts:1,active_run_started_at:null,last_playtime_at:null});
  return row;
}
const repaired=await boot();
try{
  await repaired.exec(migration.replaceAll(/\bv_event_time\b/g,'current_time'));
  await assert.rejects(call(repaired,'visitor'),error=>error.code==='42804');
  await repaired.query('insert into public.developer_usage_stats(user_id,last_player_name,games_started,games_finished,seconds_played,donation_2_attempts) values($1,$2,7,4,100,2)',[uid,'Existing player']);
  const before=(await repaired.query('select * from public.developer_usage_stats where user_id=$1',[uid])).rows;
  await repaired.exec(hotfix);
  assert.deepEqual((await repaired.query('select * from public.developer_usage_stats where user_id=$1',[uid])).rows,before);
  const outcome=await exercise(repaired);
  const allBeforeRepeat=(await repaired.query('select * from public.developer_usage_stats order by user_id')).rows;
  await repaired.exec(hotfix);
  assert.deepEqual((await repaired.query('select * from public.developer_usage_stats order by user_id')).rows,allBeforeRepeat);
  reports.push({scenario:'hotfix on broken database',existingDataPreserved:true,idempotent:true,outcome,permissions:await permissions(repaired)});
}finally{await repaired.close();}
const fresh=await boot();
try{
  await fresh.exec(migration);
  reports.push({scenario:'fixed canonical full migration',outcome:await exercise(fresh),permissions:await permissions(fresh)});
}finally{await fresh.close();}
const setupFunction=setup.match(/create or replace function public\.record_developer_usage_server\([\s\S]*?\$\$;/)?.[0];
assert.ok(setupFunction);
const freshSetup=await boot();
try{
  await freshSetup.exec(migration);
  await freshSetup.exec(setupFunction);
  reports.push({scenario:'function copied from fixed setup.sql',outcome:await exercise(freshSetup),permissions:await permissions(freshSetup)});
}finally{await freshSetup.close();}
console.log(JSON.stringify({passed:true,reports},null,2));
