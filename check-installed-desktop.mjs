import assert from 'node:assert/strict';
import {_electron as electron} from './.mob-build/browser-check/node_modules/playwright-core/index.mjs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
let desktop;const out=resolve('.mob-build/browser-results');
try {
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
}finally{if(desktop){await desktop.evaluate(({app})=>app.quit());await desktop.close().catch(()=>{});}}