import assert from 'node:assert/strict';
import {chromium} from './.mob-build/browser-check/node_modules/playwright-core/index.mjs';
import {mkdir} from 'node:fs/promises';
await mkdir('.mob-build/audio-results',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Users/lakshya/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
const deadline=setTimeout(()=>{console.error('Audio/control verification timed out');process.exitCode=1;void browser.close();},120000);
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await context.addInitScript(()=>{
  localStorage.setItem('mob:supabase','{}');
  if(!localStorage.getItem('mob:guest'))localStorage.setItem('mob:guest',JSON.stringify({settings:{onboarded:true},tasks:[{id:'fixture',title:'Write a chapter',createdAt:Date.now(),completedDay:'',date:'',project:'',priority:'medium'}],sessions:[]}));
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#tasks');
 await page.locator('[data-action="task-new"]').first().click();
 await page.getByRole('button',{name:'Due date',exact:true}).click();
 await page.getByRole('button',{name:'Next month',exact:true}).click();
 await page.getByRole('dialog',{name:'Choose date'}).getByRole('button',{name:/^\d{4}-\d\d-15$/}).click();
 assert.match(await page.locator('input[name="date"]').inputValue(),/15$/);
 await page.getByRole('button',{name:'Reminder time',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Hour',exact:true}).fill('14');
 await page.getByRole('spinbutton',{name:'Minute',exact:true}).fill('35');
 await page.getByRole('button',{name:'Set time',exact:true}).click();
 assert.equal(await page.locator('input[name="time"]').inputValue(),'14:35');
 for(const theme of ['plain','daylight','ocean','forest','photo']) {
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.getByRole('button',{name:'Due date',exact:true}).click();
  assert.equal(await page.locator('.mob-picker-panel:popover-open').evaluate(n=>{const probe=document.createElement('span');probe.style.backgroundColor='var(--card)';document.body.append(probe);const matches=getComputedStyle(n).backgroundColor===getComputedStyle(probe).backgroundColor;probe.remove();return matches;}),true,'Calendar popup did not inherit the theme');
  await page.screenshot({path:'.mob-build/audio-results/calendar-'+theme+'.png'});
  await page.keyboard.press('Escape');
 }
 await page.getByRole('button',{name:'Close',exact:true}).click();
 console.log('Themed date and time pickers passed for five themes.');
 await page.goto('http://127.0.0.1:4173/#focus');
 await page.getByRole('button',{name:'Task for this session',exact:true}).click();
 await page.getByRole('listbox',{name:'Task for this session',exact:true}).getByRole('option',{name:'Write a chapter',exact:true}).click();
 assert.equal(await page.locator('#focus-task').inputValue(),'fixture');
 await page.locator('[data-action="sound-preset"][data-id="binaural-10"]').click();
 await page.getByRole('button',{name:'Play sound',exact:true}).click();
 await page.getByRole('button',{name:'Pause sound',exact:true}).waitFor({timeout:5000}).catch(async error=>{console.log('Playback diagnostic:',await page.locator('#toast').innerText(),await page.locator('#sound-status').innerText(),errors);throw error;});
 await page.getByRole('button',{name:'Pause sound',exact:true}).click();
 console.log('Focus task selection and actual audio Play/Pause passed.');
 await page.locator('#focus-volume').evaluate(n=>{n.value='15';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));});
 const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('mob:guest')).settings.focusAudio);
 assert.equal(preferences.preset,'binaural-10');assert.equal(preferences.volume,0.15);
 for(const width of [1280,390,360]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:'.mob-build/audio-results/focus-'+width+'.png',fullPage:true});
 }
 const audio=await page.evaluate(async()=>{
  const {createFocusAudio,soundPresets}=await import('./focus-audio.js');const results=[];
  for(const [id] of soundPresets){
   const engine=createFocusAudio(class {constructor(){const ctx=new OfflineAudioContext(2,48000,48000);ctx.resume=async()=>{};return ctx;}});
   await engine.play(id,0.2);const output=await engine.context.startRendering();
   const left=output.getChannelData(0),right=output.getChannelData(1);
   const energy=left.reduce((s,v)=>s+v*v,0);
   const magnitude=(data,hz)=>{let re=0,im=0;for(let i=0;i<data.length;i++){re+=data[i]*Math.cos(2*Math.PI*hz*i/48000);im+=data[i]*Math.sin(2*Math.PI*hz*i/48000);}return Math.hypot(re,im);};
   results.push({id,energy,left200:magnitude(left,200),right200:magnitude(right,200),rightBeat:magnitude(right,id==='binaural-16'?216:210)});engine.stop();
  }return results;
 });
 for(const value of audio){assert(value.energy>0.0001,value.id+' produced silence');if(value.id.startsWith('binaural'))assert(value.rightBeat>value.right200*5,value.id+' lost stereo separation');}
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await context.setOffline(true);await page.reload();
 await page.getByRole('button',{name:'Play sound',exact:true}).click();
 await page.getByRole('button',{name:'Pause sound',exact:true}).waitFor();
 await page.getByRole('button',{name:'Pause sound',exact:true}).click();
 assert.equal(await page.locator('#focus-volume').inputValue(),'15');
 assert.deepEqual(errors,[]);console.log('Themed date/time/task pickers, all themes, responsive audio UI, saved preferences and seven rendered audio presets passed.');
 await context.close();
}finally{clearTimeout(deadline);await browser.close();}
