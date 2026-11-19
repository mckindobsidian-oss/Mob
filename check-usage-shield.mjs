import assert from 'node:assert/strict';
import {_electron as electron} from './.mob-build/browser-check/node_modules/playwright-core/index.mjs';
import {resolve} from 'node:path';
const app=await electron.launch({executablePath:resolve('.mob-build/Mob-Windows-v1.4/Mob.exe'),args:['--mob-verification','--mob-verification-port=43174','--user-data-dir='+resolve('.mob-build/shield-check-'+Date.now())],timeout:60000});
try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 await page.evaluate(()=>localStorage.setItem('mob:supabase','{}'));await page.reload();
 await page.evaluate(()=>{const last=setInterval(()=>{},999999);for(let id=1;id<=last;id++)clearInterval(id);});
 await app.evaluate(({app,BrowserWindow,ipcMain,powerMonitor})=>{
  const main=BrowserWindow.getAllWindows()[0];globalThis.testMain=main;
  ipcMain.removeHandler('mob-usage-policy');powerMonitor.getSystemIdleTime=()=>0;
  globalThis.testShield=process.mainModule.require(app.getAppPath()+'/usage-shield.cjs')(main,app,globalThis.MobUsageRules,new URL(main.webContents.getURL()).origin);
 });
 const policy={owner:'guest',epoch:0,enabled:true,theme:'plain',rules:[{id:'daily',mode:'daily',enabled:true,name:'Code budget',minutes:1,items:[{kind:'app',label:'Code'}]}],daily:{'app:code':59.5}};
 await page.evaluate(p=>window.MobDesktop.setUsagePolicy(p),policy);
 await app.evaluate(()=>testShield.sample('Code',0.25,Date.now(),false));
 assert.equal((await app.windows()).length,1);
 const opened=app.waitForEvent('window');await app.evaluate(()=>testShield.sample('Code',0.25,Date.now(),false));const shield=await opened;await shield.waitForLoadState('domcontentloaded');
 assert.match(await shield.locator('body').innerText(),/Code budget/);
 await shield.screenshot({path:'.mob-build/flow-selection-results/desktop-shield.png'});
 await app.evaluate(()=>testShield.sample('',0,Date.now(),false));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w!==testMain).isVisible()),false,'Switching to a browser did not dismiss shield');
 await page.evaluate(p=>window.MobDesktop.setUsagePolicy({...p,rules:[{...p.rules[0],mode:'permanent'}]}),policy);
 await app.evaluate(()=>testShield.sample('Code',0.25,Date.now(),false));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w!==testMain).isVisible()),true);
 await page.evaluate(()=>window.MobDesktop.setUsagePolicy({owner:'guest',epoch:0,enabled:true,rules:[],daily:{}}));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w!==testMain).isVisible()),false,'Disabled rule left app blocked');
 console.log('Packaged native shield passed: daily threshold, permanent rule, browser switch and rule removal using simulated active-app samples.');
}finally{await app.evaluate(({app})=>{globalThis.testShield?.close();app.quit();}).catch(()=>{});await app.close().catch(()=>{});}
