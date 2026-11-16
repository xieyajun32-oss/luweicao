import {readyDB} from './private-db.js';
export const WEEKLY_VERSION='weekly-review-v1';
export const localDate=(value=Date.now())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(value));
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value}
export const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function previousWeek(now=Date.now()){const day=localDate(now),dow=new Date(day+'T00:00:00Z').getUTCDay();return addDays(day,-((dow+6)%7)-7)}
export function validateWeek(start,now=Date.now()){if(!validDate(start)||new Date(start+'T00:00:00Z').getUTCDay()!==1||start>previousWeek(now))throw Error('请选择已经结束的一周，日期须为周一');return{start,end:addDays(start,6)}}
export async function weeklyDB(env){const db=await readyDB(env);await db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS reed_activity (id TEXT PRIMARY KEY,occurred TEXT NOT NULL,payload TEXT NOT NULL)'),
 db.prepare('CREATE INDEX IF NOT EXISTS reed_activity_occurred ON reed_activity(occurred)'),
 db.prepare('CREATE TABLE IF NOT EXISTS reed_weekly_context (device TEXT PRIMARY KEY,payload TEXT NOT NULL,updated TEXT NOT NULL)')]);return db}
const cut=(value,n=100000)=>typeof value==='string'?value.slice(0,n):'';
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export function cleanLocalContext(input){
 const value=plain(input),out={days:{},weeks:{},months:{},mem:[],inbox:{}};
 for(const [date,row] of Object.entries(plain(value.days)).slice(-1500)){if(!validDate(date)||!row||typeof row!=='object')continue;out.days[date]={raw:cut(row.raw),parts:Array.isArray(row.parts)?row.parts.slice(0,4).map(x=>cut(x)):[],saved:cut(row.saved,80),sourceId:cut(row.sourceId||row.intakeId,160)}}
 for(const key of ['weeks','months'])for(const [period,row] of Object.entries(plain(value[key])).slice(-300)){if(!row||typeof row!=='object'||!/^\d{4}-\d{2}(?:-\d{2})?$/.test(period))continue;out[key][period]={items:Array.isArray(row.items)?row.items.slice(0,3).map(x=>cut(x,1000)):[],states:Array.isArray(row.states)?row.states.slice(0,3).map(x=>cut(x,30)):[],review:cut(row.review,10000)}}
 out.mem=(Array.isArray(value.mem)?value.mem:[]).slice(-500).map(row=>typeof row==='string'?{text:cut(row,5000)}:{id:cut(row?.id,160),text:cut(row?.text,5000),confirmed:row?.confirmed===true,disabled:row?.disabled===true,sourceDate:cut(row?.sourceDate,10)});
 for(const [id,row] of Object.entries(plain(value.inbox)).slice(-2000)){if(!/^[\w:-]{1,160}$/.test(id)||!row||row.source==='Oura')continue;out.inbox[id]={id,date:cut(row.date,10),text:cut(row.text),source:cut(row.source,100),status:cut(row.status,30),domains:Array.isArray(row.domains)?row.domains.slice(0,8).map(x=>cut(x,30)):[],analysis:row.analysis?JSON.parse(JSON.stringify(row.analysis)):null,files:(Array.isArray(row.files)?row.files:[]).map(file=>({id:cut(file.id,160),name:cut(file.name,200),type:cut(file.type,100),cloud:file.cloud===true})),createdAt:cut(row.createdAt,40)}}
 return out;
}
export const activityKinds=new Set(['view','expand','collapse','save','save_failed','delete','restore','cloud_save','checkin_save','focus_save','investment_save','article_save','material_save','memory_save']);
export async function saveActivity(env,events,now=Date.now()){
 if(!Array.isArray(events)||events.length>50)throw Error('操作记录格式不正确');const db=await weeklyDB(env),clean=[],discarded=[];
 for(const row of events){if(!row||typeof row.id!=='string'||!/^[\w-]{1,100}$/.test(row.id)||!activityKinds.has(row.kind))throw Error('操作记录格式不正确');const timestamp=Date.parse(row.occurred);if(!Number.isFinite(timestamp)||timestamp>now+60000||timestamp<now-60*86400000){discarded.push(row.id);continue}clean.push({id:row.id,occurred:new Date(timestamp).toISOString(),kind:row.kind,section:cut(row.section,80),recordId:cut(row.recordId,160)})}
 for(const row of clean)await db.prepare('INSERT INTO reed_activity(id,occurred,payload) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(row.id,row.occurred,JSON.stringify(row)).run();
 return{accepted:clean.map(x=>x.id),discarded,verified:true};
}
