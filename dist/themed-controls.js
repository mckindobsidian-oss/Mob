// Native values remain the form source; popup surfaces use Mob's theme everywhere.
export function installThemedControls(root=document) {
  let open;
  function close() {if(open){if(open.panel.matches(':popover-open'))open.panel.hidePopover();open.panel.hidden=true;open.button.setAttribute('aria-expanded','false');open=null;}}
  function popup(input,label) {
    const wrap=document.createElement('span');wrap.className='mob-picker';
    input.before(wrap);wrap.append(input);input.classList.add('mob-native-control');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
    const button=document.createElement('button');button.type='button';button.disabled=input.disabled;button.className='mob-picker-button';button.setAttribute('aria-label',label);button.setAttribute('aria-expanded','false');
    const panel=document.createElement('span');panel.className='mob-picker-panel';panel.hidden=true;
    wrap.append(button,panel);
    input.addEventListener('focus',()=>button.focus());
    if(panel.showPopover)panel.setAttribute('popover','manual');
    button.onclick=()=>{const show=panel.hidden;close();if(show){panel.hidden=false;button.setAttribute('aria-expanded','true');open={wrap,button,panel};
      if(panel.showPopover){const rect=button.getBoundingClientRect();panel.style.width=Math.min(Math.max(rect.width,input.type==='date'?286:220),innerWidth-24)+'px';panel.style.left=Math.max(12,Math.min(rect.left,innerWidth-parseFloat(panel.style.width)-12))+'px';const above=innerHeight-rect.bottom<240&&rect.top>innerHeight-rect.bottom;panel.style.top=above?'auto':rect.bottom+6+'px';panel.style.bottom=above?innerHeight-rect.top+6+'px':'auto';panel.style.maxHeight=Math.max(120,(above?rect.top:innerHeight-rect.bottom)-20)+'px';panel.showPopover();}
      panel.querySelector('[aria-selected="true"],button,input')?.focus();}};
    return {wrap,button,panel};
  }
  function enhance(input) {
    if(input.classList.contains('mob-native-control'))return;
    const label=input.getAttribute('aria-label') || input.closest('label')?.childNodes[0]?.textContent?.trim() || 'Choose an option';
    const {button,panel}=popup(input,label);
    const commit=value=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();button.focus();};
    if(input.tagName==='SELECT') {
      panel.setAttribute('role','listbox');panel.setAttribute('aria-label',label);button.setAttribute('aria-haspopup','listbox');
      const draw=()=>{button.textContent=input.selectedOptions[0]?.textContent || 'Choose';panel.replaceChildren();
        for(const option of input.options){const item=document.createElement('button');item.type='button';item.textContent=option.textContent;item.disabled=option.disabled;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.onclick=()=>commit(option.value);panel.append(item);}};
      input.addEventListener('change',draw);draw();
    } else if(input.type==='date') {
      button.setAttribute('aria-haspopup','dialog');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Choose date');
      let month;
      const draw=()=>{
        button.textContent=input.value ? new Date(input.value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Choose date';
        const date=month || new Date((input.value || new Date().toISOString().slice(0,10))+'T12:00:00');month=new Date(date.getFullYear(),date.getMonth(),1);
        panel.innerHTML='<span class="picker-calendar-head"><button type="button" aria-label="Previous month">‹</button><strong>'+month.toLocaleDateString(undefined,{month:'long'})+'</strong><input type="number" aria-label="Year" min="1900" max="2199" value="'+month.getFullYear()+'"><button type="button" aria-label="Next month">›</button></span><span class="picker-calendar-grid"></span>';
        const arrows=panel.querySelectorAll('button');arrows[0].onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);draw();};arrows[1].onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);draw();};
        panel.querySelector('input').onchange=e=>{const year=Number(e.target.value);if(year>=1900&&year<=2199){month.setFullYear(year);draw();}};
        const grid=panel.querySelector('.picker-calendar-grid');
        for(const day of ['Su','Mo','Tu','We','Th','Fr','Sa']){const el=document.createElement('small');el.textContent=day;grid.append(el);}
        for(let i=0;i<month.getDay();i++)grid.append(document.createElement('span'));
        const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
        for(let day=1;day<=count;day++){
          const value=month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
          const item=document.createElement('button');item.type='button';item.textContent=day;item.setAttribute('aria-label',value);item.setAttribute('aria-selected',String(value===input.value));item.onclick=()=>commit(value);grid.append(item);
        }
        const clear=document.createElement('button');clear.type='button';clear.textContent='No due date';clear.onclick=()=>commit('');panel.append(clear);
      };input.addEventListener('change',draw);draw();
    } else {
      button.setAttribute('aria-haspopup','dialog');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Choose reminder time');
      const draw=()=>{button.textContent=input.value || 'No reminder';};draw();input.addEventListener('change',draw);
      panel.innerHTML='<span class="picker-time-fields"><label>Hour<input aria-label="Hour" type="number" min="0" max="23"></label><label>Minute<input aria-label="Minute" type="number" min="0" max="59"></label></span><button type="button">Set time</button><button type="button">No reminder</button>';
      const fields=panel.querySelectorAll('input');fields[0].value=input.value.slice(0,2)||'09';fields[1].value=input.value.slice(3)||'00';
      const buttons=panel.querySelectorAll('button');buttons[0].onclick=()=>{if([...fields].every(f=>f.checkValidity()&&f.value!==''))commit([...fields].map(f=>String(Number(f.value)).padStart(2,'0')).join(':'));};buttons[1].onclick=()=>commit('');
    }
    panel.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      const items=[...panel.querySelectorAll('button:not(:disabled),input')];const at=items.indexOf(document.activeElement);
      const next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();event.preventDefault();
    }});
  }
  function scan(){root.querySelectorAll('select,input[type="date"],input[type="time"]').forEach(enhance);}
  scan();const observer=new MutationObserver(scan);observer.observe(root,{childList:true,subtree:true});
  root.addEventListener('click',event=>{if(open&&!event.composedPath().includes(open.wrap))close();});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&open){const button=open.button;close();button.focus();event.preventDefault();event.stopPropagation();}},true);
  window.addEventListener('resize',close);
  return ()=>{observer.disconnect();close();};
}
