import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../static/system/inbox.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function intakeTimelineText'),source.indexOf('function intakeAnalysisHTML'));
const projection=source.slice(source.indexOf('notebookEntries=function(){'),source.indexOf('const domainMatchesBeforeInbox='));
const items={
 diary:{id:'diary',text:'20261110 晨夕日记\n日记正文',date:'2026-11-10',status:'待整理',files:[{id:'diaryphoto',type:'image/png'}]},
 second:{id:'second',text:'20261110 晨夕日记\n同日第二篇日记',date:'2026-11-10',status:'已归档',files:[]},
 tennis:{id:'tennis',text:'20261110 网球记录\n网球正文',date:'2026-11-10',status:'已归档',domains:['健康'],files:[{id:'tennisphoto',type:'image/png'}]},
 strength:{id:'strength',text:'20261110 力量训练记录\n力量正文',date:'2026-11-10',status:'已归档',domains:['健康'],files:[]},
 reflection:{id:'reflection',text:'20261110 所思所想\n思考正文',date:'2026-11-12',status:'已归档',domains:['认知'],files:[]},
 repeated:{id:'repeated',text:'20261110 所思所想\n思考正文',date:'2026-11-12',status:'已归档',domains:['认知'],files:[]},
 device:{id:'device',source:'Oura',date:'2026-11-10',text:'力量训练',status:'已归档'},
 ordinary:{id:'ordinary',date:'2026-11-10',text:'普通资料',status:'已归档',domains:['事业']}
};
const before=JSON.stringify(items),legacy={'2026-11-09':{raw:'独立旧日记',parts:['','','',''],recordType:'已整理日记',photo:'data:image/png;base64,AA'},'2026-11-10':{raw:items.diary.text,parts:['','','',''],recordType:'原文记录'}};
for(const input of [items,Object.fromEntries(Object.entries(items).reverse())]){
 const scope={db:{inbox:input},recordsBeforeIntake:()=>legacy,parseTemplate:()=>null,notebookEntries:null};vm.createContext(scope);vm.runInContext(helpers+projection,scope);const entries=scope.notebookEntries(),records=new Map(entries);
 assert.equal(entries.length,7);assert.equal(entries.filter(([,v])=>v.date==='2026-11-10').length,6);
 for(const id of ['diary','second','tennis','strength','reflection','repeated']){const v=records.get('intake:'+id);assert(v,id);assert.equal(v.raw,items[id].text);assert.equal(v.title,items[id].text.split('\n')[0]);assert.equal(v.sourceId,id);assert.deepEqual(Array.from(v.diarySourceIds),[id]);assert(!v.timelineSourceIds);}
 assert.equal(records.get('intake:reflection').date,'2026-11-10');
 assert(!records.get('intake:diary').raw.includes('网球正文'));
 assert(!records.has('day:2026-11-10'),'same legacy copy should not duplicate the submitted original');
 assert(records.has('day:2026-11-09'));assert.equal(JSON.stringify(items),before);
}
console.log('时间轴：同日6次提交独立展示、相同内容的两次提交各保留、原文标题与照片来源隔离、旧副本不重复、原始资料不改写：通过');
