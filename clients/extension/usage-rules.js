(function(root){
  const modes=['permanent','schedule','daily','session','focus'];
  const key=item=>(item.kind==='website'?'website':'app')+':'+item.label.toLowerCase();
  function clean(rules){return (Array.isArray(rules)?rules:[]).slice(0,30).filter(r=>r&&modes.includes(r.mode)).map(r=>({
    id:String(r.id).slice(0,60),name:String(r.name||'Usage limit').slice(0,60),enabled:r.enabled!==false,mode:r.mode,
    seconds:Math.max(1,Math.min(86400,Math.round(Number(r.seconds)||Number(r.minutes)*60||1800))),minutes:Math.max(1,Math.min(86400,Math.round(Number(r.seconds)||Number(r.minutes)*60||1800)))/60,start:/^\d\d:\d\d$/.test(r.start)?r.start:'09:00',end:/^\d\d:\d\d$/.test(r.end)?r.end:'17:00',
    days:Array.isArray(r.days)?r.days.filter(n=>Number.isInteger(n)&&n>=0&&n<7):[1,2,3,4,5],
    items:(Array.isArray(r.items)?r.items:[]).filter(i=>i&&['app','website'].includes(i.kind)&&typeof i.label==='string'&&i.label.length>0&&i.label.length<=100&&(i.kind!=='website'||/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(i.label))).slice(0,60).map(i=>({kind:i.kind,label:i.label}))
  })).filter(r=>r.items.length);}
  function matches(item,kind,label){return item.kind===kind&&(kind==='website'?(label===item.label||label.endsWith('.'+item.label)):label.toLowerCase()===item.label.toLowerCase());}
  function blocked(rule,{now=Date.now(),daily={},session=0,focusUntil=0}={}){
    if(!rule.enabled)return false;
    if(rule.mode==='permanent')return true;
    if(rule.mode==='focus')return focusUntil>now;
    if(rule.mode==='session')return session>=rule.minutes*60;
    if(rule.mode==='daily')return Object.entries(daily).reduce((sum,[id,value])=>{const at=id.indexOf(':');return sum+(rule.items.some(i=>matches(i,id.slice(0,at),id.slice(at+1)))?Number(value)||0:0);},0)>=rule.minutes*60;
    const date=new Date(now),minute=date.getHours()*60+date.getMinutes(),toMinute=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
    const start=toMinute(rule.start),end=toMinute(rule.end),day=date.getDay();
    if(start===end)return rule.days.includes(day);
    return start<end?rule.days.includes(day)&&minute>=start&&minute<end:(minute>=start&&rule.days.includes(day))||(minute<end&&rule.days.includes((day+6)%7));
  }
  function advance(rules,state,kind,label,seconds,now=Date.now()){
    const next={...state};
    for(const rule of clean(rules)){
      if(rule.mode!=='session')continue;
      const old=state[rule.id],active=label&&rule.items.some(i=>matches(i,kind,label));
      next[rule.id]=active?{seconds:Math.min(86400,(old&&now-old.at<=60000?old.seconds:0)+Math.max(0,seconds)),at:now}:old&&now-old.at<=60000?old:{seconds:0,at:now};
    }return next;
  }
  root.MobUsageRules={clean,key,matches,blocked,advance};
})(globalThis);
