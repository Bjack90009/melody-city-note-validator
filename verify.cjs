const assert=require('node:assert/strict'),E=require('./note-engine.js'),base=require('./data.json');
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
const copy=()=>E.clone(base),item=(d,id)=>d.items.find(i=>i.id===id),close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function scene(entries,data=base){const s=E.newState(data,'test');s.unlocked=Array.from({length:49},(_,i)=>i);s.placed=entries.map(([id,x=0,y=0])=>({id,x,y}));return s;}
function run(entries,edit=()=>{},opts={}){const d=copy();edit(d);return E.performance(scene(entries,d),d,{seed:'verify-v03',trace:true,...opts});}
function flat(d,q=1){for(const k of E.qualities)d.rules.noteWeights[k]=Array.from({length:5},(_,i)=>+(i===q));}
const first=r=>r.noteTrace.filter(n=>n.time===.5),at=(r,t)=>r.noteTrace.filter(n=>n.time===t);
test('V0.3 IDs, six levels, 6 primary per flow and 15 generic connectors',()=>{
 assert.equal(base.version,'20260927-notes-v03');assert.equal(base.items.length,45);assert.deepEqual(base.items.map(i=>i.id).sort(),[...E.supported].sort());
 for(const i of base.items){assert.equal(i.base.length,6);assert.equal(i.effect.length,6);assert.equal(i.area,i.width*i.height);}
 for(const flow of ['古典','流行','华丽','摇滚','爵士']){const is=base.items.filter(i=>i.primary===flow);assert.equal(is.length,6);assert.equal(is.reduce((n,i)=>n+i.area,0),21);assert.equal(is.filter(i=>i.quality==='蓝').length,3);}
 assert.equal(base.items.filter(i=>i.primary==='通用').length,15);assert(base.items.filter(i=>i.category==='乐谱').every(i=>i.role==='连接'&&i.primary==='通用'));assert.equal(item(base,'P02').name,'尼龙吉他');
});
test('empty and scores-only bags emit nothing',()=>{assert.equal(run([]).total,0);assert.equal(run([['D01']]).totalNotes,0);});
test('20 default pulses, endpoint10 and quarter/basic score',()=>{const r=run([['G05']],d=>flat(d,0));assert.equal(r.regular,40);assert.equal(r.additional,0);assert.equal(r.quarter,40);assert.equal(r.eighth,0);close(r.N,40);close(r.preview,172.8);assert.equal(r.total,175);assert.equal(r.noteTrace[0].time,.5);assert.equal(r.noteTrace.at(-1).time,10);});
test('all six levels read independent values',()=>{const s=scene([['G05']]);for(let lv=1;lv<=6;lv++){s.owned.G05.level=lv;const i=item(base,'G05');close(E.score(s,base).total,i.base[lv-1]*(1+i.effect[lv-1]/100));}});
test('C03 category gate, global B01/B02/R04, D01 all adjacent categories',()=>{
 let r=E.score(scene([['C01'],['C03',4]]),base);assert.equal(r.info.C03.active,false);
 r=E.score(scene([['C01'],['C03',4],['G05',6],['G09',5,5]]),base);assert(r.info.C03.active);assert(r.info.C03.targets.includes('C01'));
 r=E.score(scene([['B01'],['B02',2],['R04',4],['G05',6,4],['G09',5,5],['G01',3,6]]),base);assert.deepEqual(r.info.B01.targets,['G01','R04']);assert(r.info.B02.targets.includes('G05'));assert(r.info.R04.targets.includes('G09'));
 r=E.score(scene([['D01'],['G06',2],['G09',0,1]]),base);assert.deepEqual(r.info.D01.targets,['G06','G09']);
 assert(!E.adjacent({x:0,y:0,width:1,height:1},{x:1,y:1,width:1,height:1}));
});
test('C02 one-second 4K violin template and 3-violin layout bonus',()=>{assert.equal(run([['C02']]).stats.C02.regular,40);const r=run([['C02'],['C05',3],['B02',4]]);assert.equal(r.stats.C02.regular,120);assert(E.score(scene([['C02'],['C05',3],['B02',4]]),base).info.C02.active);});
test('P02 fixed blue x2 area, R03 .25sec blue 65%, R04 default',()=>{const r=run([['P02'],['R03',3],['R04',0,4]],d=>flat(d,4));assert.equal(r.stats.P02.regular,160);assert.equal(r.stats.P02.qualities[1],160);assert.equal(r.stats.R03.regular,160);assert.equal(r.stats.R03.qualities[1],160);assert(r.noteTrace.filter(n=>n.source==='R03').every(n=>n.coef===.65));assert.equal(r.stats.R04.regular,60);});
test('P01 global category scope, source exclusion, no recursion',()=>{const r=run([['P01'],['G05',6,5],['G06',4,4]],d=>flat(d,1));assert.equal(r.stats.G05.additional,40);assert.equal(r.stats.G06.additional,0);assert.equal(r.stats.P01.additional,0);assert(r.noteTrace.filter(n=>n.extra).every(n=>n.coef===.6&&n.copyOf));});
test('H01 consumes originals; two pairs per GLOBAL batch, purple first',()=>{
 const r=run([['H01'],['G05',3]],d=>{flat(d,1);d.rules.noteWeights['金']=[0,0,1,0,0];});const b=r.batchTrace[0];
 assert.equal(b.phase2.filter(n=>n.harp).length,2);assert(b.phase2.filter(n=>n.harp).every(n=>n.quality===3&&n.source==='H01'));
 assert.equal(b.phase2.filter(n=>n.consumed).length,4);assert.equal(first(r).length,6);assert.equal(r.consumed,80);assert.equal(r.regular,120);
 assert(first(r).filter(n=>n.harp).every(n=>n.percent===60));
});
test('H01 stable source-ID pairing and no consumed blue copied',()=>{const r=run([['P01'],['H01',3],['G05',6]],d=>flat(d,1));const b=r.batchTrace[0];assert(b.phase2.filter(n=>n.harp).every(n=>n.parents.length===2));assert.equal(first(r).filter(n=>n.extra).length,4);assert(!first(r).some(n=>n.source==='G05'&&n.extra));const dead=new Set(b.phase2.filter(n=>n.consumed).map(n=>n.id));assert(first(r).every(n=>!dead.has(n.id)&&!dead.has(n.copyOf)));});
test('phase2 failure reserves note against lower-priority harp',()=>{const r=run([['H01'],['H02',3],['G06',5]],d=>{flat(d,1);item(d,'H02').effect.fill(0);});const b=r.batchTrace[0];assert(b.phase2.filter(n=>['H02','G06'].includes(n.source)).every(n=>n.claimed==='H02'&&n.quality===1&&!n.consumed));assert(b.phase2.filter(n=>n.harp).every(n=>n.source==='H01'));});
test('H03 samples blue table, gold gate is whole-phase1 batch',()=>{
 const a=run([['H03']],d=>{flat(d,4);d.rules.noteWeights['蓝']=[0,1,0,0,0];});assert.equal(a.stats.H03.qualities[1],80);assert.equal(a.effects.H03,undefined);
 const r=run([['H03'],['C01',3]],d=>{flat(d,1);d.rules.noteWeights['金']=[0,0,0,1,0];});const ns=first(r).filter(n=>n.source==='H03');assert.equal(ns.filter(n=>n.piano).length,2);assert(ns.filter(n=>n.piano).every(n=>n.quality===2&&n.percent===20));assert.equal(r.batchTrace[0].gold,6);
});
test('J01 diversity uses phase1, probability failure does not downshift',()=>{
 let r=run([['J01'],['G05',3]],d=>flat(d,1));assert(!r.noteTrace.some(n=>n.modulated));
 r=run([['J01'],['J02',3],['G05',5],['H02',6]],d=>{flat(d,1);d.rules.noteWeights['金']=[0,0,0,1,0];d.rules.noteWeights['绿']=[1,0,0,0,0];item(d,'J01').effect.fill(0);item(d,'H02').effect.fill(100);});
 assert.equal(r.batchTrace[0].diversity,3);assert(r.noteTrace.filter(n=>n.source==='H02').every(n=>n.claimed==='J01'&&n.quality===1));assert(!r.noteTrace.some(n=>n.source==='G05'&&n.changed));
});
test('J02 50/50 without unchanged interior; J02 precedes J01; boundary is not event',()=>{
 const r=run([['J02'],['J01',2],['G05',5]],d=>{flat(d,2);d.rules.duration=60;d.rules.noteWeights['金']=[0,0,0,1,0];d.rules.noteWeights['绿']=[1,0,0,0,0];item(d,'J01').effect.fill(100);});
 const ns=r.noteTrace.filter(n=>n.source==='J02');assert(ns.every(n=>n.claimed==='J02'&&n.modulated&&[1,3].includes(n.quality)));const up=ns.filter(n=>n.randomUp).length/ns.length;assert(up>.4&&up<.6);
 const edge=run([['J02'],['J03',2]],d=>flat(d,4));assert(edge.noteTrace.filter(n=>n.source==='J02'&&n.quality===4).every(n=>!n.changed&&!n.modulated));
});
test('J03 only actual random changes, max per (0,1], phase4 upgrade no feedback',()=>{
 const r=run([['J02'],['J03',2],['H02',5]],d=>{flat(d,2);item(d,'H02').effect.fill(100);});
 assert.equal(r.stats.J03.additional,40);assert(r.noteTrace.filter(n=>n.source==='J03'&&n.extra).every(n=>n.quality===2&&n.stableUp&&!n.modulated));assert.equal(r.timeline[0].windowAdditional,4);assert.equal(at(r,1).filter(n=>n.source==='J03'&&n.extra).length,0);assert.equal(at(r,1.5).filter(n=>n.source==='J03'&&n.extra).length,4);
 const stable=run([['H02'],['J03',2]],d=>{flat(d,1);item(d,'H02').effect.fill(100);});assert.equal(stable.stats.J03.additional,0);
});
test('copies inherit random flags, retain coefficient, fourth-round upgrade independent',()=>{
 const r=run([['J01'],['P01',3],['P02',5],['R03',2],['G08',4,5]],d=>{flat(d,2);d.rules.noteWeights['金']=[0,0,0,1,0];d.rules.noteWeights['绿']=[0,0,1,0,0];item(d,'J01').effect.fill(100);});
 const copies=r.noteTrace.filter(n=>n.extra&&n.source==='R03'&&n.modulated);assert(copies.length>0);assert(copies.every(n=>n.coef===.65*.6&&n.randomDown));
 const r2=run([['P01'],['G01',4],['H02',6]],d=>{flat(d,1);item(d,'H02').effect.fill(100);});assert(r2.noteTrace.filter(n=>n.extra).every(n=>n.source==='G01'&&n.quality===2));assert(r2.noteTrace.filter(n=>!n.extra&&n.source==='G01').every(n=>n.quality===1));
});
test('fixed points after additive percentages, copied bonuses recomputed once',()=>{const r=run([['P01'],['P02',3],['P03',0,4],['P04',3,5]],d=>flat(d,1));const n=first(r).find(n=>n.source==='P02'&&n.extra);assert.equal(n.fixed,.2);assert.equal(n.percent,14);close(n.points,1.4*.6*1.14+.2);});
test('Solo 4 G purple basic eighth pulses, frozen others, endpoint6, no additional',()=>{const r=run([['R02'],['G05',2],['D04',1]],d=>flat(d,1));assert.equal(r.G,6);assert.equal(r.stats.G05.regular,36);const ns=r.noteTrace.filter(n=>n.solo);assert.equal(ns.length,24);assert(ns.every(n=>n.type==='eighth'&&n.quality===2&&!n.extra));assert.deepEqual(r.events.filter(e=>e.type==='Solo出音').map(e=>e.time),[5.25,5.5,5.75,6]);assert(r.noteTrace.filter(n=>n.time>5&&n.time<=6).every(n=>n.solo));assert(ns.every(n=>n.percent===23));close(ns[0].points,2*.75*1.23);});
test('surge starts NEXT due batch, categories limited, dedicated template survives',()=>{const r=run([['R01'],['R03',4],['G01',0,3],['G06',5]],d=>{flat(d,1);d.rules.duration=2;d.rules.surgeThreshold=1;});assert.equal(r.events.find(e=>e.type==='高潮开始').time,.5);assert(at(r,.25).every(n=>n.type==='quarter'));assert(at(r,.5).filter(n=>['R01','R03'].includes(n.source)).every(n=>n.type==='eighth'));assert(r.noteTrace.filter(n=>['G01','G06'].includes(n.source)).every(n=>n.type==='quarter'));assert(r.noteTrace.filter(n=>n.source==='R03').every(n=>n.quality===1&&n.coef===.65));assert(r.noteTrace.some(n=>n.source==='R03'&&n.time===.625));const bs=r.batchTrace.filter(b=>b.surge);for(let k=1;k<bs.length;k++)if(bs[k].time<1.5)assert.equal(bs[k].surgeCount,bs[k-1].surgeCount);});
test('rock accumulation counts post-exchange survivor quarters',()=>{const r=run([['H01'],['R01',3]],d=>{flat(d,2);d.rules.duration=1;d.rules.surgeThreshold=9999;});assert.equal(r.batchTrace[0].surgeCount,10);assert.equal(r.batchTrace[1].surgeCount,20);});
test('queued surge at t5 waits through Solo until6',()=>{const r=run([['R01'],['R02',4]],d=>{flat(d,1);d.rules.surgeThreshold=100;});assert.equal(r.events.find(e=>e.type==='高潮开始').time,6);assert(r.batchTrace.filter(b=>b.solo).every(b=>!b.surge&&b.surgeCount===100));});
test('C01 phase3 quarter additions, C05/P05/H05/R05 scopes, no old R05 window notes',()=>{const r=run([['C01'],['G05',3],['C05',6],['P05',3,4],['H05',0,4],['R05',0,5]],d=>flat(d,3));const ns=first(r);assert.equal(ns.filter(n=>n.source==='C01'&&n.extra).length,1);assert.equal(ns.find(n=>n.source==='C01'&&n.extra).percent,6);assert(ns.filter(n=>n.quality===3).every(n=>n.percent===6));assert.equal(r.stats.R05.additional,0);});
test('B03 and B04 apply by note attributes across field, G10 only low quarters',()=>{const r=run([['R02'],['R03',2],['R01',3],['B03',0,5],['B04',2,5],['G10',5,5]],d=>{flat(d,4);d.rules.surgeThreshold=1;});const solo=r.noteTrace.find(n=>n.solo);assert(solo.percent>=23);const bass=r.noteTrace.find(n=>n.source==='R03'&&n.type==='eighth');assert(bass.percent>=23);assert(r.noteTrace.filter(n=>n.source==='G10').every(n=>n.percent===0));});
test('D02 low all types, D03 purple inclusive, D04 basic, D05 additional fixed',()=>{const r=run([['D02'],['G05',2],['D03',3],['C01',3,1],['D04',6,1],['D05',3,3]],d=>flat(d,2));assert(r.noteTrace.filter(n=>n.source==='C01'&&!n.extra).every(n=>n.percent===18));assert(r.noteTrace.filter(n=>n.source==='C01'&&n.extra).every(n=>n.percent===10&&n.fixed===.2));const low=run([['D02'],['G05',1]],d=>flat(d,1));assert(low.noteTrace.filter(n=>n.source==='G05').every(n=>n.percent===15));});
test('ten legal reference layouts, all levels, deterministic counts and score conservation',()=>{for(const [name,ps] of Object.entries(base.presets)){const s=scene([]);for(const p of ps){assert(E.validPlacement(s,base,p.id,p.x,p.y),name);s.placed.push(p);}for(let lv=1;lv<=6;lv++){for(const id in s.owned)s.owned[id].level=lv;const r=E.performance(s,base,{seed:name});assert(r.total>0);assert.equal(r.regular+r.additional,r.totalNotes);assert.equal(r.quarter+r.eighth,r.totalNotes);close(Object.values(r.stats).reduce((n,s)=>n+s.score,0),r.N);assert.equal(r.total,Math.floor(r.preview*(1+r.N/base.rules.noteDivisor)+1e-9));}}});
test('seed reproducible, placement iteration irrelevant, varied seed',()=>{const s=scene(base.presets['爵士'].map(p=>[p.id,p.x,p.y]));const a=E.performance(s,base,{seed:'same'});s.placed.reverse();assert.deepEqual(E.performance(s,base,{seed:'same'}),a);assert.notEqual(E.performance(s,base,{seed:'different'}).N,a.N);});
test('999 stamina, independent rewards, duplicate level, mixed-quality draws',()=>{const s=E.newState(base,'test');assert.equal(s.stamina,999);E.spend(s,base,5);assert.equal(s.stamina,994);assert.equal(s.unlocked.length,8);assert.equal(s.drawQueue.length,1);assert.equal(s.drawRemainder,2);const id=s.drawQueue[0].choices[0];E.choose(s,base,id);assert.equal(s.owned[id].level,2);let mixed=0;for(const sameQualityDraw of [true,false]){const d=copy();d.rules.sameQualityDraw=sameQualityDraw;for(let i=1;i<=100;i++){const q=E.makeDraw(d,i,'draw'+i),qualities=new Set(q.choices.map(id=>item(d,id).quality));assert.equal(q.advanced,i%7===0);assert.equal(new Set(q.choices).size,3);if(sameQualityDraw)assert.equal(qualities.size,1);else if(qualities.size>1)mixed++;}}assert(mixed>30);});
console.log(`${checks} V0.3 rule groups passed`);
