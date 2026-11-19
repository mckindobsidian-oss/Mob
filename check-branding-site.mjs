import assert from 'node:assert/strict';
import {chromium} from './.mob-build/browser-check/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({executablePath:'C:/Users/lakshya/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1200,height:820},deviceScaleFactor:1});
 await context.addInitScript(()=>{if(location.hostname!=='127.0.0.1')return;localStorage.setItem('mob:supabase','{}');localStorage.setItem('mob:guest',JSON.stringify({settings:{onboarded:true,motion:false},tasks:[{id:'1',title:'Make room for deep work',priority:'high',project:'Personal',date:new Date().toISOString().slice(0,10),time:'',completedDay:'',createdAt:1},{id:'2',title:'Sketch the next idea',priority:'medium',project:'Creative',date:new Date().toISOString().slice(0,10),time:'',completedDay:'',createdAt:2},{id:'3',title:'Take a proper break',priority:'low',project:'Personal',date:new Date().toISOString().slice(0,10),time:'',completedDay:'',createdAt:3}],sessions:[]}));});
 const p=await context.newPage();await p.goto('http://127.0.0.1:4173/#today');await p.screenshot({path:'branding-site/assets/workspace.png'});await p.goto('http://127.0.0.1:4173/#focus');await p.screenshot({path:'branding-site/assets/focus.png'});await context.close();
 const c=await browser.newContext();const page=await c.newPage();await page.goto('http://127.0.0.1:4180');
 for(const width of [1440,390,360]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'.mob-build/release-polish-results/branding-'+width+'.png',fullPage:true});}
 assert.match(await page.locator('.closing').innerText(),/Lakshya.*Khushaank/s);
 assert.equal(await page.locator('[download]').count(),3);
 for(const image of await page.locator('img').all())assert(await image.evaluate(i=>i.complete&&i.naturalWidth>0));
 console.log('Branding screenshots, responsive layouts, credits, product images and download links passed.');
}finally{await browser.close();}
