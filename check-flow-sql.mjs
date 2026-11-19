import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "./.mob-build/sql-check/node_modules/@electric-sql/pglite/dist/index.js";
const db=new PGlite();
await db.exec([
  "create role anon; create role authenticated; create role service_role; create schema auth;",
  "create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "grant usage on schema auth to anon,authenticated;"
].join("\n"));
for (const file of ["schema.sql","supabase/migrations/20261115140000_mob_accounts.sql","supabase/flow-budget.sql",
  "supabase/migrations/20261115150000_mob_flow.sql","supabase/flow-background.sql","supabase/usage-rules.sql"]) await db.exec(await readFile(file,"utf8"));
const owner="00000000-0000-4000-8000-000000000001";
const other="00000000-0000-4000-8000-000000000002";
const device="00000000-0000-4000-8000-000000000003";
const second="00000000-0000-4000-8000-000000000004";
const token="a".repeat(64);
await db.query("insert into auth.users(id) values($1),($2)",[owner,other]);
await db.query("insert into public.mob_companion(user_id,device_id,token_hash,device_kind) values($1,$2,$3,'browser')",
  [owner,device,createHash("sha256").update(token).digest("hex")]);
const hour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
const row={hour,source:"website",label:"example.app",seconds:35,visits:1};
const mobile=async (epoch=0,batch=[row])=>(await db.query("select public.mob_flow_browser($1,$2,$3::jsonb) as value",[token,epoch,JSON.stringify(batch)])).rows[0].value;
await db.exec("set role anon");
await assert.rejects(db.query("select public.mob_flow_mobile($1,0,'[]'::jsonb)",[token]),/permission denied/);
assert.equal((await mobile()).epoch,0);
await mobile();
await db.exec("reset role; set role authenticated");
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
await db.query("insert into public.mob_settings(user_id,timer_state) values($1,$2::jsonb)",
  [owner,JSON.stringify({updatedAt:2000,mode:"focus"})]);
await db.query("insert into public.mob_tasks(user_id,id,title) values($1,$2,'Task revision fixture')",[owner,second]);
assert.equal(Number((await db.query("select public.mob_task_revision() as version")).rows[0].version),1);
await db.query("update public.mob_tasks set title='Edited' where id=$1",[second]);
assert.equal(Number((await db.query("select public.mob_task_revision() as version")).rows[0].version),2);
await db.query("update public.mob_settings set timer_state=$1::jsonb where user_id=$2",
  [JSON.stringify({updatedAt:1000,mode:"short"}),owner]);
assert.equal((await db.query("select timer_state from public.mob_settings where user_id=$1",[owner])).rows[0].timer_state.updatedAt,2000);
const snapshot=async ()=>(await db.query("select public.mob_flow_snapshot_device($1) as value",[device])).rows[0].value;
assert.equal((await snapshot()).items[0][2],35,"Retry duplicated mobile usage");
await db.exec("reset role");
await db.query("insert into public.mob_companion(user_id,device_id,token_hash) values($1,$2,$3)",[owner,second,createHash("sha256").update("b".repeat(64)).digest("hex")]);
await db.exec("set role anon");
await db.query("select public.mob_flow_browser($1,0,$2::jsonb)",["b".repeat(64),JSON.stringify([{...row,seconds:15}])]);
await db.exec("reset role; set role authenticated");
assert.equal((await snapshot()).items[0][2],50,"Second device missing");
assert.equal((await snapshot()).own[0][3],35,"Own-device baseline incorrect");
await db.query("select public.mob_flow_manage('hide','website:example.app')");
assert.equal((await snapshot()).items.length,0);
assert.equal((await snapshot()).catalog.length,1,"Hiding removed limit-picker history");
assert.equal((await snapshot()).totals[0][2],50,"Hiding bypassed daily limit totals");
await db.query("select public.mob_flow_manage('show','website:example.app')");
assert.equal((await snapshot()).items.length,1);
const epoch=Number((await db.query("select public.mob_flow_manage('clear',null) as epoch")).rows[0].epoch);
await db.exec("reset role; set role anon");
assert.equal((await mobile()).epoch,epoch);
await db.exec("reset role; set role authenticated");
assert.equal((await snapshot()).items.length,0,"Old upload restored cleared data");
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
assert.equal((await snapshot()).items.length,0,"Other account could read usage");
await db.exec("reset role; set role anon");
await assert.rejects(mobile(epoch,[{...row,source:"desktop"}]),/invalid_parameter_value|invalid parameter/i);
await assert.rejects(db.query("select * from mob_internal.flow_activity"),/permission denied/);
await db.exec("reset role; set role authenticated");
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
await assert.rejects(db.query("select public.mob_delete_account($1)",[other]),/insufficient_privilege|permission denied/i);
await db.query("select public.mob_delete_account($1)",[owner]);
await db.exec("reset role");
assert.equal((await db.query("select count(*) as total from auth.users where id=$1",[owner])).rows[0].total,0);
assert.equal((await db.query("select count(*) as total from auth.users where id=$1",[other])).rows[0].total,1);
await db.close();
console.log("Flow SQL passed — two devices, retries, scoped tokens, hide/unhide, clear generations and RLS.");
