import {reply} from '../../../lib/owner-auth.js';
import {readyDB} from '../../../lib/private-db.js';
const key='health-check-topics';
export async function onRequest({env,request}){
 try{
  const db=await readyDB(env),row=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(key).first();
  const assignments=row?JSON.parse(row.value):{},version=row?.updated||null;
  if(request.method==='GET')return reply({assignments,version});
  if(request.method!=='PUT')return reply({error:'请求方法不支持'},405);
  const text=await request.text();if(text.length>1000)return reply({error:'请求内容过长'},413);
  let body;try{body=JSON.parse(text)}catch{return reply({error:'请求格式不正确'},400)}
  const {id,topic,expectedVersion}=body;
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(id)||!['贫血','心血管','常规体检'].includes(topic))return reply({error:'报告编号或专题不正确'},400);
  if(version!==(expectedVersion||null))return reply({error:'另一设备已更新报告分类，请重新读取后再修改。',conflict:true},409);
  const next={...assignments,[id]:topic};if(Object.keys(next).length>5000)return reply({error:'报告分类已达到容量上限'},400);
  const payload=JSON.stringify(next),updated=new Date(Math.max(Date.now(),Date.parse(version||'')+1||0)).toISOString();
  const result=row?await db.prepare('UPDATE reed_connections SET value=?,updated=? WHERE id=? AND updated=?').bind(payload,updated,key,version).run():await db.prepare('INSERT INTO reed_connections(id,value,updated) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(key,payload,updated).run();
  if(!result.meta?.changes)return reply({error:'分类保存冲突，请重新读取。',conflict:true},409);
  const check=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(key).first();
  if(check?.updated!==updated||check?.value!==payload)return reply({error:'保存后核对失败，请重新读取'},503);
  return reply({assignments:next,version:updated,verified:true});
 }catch(error){return reply({error:error.message||'报告分类保存失败'},503)}
}
