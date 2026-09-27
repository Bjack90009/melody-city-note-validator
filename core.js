(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const qualities = ['绿','蓝','紫','金'];
  function tierIndex(level) { return level >= 6 ? 2 : level >= 3 ? 1 : 0; }
  function cells(p,item,cols=7) { return Array.from({length:item.width*item.height},(_,i)=>(p.y+Math.floor(i/item.width))*cols+p.x+i%item.width); }
  function adjacent(a,b) {return ((a.x+a.width===b.x||b.x+b.width===a.x)&&a.y<b.y+b.height&&b.y<a.y+a.height)||((a.y+a.height===b.y||b.y+b.height===a.y)&&a.x<b.x+b.width&&b.x<a.x+a.width);}
  // Direction uses the full orthogonal strip, without a distance limit or diagonal targets.
  function direction(a,b,side) {const overlapX=a.x<b.x+b.width&&b.x<a.x+a.width, overlapY=a.y<b.y+b.height&&b.y<a.y+a.height;
    return side==='up'?overlapX&&b.y+b.height<=a.y:side==='down'?overlapX&&b.y>=a.y+a.height:side==='left'?overlapY&&b.x+b.width<=a.x:overlapY&&b.x>=a.x+a.width;}
  function initialCells(rules) {let a=[];let x=Math.floor((rules.cols-rules.initialCols)/2),y=Math.floor((rules.rows-rules.initialRows)/2);for(let j=0;j<rules.initialRows;j++)for(let i=0;i<rules.initialCols;i++)a.push((y+j)*rules.cols+x+i);return a;}
  function validPlacement(state,data,id,x,y) {const item=data.items.find(i=>i.id===id);if(!item||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+item.width>data.rules.cols||y+item.height>data.rules.rows)return false;
    const wanted=cells({x,y},item,data.rules.cols);if(wanted.some(c=>!state.unlocked.includes(c)))return false;
    const busy=new Set(state.placed.filter(p=>p.id!==id).flatMap(p=>cells(p,data.items.find(i=>i.id===p.id),data.rules.cols)));return wanted.every(c=>!busy.has(c));}
  function placement(state,data,id,x,y,allowSwap=true){const i=data.items.find(i=>i.id===id);if(!i)return {valid:false};const overlaps=state.placed.filter(p=>p.id!==id&&cells(p,data.items.find(j=>j.id===p.id),data.rules.cols).some(c=>cells({x,y},i,data.rules.cols).includes(c)));if(overlaps.length>1||(!allowSwap&&overlaps.length))return {valid:false};const swapId=overlaps[0]?.id;return {valid:validPlacement({...state,placed:state.placed.filter(p=>p.id!==swapId)},data,id,x,y),swapId};}
  function manualUnlock(state,data,count){if(!Number.isInteger(count)||count<9||count>49)throw Error('格数须为9～49的整数');const origin=initialCells(data.rules),pool=new Set(origin);while(pool.size<count){let next=-1;for(let c=0;c<49;c++){if(pool.has(c))continue;const x=c%7,y=Math.floor(c/7);if([...pool].some(o=>Math.abs(o%7-x)+Math.abs(Math.floor(o/7)-y)===1)){next=c;break;}}pool.add(next);}state.unlocked=[...pool];const removed=state.placed.filter(p=>!cells(p,data.items.find(i=>i.id===p.id)).every(c=>pool.has(c)));state.placed=state.placed.filter(p=>!removed.includes(p));state.unlockCredits=0;state.unlockRemainder=0;return removed.map(p=>p.id);}
  function judgeTiming(progress){if(progress===null||!Number.isFinite(progress)||progress<0||progress>1)return 'Miss';const d=Math.abs(progress-.5);return d<=.08?'Perfect':d<=.18?'Great':d<=.32?'Good':'Miss';}
  function random(seed) {let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function weighted(weights,rng) {let v=rng()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){v-=weights[i];if(v<0)return i;}return weights.length-1;}
  function choose(state,data,id) {if(!state.drawQueue[0]?.choices.includes(id))throw Error('无效奖励');let message='新道具';if(state.owned[id]){const o=state.owned[id];if(o.level>=data.rules.maxLevel)message='已满级';else{o.progress++;if(o.progress>=data.rules.duplicatesPerLevel){o.progress-=data.rules.duplicatesPerLevel;o.level++;message=`升级至${o.level}级`;}else message=`升级进度${o.progress}/${data.rules.duplicatesPerLevel}`;}}else state.owned[id]={level:1,progress:0};state.drawQueue.shift();return message;}
  function unlock(state,data,cell) {if(!state.unlockCredits||state.unlocked.includes(cell)||cell<0||cell>=data.rules.rows*data.rules.cols)return false;const col=cell%data.rules.cols,row=Math.floor(cell/data.rules.cols);if(!state.unlocked.some(c=>Math.abs(c%data.rules.cols-col)+Math.abs(Math.floor(c/data.rules.cols)-row)===1))return false;state.unlocked.push(cell);state.unlockCredits--;return true;}
  const api={clone,qualities,tierIndex,cells,adjacent,direction,initialCells,validPlacement,placement,manualUnlock,judgeTiming,random,weighted,choose,unlock};
  if(typeof module!=='undefined')module.exports=api;else root.NumericEngine=api;
})(typeof window!=='undefined'?window:globalThis);
