import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../static/system/inbox.js',import.meta.url),'utf8');
const scope={db:{inbox:{
 diary:{id:'diary',text:'20261101 晨夕日记\\n原文',status:'待整理',files:[{id:'photo'}]},
 reflection:{id:'reflection',text:'20261026 所思所想\\n一次反思',date:'2026-11-12',status:'已归档',domains:['认知']},
 tennis:{id:'tennis',text:'网球记录\\n和孩子打网球',date:'2026-11-11',status:'已归档',domains:['健康','人生时间轴']},
 strength:{id:'strength',text:'力量训练：深蹲、哑铃',date:'2026-11-10',status:'已归档',domains:['健康']},
 device:{id:'device',source:'Oura',text:'20261102 晨夕日记',status:'已归档'},
 note:{id:'note',text:'普通资料',date:'2026-11-09',status:'已归档',domains:['事业']},
 invalid:{id:'invalid',text:'20261301 所思所想',date:'2026-11-08',status:'已归档'}
}},allRecords:()=>({}),parseTemplate:()=>null};vm.createContext(scope);
vm.runInContext(s.slice(s.indexOf('function intakeTimelineText'),s.indexOf('const domainMatchesBeforeInbox=')),scope);
const result=scope.allRecords();assert.deepEqual(Object.keys(result).sort(),['2026-10-26','2026-11-01','2026-11-10','2026-11-11']);
assert.equal(result['2026-10-26'].raw,'20261026 所思所想\\n一次反思');
assert.equal(result['2026-11-11'].recordType,'资料记录');assert(s.includes("const intakeDomains=['健康','财富','事业','家庭','认知','人生时间轴']"));assert(s.includes("if(intakeTimelineWorkout(x)||intakeDatedReflection(x))"));assert(s.includes("d==='人生时间轴'&&intakeTimelineSuggested(x)"));
assert.equal(result['2026-11-10'].timelineSourceIds[0],'strength');
assert(!scope.db.days);assert.doesNotThrow(()=>scope.allRecords());
console.log('明确日期反思、网球与力量训练进入人生时间轴；普通资料和 Oura 不进入，非法日期跳过：通过');