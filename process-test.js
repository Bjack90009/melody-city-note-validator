(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./core.js'):root.NumericEngine;
const qualityNames=['绿','蓝','紫','金','红'];
// Separate experimental schedule; never calls the numeric performance or resource engine.
function plan(state,data,scheme,seed=state.seed){
 if(!['A','B'].includes(scheme))throw Error('未知表演方案');
 const rng=E.random(`${seed}:process:${scheme}`),events=[],attempts=[],duration=10,lifetime=.5;
 const instruments=state.placed.map(p=>({...data.items.find(i=>i.id===p.id),...p})).filter(p=>p.category!=='乐谱').sort((a,b)=>a.id.localeCompare(b.id));
 const interval=()=>[.5,.75,1,1.25,1.5,1.75,2,2.25,2.5][Math.floor(rng()*9)];
 const clocks=instruments.map(p=>({p,next:scheme==='A'?.25:interval()}));
 while(clocks.length){const time=Math.min(...clocks.map(c=>c.next));if(time>duration)break;
  for(const c of clocks.filter(c=>c.next===time)){
   const emit=scheme==='B'||rng()>=.75;attempts.push({time,source:c.p.id,emit});
   if(emit){const q=qualityNames.indexOf(c.p.quality),notes=[];
    for(let y=0;y<c.p.height;y++)for(let x=0;x<c.p.width;x++){const r=rng(),quality=Math.min(4,q+(r<.8?0:r<.95?1:2));notes.push({x:c.p.x+x,y:c.p.y+y,quality});}
    events.push({time,source:c.p.id,name:c.p.name,notes});
   }
   c.next=time+(scheme==='A'?.25:interval());
  }
 }
 return{scheme,seed,duration,lifetime,events,attempts,instruments:instruments.length,total:events.reduce((n,e)=>n+e.notes.length,0)};
}
function open({state,data,scheme,onClose}){
 let seed=state.seed,schedule=plan(state,data,scheme,seed),frame,elapsed=0,last=0,paused=false,done=false,closed=false,cursor=0,emitted=0;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const colors=['#70df92','#72baff','#c791ff','#ffd36a','#ff777d'];
 const dialog=document.createElement('dialog');dialog.className='process-stage';dialog.setAttribute('aria-label',`方案${scheme}表演过程测试`);
 dialog.innerHTML=`<div class="process-heading"><div><h2>方案${scheme} · 表演过程测试</h2><p>${scheme==='A'?'每0.25秒独立判定：每件乐器75%不出音':'每件乐器每次出音后，重抽0.5～2.5秒间隔（步长0.25秒，9档等概率）'}</p></div><button data-action="close" aria-label="关闭过程测试">关闭</button></div><div class="process-meta"><span data-time>0.0 / 10秒</span><span data-count>累计0枚</span><span data-status>播放中</span></div><div class="process-board-wrap"><div class="process-board" aria-label="音符表演棋盘"></div></div><progress max="10" value="0" aria-label="表演进度"></progress><div class="process-legend">${qualityNames.map((q,i)=>`<span style="--note-color:${colors[i]}">● ${q}</span>`).join('')}<span>同色80% · 高一级15% · 高二级5%</span></div><p class="process-help">每格独立品质 · 0.5秒淡入淡出 · 最高红色 · 仅观察过程，不叠加技能、不结算或消耗体力</p><div class="process-controls"><button data-action="pause">暂停</button><button data-action="replay">同种子重播</button><button data-action="random">换种子重播</button></div><p class="process-seed">种子：<span data-seed>${esc(seed)}</span> · 空格暂停／继续</p>`;
 const board=dialog.querySelector('.process-board'),get=s=>dialog.querySelector(s);
 for(let c=0;c<data.rules.rows*data.rules.cols;c++){const cell=document.createElement('div');cell.className='process-cell'+(state.unlocked.includes(c)?' open':'');cell.style.gridColumn=c%data.rules.cols+1;cell.style.gridRow=Math.floor(c/data.rules.cols)+1;board.append(cell);}
 for(const p of state.placed){const i=data.items.find(i=>i.id===p.id),el=document.createElement('div');el.className='process-prop';el.style.gridColumn=`${p.x+1}/span ${i.width}`;el.style.gridRow=`${p.y+1}/span ${i.height}`;el.style.setProperty('--note-color',colors[qualityNames.indexOf(i.quality)]);el.innerHTML=`<img src="${esc(i.icon)}" alt="${esc(i.name)}"><span>${esc(i.name)}</span>`;board.append(el);}
 document.body.append(dialog);dialog.showModal();let active=[];
 function render(){
  while(cursor<schedule.events.length&&schedule.events[cursor].time<=elapsed){const e=schedule.events[cursor++];emitted+=e.notes.length;for(const n of e.notes){if(elapsed-e.time>=schedule.lifetime)continue;const el=document.createElement('span');el.className='process-note';el.style.gridColumn=n.x+1;el.style.gridRow=n.y+1;el.style.setProperty('--note-color',colors[n.quality]);el.textContent='♪';el.setAttribute('aria-label',`${e.name}：${qualityNames[n.quality]}音符`);board.append(el);active.push({el,start:e.time});}}
  active=active.filter(n=>{const age=elapsed-n.start;if(age>=schedule.lifetime){n.el.remove();return false;}const enter=Math.min(1,age/.1),exit=Math.max(0,(age-.32)/.18);n.el.style.opacity=String(enter*(1-exit));n.el.style.transform=`translateY(${-exit*24}px) scale(${.55+.45*enter+.12*exit})`;return true;});
  get('[data-time]').textContent=`${Math.min(10,elapsed).toFixed(1)} / 10秒`;get('[data-count]').textContent=`累计${emitted}枚 · 当前${active.length}枚`;get('progress').value=Math.min(elapsed,10);
  get('[data-status]').textContent=done?'已结束':paused?'已暂停':elapsed>=10?'最后一批收尾':'播放中';
 }
 function tick(now){if(closed)return;if(!last)last=now;if(!paused&&!done)elapsed+=Math.max(0,(now-last)/1000);last=now;if(elapsed>=10.5){elapsed=10.5;done=true;get('[data-action="pause"]').disabled=true;}render();if(!done)frame=requestAnimationFrame(tick);}
 function restart(random){cancelAnimationFrame(frame);if(random)seed=`${state.seed}:visual:${Date.now()}`;schedule=plan(state,data,scheme,seed);for(const n of active)n.el.remove();active=[];elapsed=0;last=0;cursor=0;emitted=0;paused=false;done=false;get('[data-seed]').textContent=seed;get('[data-action="pause"]').disabled=false;get('[data-action="pause"]').textContent='暂停';render();frame=requestAnimationFrame(tick);}
 function pause(){if(done)return;paused=!paused;get('[data-action="pause"]').textContent=paused?'继续':'暂停';render();}
 function close(){if(closed)return;closed=true;cancelAnimationFrame(frame);document.removeEventListener('keydown',key);dialog.remove();onClose();}
 const key=e=>{if(e.code==='Space'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();pause();}};
 document.addEventListener('keydown',key);get('[data-action="close"]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};get('[data-action="pause"]').onclick=pause;get('[data-action="replay"]').onclick=()=>restart(false);get('[data-action="random"]').onclick=()=>restart(true);frame=requestAnimationFrame(tick);
}
if(typeof module!=='undefined')module.exports={plan};else root.ProcessTest={plan,open};
})(typeof window!=='undefined'?window:globalThis);
