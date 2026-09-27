(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./core.js'):root.NumericEngine;
const supported=['C01','C02','C03','C04','C05','P01','P02','P03','P04','P05','H01','H02','H03','H04','H05','R01','R02','R03','R04','R05','J01','J02','J03','J04','J05','B01','B02','B03','B04','B05','G01','G02','G03','G04','G05','G06','G07','G08','G09','G10','D01','D02','D03','D04','D05'];
const value=(p)=>p.effect[p.level-1];
function context(state,data){return state.placed.map(p=>({...data.items.find(i=>i.id===p.id),...p,level:state.owned[p.id]?.level||1})).sort((a,b)=>a.id.localeCompare(b.id));}
function score(state,data){
 const ps=context(state,data),inst=ps.filter(p=>p.category!=='乐谱'),info=Object.fromEntries(ps.map(p=>[p.id,{id:p.id,name:p.name,base:p.base[p.level-1],member:0,ability:0,total:0,active:false,sources:[],matches:[],targets:[],count:0}]));
 for(const s of ps){let targets=[],scale=1;const near=inst.filter(t=>s.id!==t.id&&E.adjacent(s,t));
  switch(s.id){
   case'C01':scale=new Set(near.map(t=>t.category)).size;targets=scale?[s]:[];break;
   case'C02':targets=inst.filter(t=>t.tags.includes('提琴')).length>=3?[s]:[];break;
   case'C03':targets=new Set(inst.map(t=>t.category)).size>=3?inst.filter(t=>t.quality==='金'&&['键盘','弦乐'].includes(t.category)):[];break;
   case'C04':case'G03':targets=inst.filter(t=>t.category==='弦乐');break;
   case'B01':targets=inst.filter(t=>t.category==='键盘');break;
   case'B02':targets=inst.filter(t=>t.category==='弦乐');break;
   case'R04':targets=inst.filter(t=>['键盘','打击'].includes(t.category));break;
   case'G01':case'G05':targets=[s];break;
   case'G06':targets=inst.filter(t=>t.category==='管乐');break;
   case'G08':targets=inst.filter(t=>t.category==='键盘');break;
   case'G09':targets=inst.filter(t=>t.category==='打击');break;
   case'D01':targets=near;break;
  }
  const entry=info[s.id];entry.value=value(s);entry.targets=targets.map(t=>t.id);entry.matches=near.map(t=>t.id);entry.count=scale;entry.active=targets.length>0;
  if(s.id==='C02'){entry.matches=inst.filter(t=>t.tags.includes('提琴')).map(t=>t.id);entry.count=Math.min(3,entry.matches.length);}
  else if(s.id==='C03'){entry.matches=inst.map(t=>t.id);entry.count=new Set(inst.map(t=>t.category)).size;}
  else if(s.id!=='C01'){entry.matches=entry.targets;entry.count=entry.targets.length;}
  for(const t of targets){const n=t.base[t.level-1]*value(s)*scale/100;info[t.id].ability+=n;info[t.id].sources.push({name:s.name,value:n,type:'布局增益'});}
  // Event scopes are highlights only, never an implicit static bonus or a claimed proc.
  if(!['C01','C02','C03','C04','B01','B02','R04','G01','G05','G03','G06','G08','G09','D01'].includes(s.id)){
   let scope=[];
   if(['P02','H03','R02','R03','J02','J04','J05','G02','G07','G10'].includes(s.id))scope=[s];
   else if(s.category==='乐谱')scope=near;
   else if(['C05','P03','P04'].includes(s.id))scope=inst.filter(t=>['键盘','弦乐'].includes(t.category));
   else if(s.id==='P01')scope=inst.filter(t=>t.id!==s.id&&['键盘','弦乐'].includes(t.category));
   else if(['P05','G04'].includes(s.id))scope=inst.filter(t=>t.category==='弦乐');
   else if(['H04','B05'].includes(s.id))scope=inst.filter(t=>t.category==='管乐');
   else if(s.id==='H02')scope=inst.filter(t=>['管乐','键盘'].includes(t.category));
   else if(['H01','J01'].includes(s.id))scope=inst.filter(t=>['管乐','弦乐'].includes(t.category));
   else if(s.id==='J03')scope=[s];
   else if(s.id==='R01')scope=inst.filter(t=>['弦乐','打击'].includes(t.category));
   else scope=inst;
   entry.targets=scope.map(t=>t.id);entry.matches=['R01','R02','J03','J01','H03'].includes(s.id)?inst.map(t=>t.id):entry.targets;entry.active=false;
  }
 }
 let base=0,ability=0;for(const v of Object.values(info)){v.total=v.base+v.ability;base+=v.base;ability+=v.ability;}
 return{base,ability,total:base+ability,subtotal:base+ability,member:0,globalFixed:0,globalPercent:0,extraBeats:0,info,sets:[],globalSources:[]};
}
function performance(state,data,{seed='notes',trace=false}={}){
 const ps=context(state,data),inst=ps.filter(p=>p.category!=='乐谱'),by=Object.fromEntries(ps.map(p=>[p.id,p]));
 const r=data.rules,rng=E.random(seed),preview=score(state,data),G=inst.reduce((n,p)=>n+p.area,0),eps=1e-8;
 const v=id=>by[id]?value(by[id]):0,cat=(n,list)=>list.includes(n.p.category),near=(id,n)=>by[id]&&E.adjacent(by[id],n.p);
 const stats=Object.fromEntries(inst.map(p=>[p.id,{id:p.id,name:p.name,regular:0,additional:0,quarter:0,eighth:0,consumed:0,score:0,qualities:[0,0,0,0,0],changed:0,up:0,down:0}]));
 const effects={},timeline=[],events=[],noteTrace=[],batchTrace=[];
 let t=0,N=0,regular=0,additional=0,quarter=0,eighth=0,consumed=0,generatedBasic=0,serial=0,batchNo=0;
 let surgeEnd=-1,surgeCount=0,pending=false,solo=false,soloDone=false,soloNext=Infinity,nextWindow=1,jazzWindow=0,windowAdditional=0;
 const trigger=(id,n=1)=>{effects[id]=(effects[id]||0)+n;};
 const event=(type,detail)=>events.push({time:+t.toFixed(6),type,detail});
 const violin=Math.min(3,inst.filter(p=>p.tags.includes('提琴')).length);
 const interval=p=>p.id==='C02'?1:p.id==='R03'?.25:p.id==='P02'?.5:r.noteInterval;
 const clocks=inst.map(p=>({p,progress:0,interval:interval(p)}));
 const active=()=>t<surgeEnd-eps;
 const speed=p=>active()&&['弦乐','打击'].includes(p.category)?2:1;
 const make=(p,q,type='quarter',extra=false,coef=1,flags={})=>({id:++serial,p,q,initial:q,type,extra,coef,flags,claimed:null,consumed:false});
 function change(n,q,id,random=false){const before=n.q;n.q=Math.max(0,Math.min(4,q));if(n.q===before)return false;n.flags.changed=true;n.flags.up=n.flags.up||n.q>before;n.flags.down=n.flags.down||n.q<before;if(random){n.flags.modulated=true;n.flags.randomUp=n.q>before;n.flags.randomDown=n.q<before;}else n.flags.stableUp=true;trigger(id);return true;}
 const publicNote=n=>({id:n.id,source:n.p.id,quality:n.q,initial:n.initial,type:n.type,extra:n.extra,coef:n.coef,claimed:n.claimed,consumed:n.consumed,...n.flags});
 function settle(notes,due){
  batchNo++;generatedBasic+=notes.length;
  // Eligibility snapshots are immutable across phase 2; failures also reserve a target.
  const snapshot=notes.filter(n=>n.type==='quarter'),diversity=new Set(snapshot.map(n=>n.q)).size,gold=snapshot.filter(n=>n.q===3).length;
  const phase1=trace?notes.map(publicNote):null;
  for(const n of snapshot){
   if(by.J02&&n.p.id==='J02'){n.claimed='J02';change(n,n.q+(rng()<.5?1:-1),'J02',true);}
   else if(by.J01&&diversity>=3&&cat(n,['弦乐','管乐'])){n.claimed='J01';if(rng()<v('J01')/100)change(n,n.q+(rng()<.5?1:-1),'J01',true);}
   else if(by.H02&&n.initial===1&&cat(n,['管乐'])){n.claimed='H02';if(rng()<v('H02')/100)change(n,n.q+1,'H02');}
  }
  if(by.H01){let pairs=0;for(const q of [2,1]){
   const pool=snapshot.filter(n=>!n.claimed&&!n.consumed&&n.initial===q&&cat(n,['弦乐','管乐']));
   for(let k=0;k+1<pool.length&&pairs<2;k+=2){const a=pool[k],b=pool[k+1];for(const n of [a,b]){n.claimed='H01';n.consumed=true;consumed++;stats[n.p.id].consumed++;}
    const merged=make(a.p,q+1,'quarter',false,a.coef,{changed:true,up:true,stableUp:true,harp:true,parents:[a.id,b.id]});merged.claimed='H01';notes.push(merged);pairs++;trigger('H01');
   }
  }}
  if(by.H03&&gold>=3){let quota=2;for(const n of snapshot)if(quota&&!n.claimed&&!n.consumed&&n.p.id==='H03'&&[1,2].includes(n.initial)){n.claimed='H03';change(n,n.q+1,'H03');n.flags.piano=true;quota--;}}
  const surviving=notes.filter(n=>!n.consumed),extras=[];
  const phase2=trace?notes.map(publicNote):null;
  // Phase 3 never reads its own output. Copies keep provenance, not baked-in scoring.
  if(by.P01)for(const n of surviving)if(n.type==='quarter'&&n.q<=1&&n.p.id!=='P01'&&cat(n,['键盘','弦乐'])){
   extras.push(make(n.p,n.q,n.type,true,n.coef*v('P01')/100,{...n.flags,copyOf:n.id}));trigger('P01');
  }
  if(by.C01&&due.some(p=>p.id==='C01')){const k=Math.min(4,new Set(inst.filter(p=>p.id!=='C01'&&E.adjacent(by.C01,p)).map(p=>p.category)).size);for(let j=0;j<k;j++)extras.push(make(by.C01,2,'quarter',true));if(k)trigger('C01',k);}
  if(by.J03)for(const n of surviving)if(n.type==='quarter'&&n.p.id!=='J03'&&n.flags.modulated&&jazzWindow<v('J03')){extras.push(make(by.J03,1,'quarter',true,1,{accompanimentOf:n.id}));jazzWindow++;trigger('J03');}
  if(by.R01&&!active()&&!solo){surgeCount+=surviving.concat(extras).filter(n=>n.type==='quarter').length;if(surgeCount>=r.surgeThreshold&&v('R01')>0)pending=true;}
  // Phase 4 converts additional notes only; no feedback into phase 3.
  extras.sort((a,b)=>a.p.id.localeCompare(b.p.id)||a.id-b.id);
  if(by.H02)for(const n of extras)if(n.type==='quarter'&&n.q===1&&cat(n,['键盘','管乐'])){n.claimed='H02';if(rng()<v('H02')/100)change(n,n.q+1,'H02');}
  for(const n of surviving.concat(extras))scoreNote(n);
  if(trace)batchTrace.push({time:+t.toFixed(6),batch:batchNo,diversity,gold,phase1,phase2,phase4:extras.map(publicNote),surge:active(),solo,surgeCount});
 }
 function scoreNote(n){
  const {p,q,type,extra,flags}=n,quart=type==='quarter',eight=type==='eighth';let percent=0,fixed=0;
  const add=(id,yes,isFixed=false)=>{if(by[id]&&yes){if(isFixed)fixed+=v(id);else percent+=v(id);trigger(id);}};
  add('C05',quart&&q===2&&cat(n,['键盘','弦乐']));
  add('P02',p.id==='P02'&&quart&&q===1);add('P03',extra&&quart&&q<=1&&cat(n,['键盘','弦乐']),true);
  add('P04',quart&&q<=1&&cat(n,['键盘','弦乐']));add('P05',p.category==='弦乐'&&(quart&&q===1||eight&&q===2));
  if(flags.harp)percent+=v('H01');if(flags.piano)percent+=v('H03');
  add('H04',quart&&q>=3&&p.category==='管乐');add('H05',q===3);
  add('R02',p.id==='R02'&&flags.solo);add('R03',p.id==='R03'&&eight);add('R05',q===1);
  add('J02',p.id==='J02'&&quart&&flags.modulated);add('J04',p.id==='J04'&&quart&&flags.randomDown);add('J05',p.id==='J05'&&quart&&flags.up);
  add('B03',q===1&&(extra&&quart||eight));add('B04',quart&&flags.modulated||eight&&q===2);add('B05',quart&&p.category==='管乐'&&flags.changed);
  add('G02',p.id==='G02'&&quart&&q===0);add('G04',p.category==='弦乐'&&quart&&q===0);add('G07',p.id==='G07'&&quart&&q===1);add('G10',p.id==='G10'&&quart&&q<=1);
  add('D02',q<=1&&near('D02',n));add('D03',q>=2&&near('D03',n));add('D04',!extra&&near('D04',n));add('D05',extra&&near('D05',n),true);
  const points=r.noteScores[q]*(eight?.75:1)*n.coef*(1+percent/100)+fixed;
  N+=points;const s=stats[p.id];s.score+=points;s.qualities[q]++;s[extra?'additional':'regular']++;s[type]++;
  if(flags.changed)s.changed++;if(flags.up)s.up++;if(flags.down)s.down++;
  if(extra){additional++;windowAdditional++;}else regular++;if(quart)quarter++;else eighth++;
  if(trace)noteTrace.push({time:+t.toFixed(6),batch:batchNo,...publicNote(n),points,percent,fixed});
 }
 function startSurge(){if(!pending||solo||active())return;pending=false;surgeCount-=r.surgeThreshold;surgeEnd=t+v('R01');trigger('R01');event('高潮开始',`弦乐与打击间隔减半，基础生成八分；持续${v('R01')}秒，余数${surgeCount}`);}
 function basic(p){const type=active()&&['弦乐','打击'].includes(p.category)?'eighth':'quarter',count=p.id==='C02'?4*violin:p.id==='P02'?2*p.area:p.area;
  return Array.from({length:count},()=>make(p,['P02','R03'].includes(p.id)?1:E.weighted(r.noteWeights[p.id==='H03'?'蓝':p.quality],rng),type,false,p.id==='R03'?.65:1));
 }
 // Fractional clocks retain progress across acceleration and freeze during Solo.
 while(t<r.duration-eps){
  let next=Math.min(r.duration,nextWindow,by.R02&&!soloDone?5:Infinity,solo?6:Infinity,soloNext,active()?surgeEnd:Infinity);
  if(!solo)for(const c of clocks)next=Math.min(next,t+(1-c.progress)*c.interval/speed(c.p));
  const dt=Math.max(0,next-t);if(!solo)for(const c of clocks)c.progress+=dt*speed(c.p)/c.interval;t=next;
  if(Math.abs(t-surgeEnd)<eps)event('高潮结束','恢复普通出音模版与间隔');
  if(!solo){const due=clocks.filter(c=>c.progress>=1-eps);if(due.length){startSurge();for(const c of due)c.progress=Math.max(0,c.progress-1);settle(due.flatMap(c=>basic(c.p)),due.map(c=>c.p));}}
  if(solo&&Math.abs(t-soloNext)<eps){settle(Array.from({length:G},()=>make(by.R02,2,'eighth',false,1,{solo:true})),[by.R02]);event('Solo出音',`${G}枚紫色基础八分音符`);soloNext+=.25;}
  if(Math.abs(t-nextWindow)<eps){timeline.push({time:+t.toFixed(6),notes:regular+additional,regular,additional,quarter,eighth,consumed,score:N,surge:active(),solo,windowAdditional});nextWindow++;windowAdditional=0;jazzWindow=0;}
  if(solo&&t>=6-eps){solo=false;soloNext=Infinity;event('Solo结束','恢复普通计时器');if(t<r.duration-eps)startSurge();}
  if(by.R02&&!soloDone&&t>=5-eps&&t<r.duration-eps){solo=true;soloDone=true;soloNext=t+.25;event('Solo开始',`其他基础声源暂停；G=${G}，每0.25秒出音`);}
 }
 if(Math.abs((timeline.at(-1)?.time??-1)-t)>eps)timeline.push({time:+t.toFixed(6),notes:regular+additional,regular,additional,quarter,eighth,consumed,score:N,surge:active(),solo,windowAdditional});
 const rate=N/r.noteDivisor,total=Math.floor(preview.total*(1+rate)+1e-9);
 return{seed,preview:preview.total,total,N,rate,totalNotes:regular+additional,regular,additional,quarter,eighth,consumed,generatedBasic,G,stats,effects,timeline,events,...(trace?{noteTrace,batchTrace}:{}),formula:`floor(${preview.total.toFixed(3)} × (1 + ${N.toFixed(3)} / ${r.noteDivisor})) = ${total}`};
}

function newState(data,mode='trial'){
 const st={mode,owned:{},placed:[],unlocked:E.initialCells(data.rules),unlockCredits:0,stamina:data.rules.initialStamina,spent:0,drawRemainder:0,unlockRemainder:0,drawCount:0,drawQueue:[],logs:[],scoreSum:0,shows:0,seed:'notes-0927',selected:null,version:data.version};
 if(mode==='test')for(const i of data.items)st.owned[i.id]={level:1,progress:0};
 else {st.owned.G05={level:1,progress:0};st.owned.G08={level:1,progress:0};st.placed=[{id:'G05',x:2,y:2},{id:'G08',x:3,y:2}];}
 return st;
}
function makeDraw(data,index,seed){const advanced=index%data.rules.advancedEvery===0,rng=E.random(seed),weights=advanced?data.rules.advancedWeights:data.rules.normalWeights,choices=[];const group=data.rules.sameQualityDraw?E.qualities[E.weighted(weights,rng)]:null;for(let k=0;k<3;k++){const q=group||E.qualities[E.weighted(weights,rng)],pool=data.items.filter(i=>i.quality===q&&!choices.includes(i.id));choices.push(pool[Math.floor(rng()*pool.length)].id);}return{index,advanced,choices};}
// Resource utility is shared with the previous validator; inject the new draw function explicitly.
function autoUnlock(state,data){
 const opened=[],cols=data.rules.cols,size=cols*data.rules.rows;
 while(state.unlockCredits>0&&state.unlocked.length<size){
  const candidates=[];
  for(let c=0;c<size;c++)if(!state.unlocked.includes(c)&&state.unlocked.some(o=>Math.abs(o%cols-c%cols)+Math.abs(Math.floor(o/cols)-Math.floor(c/cols))===1))candidates.push(c);
  if(!candidates.length)break;
  const sequence=(state.unlockSequence||0)+1,rng=E.random(`${state.seed}:unlock:${sequence}`),cell=candidates[Math.floor(rng()*candidates.length)];
  if(!E.unlock(state,data,cell))break;
  state.unlockSequence=sequence;opened.push(cell);
 }
 if(state.unlocked.length===size){state.unlockCredits=0;state.unlockRemainder=0;}
 return opened;
}
function spend(state,data,amount){if(!Number.isInteger(amount)||amount<=0||state.stamina<amount)throw Error('体力不足或消耗值无效');if(state.drawQueue.length)throw Error('请先完成三选一');state.stamina-=amount;state.spent+=amount;const r=data.rules,room=49-state.unlocked.length-state.unlockCredits;let grants=0;if(room>0){state.unlockRemainder+=amount;grants=Math.min(room,Math.floor(state.unlockRemainder/r.unlockStamina)*r.unlockCells);state.unlockRemainder%=r.unlockStamina;state.unlockCredits+=grants;}if(state.unlocked.length+state.unlockCredits>=49)state.unlockRemainder=0;autoUnlock(state,data);state.drawRemainder+=amount;while(state.drawRemainder>=r.drawStamina){state.drawRemainder-=r.drawStamina;state.drawCount++;state.drawQueue.push(makeDraw(data,state.drawCount,`${state.seed}:draw:${state.drawCount}`));}return grants;}
const api={...E,tierIndex:level=>level-1,score,performance,newState,makeDraw,spend,autoUnlock,supported};if(typeof module!=='undefined')module.exports=api;else root.NumericEngine=api;
})(typeof window!=='undefined'?window:globalThis);

