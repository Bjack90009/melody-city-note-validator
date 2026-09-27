// Run after editing data.json. No account-specific paths or credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),d=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
const E=require('../note-engine.js'),XLSX=require('../vendor/xlsx.full.min.js');
assert.equal(d.items.length,45);assert.deepEqual(d.items.map(i=>i.id).sort(),[...E.supported].sort());
for(const i of d.items){assert.equal(i.base.length,6);assert.equal(i.effect.length,6);assert([...i.base,...i.effect].every(Number.isFinite));assert([...i.base,...i.effect].every(n=>n>=0));assert.equal(i.area,i.width*i.height);assert(i.width>0&&i.height>0&&i.width<=7&&i.height<=7);}
assert(d.rules.noteDivisor>0);assert(d.rules.duration>=1&&d.rules.duration<=60);
fs.writeFileSync(path.join(root,'data.js'),'window.NUMERIC_DATA='+JSON.stringify(d)+';\n');
const wb=XLSX.utils.book_new(),add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
add('道具',[['ID','名称',...Array.from({length:6},(_,i)=>`${i+1}级基础`),...Array.from({length:6},(_,i)=>`${i+1}级效果`),'参数单位','效果说明'],...d.items.map(i=>[i.id,i.name,...i.base,...i.effect,i.param,i.description])]);
add('规则',[['字段','值(JSON格式)'],...Object.entries(d.rules).map(([k,v])=>[k,JSON.stringify(v)])]);
add('版本',[[d.version]]);
add('说明',[['09/27五流派候选V0.3 45件，基础和效果每级独立'],['数值源头data.json；修改后运行node scripts/sync-data.cjs'],['客户端Excel导入只保存当前浏览器；要发布请把改值写回data.json再同步'],['百分比填百分点，其他参数按参数单位；音符绿蓝紫金红，抽奖绿蓝紫金'],['新形状、ID、名称、机制需同步逻辑与测试；旧31件模板不兼容']]);
const xlsx=path.join(root,'爱乐之城-五流派数值配置.xlsx');fs.writeFileSync(xlsx,XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));
const read=XLSX.read(fs.readFileSync(xlsx),{type:'buffer'});assert.equal(XLSX.utils.sheet_to_json(read.Sheets['道具']).length,45);
console.log('Synced data.js and 45-item six-level Excel from data.json');
