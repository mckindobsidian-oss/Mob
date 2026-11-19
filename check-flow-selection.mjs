import assert from 'node:assert/strict';
import {chromium} from './.mob-build/browser-check/node_modules/playwright-core/index.mjs';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Users/lakshya/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await context.addInitScript(()=>{
  localStorage.setItem('mob:supabase','{}');
  if(!localStorage.getItem('fixture')){localStorage.setItem('fixture','1');localStorage.setItem('mob:guest',JSON.stringify({settings:{onboarded:true},tasks:Array.from({length:10},(_,i)=>({id:'task'+i,title:'Task '+i,completedDay:i<9?'2026-11-19':'',createdAt:Date.now(),priority:'medium',date:'',time:'',project:''})),sessions:[]}));
   const hour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();localStorage.setItem('mob:activity:guest',JSON.stringify({epoch:0,hidden:[],rows:{a:{hour,source:'app',label:'Code',seconds:120,visits:1},b:{hour,source:'website',label:'example.com',seconds:90,visits:1}}}));}
  window.MobDesktop={watchActivity(){},trackingStatus:async()=>({running:true}),setUsagePolicy:async policy=>{window.rulePolicy=policy;}};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#flow');
 assert.equal(await page.locator('#limit-form').count(),0);
 await page.locator('[data-rule-action="new"]').first().click();
 await page.locator('#rule-search').fill('example');assert.equal(await page.locator('[data-rule-item]').count(),1);
 await page.locator('[data-rule-item="website:example.com"]').check();
 await page.locator('#rule-search').fill('');await page.locator('[data-rule-item="app:code"]').check();
 await page.locator('#usage-rule-form input[name="mode"][value="permanent"]').check();await page.locator('#usage-rule-form input[name="name"]').fill('Quiet work');
 await page.locator('#usage-rule-form button[type="submit"]').click();
 assert.match(await page.locator('.usage-rule-card').innerText(),/Quiet work/);
 const rules=await page.evaluate(()=>JSON.parse(localStorage.getItem('mob:guest')).settings.usageRules);assert.equal(rules[0].items.length,2);assert.equal(rules[0].mode,'permanent');
 await page.locator('[data-rule-action="edit"]').first().click();
 await page.locator('#usage-rule-form input[name="mode"][value="schedule"]').check();
 assert(await page.locator('#rule-schedule').isVisible());
 for(const width of [1280,390,360]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await mkdir('.mob-build/flow-selection-results',{recursive:true});await page.screenshot({path:'.mob-build/flow-selection-results/rule-'+width+'.png'});}
 await page.locator('[data-rule-action="cancel"]').click();
 await page.locator('[data-rule-action="new"]').first().click();await page.locator('[data-rule-item="app:code"]').check();
 await page.locator('[name="hours"]').fill('1');await page.locator('[name="minutes"]').fill('2');await page.locator('[name="seconds"]').fill('3');
 await page.locator('#usage-rule-form button[type="submit"]').click();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mob:guest')).settings.usageRules)).at(-1).seconds,3723);
 await page.locator('[data-rule-action="edit"]').last().click();assert.equal(await page.locator('[name="hours"]').inputValue(),'1');assert.equal(await page.locator('[name="seconds"]').inputValue(),'3');await page.locator('[data-rule-action="cancel"]').click();
 await page.goto('http://127.0.0.1:4173/#focus');
 assert.equal(await page.locator('.focus-audio-column').evaluate(n=>n.firstElementChild.classList.contains('music-card')),true);
 await page.goto('http://127.0.0.1:4173/#tasks');
 await page.locator('[data-action="task-check"][data-id="task9"]').click();
 await page.locator('#achievement-popup').waitFor();assert.match(await page.locator('#achievement-popup').innerText(),/Clean sweep/);
 await page.locator('#achievement-popup button').click();await page.waitForTimeout(700);assert.equal(await page.locator('#achievement-popup').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Visited-item search/selection, rule editing, mobile layout, Spotify order and one-time achievement popup passed.');
}finally{await browser.close();}
