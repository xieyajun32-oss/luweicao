import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../static/system/inbox.js',import.meta.url),'utf8');
const helperSource=source.slice(source.indexOf('function intakeTimelineText'),source.indexOf('function intakeAnalysisHTML'));
const recordSource=source.slice(source.indexOf('const recordsBeforeIntake='),source.indexOf('const domainMatchesBeforeInbox='));
const items={
 strength:{id:'strength',text:'力量训练：深蹲、哑铃',date:'2026-11-11',status:'已归档',domains:['健康']},
 tennis:{id:'tennis',text:'网球记录\n和孩子打网球',date:'2026-11-10',status:'已归档',domains:['健康','人生时间轴']},
 diary10:{id:'diary10',text:'20261110 晨夕日记\n第一篇原文',date:'2026-11-10',status:'待整理',files:[{id:'photo10'}]},
 diary11:{id:'diary11',text:'20261111 晨夕日记\n第二篇原文',date:'2026-11-11',status:'已归档',files:[{id:'photo11'}]},
 reflection:{id:'reflection',text:'20261026 所思所想\n一次反思',date:'2026-11-12',status:'已归档',domains:['认知']},
 device:{id:'device',source:'Oura',text:'20261102 晨夕日记',status:'已归档'},
 note:{id:'note',text:'普通资料',date:'2026-11-09',status:'已归档',domains:['事业']},
 invalid:{id:'invalid',text:'20261301 所思所想',date:'2026-11-08',status:'已归档'},
 existing:{id:'existing',text:'网球记录：挥拍练习',date:'2026-11-09',status:'已归档',domains:['健康']}
};
const originalDiary={raw:'原有正式日记',parts:['一','二','三','四'],recordType:'已整理日记',photo:'photo-existing'};
for(const entries of [Object.entries(items),Object.entries(items).reverse()]){
 const scope={db:{inbox:Object.fromEntries(entries)},allRecords:()=>({'2026-11-09':structuredClone(originalDiary)}),parseTemplate:()=>null,recordText:v=>v.raw||'',domainText:(d,v)=>v.raw||''};
 vm.createContext(scope);vm.runInContext(helperSource+recordSource,scope);
 const result=scope.allRecords();
 assert.deepEqual(Object.keys(result).sort(),['2026-10-26','2026-11-09','2026-11-10','2026-11-11']);
 for(const [day,id] of [['2026-11-10','diary10'],['2026-11-11','diary11']]){
  assert.equal(result[day].raw,items[id].text);
  assert.equal(result[day].recordType,'原文记录');
  assert.deepEqual(Array.from(result[day].diarySourceIds),[id]);
  assert.equal(scope.db.inbox[id].files[0].id,id==='diary10'?'photo10':'photo11');
 }
 assert.deepEqual(Array.from(result['2026-11-11'].timelineSourceIds),['strength']);
 assert.deepEqual(Array.from(result['2026-11-10'].timelineSourceIds),['tennis']);
 for(const key of ['raw','recordType','photo'])assert.equal(result['2026-11-09'][key],originalDiary[key]);
 assert.deepEqual(Array.from(result['2026-11-09'].parts),originalDiary.parts);
 assert.equal(result['2026-10-26'].recordType,'资料记录');
 assert(scope.recordText(result['2026-10-26']).includes('一次反思'));
 assert(scope.recordText(result['2026-11-11']).includes('第二篇原文'));
 assert(scope.recordText(result['2026-11-11']).includes('深蹲'));
 assert.equal(scope.db.inbox.diary11.text,items.diary11.text);
 assert(!scope.db.days);
 assert.doesNotThrow(()=>scope.allRecords());
}
assert(source.includes("const intakeDomains=['健康','财富','事业','家庭','认知','人生时间轴']"));
assert(source.includes("d==='人生时间轴'&&intakeTimelineSuggested(x)"));
console.log('时间轴：同日训练不遮住日记，资料先后顺序不影响两篇日记原文、类型和照片；已有日记保留；日期反思正确归档：通过');
