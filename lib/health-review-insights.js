import '../static/system/health-model.js';
const H=globalThis.ReedHealth;
export const REVIEW_VERSION='recovery-insights-v1';
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const avg=a=>a.reduce((s,p)=>s+p.value,0)/a.length;
const round=v=>Math.round(v*10)/10;
const median=a=>{const b=a.map(p=>p.value).sort((a,b)=>a-b);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2};
const refs=a=>[...new Set(a.map(p=>p.id).filter(Boolean))];
const official={hrv:'https://support.ouraring.com/hc/en-us/articles/360025441974-Heart-Rate-Variability',balance:'https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors',radar:'https://support.ouraring.com/hc/en-us/articles/35593651188115-Symptom-Radar'};

// These are transparent website trend rules, never Oura's proprietary Symptom Radar classification.
export function buildHealthInsights(records,date,{sync=null}={}){
 const m=H.model(records,date,90),series={};
 for(const key of [...H.metrics.map(x=>x.key),'steps'])series[key]=m.daily.filter(d=>num(d.values[key])!==null).map(d=>({date:d.date,value:d.values[key],id:d.refs[key]}));
 const main=new Map();for(const x of m.sources.filter(x=>x.source==='Oura'&&x.sourceType==='sleep')){const old=main.get(x.date),a=x.rawData||{},b=old?.rawData||{};if(!old||((a.type==='long_sleep')!==(b.type==='long_sleep')?a.type==='long_sleep':(a.total_sleep_duration||0)>(b.total_sleep_duration||0)))main.set(x.date,x)}
 for(const [key,raw]of [['nightHrv','average_hrv'],['respiration','average_breath'],['sleepHours','total_sleep_duration']])series[key]=[...main.values()].filter(x=>num(x.rawData?.[raw])!==null).map(x=>({date:x.date,value:x.rawData[raw]/(key==='sleepHours'?3600:1),id:x.id})).sort((a,b)=>a.date.localeCompare(b.date));
 series.temperature=m.sources.filter(x=>x.source==='Oura'&&x.sourceType==='daily_readiness'&&num(x.rawData?.temperature_deviation)!==null).map(x=>({date:x.date,value:x.rawData.temperature_deviation,id:x.id})).sort((a,b)=>a.date.localeCompare(b.date));
 const latest=k=>series[k]?.at(-1),today=k=>latest(k)?.date===date?latest(k):null;
 const window=(k,a,b)=>series[k].filter(p=>p.date>=shift(date,a)&&p.date<=shift(date,b));
 const compare=k=>{const a=window(k,-6,0),b=window(k,-13,-7);return a.length>=4&&b.length>=4?{recent:a,previous:b,now:avg(a),before:avg(b),delta:avg(a)-avg(b)}:null};
 const current=!!today('readiness')&&!!today('sleepScore')&&!!today('heartRate'),insights=[],limitations=[];
 const add=(key,title,severity,trend,reason,action,followUp,points=[],extra={})=>insights.push({key,title,severity,trend,reason,action,followUp,sourceIds:refs(points),...extra});
 const sleep=compare('sleepHours'),rhr=compare('restingHeartRate'),training=m.training.filter(t=>t.date>=shift(date,-6)&&t.date<date);
 const context=[];if(sleep&&sleep.delta<=-0.5)context.push('同期睡眠时长缩短，恢复机会减少，值得先排查作息');
 if(rhr&&rhr.delta>=3)context.push('静息心率同期升高，与恢复负担增加的方向一致');
 if(training.length)context.push('最近有已归档的'+[...new Set(training.map(t=>t.category))].join('、')+'记录，可回看训练强度和安排是否留出恢复日');
 const contextPoints=[...(sleep?.recent||[]),...(sleep?.previous||[]),...(rhr?.recent||[]),...(rhr?.previous||[]),...training];
 const recoveryReason=()=>context.length?context.join('；')+'。这些是相关线索，不能确定因果；未记录的压力、饮酒、身体不适等仍需结合体感核对。':'现有资料不足以确定原因。睡眠不足、训练后的恢复压力、持续压力或身体不适都可能影响恢复，但没有记录时不能认定你存在这些情况。';
 const drift=k=>{const p=series[k],end=p.at(-1);if(!end||end.date!==date)return [];let out=[end];for(let i=p.length-2;i>=0&&out.length<14;i--){if(p[i].date!==shift(out[0].date,-1)||p[i].value<=out[0].value)break;out.unshift(p[i])}return out};
 const balance=compare('hrvBalance'),fall=drift('hrvBalance');
 if(today('hrvBalance')&&(fall.length>=3||balance?.delta<=-5)){
  const text=fall.length>=3?'心率变异性平衡连续 '+fall.length+' 天下降（'+round(fall[0].value)+' → '+round(fall.at(-1).value)+' 分）。':('心率变异性平衡近 7 天均值比前 7 天低 '+round(-balance.delta)+' 分，恢复趋势在走弱。');
  add('hrv-balance','恢复趋势需要关注','important',text,'HRV 平衡是 Oura 恢复贡献分，反映近期 HRV 相对长期基线的变化，不是毫秒值，也不能单独证明患病。'+recoveryReason(),'今天先把恢复放在加量前：若感觉疲劳，将高强度或力竭训练换成轻松活动，并保持规律就寝。','接下来观察几晚 HRV 平衡是否止跌，并同时看夜间 HRV 和静息心率；若持续恶化或伴明显不适，咨询医生。',[...fall,...(balance?.recent||[]),...(balance?.previous||[]),...contextPoints],{referenceUrl:official.balance});
 }
 const vital=[];
 for(const [key,label,delta,unit]of [['nightHrv','夜间 HRV',0.2,'毫秒'],['restingHeartRate','静息心率',5,'次/分'],['respiration','夜间呼吸频率',2,'次/分']]){
  const p=today(key),baseline=window(key,-14,-1);if(!p||baseline.length<7)continue;const base=median(baseline),bad=key==='nightHrv'?base>0&&p.value<=base*(1-delta):p.value-base>=delta;
  if(bad){vital.push(label);if(key==='nightHrv'&&insights.some(x=>x.key==='hrv-balance'))continue;
   add(key,label+'偏离近期个人水平','important',label+'今天为 '+round(p.value)+' '+unit+'，近 14 天已记录样本的中位数为 '+round(base)+' '+unit+'。','这是网站对你个人数据的比较，不是 Oura 体征雷达结论。'+recoveryReason(),'先核对昨晚佩戴和睡眠质量；今天按体感适当降低负荷，留出休息时间。','观察未来几晚是否回到自己的近期水平；若偏离持续或伴身体不适，咨询医生。',[p,...baseline,...contextPoints],{referenceUrl:key==='nightHrv'?official.hrv:official.balance});
  }
 }
 const temp=today('temperature');if(temp&&Math.abs(temp.value)>=0.5){vital.push('体温偏离');add('temperature','夜间体温偏离需要留意','important','Oura 夜间皮温相对基线'+(temp.value>0?'升高 ':'降低 ')+round(Math.abs(temp.value))+' ℃。','皮温偏离不是体温计读数，不能据此判断发热；环境、恢复状态或身体变化都可能有关，单次记录不能确定原因。','先核对佩戴和睡眠环境；若感觉发热或不舒服，使用体温计确认，并优先休息。','继续观察后续夜间变化；不适持续或加重时咨询医生。',[temp],{referenceUrl:official.radar})}
 if(vital.length>=2)add('combined','多项恢复信号同时变化','important','今天同时出现'+vital.join('、')+'的变化，需要比单项波动更认真地观察。','多项指标方向同时改变提示恢复负担可能增加，但不能据此判断感染或某种疾病，也不等于 Oura 的“主要／次要体征”。','今天优先休息和适度活动，暂缓追求训练强度；结合自己是否疲劳、疼痛或身体不适来安排。','若持续偏离个人水平或明显不适，及时咨询医生。',vital.flatMap(name=>{const k={夜间HRV:'nightHrv',静息心率:'restingHeartRate',夜间呼吸频率:'respiration',体温偏离:'temperature'}[name.replace(/ /g,'')];return k&&today(k)?[today(k)]:[]}));
 const lastSleeps=window('sleepHours',-2,0);if(today('sleepHours')&&lastSleeps.length>=2&&avg(lastSleeps)<7)add('sleep-duration','睡眠机会值得优先补足','important','近几晚实际睡眠平均约 '+round(avg(lastSleeps))+' 小时，睡眠恢复时间偏短。','睡眠时间偏短可能影响恢复；先区分是卧床时间不足，还是夜间清醒较多。仅凭时长不能确定睡眠问题的原因。','今晚预留更完整的睡眠机会，保持起床时间相对稳定，避免为了补运动继续推迟睡觉。','观察接下来几晚的实际睡眠、白天精神和恢复趋势是否一起改善。',lastSleeps);
 const readiness=compare('readiness'),sleepScore=compare('sleepScore');
 for(const [key,label,c]of [['readiness','准备度',readiness],['sleepScore','睡眠分数',sleepScore],['recoveryIndex','恢复指数',compare('recoveryIndex')]])if(today(key)&&c?.delta<=-5){
  add(key,label+'近期走弱','important',label+'近 7 天均值较前 7 天降低 '+round(-c.delta)+' 分；这是两个时段的比较，不代表每天都在下降。',key==='recoveryIndex'?'恢复指数是关于夜间心率何时稳定的 Oura 贡献分，不是恢复时长。晚间进餐、临睡前训练或压力可能影响它，但现有记录不能确定原因。':recoveryReason(),key==='sleepScore'?'今晚先保证完整的睡眠机会，回看是否因晚睡、夜间清醒或睡前活动影响了休息。':'今天根据精神和疲劳程度调整训练，先减少额外负荷，保持规律作息。','继续观察几晚能否回升，同时核对夜间心率、HRV 和白天体感，避免只追求提高分数。',[...c.recent,...c.previous,...contextPoints],{referenceUrl:official.balance});
 }
 if(!insights.length&&current){
  const improving=[['准备度',readiness],['睡眠分数',sleepScore],['HRV 平衡',balance]].filter(([,x])=>x?.delta>=5);
  if(improving.length){const [label,c]=improving[0];add('improving','恢复出现改善', 'normal',label+'近 7 天均值较前 7 天提高 '+round(c.delta)+' 分。','改善说明已记录样本的方向向好，仍需结合白天精神和训练后的体感，不能只凭分数决定加量。','保留最近有效的作息和恢复安排；若体感良好，再逐步恢复原有训练。','观察改善能否持续，而不是追求单日最高分。',[...c.recent,...c.previous]);}
  else add('steady','今天先保持节奏','normal','今天已有新的睡眠与恢复数据；在样本足够的指标中，暂未触发本页的持续下降或明显个人偏离提醒。','这不代表没有身体不适，也不等于 Oura 体征雷达“无体征”。单次高分不能抵消持续疲劳的体感。','按体感维持适量活动与稳定作息，训练后留意疲劳是否如常恢复。','继续观察自己的恢复趋势；身体不舒服时优先听从体感。',[today('readiness'),today('sleepScore'),today('heartRate')].filter(Boolean));
 }
 // Only preserve an explicitly reported Oura classification. Do not infer app alerts from scores.
 const alerts=[];for(const x of m.sources.filter(x=>x.date===date)){
  const isOuraReport=/Oura|Symptom Radar/i.test([x.source,x.text,x.analysis?.summary,...(x.files||[]).map(f=>f.name)].filter(Boolean).join(' '));
  const explicit=(x.analysis?.facts||[]).filter(f=>/Oura|体征雷达|症状雷达|Symptom Radar/i.test(f.name||'')||isOuraReport&&/体征/.test(f.name||'')).map(f=>String(f.value||'')).filter(t=>!/(无|没有|未见|不是|no signs|not )/i.test(t));
  if(x.source!=='Oura'){const text=[x.text,x.analysis?.summary].filter(Boolean).join('\n');for(const line of text.split(/[\n。；]/)){if(/Oura|Symptom Radar|体征雷达|症状雷达/i.test(line)&&/显示|报告|提示|出现|检测到|[:：]/.test(line)&&!/(无|没有|未见|否认|不是|如果|假如|是否|会不会|例如|示例|可能|[?？]|no signs|not )/i.test(line))explicit.push(line)}}
  for(const text of explicit){const level=/主要体征|重大体征|major signs/i.test(text)?'major':/次要体征|轻微体征|minor signs/i.test(text)?'minor':null;if(level&&!alerts.some(a=>a.level===level))alerts.push({level,sourceId:x.id})}
 }
 for(const a of alerts)add('oura-'+a.level,'Oura 提醒：'+(a.level==='major'?'主要体征':'次要体征'),'important','今天已归档的 Oura 资料明确报告了'+(a.level==='major'?'主要体征':'次要体征')+'。','Oura 的体征雷达结合多项生理指标及个人基线评估身体负担；分数高也不应忽略这项提醒。'+(vital.length?'今天本页也观察到'+vital.join('、')+'变化，可作为进一步核对的线索。':'当前可读取的数据不足以确定是哪项变化触发了提醒。'),'今天优先休息与恢复，查看 Oura App 提醒详情及变化最大的指标，避免勉强完成高强度训练。','若身体不适持续或加重，咨询医生；这项提醒本身不构成诊断。',[{id:a.sourceId}],{referenceUrl:official.radar});
 if(!alerts.length)limitations.push('当前接口未提供 Oura 体征雷达的主要／次要体征结果，不能据此判断有无体征；本页趋势提醒与 Oura 原始警报分开。');
 if(!current)limitations.unshift('复盘当天的核心睡眠与恢复数据尚不完整；历史变化仅供回看，不当作今天的身体状态。');
 if(sync?.status==='partial')limitations.unshift('本次 Oura 同步部分未完成，以下仅分析已成功保存的数据，不能代表完整情况。');
 const priorities={combined:1,'oura-major':0,'oura-minor':0,'hrv-balance':2,nightHrv:3,temperature:3,restingHeartRate:4,respiration:4,'sleep-duration':5};insights.sort((a,b)=>(priorities[a.key]??9)-(priorities[b.key]??9));
 const selected=insights.slice(0,5),important=selected.filter(x=>x.severity==='important');
 const summary=!current?'今天的数据还不完整，先保留已发现的线索，等同步齐全后再判断。':important.length?'今天优先关注'+important.slice(0,2).map(x=>x.title.replace(/^Oura 提醒：/,'')).join('和')+'，安排上先给恢复留出空间。':'今天以保持稳定节奏为主，重点观察趋势与体感是否一致。';
 return {schemaVersion:REVIEW_VERSION,date,summary,summaryImportant:current&&important.length>0,insights:selected,limitations,sources:m.sources.filter(x=>selected.some(i=>i.sourceIds.includes(x.id))).map(x=>({id:x.id,date:x.date,source:x.source})),dataThrough:m.daily.at(-1)?.date||null,current,method:'个人趋势比较与恢复建议；原因是待核对的可能因素，不作为诊断。'};
}
