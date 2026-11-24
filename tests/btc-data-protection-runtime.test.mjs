import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {JSDOM,VirtualConsole}=createRequire(import.meta.url)(process.env.BTC_JSDOM_MODULE||'jsdom');
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

const {DatabaseSync}=await import('node:sqlite');
const sql=new DatabaseSync(':memory:');function prepare(q){let args=[];return{bind(...v){args=v;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}}
const btcEnv={PRIVATE_DB:{prepare,async batch(items){return Promise.all(items.map(s=>s.run()))}}};
const btcAPI=await import('../functions/api/investments/btc.js');
const daily={id:'runtime-daily',date:'2026-11-23',btcPrice:65000,jinjinMultiple:2,ma200Shares:0,executionPrice:65000,amount:100,executed:true,note:'Anonymous original'};
const special={id:'runtime-special',date:'2026-11-23',btcPrice:65000,condition:'Anonymous condition',strategy:'Anonymous strategy',fundingSource:'定投资金',executionPrice:65000,amount:300,executed:true,note:''};
const originalPlan={entries:[daily],specialEntries:[special],custom:{preserve:'original'}};
await btcAPI.onRequest({env:btcEnv,request:new Request('https://preview.test/api/investments/btc',{method:'PUT',body:JSON.stringify({plan:originalPlan,expectedVersion:null})})});
let offline=false;const fallbackFetch=win.fetch;
win.fetch=async(url,init={})=>{const u=new URL(url,'https://preview.test');if(u.pathname!=='/api/investments/btc')return fallbackFetch(url,init);if(offline)throw Error('Anonymous offline');return btcAPI.onRequest({env:btcEnv,request:new Request(u.href,{method:init.method||'GET',body:init.body})})};
win.eval("go('五个领域');selectDomain(1)");await settle();win.eval("btcSelectTab('log')");await settle();
assert.equal(doc.querySelector('[aria-label="成交额"]').value,'100');assert(doc.querySelector('#btc-overall').textContent.includes('400'));assert(doc.querySelector('#btc-protection-status'));assert(doc.querySelector('.btc-tabs'));
const amount=doc.querySelector('[aria-label="成交额"]');amount.value='250';win.Function(amount.getAttribute('oninput')).call(amount);assert.equal(JSON.parse(win.localStorage.getItem('reed-btc-draft-v1')).plan.entries[0].amount,250);await win.eval('btcSave()');
let saved=JSON.parse(sql.prepare("SELECT value FROM reed_connections WHERE id='btc-investment-plan'").get().value);assert.equal(saved.entries[0].amount,250);assert.equal(saved.specialEntries[0].amount,300);assert.deepEqual(saved.custom,{preserve:'original'});assert(!win.localStorage.getItem('reed-btc-draft-v1'));assert(doc.querySelector('#btc-save-status').textContent.includes('服务器历史版本已保留'));
await win.eval('btcReadHistory()');assert(doc.querySelector('.btc-plan details').textContent.includes('保存版本'));const historyID=win.eval('btcHistory.at(-1).id');await win.eval('btcReadSnapshot('+historyID+')');assert(doc.querySelector('.btc-plan pre').textContent.includes('Anonymous original'));
offline=true;win.eval("btcSetField('runtime-daily','note','Anonymous retained unsaved input')");await win.eval('btcSave()');assert(doc.querySelector('#btc-save-status').textContent.includes('保存失败'));assert(win.localStorage.getItem('reed-btc-draft-v1').includes('retained unsaved input'));assert.equal(JSON.parse(sql.prepare("SELECT value FROM reed_connections WHERE id='btc-investment-plan'").get().value).entries[0].note,'Anonymous original');
await win.eval('btcReloadCloud()');assert(!win.eval('btcLoaded'));assert(win.localStorage.getItem('reed-btc-draft-v1'));offline=false;await win.eval('btcReloadCloud()');assert(win.eval('btcConflict'));assert(doc.querySelector('[aria-label="成交额"]').disabled);assert(doc.querySelector('.btc-plan [role="alert"]').textContent.includes('本机内容'));win.eval('btcUseDraft()');await win.eval('btcSave()');assert.equal(JSON.parse(sql.prepare("SELECT value FROM reed_connections WHERE id='btc-investment-plan'").get().value).entries[0].note,'Anonymous retained unsaved input');
// The visible unlock action refreshes the cloud and archives stale local content, without PUT.
win.eval("btcRecoveryDraft={plan:JSON.parse(JSON.stringify(btcPlan)),baseVersion:'old-version'};btcRecoveryDraft.plan.entries[0].amount=9999;btcConflict=true;render()");const beforeUnlock=JSON.stringify(sql.prepare("SELECT * FROM reed_connections WHERE id='btc-investment-plan'").get());const resumeButton=[...doc.querySelectorAll('.btc-plan button')].find(el=>el.textContent==='以当前云端为准，恢复编辑');assert(resumeButton);await win.Function('return '+resumeButton.getAttribute('onclick')).call(resumeButton);assert(!win.eval('btcConflict'));assert(!doc.querySelector('[aria-label="成交额"]').disabled);assert.equal(doc.querySelector('[aria-label="成交额"]').value,'250');assert.equal(JSON.stringify(sql.prepare("SELECT * FROM reed_connections WHERE id='btc-investment-plan'").get()),beforeUnlock);assert(JSON.parse(win.localStorage.getItem('reed-btc-recovered-drafts-v1')).some(item=>item.plan?.entries?.[0]?.amount===9999));
const storageWrite=win.Storage.prototype.setItem;win.Storage.prototype.setItem=function(){throw Error('Anonymous quota exceeded')};win.eval("btcSetField('runtime-daily','note','Anonymous quota test')");assert(doc.querySelector('#btc-save-status').textContent.includes('本机备份写入失败'));win.Storage.prototype.setItem=storageWrite;await win.eval('btcSave()');
win.eval("btcSelectTab('special')");assert.equal(doc.querySelector('[aria-label="特殊情况"]').value,'Anonymous condition');assert.equal(doc.querySelector('[aria-label="资金口径"]').value,'定投资金');
win.eval("selectDomain(0);healthSelect('总览')");await settle();assert(doc.querySelector('#healthReviewContent'));win.eval('selectDomain(2)');await settle();assert(doc.querySelector('.project-research'));assert.equal(jsErrors.length,0,jsErrors.join('\n'));assert(!requests.some(x=>/ocr|analy[sz]e/.test(x)));
console.log('BTC整页+实际API+SQLite：原交易展示、即时草稿、云端保存回读、历史只读、离线不丢输入、重读不覆盖草稿、手动恢复、特殊记录与扩展字段保留、健康投研入口保留：通过');win.close();
