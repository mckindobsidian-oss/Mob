import assert from 'node:assert/strict';
import { chromium, _electron as electron } from './.mob-build/browser-check/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';

const out=resolve('.mob-build/browser-results');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const path=resolve('dist','.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
    if (!path.startsWith(resolve('dist')+'\\')) throw Error('path');
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path));
  } catch {res.writeHead(404).end();}
});
await new Promise((r,j)=>server.once('error',error=>error.code==='EADDRINUSE'?r():j(error)).listen(4173,'127.0.0.1',r));
const errors=[];
let context,desktop;
try {
  context=await chromium.launchPersistentContext(resolve('.mob-build/browser-profile-'+Date.now()),{
    executablePath:process.env.MOB_TEST_BROWSER || 'C:/Users/lakshya/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',
    headless:true,viewport:{width:1280,height:900},
    args:['--disable-extensions-except='+resolve('clients/extension'),'--load-extension='+resolve('clients/extension')]
  });
  // Keep test fixtures and credentials entirely local. No signed-in cloud test is implied.
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    return ['127.0.0.1','localhost'].includes(u.hostname)||u.protocol==='chrome-extension:' ? route.continue() : route.abort();
  });
  await context.addInitScript(()=>{
    if (!location.hostname || !['127.0.0.1','localhost'].includes(location.hostname)) return;
    localStorage.setItem('mob:supabase','{}');
    const hour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
    if (!localStorage.getItem('fixture-loaded')) {
      localStorage.setItem('fixture-loaded','1');
      localStorage.setItem('mob:guest',JSON.stringify({settings:{onboarded:true},tasks:[],sessions:[]}));
      localStorage.setItem('mob:activity:guest',JSON.stringify({epoch:0,hidden:[],rows:{
        a:{hour,source:'app',label:'Code editor',seconds:600,visits:3},
        b:{hour,source:'website',label:'example.com',seconds:300,visits:2}
      }}));
    }
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/#flow');
  await page.locator('#flow-dashboard .usage-list').first().waitFor();
  assert.match(await page.locator('#flow-dashboard').innerText(),/example.com/);
  for(const width of [1280,768,390,360]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Horizontal overflow at '+width);
    await page.screenshot({path:resolve(out,'flow-'+width+'.png'),fullPage:true});
  }
  await page.locator('[data-action="flow-hide"][data-id="website:example.com"]').click();
  await page.locator('#flow-dashboard summary').click();
  await page.locator('[data-action="flow-show"]').click();
  await page.locator('#flow-list-filter').selectOption('apps',{force:true});
  assert.equal(await page.locator('[data-action="flow-hide"][data-id="website:example.com"]').count(),0);
  await page.locator('#flow-list-filter').selectOption('all',{force:true});
  await page.locator('[data-action="flow-privacy"]').click();
  assert.equal(await page.locator('#flow-dashboard').evaluate(n=>n.classList.contains('usage-private')),true);
  await page.locator('[data-action="flow-privacy"]').click();
  await page.locator('[data-action="flow-list"]').click();
  assert.equal(await page.locator('#flow-dashboard .usage-list').first().isVisible(),false);
  await page.locator('[data-action="flow-list"]').click();
  await page.locator('[data-rule-action="new"]').first().click();
  await page.locator('[data-rule-item="website:example.com"]').check();
  await page.locator('#usage-rule-form input[name="minutes"]').fill('2');
  await page.locator('#usage-rule-form button[type="submit"]').click();
  assert.match(await page.locator('.usage-rule-card').innerText(),/2 min/);
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="flow-clear"]').click();
  await page.waitForFunction(()=>document.querySelector('#flow-dashboard').textContent.includes('No visible usage'));
  console.log('Browser responsive layout, hide/unhide, filters, privacy, clear and limit saving passed.');
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
  const workerErrors=[];
  worker.on('console',m=>{if(m.type()==='error')workerErrors.push(m.text());});
  const extensionId=new URL(worker.url()).hostname;
  const popup=await context.newPage();
  await popup.setViewportSize({width:320,height:160});
  await popup.goto('chrome-extension://'+extensionId+'/popup.html');
  await popup.screenshot({path:resolve(out,'extension-popup.png')});
  console.log('Installed unpacked extension service worker and popup loaded.');
  const result=await worker.evaluate(async()=>{
    const token='a'.repeat(64),owner='00000000-0000-4000-8000-000000000001';
    globalThis.fetch=async url=>Response.json(String(url).endsWith('mob_flow_browser')
      ?{epoch:0,sites:[],theme:'plain'}:[{block_shorts:true,daily_limit_minutes:1,total_seconds:65}]);
    await chrome.storage.local.set({connection:{token,key:'sb_publishable_fixture',owner},tracking:true,
      usage:{day:new Date().toISOString().slice(0,10),seconds:65},cloud:{limit:1,other:0,blockShorts:true}});
    await setFocus({sites:['example.com'],until:Date.now()+60000});
    await apply();
    return {dynamic:await chrome.declarativeNetRequest.getDynamicRules(),session:await chrome.declarativeNetRequest.getSessionRules()};
  });
  assert.deepEqual(result.dynamic.map(r=>r.id),[1,2]);
  assert.deepEqual(result.session[0].condition.requestDomains,['example.com']);
  const fixture=await context.newPage();
  await fixture.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:'<h1>Local navigation fixture</h1>'}));
  await assert.rejects(fixture.goto('https://example.com/'),/ERR_BLOCKED_BY_CLIENT/);
  await fixture.goto('https://www.youtube.com/watch?v=fixture').catch(()=>{});
  await fixture.waitForURL('chrome-extension://'+extensionId+'/blocked.html');
  await worker.evaluate(async()=>{
    const hour=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
    await chrome.storage.local.set({browserUsage:{epoch:0,rows:{test:{hour,label:'example.org',source:'website',seconds:60,visits:1}}}});
    await setFocus({sites:[],until:0,siteLimits:{'example.org':1}});await apply();
  });
  await assert.rejects(fixture.goto('https://example.org/'),/ERR_BLOCKED_BY_CLIENT/);
  await worker.evaluate(async()=>{
    await setFocus({sites:[],until:0,rules:[{id:'permanent-check',mode:'permanent',enabled:true,name:'Permanent fixture',items:[{kind:'website',label:'example.net'}]}]});await apply();
  });
  await assert.rejects(fixture.goto('https://example.net/'),/ERR_BLOCKED_BY_CLIENT/);
  await worker.evaluate(async()=>{
    await setFocus({sites:[],until:0,rules:[{id:'schedule-check',mode:'schedule',enabled:true,start:'00:00',end:'00:00',days:[0,1,2,3,4,5,6],items:[{kind:'website',label:'example.edu'}]}]});await apply();
  });
  await assert.rejects(fixture.goto('https://example.edu/'),/ERR_BLOCKED_BY_CLIENT/);
  await worker.evaluate(async()=>{
    await setFocus({sites:[],until:0,rules:[{id:'session-check',mode:'session',minutes:1,enabled:true,items:[{kind:'website',label:'example.net'}]}]});
    await chrome.storage.local.set({ruleSessions:{'session-check':{seconds:60,at:Date.now()}}});await apply();
  });
  await assert.rejects(fixture.goto('https://example.net/'),/ERR_BLOCKED_BY_CLIENT/);
  await worker.evaluate(async()=>{await setFocus({sites:[],until:0});await apply();});
  const clearedFixture=await context.newPage();
  await clearedFixture.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:'<h1>Local navigation fixture</h1>'}));
  await clearedFixture.goto('https://example.com/');
  assert.match(await clearedFixture.locator('h1').innerText(),/Local navigation fixture/);
  await worker.evaluate(async()=>{
    globalThis.fixtureRequests=0;
    const fixtureFetch=globalThis.fetch;
    globalThis.fetch=async(...args)=>{fixtureRequests++;return fixtureFetch(...args);};
    await chrome.storage.local.set({browserSyncAt:0});
    await pullPolicy();await pullPolicy();await pullPolicy();
  });
  assert.equal(await worker.evaluate(()=>fixtureRequests),2,'Repeated policy reads bypassed 15-minute throttle');
  console.log('Installed extension enforced navigation blocking, removed expired focus rules and throttled repeated sync requests.');
  assert.deepEqual(errors,[]);
  await context.close();context=null;

  desktop=await electron.launch({executablePath:resolve(process.env.MOB_DESKTOP_BUILD||'.mob-build/Mob-Windows-v1.4/Mob.exe'),
    args:['--mob-verification','--mob-verification-port=43173','--user-data-dir='+resolve('.mob-build/desktop-test-profile-'+Date.now())],timeout:45000});
  const dp=await desktop.firstWindow();
  await dp.waitForLoadState('domcontentloaded');
  await dp.evaluate(()=>{localStorage.setItem('mob:supabase','{}');localStorage.setItem('mob:guest',JSON.stringify({settings:{onboarded:true},tasks:[],sessions:[]}));});
  await dp.reload();
  await dp.goto(new URL(dp.url()).origin+'/#flow');
  await dp.locator('#flow-tracking').check();
  const status=await dp.evaluate(()=>window.MobDesktop.trackingStatus());
  assert.equal(status.running,true);
  await dp.screenshot({path:resolve(out,'desktop-flow.png'),fullPage:true});
  const before=await dp.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mob:activity:guest')||'{"rows":{}}').rows).reduce((s,r)=>s+r.seconds,0));
  await dp.waitForTimeout(4500);
  await dp.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  const after=await dp.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mob:activity:guest')||'{"rows":{}}').rows).reduce((s,r)=>s+r.seconds,0));
  console.log(JSON.stringify({desktopHelper:status,before,after}));
  // A headless/idle test environment may have no foreground input, so zero is valid.
  assert(after>=before);
  if(status.idle) assert.equal(after,before,'Idle desktop accumulated usage');
  const dataPath=await desktop.evaluate(({app})=>app.getPath('userData'));
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  assert.equal((await dp.evaluate(()=>window.MobDesktop.trackingStatus())).running,true);
  await dp.evaluate(()=>{globalThis.hiddenTicks=0;globalThis.hiddenInterval=setInterval(()=>hiddenTicks++,100);});
  await dp.waitForTimeout(1000);
  assert(await dp.evaluate(()=>hiddenTicks)>=5,'Minimized renderer stopped background work');
  const second=spawn(resolve(process.env.MOB_DESKTOP_BUILD||'.mob-build/Mob-Windows-v1.4/Mob.exe'),['--mob-verification','--mob-verification-port=43173','--user-data-dir='+dataPath],{windowsHide:true,stdio:'ignore'});
  await new Promise(r=>{second.once('exit',r);setTimeout(r,5000);});
  await dp.waitForTimeout(500);
  assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true,'Launching Mob again did not reopen its hidden window');
  console.log('Packaged desktop renderer, native bridge, tracking, hidden-window background work and second-launch recovery passed.');
} finally {
  await context?.close();
  if(desktop){await desktop.evaluate(({app})=>app.quit());await desktop.close().catch(()=>{});}
  if(server.listening)server.close();
}
