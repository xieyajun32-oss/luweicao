import {weeklyDB,validateWeek,localDate,addDays,cleanLocalContext} from './weekly-store.js';
import '../static/system/health-model.js';
import {people} from '../static/system/checkin-model.js';

const parse=value=>{try{return JSON.parse(value)}catch{return null}};
const string=value=>typeof value==='string'?value:'';
const finite=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const round=value=>Math.round(value*100)/100;
export async function collectWeeklyContext(env,start){
 const period=validateWeek(start),db=await weeklyDB(env),sources=new Map(),limits=[],coverage={},inbox=new Map(),contexts=[];
 const tables=new Set(((await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results||[]).map(x=>x.name));
 const inWeek=date=>date>=period.start&&date<=period.end;
 function source(id,type,date,title,data,{priority=3,locator=null}={}){if(!id||sources.has(id))return;const text=typeof data==='string'?data:JSON.stringify(data);sources.set(id,{id,type,date:date||'',title,period:inWeek(date)?'本周':date&&date<start?'历史背景':'日期待核对',text,priority,locator})}
 async function scan(query,args,consume,label){let count=0;for(let offset=0;offset<20000;offset+=200){const rows=(await db.prepare(query+' LIMIT 200 OFFSET ?').bind(...args,offset).all()).results||[];for(const row of rows){consume(row);count++}if(rows.length<200){coverage[label]=count;return}if(offset===19800)limits.push(label+'超过20,000条，本次未覆盖全部记录。')}coverage[label]=count}
 // Only an explicit allow-list of connection keys is read. OAuth credentials and locks never enter the model context.
 const keys=['btc-investment-plan','altcoin-investment-plan','personal-project-research','personal-health-articles','health-check-topics'];
 const connections=(await db.prepare("SELECT id,value,updated FROM reed_connections WHERE id IN (?,?,?,?,?) OR id LIKE 'focus:%' OR id GLOB 'health-review:????-??-??' ORDER BY id").bind(...keys).all()).results||[];
 const getConnection=id=>parse(connections.find(row=>row.id===id)?.value||'null');
 let cloudAvailable=false;
 if(env.PRIVATE_STORE){try{const object=await env.PRIVATE_STORE.get('owner/state.json');if(object){contexts.push({state:cleanLocalContext(await object.json()),name:'私人云端备份',updated:object.uploaded?.toISOString?.()||''});cloudAvailable=true}}catch{limits.push('私人云端备份本次未读到，未将其视为没有资料。')}}
 const localRows=(await db.prepare('SELECT device,payload,updated FROM reed_weekly_context ORDER BY updated').all()).results||[];
 for(const row of localRows){const state=parse(row.payload);if(state)contexts.push({state,name:row.device,updated:row.updated})}
 coverage.localSnapshots=localRows.length;coverage.privateBackup=cloudAvailable;
 if(!cloudAvailable&&!localRows.length)limits.push('尚未收到浏览器已保存资料的周报快照，只有本机保存且未同步的内容可能缺失。');
 const legacyDays=new Map(),localFocus=new Map(),localMemories=new Map();
 for(const {state}of contexts){
  for(const [id,item]of Object.entries(state.inbox||{}))if(item.date<=period.end)inbox.set(id,item);
  for(const [date,row]of Object.entries(state.days||{}))if(date<=period.end&&(row.raw||row.parts?.some(Boolean)))legacyDays.set(row.sourceId||'legacy-day:'+date,{date,row});
  for(const [scope,records]of [['week',state.weeks],['month',state.months]])for(const [date,row]of Object.entries(records||{}))if(date<=period.end)localFocus.set('focus:'+scope+':'+date,{date,row});
  for(const row of state.mem||[])if(!row.disabled&&row.text)localMemories.set(row.id||'local-memory-'+localMemories.size,{date:row.sourceDate||'',row});
 }
 const since=addDays(start,-28);
 await scan("SELECT id,payload,updated FROM reed_inbox WHERE (coalesce(json_extract(payload,'$.source'),'')!='Oura' OR json_extract(payload,'$.date') BETWEEN ? AND ? OR json_extract(payload,'$.date') IS NULL) AND coalesce(json_extract(payload,'$.date'),'')<=? ORDER BY id",[since,period.end,period.end],row=>{const item=parse(row.payload);if(item)inbox.set(row.id,{...item,id:row.id,serverUpdated:row.updated})},'inboxScanned');
 const oura=[],ouraGroups=new Map();
 for(const item of inbox.values()){
  if(item.source==='Oura'){
   oura.push(item);if(!item.date){coverage.undatedDeviceTypes??=[];if(!coverage.undatedDeviceTypes.includes(item.sourceType))coverage.undatedDeviceTypes.push(item.sourceType);if(item.sourceType==='personal_info'){const raw=item.rawData||{};source('oura-profile','设备背景','','Oura 已保存个人资料（非本周测量）',{age:raw.age,biological_sex:raw.biological_sex,height:raw.height,weight:raw.weight},{priority:5})}}if(!inWeek(item.date))continue;const type=item.sourceType||'unknown',id='oura:'+item.date+':'+type;let group=ouraGroups.get(id);if(!group){group={date:item.date,type,count:0,metrics:{},latest:null};ouraGroups.set(id,group)}group.count++;
   const raw=item.rawData||{};let visited=0;function numbers(value,key='',depth=0){if(++visited>100000||depth>7)return;if(finite(value)!==null){const m=group.metrics[key]??={count:0,sum:0,min:value,max:value};m.count++;m.sum+=value;m.min=Math.min(m.min,value);m.max=Math.max(m.max,value)}else if(Array.isArray(value)){for(const item of value)numbers(item,key+'[]',depth+1)}else if(value&&typeof value==='object'){for(const [name,item]of Object.entries(value))numbers(item,key?key+'.'+name:name,depth+1)}}numbers(raw);if(visited>100000)limits.push(item.date+' '+type+'的采样数据超过本次汇总范围。');
   // Preserve all scalar/categorical fields and contributor scores; high-frequency arrays remain untranscribed.
   const compact=Object.fromEntries(Object.entries(raw).filter(([,value])=>!Array.isArray(value)&&(!value||typeof value!=='object')));if(raw.contributors)compact.contributors=raw.contributors;
   if(!group.latest||String(item.serverUpdated||'')>=group.latest.updated)group.latest={updated:item.serverUpdated||'',values:compact};
  }else{const files=(item.files||[]).map(file=>({name:file.name,type:file.type,cloud:file.cloud===true}));source(item.id,'资料原件',item.date,item.analysis?.summary||item.text?.split('\n')[0]||'资料记录',{status:item.status,originalText:item.text||'',previouslyExtractedText:item.extractedText||'',analysis:item.analysis||null,files,domains:item.domains||[]},{priority:inWeek(item.date)?0:4,locator:{kind:'inbox',id:item.id}})}
 }
 for(const [id,{date,row}]of legacyDays)if(!inbox.has(id))source(id,'已保存日记',date,date+' 日记',{raw:row.raw,parts:row.parts},{priority:inWeek(date)?0:5});
 for(const [id,group]of ouraGroups){const metrics=Object.fromEntries(Object.entries(group.metrics).map(([key,m])=>[key,{count:m.count,min:m.min,max:m.max,mean:round(m.sum/m.count)}]));source(id,'Oura 设备资料',group.date,group.date+' '+group.type,{sourceType:group.type,sampleCount:group.count,numericAggregates:metrics,latestScalarFields:group.latest?.values},{priority:2})}
 coverage.ouraTypes=[...new Set([...ouraGroups.values()].map(x=>x.type))];coverage.attachmentCount=[...inbox.values()].filter(x=>x.source!=='Oura').reduce((n,x)=>n+(x.files?.length||0),0);
 const model=globalThis.ReedHealth.model(oura.filter(x=>x.date>=since),period.end,35),health={};
 for(const metric of [...globalThis.ReedHealth.metrics,{key:'steps',label:'每日步数',unit:'步'}]){const points=model.daily.filter(x=>inWeek(x.date)&&finite(x.values[metric.key])!==null).map(x=>x.values[metric.key]),prior=model.daily.filter(x=>x.date>=addDays(start,-7)&&x.date<start&&finite(x.values[metric.key])!==null).map(x=>x.values[metric.key]);health[metric.label]={days:points.length,unit:metric.unit,mean:points.length?round(points.reduce((a,b)=>a+b,0)/points.length):null,previousWeekMean:prior.length?round(prior.reduce((a,b)=>a+b,0)/prior.length):null,previousWeekDays:prior.length}}
 health.training=model.training.filter(x=>inWeek(x.date)).map(({id,date,category,content,duration,source})=>({id,date,category,content,duration,source}));health.bodyComposition=model.bodySeries;
 source('weekly-health-metrics','程序核算',start,'本周健康指标（缺失值不补零）',health,{priority:0});
 const checkins=[];
 if(tables.has('reed_checkins'))await scan('SELECT day,person,payload,updated FROM reed_checkins WHERE day BETWEEN ? AND ? ORDER BY day,person',[start,period.end],row=>{const data=parse(row.payload);if(data){checkins.push({...row,data});source('checkin:'+row.day+':'+row.person,'打卡',row.day,(people[row.person]||'人员 '+row.person)+' 打卡',{person:row.person,personName:people[row.person],data},{priority:1})}},'checkinRecords');else coverage.checkinRecords=0;
 const checkinMetrics={};for(const row of checkins){const p=checkinMetrics[row.person]??={recordedDays:new Set(),completedChecks:0,items:{}};p.recordedDays.add(row.day);for(const [name,value]of Object.entries(row.data)){if(value?.done!==true)continue;p.completedChecks++;const m=p.items[name]??={days:0,minutes:0,quantity:0,minutesRecorded:0,quantityRecorded:0};m.days++;for(const part of value.parts||[]){if(finite(part.minutes)!==null){m.minutes+=part.minutes;m.minutesRecorded++}if(finite(part.quantity)!==null){m.quantity+=part.quantity;m.quantityRecorded++}}}}for(const row of Object.values(checkinMetrics))row.recordedDays=row.recordedDays.size;
 source('weekly-checkin-metrics','程序核算',start,'本周打卡核算（未填写不等于未完成）',{people,byPerson:checkinMetrics},{priority:0});
 const history=tables.has('reed_checkin_history')?(await db.prepare('SELECT count(*) AS n FROM reed_checkin_history WHERE updated>=? AND updated<?').bind(new Date(start+'T00:00:00+08:00').toISOString(),new Date(addDays(period.end,1)+'T00:00:00+08:00').toISOString()).first())?.n||0:0;coverage.checkinPriorVersions=history;
 if(tables.has('reed_checkin_projects')){const rows=(await db.prepare('SELECT person,item,group_name FROM reed_checkin_projects ORDER BY person,item').all()).results||[];source('checkin-projects','打卡项目配置','', '已保存的打卡项目',rows,{priority:5})}
 for(const row of connections){const value=parse(row.value);if(!value)continue;
  if(row.id.startsWith('focus:')){const date=row.id.split(':').at(-1);if(date<=period.end){localFocus.delete(row.id);source(row.id,'已保存重点计划',date,row.id,{data:value,completionRule:'仅已沉淀代表用户标记完成；计划与完成分开',savedAt:row.updated},{priority:row.id===('focus:week:'+start)||row.id===('focus:month:'+start.slice(0,7))?0:5})}}
  if(row.id==='health-check-topics')source(row.id,'检查专题分类背景','','已保存的检查资料分类',{assignments:value,note:'只作资料索引，不能由分类推断诊断或本周检查完成情况。'},{priority:5});
  if(row.id.startsWith('health-review:')){const date=row.id.slice(14);if(inWeek(date))source(row.id,'既有每日健康总结',date,date+' 每日健康总结',{summary:value.summary,insights:value.insights,limitations:value.limitations,coverage:value.coverage,status:'历史程序分析，不能当成诊断'},{priority:3})}
 }
 for(const [id,{date,row}]of localFocus)source(id,'本机已保存重点计划',date,id,row,{priority:id==='focus:week:'+start?0:5});
 const btc=getConnection('btc-investment-plan'),btcRows=[...(btc?.entries||[]).map(x=>({...x,table:'每日定投'})),...(btc?.specialEntries||[]).map(x=>({...x,table:'特殊情况'}))].filter(x=>inWeek(x.date));
 const btcMetrics={executedDays:0,principalAmount:0,extraAmount:0,estimatedBTC:0,missingAmount:0,missingExecutionPrice:0,unexecuted:0};const btcDates=new Set();
 for(const row of btcRows){source('btc:'+row.id,'BTC 执行记录',row.date,row.date+' '+row.table,row,{priority:1});if(!row.executed){btcMetrics.unexecuted++;continue}btcDates.add(row.date);if(finite(row.amount)!==null&&row.amount>=0){if(row.fundingSource==='额外资金')btcMetrics.extraAmount+=row.amount;else btcMetrics.principalAmount+=row.amount;if(finite(row.executionPrice)!==null&&row.executionPrice>0)btcMetrics.estimatedBTC+=row.amount/row.executionPrice;else if(row.amount)btcMetrics.missingExecutionPrice++}else btcMetrics.missingAmount++}
 function tradeTotals(rows){let amount=0,quantity=0,missingTradeData=false;for(const row of rows){amount+=finite(row.amount)??0;if(finite(row.amount)!==null&&row.amount>0&&finite(row.executionPrice)!==null&&row.executionPrice>0)quantity+=row.amount/row.executionPrice;else missingTradeData=true}return{amount,estimatedBTC:quantity,count:rows.length,missingTradeData,average:rows.length&&!missingTradeData&&quantity>0?amount/quantity:null}}
 const cumulative=[...(btc?.entries||[]).map(x=>({...x,table:'每日定投'})),...(btc?.specialEntries||[]).map(x=>({...x,table:'特殊情况'}))].filter(x=>x.date<=period.end&&x.executed),principal=rows=>rows.filter(x=>x.table==='每日定投'||x.fundingSource!=='额外资金'),extra=rows=>rows.filter(x=>x.table==='特殊情况'&&x.fundingSource==='额外资金');
 btcMetrics.weeklyPrincipal=tradeTotals(principal(btcRows.filter(x=>x.executed)));btcMetrics.weeklyExtra=tradeTotals(extra(btcRows.filter(x=>x.executed)));btcMetrics.cumulativePrincipal=tradeTotals(principal(cumulative));btcMetrics.cumulativeExtra=tradeTotals(extra(cumulative));btcMetrics.principalBudget=100000;btcMetrics.cumulativePositionPercent=round(btcMetrics.cumulativePrincipal.amount/100000*100);
 btcMetrics.executedDays=btcDates.size;btcMetrics.unit='美元；BTC数量按每笔成交额÷成交价估算；缺少成交资料时均价不计算';source('weekly-btc-metrics','程序核算',start,'本周 BTC 已执行金额与日期核算',btcMetrics,{priority:0});
 if(btc)source('btc-plan-context','当前投资规则背景','','BTC 当前保存的规则与资金口径',{...btc,entries:undefined,specialEntries:undefined,note:'当前版本背景，不据此断言上周每次编辑的过程；定投本金100000美元，额外资金另算。'},{priority:4});
 const alt=getConnection('altcoin-investment-plan');for(const row of alt?.entries||[])if(row.date<=period.end)source('alt:'+row.id,'山寨买入记录',row.date,row.symbol+' 买入',row,{priority:inWeek(row.date)?1:5});
 for(const [key,type]of [['personal-project-research','项目投研'],['personal-health-articles','健康专题文章']])for(const row of getConnection(key)||[]){const date=row.createdAt?localDate(row.createdAt):'';if(date&&date>period.end)continue;source(key+':'+row.id,type,date,row.title,{kind:row.kind,content:row.content,createdAt:row.createdAt,updatedAt:row.updatedAt,deletedAt:row.deletedAt,status:'按当前保存原文回看；不据此重建过去编辑过程'},{priority:inWeek(date)?1:4,locator:{kind:key,id:row.id}})}
 if(tables.has('reed_memories'))await scan('SELECT id,payload,updated FROM reed_memories ORDER BY id',[],row=>{const value=parse(row.payload);if(value&&!value.disabled&&value.confirmed){localMemories.delete(row.id);source('memory:'+row.id,'用户确认长期背景',value.sourceDate||'',value.text?.slice(0,50)||'长期背景',{text:value.text,updatedAt:row.updated,status:'背景或偏好不代表本周完成'},{priority:4})}},'memoriesScanned');
 for(const [id,{date,row}]of localMemories)source('local-memory:'+id,'本机记忆背景',date,row.text.slice(0,50),{text:row.text,confirmed:row.confirmed===true,status:'未确认内容只作待核对背景'},{priority:5});
 const from=new Date(start+'T00:00:00+08:00').toISOString(),until=new Date(addDays(period.end,1)+'T00:00:00+08:00').toISOString();
 const activity=(await db.prepare('SELECT payload FROM reed_activity WHERE occurred>=? AND occurred<? ORDER BY occurred,id LIMIT 20001').bind(from,until).all()).results||[],activitySummary={events:Math.min(activity.length,20000),days:{},kinds:{},sections:{}};
 for(const row of activity.slice(0,20000)){const e=parse(row.payload);if(!e)continue;const day=localDate(e.occurred);activitySummary.days[day]=(activitySummary.days[day]||0)+1;activitySummary.kinds[e.kind]=(activitySummary.kinds[e.kind]||0)+1;activitySummary.sections[e.section]=(activitySummary.sections[e.section]||0)+1}
 const firstActivity=await db.prepare('SELECT min(occurred) AS first FROM reed_activity').first();coverage.activityFirstRecorded=firstActivity?.first||null;coverage.activityEvents=activitySummary.events;
 if(!firstActivity?.first||firstActivity.first>=until)limits.push('这周发生时尚无完整网站操作日志，无法还原点击、阅读时长、修改次数或未保存输入；不能把没有日志当作没有行动。');else if(firstActivity.first>from)limits.push('网站操作日志仅覆盖本周部分时段。');
 if(activity.length>20000)limits.push('本周操作超过20,000条，操作分布未完全覆盖。');source('weekly-activity','网站操作记录',start,'本周可核验的网站使用分布',{...activitySummary,note:'次数不代表投入时间或完成质量；自动同步与周报自身不计作用户操作。'},{priority:0});
 limits.push('按当前已保存资料回看该周；后补录和事后修改可能已反映在原件中，无法重建所有历史版本。','照片和其他附件仅使用文件索引及此前已保存的提取结果，本次未自动读取图片内容。','家庭成员打卡分别统计，不能把孩子的记录算作本人完成；计划、原始自述、未确认整理与AI判断必须区分。');
 const sorted=[...sources.values()].sort((a,b)=>a.priority-b.priority||String(b.date).localeCompare(String(a.date))||a.id.localeCompare(b.id));let budget=60000,truncated=0;const included=[];
 for(const item of sorted){if(budget<200){truncated++;continue}const size=Math.min(item.text.length,item.priority<=1?9000:2500,budget-100),text=item.text.slice(0,size);if(size<item.text.length)truncated++;included.push({...item,text,truncated:size<item.text.length,originalCharacters:item.text.length});budget-=text.length+100}
 coverage.sourceRecords=sources.size;coverage.sourcesIncluded=included.length;coverage.truncatedSources=truncated;if(truncated)limits.push('共有'+truncated+'项来源被截短或未进入本次模型文本窗口；未展示部分不作确定结论。');
 return{schemaVersion:'weekly-context-v1',...period,generatedFromCurrentData:true,coverage,limits,sources:included,metrics:{health,checkins:checkinMetrics,btc:btcMetrics,activity:activitySummary}};
}
