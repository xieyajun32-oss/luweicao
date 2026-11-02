/* Shared, pure health projections. Original records remain unchanged. */
(function(root){
 const metrics=[
 {key:'readiness',label:'准备度',unit:'分',note:'Oura 准备度分数'},
 {key:'sleepScore',label:'睡眠分数',unit:'分',note:'Oura 睡眠分数'},
 {key:'heartRate',label:'心率',unit:'次/分',note:'主睡眠平均心率'},
 {key:'recoveryIndex',label:'恢复指数',unit:'分',note:'Oura 贡献分，非时长'},
 {key:'hrvBalance',label:'心率变异性平衡',unit:'分',note:'Oura HRV 平衡贡献分，非毫秒'},
 {key:'restingHeartRate',label:'静息心率',unit:'次/分',note:'Oura 静息心率'}
 ];
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'));
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const factNumber=f=>{if(!f||f.value===null||f.value===undefined)return null;const match=String(f.value).trim().match(/^(?:第\s*)?(-?\d+(?:\.\d+)?)\s*(?:kg|公斤|千克|%|％|天|日|分|次\/分)?$/i);return match?Number(match[1]):null};
 const sourceText=x=>[x.analysis?.summary,x.text,...(x.analysis?.facts||[]).map(f=>f.name+' '+f.value+' '+(f.source||''))].filter(Boolean).join('\n');
 const isBody=x=>x.analysis?.kind==='体测'||(x.analysis?.facts||[]).some(f=>/^(体重|体脂率|脂肪率|骨骼肌量?)$/.test(f.name));
 const isLeKe=x=>x.source!=='Oura'&&isBody(x)&&!(/华为|HUAWEI/i.test(sourceText(x)+' '+x.source))&&(/乐刻|LEKE|LEOAO/i.test(sourceText(x)+' '+x.source+' '+(x.files||[]).map(f=>f.name).join(' '))||x.provider==='乐刻');
 function model(input,until,days=30){
  const start=new Date(Date.parse(until+'T00:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
  const all=input.filter(x=>x.status==='已归档'&&x.domains?.includes('健康')&&(!x.date||x.date<=until)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.observedAt||b.createdAt||'').localeCompare(String(a.observedAt||a.createdAt||'')));
  const sources=all.filter(x=>validDate(x.date)&&x.date>=start),daily=new Map();
  const day=d=>{if(!daily.has(d))daily.set(d,{date:d,values:{},refs:{}});return daily.get(d)};
  const set=(x,k,v)=>{v=number(v);if(v!==null&&!(k in day(x.date).values)){day(x.date).values[k]=v;day(x.date).refs[k]=x.id}};
  const mainSleep=new Map();for(const x of sources.filter(x=>x.source==='Oura'&&x.sourceType==='sleep')){const old=mainSleep.get(x.date),v=x.rawData||{};if(!old||((v.type==='long_sleep')!==(old.rawData?.type==='long_sleep')?v.type==='long_sleep':(v.total_sleep_duration||0)>(old.rawData?.total_sleep_duration||0)))mainSleep.set(x.date,x)}
  for(const x of sources){const r=x.rawData||{};
   if(x.source==='Oura'&&x.sourceType==='daily_readiness'){set(x,'readiness',r.score);set(x,'recoveryIndex',r.contributors?.recovery_index);set(x,'hrvBalance',r.contributors?.hrv_balance)}
   if(x.source==='Oura'&&x.sourceType==='daily_sleep')set(x,'sleepScore',r.score);
   if(x.source==='Oura'&&x.sourceType==='daily_activity')set(x,'steps',r.steps);
  }
  for(const x of mainSleep.values()){set(x,'heartRate',x.rawData.average_heart_rate);set(x,'restingHeartRate',x.rawData.lowest_heart_rate)}
  const manual=[],device=[];for(const x of sources){let category=null,content='',duration=null;if(x.source==='Oura'&&x.sourceType==='workout'){const v=x.rawData||{};if(/^(strength_training|weight_training|weightlifting|traditional_strength_training|functional_strength_training)$/.test(v.activity||''))category='力量训练';if(v.activity==='tennis')category='网球训练';content=category||'';if(v.start_datetime&&v.end_datetime){const minutes=(Date.parse(v.end_datetime)-Date.parse(v.start_datetime))/60000;if(Number.isFinite(minutes)&&minutes>=0)duration=Math.round(minutes)}if(duration!==null)content+=' · '+duration+' 分钟';if(v.intensity)content+=' · 强度 '+v.intensity}
   else if(x.analysis?.kind==='训练'){const t=sourceText(x);if(/网球|tennis/i.test(t))category='网球训练';else if(/力量|抗阻|杠铃|哑铃|深蹲|硬拉|臀核心|胸背|增肌/.test(t))category='力量训练';content=x.analysis?.summary||x.text||''}
   if(category){const t={id:x.id,date:x.date,category,content,duration,source:x.source,files:x.files||[]};(x.source==='Oura'?device:manual).push(t)}
  }
  const manualDays=new Set(manual.map(x=>x.date+'|'+x.category)),seen=new Set();const training=[...manual,...device.filter(x=>!manualDays.has(x.date+'|'+x.category))].filter(x=>{const key=x.files.length?x.files.map(f=>f.id).sort().join('|'):x.id;if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>b.date.localeCompare(a.date));
  const bodies=all.filter(isLeKe),bodyPending=all.filter(x=>isBody(x)&&!isLeKe(x)&&!/华为|HUAWEI/i.test(sourceText(x)+' '+x.source)&&x.source!=='Oura');
  const bodyMetrics=[{key:'weight',label:'体重',unit:'kg',pattern:/^体重$/},{key:'bodyFat',label:'体脂率',unit:'%',pattern:/^(体脂率|脂肪率)$/},{key:'muscle',label:'骨骼肌',unit:'kg',pattern:/^骨骼肌(?:量)?$/}];
  const bodySeries={};for(const m of bodyMetrics){const points=new Map();for(const x of bodies){if(!validDate(x.date)||x.date<start||points.has(x.date))continue;const fact=x.analysis?.facts?.find(f=>m.pattern.test(f.name)),n=factNumber(fact),unit=fact?.unit||'';if(n===null||n<0||(m.key==='bodyFat'?n>100||!(unit===''||/^(%|％)$/.test(unit)):!(unit===''||/^(kg|公斤|千克)$/i.test(unit))))continue;points.set(x.date,{date:x.date,value:n,id:x.id})}bodySeries[m.key]=[...points.values()].sort((a,b)=>a.date.localeCompare(b.date))}
  return {start,until,days,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),training,bodies,bodyPending,bodyMetrics,bodySeries,checks:all.filter(x=>x.source!=='Oura'&&x.analysis?.kind==='检查'),sources:all};
 }
 function snapshot(input,date){const m=model(input,date,90),facts=[],refs=new Set();for(const row of m.daily)for(const [key,value]of Object.entries(row.values)){const label=key==='steps'?'每日步数':metrics.find(x=>x.key===key)?.label;facts.push({date:row.date,metric:label,value,unit:key==='steps'?'步':metrics.find(x=>x.key===key)?.unit,sourceId:row.refs[key]});refs.add(row.refs[key])}
  const bodies=m.bodies.slice(0,8).map(x=>{refs.add(x.id);return {id:x.id,date:x.date,facts:x.analysis?.facts||[]}}),checks=m.checks.slice(0,8).map(x=>{refs.add(x.id);return {id:x.id,date:x.date,summary:x.analysis?.summary||'',facts:x.analysis?.facts||[]}}),training=m.training.slice(0,40).map(x=>{refs.add(x.id);return {id:x.id,date:x.date,category:x.category,content:x.content}});
  for(const points of Object.values(m.bodySeries))for(const p of points)refs.add(p.id);
  return {date,windowStart:m.start,facts,bodies,checks,training,sources:m.sources.filter(x=>refs.has(x.id)).map(x=>({id:x.id,date:x.date,source:x.source})),missing:metrics.filter(v=>!m.daily.some(d=>d.values[v.key]!==undefined)).map(v=>v.label).concat(!bodies.length?['乐刻体成分']:[],!checks.length?['检查资料']:[])};
 }
 root.ReedHealth={metrics,model,snapshot,isLeKe,factNumber,sourceText,validDate};
})(globalThis);
