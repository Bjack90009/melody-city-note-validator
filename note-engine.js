(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./core.js'):root.NumericEngine;
const supported=['C01','C02','C03','C04','C05','P01','P02','P03','P04','P05','H01','H02','H03','H04','H05','R01','R02','R03','R04','R05','J01','J02','J03','J04','J05','B01','B02','B03','B04','B05','G01','G02','G03','G04','G05','G06','G07','G08','G09','G10','D01','D02','D03','D04','D05'];
const value=(p)=>p.effect[p.level-1];
function context(state,data){return state.placed.map(p=>({...data.items.find(i=>i.id===p.id),...p,level:state.owned[p.id]?.level||1})).sort((a,b)=>a.id.localeCompare(b.id));}
function score(state,data){
 const ps=context(state,data),inst=ps.filter(p=>p.category!=='乐谱'),info=Object.fromEntries(ps.map(p=>[p.id,{id:p.id,name:p.name,base:p.base[p.level-1],member:0,ability:0,total:0,active:false,sources:[],matches:[],targets:[],count:0}]));
 const local=(s,t)=>s.id===t.id||E.adjacent(s,t);
 for(const s of ps){let targets=[],scale=1;const near=inst.filter(t=>s.id!==t.id&&E.adjacent(s,t));
  switch(s.id){
   case'C01':scale=new Set(near.map(t=>t.category)).size;targets=scale?[s]:[];break;
   case'C02':targets=inst.filter(t=>t.tags.includes('提琴')).length>=3?[s]:[];break;
   case'C03':targets=inst.filter(t=>t.quality==='金'&&['键盘','弦乐'].includes(t.category));break;
   case'C04':case'G03':targets=inst.filter(t=>t.category==='弦乐');break;
   case'B01':targets=inst.filter(t=>t.id===s.id||(E.adjacent(s,t)&&t.category==='键盘'));break;
   case'B02':targets=inst.filter(t=>t.id===s.id||(E.adjacent(s,t)&&t.category==='弦乐'));break;
   case'R04':case'G01':case'G05':targets=[s];break;
   case'G06':targets=inst.filter(t=>t.category==='管乐');break;
   case'G08':targets=inst.filter(t=>t.category==='键盘');break;
   case'G09':targets=inst.filter(t=>t.category==='打击');break;
   case'D01':targets=near.filter(t=>['键盘','弦乐'].includes(t.category));break;
  }
  const entry=info[s.id];entry.value=value(s);entry.targets=targets.map(t=>t.id);entry.matches=near.map(t=>t.id);entry.count=scale;entry.active=targets.length>0;
  for(const t of targets){const n=t.base[t.level-1]*value(s)*scale/100;info[t.id].ability+=n;info[t.id].sources.push({name:s.name,value:n,type:'布局增益'});}
  // Other effects are event-based. Highlight the relevant local region without pretending it is a static bonus.
  if(!targets.length){entry.targets=inst.filter(t=>local(s,t)).map(t=>t.id);entry.active=false;}
 }
 let base=0,ability=0;for(const v of Object.values(info)){v.total=v.base+v.ability;base+=v.base;ability+=v.ability;}
 return{base,ability,total:base+ability,subtotal:base+ability,member:0,globalFixed:0,globalPercent:0,extraBeats:0,info,sets:[],globalSources:[]};
}
function performance(state,data,{seed='notes',trace=false}={}){
 const ps=context(state,data),inst=ps.filter(p=>p.category!=='乐谱'),by=Object.fromEntries(ps.map(p=>[p.id,p])),r=data.rules,rng=E.random(seed),preview=score(state,data),G=inst.reduce((n,p)=>n+p.area,0);
 const near=(s,p)=>s&&E.adjacent(s,p),local=(s,p)=>s&&(s.id===p.id||near(s,p)),v=id=>by[id]?value(by[id]):0;
 const stats=Object.fromEntries(inst.map(p=>[p.id,{id:p.id,name:p.name,regular:0,additional:0,score:0,qualities:[0,0,0,0,0],changed:0,up:0,down:0}]));
 const effects={},timeline=[],events=[],noteTrace=[];let t=0,totalNotes=0,N=0,regular=0,additional=0,surgeEnd=-1,surgeCount=0,solo=false,soloDone=false,soloNext=Infinity,nextWindow=1,windowAdditional=0,jazzWindow=0,woodUntil=-1,windowRegular={};
 const trigger=(id,n=1)=>{effects[id]=(effects[id]||0)+n;};
 const event=(type,detail)=>events.push({time:+t.toFixed(6),type,detail});
 const interval=p=>p.id==='C02'||p.id==='R04'?1:p.id==='R03'?.4:r.noteInterval;
 const clocks=inst.map(p=>({p,progress:0,batch:0,interval:interval(p)}));
 const violin=Math.min(3,inst.filter(p=>p.tags.includes('提琴')).length);
 function addNote(p,q,extra=false,flags={},coef=1,batchBuff=0,harpBuff=0){
  let percent=batchBuff+harpBuff,fixed=0;const changed=!!flags.changed,up=!!flags.up,down=!!flags.down;
  const add=(id,yes,isFixed=false)=>{if(by[id]&&yes){if(isFixed)fixed+=v(id);else percent+=v(id);trigger(id);}};
  add('C05',q===2&&local(by.C05,p));add('P03',extra&&local(by.P03,p),true);add('P04',q<=1&&local(by.P04,p));add('P05',extra&&p.category==='弦乐'&&near(by.P05,p));
  add('H04',q>=3&&p.category==='管乐');add('H05',q===3&&local(by.H05,p));add('R02',flags.solo);add('R03',extra&&p.id==='R03');
  add('J02',p.id==='J02'&&flags.modulated);add('J04',p.id==='J04'&&down);add('J05',p.id==='J05'&&up);
  add('B03',extra&&q===1);add('B04',p.id==='B04'&&!extra&&t<=woodUntil+1e-8);add('B05',changed&&(p.id==='B05'||p.category==='管乐'&&near(by.B05,p)));
  add('G02',p.id==='G02'&&q===0);add('G04',q===0&&local(by.G04,p));add('G07',p.id==='G07'&&q===1);add('G10',p.id==='G10');
  add('D02',extra&&near(by.D02,p));add('D03',q>=3&&near(by.D03,p));add('D04',(solo||t<surgeEnd-1e-8)&&near(by.D04,p));add('D05',changed&&near(by.D05,p),true);
  const points=r.noteScores[q]*coef*(1+percent/100)+fixed;
  N+=points;totalNotes++;const st=stats[p.id];st.score+=points;st.qualities[q]++;st[extra?'additional':'regular']++;if(changed)st.changed++;if(up)st.up++;if(down)st.down++;
  if(extra){additional++;windowAdditional++;}else{regular++;windowRegular[p.id]=(windowRegular[p.id]||0)+1;}
  if(by.R01&&t>=surgeEnd-1e-8)surgeCount++;
  if(trace)noteTrace.push({time:+t.toFixed(6),source:p.id,quality:q,extra,points,coef,percent,fixed,...flags});
  return{q,flags};
 }
 function upgrade(p,q,flags,quota=null){
  const candidates=[];if(quota&&quota.left>0&&q>=1&&q<=2&&local(by.H01,p))candidates.push({id:'H01',prob:1});
  if(q===1&&(p.id==='H02'||p.category==='管乐'&&near(by.H02,p)))candidates.push({id:'H02',prob:v('H02')/100});
  candidates.sort((a,b)=>b.prob-a.prob||a.id.localeCompare(b.id));const c=candidates[0];let buff=0;
  if(c&&rng()<c.prob){q++;flags={...flags,changed:true,up:true};trigger(c.id);if(c.id==='H01'){quota.left--;buff=v('H01');}}
  return{q,flags,buff};
 }
 function extraNote(p,q,flags={},coef=1){const u=upgrade(p,q,flags);return addNote(p,u.q,true,u.flags,coef,0,u.buff);}
 function batch(clock){const p=clock.p;clock.batch++;let count=p.id==='C02'?4*violin:p.id==='R04'?p.area*2:p.area;const quota={left:2};
  for(let k=0;k<count;k++){
   let q=E.weighted(r.noteWeights[p.id==='P02'?'蓝':p.quality],rng),batchBuff=0,flags={};
   if(p.id==='H03'&&clock.batch%4===0){q=Math.max(3,q);batchBuff=v('H03');trigger('H03');}
   const mods=[];if(local(by.J01,p))mods.push({id:'J01',prob:v('J01')/100});if(p.id==='J02')mods.push({id:'J02',prob:.5});mods.sort((a,b)=>b.prob-a.prob||a.id.localeCompare(b.id));
   if(mods.length){const before=q;q=Math.max(0,Math.min(4,q+(rng()<mods[0].prob?1:-1)));flags={changed:q!==before,modulated:q!==before,up:q>before,down:q<before};trigger(mods[0].id);}
   const copies=[];if(q<=1&&near(by.P01,p))copies.push({id:'P01',prob:1,coef:v('P01')/100});if(p.id==='P02'&&q<=2)copies.push({id:'P02',prob:v('P02')/100,coef:1});copies.sort((a,b)=>b.prob-a.prob||b.coef-a.coef||a.id.localeCompare(b.id));
   const copy=copies[0]&&rng()<copies[0].prob?copies[0]:null,copyQ=q,copyFlags={...flags};
   const u=upgrade(p,q,flags,quota);addNote(p,u.q,false,u.flags,1,batchBuff,u.buff);
   if(copy){trigger(copy.id);extraNote(p,copyQ,copyFlags,copy.coef);}
   if(by.J03&&p.id!=='J03'&&u.flags.changed&&jazzWindow<v('J03')){jazzWindow++;trigger('J03');extraNote(by.J03,1);}
  }
  if(p.id==='C01'){const n=Math.min(4,new Set(inst.filter(x=>x.id!==p.id&&near(p,x)).map(x=>x.category)).size);for(let j=0;j<n;j++)extraNote(p,2);if(n)trigger('C01',n);}
 }
 function surge(){if(by.R01&&t<r.duration-1e-8&&t>=surgeEnd-1e-8&&surgeCount>=r.surgeThreshold&&v('R01')>0){surgeCount-=r.surgeThreshold;surgeEnd=t+v('R01');trigger('R01');event('高潮开始',`持续${v('R01')}秒；余数${surgeCount}`);}}
 // Event clock: preserve fractional progress through acceleration; freeze all regular clocks during Solo.
 while(t<r.duration-1e-8){
  const speed=t<surgeEnd-1e-8?2:1;
  let next=Math.min(r.duration,nextWindow,by.R02&&!soloDone?5:Infinity,solo?6:Infinity,soloNext,t<surgeEnd-1e-8?surgeEnd:Infinity);
  if(!solo)for(const c of clocks)next=Math.min(next,t+(1-c.progress)*c.interval/speed);
  const dt=Math.max(0,next-t);if(!solo)for(const c of clocks)c.progress+=dt*speed/c.interval;t=next;
  const surgeEnding=Math.abs(t-surgeEnd)<1e-8;
  if(surgeEnding)event('高潮结束','恢复常规速度');
  if(!solo)for(const c of clocks)if(c.progress>=1-1e-8){c.progress=Math.max(0,c.progress-1);batch(c);}
  if(solo&&Math.abs(t-soloNext)<1e-8){for(let n=0;n<G;n++)extraNote(by.R02,3,{solo:true});event('Solo出音',`${G}枚金音符`);soloNext+=.5;}
  if(Math.abs(t-nextWindow)<1e-8){
   if(by.R05&&Object.entries(windowRegular).filter(([id])=>id!=='R05').reduce((sum,[,n])=>sum+n,0)<12){for(let j=0;j<v('R05');j++)extraNote(by.R05,1);trigger('R05',v('R05'));}
   const wood=by.B04&&windowAdditional>=8;if(wood){woodUntil=t+1;trigger('B04');}
   timeline.push({time:+t.toFixed(6),notes:totalNotes,regular,additional,score:N,surge:t<surgeEnd-1e-8,solo,windowAdditional});
   nextWindow++;windowAdditional=0;windowRegular={};jazzWindow=0;
  }
  if(solo&&t>=6-1e-8){solo=false;soloNext=Infinity;event('Solo结束','常规计时器继续');}
  if(by.R02&&!soloDone&&t>=5-1e-8&&t<r.duration-1e-8){solo=true;soloDone=true;soloNext=t+.5;event('Solo开始',`冻结常规出音，G=${G}`);}
  surge();
 }
 if(Math.abs((timeline.at(-1)?.time??-1)-t)>1e-8)timeline.push({time:+t.toFixed(6),notes:totalNotes,regular,additional,score:N,surge:t<surgeEnd-1e-8,solo,windowAdditional});
 const rate=N/r.noteDivisor,total=Math.floor(preview.total*(1+rate)+1e-9);
 return{seed,preview:preview.total,total,N,rate,totalNotes,regular,additional,G,stats,effects,timeline,events,...(trace?{noteTrace}:{}),formula:`floor(${preview.total.toFixed(3)} × (1 + ${N.toFixed(3)} / ${r.noteDivisor})) = ${total}`};
}
function newState(data,mode='trial'){
 const st={mode,owned:{},placed:[],unlocked:E.initialCells(data.rules),unlockCredits:0,stamina:data.rules.initialStamina,spent:0,drawRemainder:0,unlockRemainder:0,drawCount:0,drawQueue:[],logs:[],scoreSum:0,shows:0,seed:'notes-0927',selected:null,version:data.version};
 if(mode==='test')for(const i of data.items)st.owned[i.id]={level:1,progress:0};
 else {st.owned.G05={level:1,progress:0};st.owned.G08={level:1,progress:0};st.placed=[{id:'G05',x:2,y:2},{id:'G08',x:3,y:2}];}
 return st;
}
function makeDraw(data,index,seed){const advanced=index%data.rules.advancedEvery===0,rng=E.random(seed),weights=advanced?data.rules.advancedWeights:data.rules.normalWeights,choices=[];const group=data.rules.sameQualityDraw?E.qualities[E.weighted(weights,rng)]:null;for(let k=0;k<3;k++){const q=group||E.qualities[E.weighted(weights,rng)],pool=data.items.filter(i=>i.quality===q&&!choices.includes(i.id));choices.push(pool[Math.floor(rng()*pool.length)].id);}return{index,advanced,choices};}
// Resource utility is shared with the previous validator; inject the new draw function explicitly.
function spend(state,data,amount){if(!Number.isInteger(amount)||amount<=0||state.stamina<amount)throw Error('体力不足或消耗值无效');if(state.drawQueue.length)throw Error('请先完成三选一');state.stamina-=amount;state.spent+=amount;const r=data.rules,room=49-state.unlocked.length-state.unlockCredits;let grants=0;if(room>0){state.unlockRemainder+=amount;grants=Math.min(room,Math.floor(state.unlockRemainder/r.unlockStamina)*r.unlockCells);state.unlockRemainder%=r.unlockStamina;state.unlockCredits+=grants;}if(state.unlocked.length+state.unlockCredits>=49)state.unlockRemainder=0;state.drawRemainder+=amount;while(state.drawRemainder>=r.drawStamina){state.drawRemainder-=r.drawStamina;state.drawCount++;state.drawQueue.push(makeDraw(data,state.drawCount,`${state.seed}:draw:${state.drawCount}`));}return grants;}
const api={...E,tierIndex:level=>level-1,score,performance,newState,makeDraw,spend,supported};if(typeof module!=='undefined')module.exports=api;else root.NumericEngine=api;
})(typeof window!=='undefined'?window:globalThis);

