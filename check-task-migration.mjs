import {createFlowControls} from "./dist/flow-controls.js";
import {createFocusAudio,soundPresets} from "./dist/focus-audio.js";
import {installThemedControls} from "./dist/themed-controls.js";
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from './.mob-build/web-check/node_modules/jsdom/lib/api.js';
import * as core from './dist/core.js';
const html=await readFile('dist/index.html','utf8'), app=await readFile('dist/app.js','utf8'), flow=await readFile('dist/flow.js','utf8');
for(const android of [false,true]) {
 const dom=new JSDOM(html,{url:'http://localhost:4173/#tasks',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window, writes=[], watches=[];
 w.localStorage.setItem('mob:guest',JSON.stringify({settings:{},tasks:[{id:'guest-task',title:'Guest task',createdAt:100,completedDay:''}],sessions:[{id:'guest-session',day:'2026-11-18',minutes:25}]}));
 Object.assign(w,core,{createFlowControls, createFocusAudio, soundPresets, installThemedControls:()=>{}, getConfig:()=>null,nativeMessage:()=>false,extensionMessage(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){}});
 if(android) w.MobAndroid={postMessage(){}};
 w.eval(flow.replace('export function createFlow','function createFlow')+'\n'+app.replace(/^import .*\r?\n/gm,'')+`
 globalThis.test={login:watchAccount, task:saveTask, remove:deleteTask, account:()=>account};
 api={remove:async()=>{},put:async(uid,type,id,value)=>{writes.push({uid,type,id,value})},watchSettings:()=>()=>{},watchList:(uid,type,handler)=>{watches.push(type);handler([]);return ()=>{}},androidSocial:async()=>({rows:[],sharing:false}),handle:async()=>"tester"};
 ` .replaceAll('writes.push','globalThis.writes.push').replaceAll('watches.push','globalThis.watches.push'));
 w.writes=writes;w.watches=watches;
 w.test.login({uid:'first'},'SIGNED_IN');
 await Promise.resolve();
 assert.equal(writes.filter(x=>x.type==='tasks'&&x.id==='guest-task').length,1);
 assert.equal(w.localStorage.getItem('mob:guest').includes('guest-task'),false);
 w.test.login({uid:'second'},'SIGNED_IN');
 await Promise.resolve();
 assert.equal(writes.filter(x=>x.type==='tasks'&&x.uid==='second').length,0,'Guest tasks leaked to second account');
 if(android){assert.deepEqual(watches,['tasks','tasks']);assert(w.document.querySelector('[href="#flow"]')); assert.equal(writes.some(x=>x.type==='profile'||x.type==='sessions'),false);}
 w.test.task({id:'new',title:'Immediate',createdAt:100,completedDay:''});
 assert.match(w.document.body.textContent,/Immediate/);
 w.test.remove('new');
 await new Promise(resolve=>setTimeout(resolve,100));dom.window.close();
}
console.log('Guest migration IDs, account isolation, immediate task UI and Android tasks-only subscriptions passed.');
