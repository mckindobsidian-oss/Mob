import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const store={},hour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString(),stamp=Date.parse(hour)/1000,day=hour.slice(0,10);
let epoch=0;
const flow=runInNewContext((await readFile('dist/flow.js','utf8')).replace('export function createFlow','function createFlow')+'\ncreateFlow(options)',{
 document:{querySelector:()=>null},navigator:{onLine:true},structuredClone,Date,setTimeout,
 options:{read:(key,fallback)=>structuredClone(store[key]??fallback),save:(key,value)=>{store[key]=structuredClone(value);},device:'web-device',source:'web',enabled:()=>true,active:()=>true},
});
const client={flowSync:async()=>epoch,flowManage:async()=>epoch=Date.now(),flowSnapshot:async device=>({epoch,day,hidden:[],hours:epoch?[]:[[stamp,'website',50]],items:epoch?[]:[['website','example.com',50,2]],catalog:[['website','example.com']],totals:epoch?[]:[['website','example.com',50]],own:!epoch&&device==='extension' ? [[stamp,'website','example.com',30,1]]:[],devices:1,visits:2})};
flow.account('owner',client);await new Promise(setImmediate);
flow.importBrowser({owner:'owner',linked:true,device:'extension',activity:{epoch:0,rows:[{hour,source:'website',label:'example.com',seconds:35,visits:1}]}});await new Promise(setImmediate);
assert.equal(flow.ruleState().daily['website:example.com'],55,'Local web time double-counted uploaded counters');
await flow.manage('clear');
assert.equal(flow.ruleState().daily['website:example.com']||0,0,'Old extension counters resurfaced after clear');
flow.account('different-owner',null);
assert.equal(flow.ruleState().daily['website:example.com']||0,0,'Extension data crossed accounts');
console.log('Live extension merge passed: cloud baseline deduplication, clear generation and account isolation.');
