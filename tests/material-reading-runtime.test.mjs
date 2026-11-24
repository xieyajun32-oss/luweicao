import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {JSDOM,VirtualConsole}=createRequire(import.meta.url)(process.env.MATERIAL_JSDOM_MODULE||'jsdom');
import path from 'node:path';
import {webcrypto} from 'node:crypto';import {File} from 'node:buffer';
const root=path.resolve(import.meta.dirname,'..');
const html=await fs.readFile(path.join(root,'static/system/index.html'),'utf8');
const jsErrors=[],writes=[],requests=[],submittedItems=[],uploadedFiles=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>jsErrors.push(e.message));
const dom=new JSDOM(html,{url:'https://preview.test/system/',runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true});
const win=dom.window,doc=win.document,ctx=dom.getInternalVMContext();
win.Blob=Blob;win.FormData=FormData;
const state={days:{'2026-11-09':{parts:['计划','','实际','感受'],raw:'既有正式日记原文',photo:null}},drafts:{},draftPhotos:{},weeks:{},mem:[],inbox:{
 training11:{id:'training11',date:'2026-11-11',status:'已归档',domains:['健康'],text:'力量训练记录：哑铃深蹲3组',files:[]},
 tennis10:{id:'tennis10',date:'2026-11-10',status:'已归档',domains:['健康'],text:'网球记录：发球训练45分钟',files:[]},
 diary10:{id:'diary10',date:'2026-11-10',status:'待整理',text:'20261110 晨夕日记\n第一篇最近日记独有正文',files:[{id:'photo10',name:'日记10.png',type:'image/png',cloud:true}]},
 diary11:{id:'diary11',date:'2026-11-11',status:'待确认',text:'20261111 晨夕日记\n第二篇最近日记独有正文',files:[{id:'photo11',name:'日记11.png',type:'image/png',cloud:true}]},
 reflection:{id:'reflection',date:'2026-11-12',status:'已归档',domains:['认知'],text:'20261026 所思所想\n反思原文',files:[]}
}};
state.inbox.checkA={id:'checkA',date:'2026-09-17',status:'已归档',domains:['健康'],source:'用户提交',text:'Anonymous existing exam',analysis:{kind:'检查',summary:'Anonymous exam A',facts:[{name:'Test marker',value:'12',unit:'unit'}]},files:[{id:'examFile',name:'anonymous-exam.png',type:'image/png',cloud:true}]};state.inbox.checkB={...state.inbox.checkA,id:'checkB',analysis:{kind:'检查',summary:'Anonymous exam B',facts:[]}};state.inbox.checkC={...state.inbox.checkA,id:'checkC',analysis:{kind:'检查',summary:'Anonymous exam C',facts:[]}};
const checkins=[{day:'2026-11-10',person:0,data:{阅读:{done:true,parts:[{name:'成人测试书',minutes:20,quantity:null}]},运动:{done:true,parts:[{name:'跳绳',minutes:10,quantity:1000}]},平板支撑:{done:true,parts:[{name:'平板支撑',minutes:0.5,quantity:null}]},铁剂:{done:true,parts:[]},孩子英语:{done:true,parts:[]}},version:'v1'},{day:'2026-11-10',person:1,data:{中文阅读:{done:true,parts:[{name:'孩子原有阅读内容',minutes:15,quantity:null}]}},version:'v2'}];
const projects=[];const fixtureToday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());const historyDay=n=>new Date(Date.parse(fixtureToday+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
win.localStorage.setItem('reed-v1',JSON.stringify(state));
win.localStorage.setItem('reed-checkins-v1',JSON.stringify({records:Object.fromEntries(checkins.map(r=>[r.day+'|'+r.person,r])),drafts:{},projects}));
win.URL.createObjectURL=()=> 'blob:https://preview.test/test-image';win.URL.revokeObjectURL=()=>{};
const originalFiles=new Map();Object.defineProperty(win.crypto,'subtle',{value:webcrypto.subtle});
win.indexedDB={open(){const r={result:{transaction(){const tx={objectStore(){return {put(value){originalFiles.set(value.id,value);queueMicrotask(()=>tx.oncomplete?.())},get(id){const get={result:originalFiles.get(id)||{blob:new Blob(['test-image'],{type:'image/png'})}};queueMicrotask(()=>get.onsuccess?.());return get;}}}};return tx},close(){}}};queueMicrotask(()=>r.onsuccess?.());return r;}};
win.HTMLElement.prototype.scrollIntoView=function(){};
win.alert=message=>{throw Error('unexpected alert: '+message)};win.confirm=()=>true;
win.fetch=async(url,init={})=>{const u=new URL(url,'https://preview.test'),method=init.method||'GET';requests.push(method+' '+u.pathname);if(method!=='GET')writes.push(method+' '+u.pathname);let data={};
 if(u.pathname==='/api/inbox/items'&&method==='PUT'){const b=JSON.parse(init.body);submittedItems.push(b.item);data={verified:true,serverUpdated:'verified-fixture-version'};}
 else if(u.pathname==='/api/inbox/files'&&method==='POST'){uploadedFiles.push(init.body.get('file'));data={verified:true};}
 else if(u.pathname==='/api/session')data={configured:true,authenticated:true,databaseConfigured:true,aiConfigured:false};
 else if(u.pathname==='/api/inbox/items')data={items:Object.values(state.inbox),nextCursor:null};
 else if(u.pathname==='/api/checkins'&&u.searchParams.get('projects')==='1')data={projects};
 else if(u.pathname==='/api/checkins'&&method==='POST'){const b=JSON.parse(init.body);const project={person:b.person,item:b.name,group:b.group};projects.push(project);data={project,verified:true};}
 else if(u.pathname==='/api/checkins')data={records:checkins,next:null};
 else if(u.pathname==='/api/integrations/oura/status')data={connected:true,configured:true,freshness:[],sync:{status:'success',finishedAt:new Date().toISOString(),errors:[]}};
 else if(u.pathname==='/api/health/review'&&u.searchParams.get('history')==='1')data=u.searchParams.get('before')===historyDay(2)?{dates:[historyDay(3)],next:null}:{dates:[historyDay(1),historyDay(2)],next:historyDay(2)};
 else if(u.pathname==='/api/health/review'&&u.searchParams.get('date')===historyDay(2))data={review:{summary:'旧版历史内容',suggestions:[{text:'当时保存的建议'}],generatedAt:'旧版保存时间'}};
 else if(u.pathname==='/api/health/review')data={review:{date:u.searchParams.get('date'),summary:u.searchParams.get('date')===historyDay(1)?'昨日保留的总结原文':'恢复趋势需要关注',summaryImportant:true,generatedAt:new Date().toISOString(),insights:[{title:'恢复趋势需要关注',severity:'important',trend:'心率变异性平衡持续下降',reason:'睡眠不足是待核对因素，并非确定因果。',action:'今天按体感减少高强度训练。',followUp:'观察未来几晚是否止跌。',sourceIds:[]}],limitations:['当前接口未提供 Oura 体征雷达结果。']}};
 else if(u.pathname==='/api/memory')data={items:[]};
 else if(u.pathname==='/api/focus')data={record:null};
 else if(u.pathname==='/api/investments/btc')data={plan:null,version:null};
 return Response.json(data);
};
const inline=[...doc.querySelectorAll('script:not([src])')].map(x=>x.textContent).join('\n');
new vm.Script(inline,{filename:'index-inline.js'}).runInContext(ctx);
for(const p of ['workflows.js','views.js','image-ocr.js','inbox.js','health-model.js','health.js','memory.js','focus.js','btc.js','altcoins.js','project-research.js','health-articles.js']){
 const src=await fs.readFile(path.join(root,'static/system',p),'utf8');new vm.Script(src,{filename:p}).runInContext(ctx);
}
const model=new vm.SourceTextModule(await fs.readFile(path.join(root,'static/system/checkin-model.js'),'utf8'),{context:ctx,identifier:'checkin-model.js'});
const module=new vm.SourceTextModule(await fs.readFile(path.join(root,'static/system/checkins.js'),'utf8'),{context:ctx,identifier:'checkins.js'});
await model.link(()=>{throw Error('unexpected model import')});await module.link(spec=>{assert.equal(spec,'./checkin-model.js');return model});await module.evaluate();
const settle=()=>new Promise(r=>setTimeout(r,20));await settle();

const {DatabaseSync}=await import('node:sqlite');const sql=new DatabaseSync(':memory:');function prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}}
const env={PRIVATE_DB:{prepare,async batch(items){return Promise.all(items.map(x=>x.run()))}}};const {readyDB}=await import('../lib/private-db.js');await readyDB(env);
const today=win.eval('today'),articleIDs=['reading-one','reading-two','reading-three'];
for(const [i,id]of articleIDs.entries())state.inbox[id]={id,title:'Anonymous article '+(i+1),text:'Original full text '+(i+1)+' <script>must remain text</script>',date:today,createdAt:today+'T0'+i+':00:00Z',domains:['认知'],status:'已归档',source:'用户提交',files:id==='reading-one'?[{id:'preserved-image',name:'anonymous.png',type:'image/png',cloud:true}]:[],serverUpdated:'2026-11-24T00:00:00.000Z'};
for(let i=0;i<9;i++)state.inbox['other-'+i]={id:'other-'+i,text:'Unclassified source '+i,date:today,createdAt:today+'T10:00:00Z',status:'待整理',source:'用户提交',files:[],serverUpdated:'2026-11-24T00:00:00.000Z'};
for(const item of Object.values(state.inbox)){item.serverUpdated??='2026-11-24T00:00:00.000Z';const payload={...item};delete payload.serverUpdated;sql.prepare('INSERT INTO reed_inbox VALUES(?,?,?)').run(item.id,JSON.stringify(payload),item.serverUpdated)}
win.eval('db.inbox='+JSON.stringify(state.inbox));
const unrelatedBefore=JSON.stringify(sql.prepare("SELECT * FROM reed_inbox WHERE id NOT IN ('reading-one','other-0') ORDER BY id").all());
const {onRequest:manageAPI}=await import('../functions/api/inbox/manage.js');const {onRequest:itemsAPI}=await import('../functions/api/inbox/items.js');let offline=false;const previousFetch=win.fetch;
win.fetch=async(url,init={})=>{const u=new URL(url,'https://preview.test');if(u.pathname==='/api/inbox/manage'){if(offline)throw Error('Anonymous offline');return manageAPI({env,request:new Request(u.href,{method:init.method||'GET',body:init.body})})}if(u.pathname==='/api/inbox/items')return itemsAPI({env,request:new Request(u.href,{method:init.method||'GET',body:init.body})});return previousFetch(url,init)};
new vm.Script(await fs.readFile(path.join(root,'static/system/materials.js'),'utf8'),{filename:'materials.js'}).runInContext(ctx);
const style=doc.createElement('style');style.textContent=await fs.readFile(path.join(root,'static/system/materials.css'),'utf8');doc.head.append(style);
win.eval("go('今日记录')");await settle();assert.equal(doc.querySelectorAll('.material-history-list>.material-record').length,6);assert(doc.querySelector('.material-history-more'));assert.equal(doc.querySelectorAll('#intakePanel').length,1);assert(doc.querySelector('#intakePanel').closest('.material-compose-column'));assert.equal(win.getComputedStyle(doc.querySelector('.material-layout')).alignItems,'start');assert.equal(doc.querySelectorAll('.material-history-list>.material-record .material-actions button').length,12);
win.eval("go('五个领域');selectDomain(4)");await settle();assert(doc.querySelector('[aria-label="阅读资料本"]'));assert.equal(doc.querySelectorAll('.reading-entry').length,3);assert.equal(doc.querySelectorAll('.reading-body').length,0);win.eval("readingToggle('reading-one')");assert(doc.querySelector('.reading-prose').textContent.includes('Original full text 1'));assert(!doc.querySelector('.reading-prose script'));
win.eval("materialEdit('reading-one')");assert(doc.querySelector('#materialEditor'));win.eval("materialInput('text','Edited source, only this original');materialInput('readingNotes','My original reading notes');materialInput('title','Updated article title')");assert(win.localStorage.getItem('reed-material-editor-v1').includes('only this original'));win.eval('materialEditorVisible=false;render()');assert(!doc.querySelector('#materialEditor'));win.eval("materialEdit('reading-one')");assert.equal(doc.querySelector('[aria-label="资料原文"]').value,'Edited source, only this original');await win.eval('materialSave()');let saved=JSON.parse(sql.prepare("SELECT payload FROM reed_inbox WHERE id='reading-one'").get().payload);assert.equal(saved.title,'Updated article title');assert.equal(saved.readingNotes,'My original reading notes');assert.equal(saved.files[0].id,'preserved-image');assert.equal(doc.querySelectorAll('#materialEditor').length,0);
await win.eval("materialTrash('reading-one')");assert.equal(doc.querySelectorAll('.reading-entry').length,2);assert(sql.prepare("SELECT payload FROM reed_inbox WHERE id='reading-one'").get().payload.includes('deletedAt'));win.eval("go('今日记录')");assert(doc.querySelector('.material-trash'));await win.eval("materialRestore('reading-one')");win.eval("go('五个领域');selectDomain(4)");assert.equal(doc.querySelectorAll('.reading-entry').length,3);assert.equal(doc.querySelectorAll('.reading-body').length,1);
await win.eval("readingCollect('other-0',true)");assert.equal(doc.querySelectorAll('.reading-entry').length,4);await win.eval("readingCollect('other-0',false)");assert.equal(doc.querySelectorAll('.reading-entry').length,3);assert(!JSON.parse(sql.prepare("SELECT payload FROM reed_inbox WHERE id='other-0'").get().payload).deletedAt);
win.eval("materialEdit('reading-one');materialInput('text','Unsent edit survives')");offline=true;await win.eval('materialSave()');assert(doc.querySelector('#materialEditor'));assert.equal(doc.querySelector('[aria-label="资料原文"]').value,'Unsent edit survives');assert(win.localStorage.getItem('reed-material-editor-v1').includes('Unsent edit survives'));assert.notEqual(JSON.parse(sql.prepare("SELECT payload FROM reed_inbox WHERE id='reading-one'").get().payload).text,'Unsent edit survives');offline=false;
const updated=JSON.parse(sql.prepare("SELECT payload FROM reed_inbox WHERE id='reading-one'").get().payload);updated.title='Newer remote title';sql.prepare("UPDATE reed_inbox SET payload=?,updated=? WHERE id='reading-one'").run(JSON.stringify(updated),'2099-01-01T00:00:00.000Z');await win.eval('materialSave()');assert(doc.querySelector('#materialEditor'));assert.equal(JSON.parse(sql.prepare("SELECT payload FROM reed_inbox WHERE id='reading-one'").get().payload).title,'Newer remote title');
// During a save the editor is locked; its receipt must not clear another tab's draft.
win.eval("materialEditor=null;materialEdit('other-0');materialInput('text','Captured save text')");const liveFetch=win.fetch;let releaseSave;win.fetch=async(url,init={})=>{if(new URL(url,'https://preview.test').pathname==='/api/inbox/manage')await new Promise(resolve=>releaseSave=resolve);return liveFetch(url,init)};const saving=win.eval('materialSave()');assert(doc.querySelector('[aria-label="资料原文"]').disabled);win.eval("materialInput('text','Late edit must not enter disabled editor')");win.localStorage.setItem('reed-material-editor-v1',JSON.stringify({id:'other-tab',title:'Other tab',text:'Other tab pending draft',date:today,readingNotes:'',baseVersion:'foreign'}));releaseSave();await saving;win.fetch=liveFetch;assert.equal(JSON.parse(sql.prepare("SELECT payload FROM reed_inbox WHERE id='other-0'").get().payload).text,'Captured save text');assert(win.localStorage.getItem('reed-material-editor-v1').includes('Other tab pending draft'));
// New submitted reading material keeps its own ID, text and explicit collection choice.
win.eval("materialEditor=null;materialDraftReading=true;intakeDraftText='Anonymous newly submitted reading source';intakeDraftDate=today;intakeCapabilities.aiConfigured=false;go('今日记录')");await win.eval('submitIntake()');assert(win.eval("Object.values(db.inbox).some(x=>x.text==='Anonymous newly submitted reading source'&&x.readingBook===true)"));
// A delayed sync response cannot replace an already verified newer material edit.
const fetchBeforeDelayedSync=win.fetch;let releaseSync;win.fetch=async(url,init={})=>{if(new URL(url,'https://preview.test').pathname==='/api/inbox/items'&&(!init.method||init.method==='GET')){const oldResponse=await fetchBeforeDelayedSync(url,init);await new Promise(resolve=>releaseSync=resolve);return oldResponse}return fetchBeforeDelayedSync(url,init)};const syncing=win.eval('syncIntake()');for(let i=0;i<20&&!releaseSync;i++)await settle();assert(releaseSync);await win.eval("readingCollect('other-0',true)");const newerVersion=win.eval("db.inbox['other-0'].serverUpdated");releaseSync();await syncing;win.fetch=fetchBeforeDelayedSync;assert(win.eval("db.inbox['other-0'].readingBook"));assert.equal(win.eval("db.inbox['other-0'].serverUpdated"),newerVersion);
const unaffectedIDs=new Set(JSON.parse(unrelatedBefore).map(row=>row.id));assert.equal(JSON.stringify(sql.prepare("SELECT * FROM reed_inbox WHERE id NOT IN ('reading-one','other-0') ORDER BY id").all().filter(row=>unaffectedIDs.has(row.id))),unrelatedBefore);assert(sql.prepare('SELECT count(*) AS n FROM reed_material_history').get().n>=5);assert(!requests.some(x=>/ocr|analy[sz]e/.test(x)));
win.eval("materialEditor=null;go('五个领域');selectDomain(0);healthSelect('总览')");await settle();assert(doc.querySelector('#healthReviewContent'));win.eval('selectDomain(1)');await settle();assert(doc.querySelector('.btc-plan'));win.eval('selectDomain(2)');await settle();assert(doc.querySelector('.project-research'));assert.equal(jsErrors.length,0,jsErrors.join('\n'));
console.log('资料整页+实际API/SQLite：最近6条与独立排版、3篇同日文章独立收录/折叠、全文转义、编辑保存与原附件保留、回收站恢复、已有资料加入/移出、离线与冲突草稿保留、不自动读图、既有入口及其他原件不变：通过');win.close();
