import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from './.mob-build/web-check/node_modules/jsdom/lib/api.js';
import {settingsQueue} from './dist/settings-queue.js';
const dom=new JSDOM('',{url:'http://localhost:4173',runScripts:'outside-only'}), w=dom.window;
let auth, online=false;
const writes=[], rows=new Map();
Object.defineProperty(w.navigator,'onLine',{get:()=>online});
w.settingsQueue=settingsQueue;
w.supabaseConfig={};
w.dayKey=()=> '2026-11-18';w.offsetDay=()=> '2026-11-05';
w.fixture={createClient:()=>({rpc:async()=>({data:1,error:null}),auth:{onAuthStateChange:handler=>{auth=handler;}},from:()=>{
 let pending, id;
 const query={select(){return this;},eq(k,v){if(k==='id')id=v;return this;},order(){return this;},range(){return this;},
 upsert(row){pending=()=>{writes.push(row); rows.set(row.id,{...rows.get(row.id),...row});};return this;},
 delete(){pending=()=>{rows.delete(id);};return this;},
 then(ok){if(pending)pending();return Promise.resolve({data:[...rows.values()],error:null}).then(ok);}};
 return query;
}})};
let source=await readFile('dist/supabase.js','utf8');
source=source.replace(/^import .*\r?\n/gm,'').replaceAll('export ','').replace(/const \{ createClient \} = await import\([^;]+;/,'const { createClient } = fixture;');
w.eval(source+'\nglobalThis.openClient=connectSupabase;');
try {
 const api=await w.openClient({url:'https://fixture.invalid',publishableKey:'fixture'});
 api.watchUser(()=>{});auth('SIGNED_IN',{user:{id:'one'}});
 await api.put('one','tasks','task',{title:'First',createdAt:100,completedDay:''});
 await api.update('one','tasks','task',{title:'Latest'});
 assert.equal(writes.length,0);
 assert.equal(settingsQueue(w.localStorage,'tasks:one').values().task.row.title,'Latest');
 auth('SIGNED_IN',{user:{id:'two'}});online=true;
 await new Promise(r=>setTimeout(r,700));
 assert.equal(writes.length,0,'Previous-account queue uploaded under new account');
 auth('SIGNED_IN',{user:{id:'one'}});
 let displayed;
 const stop=api.watchList('one','tasks',v=>displayed=v,()=>{});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(writes.length,1);assert.equal(writes[0].title,'Latest');
 assert.equal(displayed[0].id,'task');
 assert.deepEqual(settingsQueue(w.localStorage,'tasks:one').values(),{});
 stop();
 await api.put('one','profile','settings',{usageRules:[{id:'test',mode:'focus',items:[{kind:'website',label:'example.com'}]}]});
 assert.equal(writes.at(-1).usage_rules[0].mode,'focus');
 await api.put('one','profile','settings',{focusAudio:{preset:'binaural-16',volume:0.15}});
 assert.deepEqual(writes.at(-1).focus_audio,{preset:'binaural-16',volume:0.15});
 console.log('Offline coalescing, account-switch isolation, reconnect recovery and task readback passed.');
} finally {w.close();}
