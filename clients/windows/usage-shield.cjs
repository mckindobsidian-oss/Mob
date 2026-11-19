const {BrowserWindow,ipcMain,powerMonitor}=require('electron');
const {readFileSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
module.exports=function createUsageShield(mainWindow,app,Rules,expectedOrigin="http://127.0.0.1:43172"){
 let policy={owner:'guest',rules:[],daily:{},enabled:false},shield,store={},activeRule,activeName;
 const file=join(app.getPath('userData'),'usage-rule-sessions.json');
 try{store=JSON.parse(readFileSync(file,'utf8'));}catch{}
 const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function hide(){shield?.hide();activeRule=null;activeName=null;}
 function openMob(){hide();mainWindow.show();mainWindow.restore();mainWindow.focus();}
 function show(name,rule){
  if(shield?.isVisible())return;
  activeRule=rule.id;activeName=name;
  const light=policy.theme==='daylight',bg=light?'#f1f3ec':'#111613',ink=light?'#1b2b20':'#edf2e9',accent=light?'#315b40':'#b5e68a';
  if(!shield){shield=new BrowserWindow({width:560,height:380,alwaysOnTop:true,autoHideMenuBar:true,resizable:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});shield.on('close',event=>{event.preventDefault();hide();});shield.webContents.on('will-navigate',(event,url)=>{event.preventDefault();if(url==='mob-shield:open')openMob();});shield.webContents.setWindowOpenHandler(()=>({action:'deny'}));shield.webContents.on('before-input-event',(event,input)=>{if(input.key==='Escape'){event.preventDefault();openMob();}});}
  const html=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Mob · Time for a pause</title><style>body{background:${bg};color:${ink};font:16px system-ui;margin:42px;line-height:1.6}h1{font-size:30px;line-height:1.2}p{overflow-wrap:anywhere}a{display:inline-block;border:1px solid ${accent};border-radius:10px;padding:10px 18px;color:${accent};text-decoration:none}</style><h1>Time for a pause</h1><p><strong>${safe(name)}</strong> is blocked by ${safe(rule.name)}.</p><p>Switch to another app, or review this limit in Mob. Your app stays open.</p><a href="mob-shield:open">Open Mob</a>`;
  void shield.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));shield.show();shield.focus();
 }
 ipcMain.handle('mob-usage-policy',(event,value)=>{
  if(event.sender!==mainWindow.webContents||event.senderFrame.url.split('/').slice(0,3).join('/')!==expectedOrigin)return;
  const owner=value?.owner==='guest'||/^[a-f0-9-]{36}$/i.test(value?.owner||'')?value.owner:'guest';
  if(owner!==policy.owner||value.epoch!==policy.epoch)hide();
  policy={owner,epoch:value.epoch,rules:Rules.clean(value.rules),daily:value.daily&&typeof value.daily==='object'?value.daily:{},focusUntil:Number(value.focusUntil)||0,theme:value.theme,enabled:value.enabled===true};
  if(!policy.enabled||!policy.rules.some(r=>r.enabled))hide();
  if(activeRule){const rule=policy.rules.find(r=>r.id===activeRule&&r.items.some(i=>Rules.matches(i,'app',activeName)));if(!rule||!Rules.blocked(rule,{daily:policy.daily,session:store[owner]?.sessions?.[activeRule]?.seconds||0,focusUntil:policy.focusUntil}))hide();}
 });
 let savedAt=0;
 return {
  sample(name,seconds,at,locked){
   if(locked||powerMonitor.getSystemIdleTime()>=60){hide();return;}
   const owner=policy.owner,prior=store[owner]||{sessions:{},epoch:policy.epoch};
   if(prior.epoch!==policy.epoch){prior.sessions={};prior.epoch=policy.epoch;}
   prior.sessions=Rules.advance(policy.rules,prior.sessions,'app',name,seconds,at);store[owner]=prior;
   if(at-savedAt>5000){savedAt=at;try{writeFileSync(file,JSON.stringify(store));}catch{}}
   if(!policy.enabled){hide();return;}
   // Mob must remain available to edit limits and leave the shield.
   if(!name){hide();return;}
   if(name.toLowerCase()==='mob'){if(mainWindow.isFocused())hide();return;}
   const id='app:'+name.toLowerCase();policy.daily[id]=(Number(policy.daily[id])||0)+seconds;
   const blocked=policy.rules.find(r=>r.items.some(i=>Rules.matches(i,'app',name))&&Rules.blocked(r,{now:at,daily:policy.daily,session:prior.sessions[r.id]?.seconds||0,focusUntil:policy.focusUntil}));
   if(blocked)show(name,blocked);else hide();
  },
  close(){if(shield){shield.removeAllListeners('close');shield.close();shield=null;}}
 };
};
