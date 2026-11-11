import {reply} from '../../../lib/owner-auth.js';
import {readyDB} from '../../../lib/private-db.js';

const recordKey='btc-investment-plan';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const optionalNumber=value=>value===null||value===''||value===undefined||Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000000;
function validPlan(plan){
 if(!plan||typeof plan!=='object'||!Array.isArray(plan.entries)||plan.entries.length>2000)return false;
 const ids=new Set();
 return plan.entries.every(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id)||ids.has(row.id)||!validDate(row.date)||typeof row.executed!=='boolean')return false;
  ids.add(row.id);
  return ['btcPrice','jinjinMultiple','executionPrice','amount'].every(key=>optionalNumber(row[key]))&&typeof (row.note??'')==='string'&&(row.note??'').length<=500;
 });
}

export async function onRequest({env,request}){
 try{
  const db=await readyDB(env);
  if(request.method==='GET'){
   const row=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(recordKey).first();
   return reply({plan:row?JSON.parse(row.value):null,version:row?.updated||null});
  }
  if(request.method!=='PUT')return reply({error:'请求方法不支持'},405);
  const text=await request.text();if(text.length>500000)return reply({error:'执行记录太多'},413);
  const {plan,expectedVersion}=JSON.parse(text);
  if(!validPlan(plan))return reply({error:'BTC计划或执行记录格式不正确'},400);
  const existing=await db.prepare('SELECT updated FROM reed_connections WHERE id=?').bind(recordKey).first();
  if((existing?.updated||null)!==(expectedVersion||null))return reply({error:'另一设备已更新 BTC 记录；已保留云端数据，请重新读取后再保存。',conflict:true},409);
  const updated=new Date().toISOString(),payload=JSON.stringify(plan);
  const result=existing
   ? await db.prepare('UPDATE reed_connections SET value=?,updated=? WHERE id=? AND updated=?').bind(payload,updated,recordKey,existing.updated).run()
   : await db.prepare('INSERT INTO reed_connections(id,value,updated) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(recordKey,payload,updated).run();
  if(!result.meta?.changes)return reply({error:'保存冲突；云端内容未覆盖。',conflict:true},409);
  const check=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(recordKey).first();
  if(!check||check.updated!==updated||check.value!==payload)return reply({error:'保存后核对失败，请重新读取'},503);
  return reply({version:updated,verified:true});
 }catch(error){return reply({error:error.message||'BTC记录保存失败'},503)}
}
