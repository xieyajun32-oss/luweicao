import {reply} from '../../../lib/owner-auth.js';
import {readyDB} from '../../../lib/private-db.js';

const key='personal-health-articles';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
export async function onRequest({env,request}){
 try{
  const db=await readyDB(env);
  const row=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(key).first();
  const entries=row?JSON.parse(row.value):[],version=row?.updated||null;
  if(request.method==='GET')return reply({entries,version});
  if(request.method!=='PUT')return reply({error:'请求方法不支持'},405);
  const text=await request.text();if(text.length>210000)return reply({error:'正文过长，请控制在十万字以内'},413);
  let body;try{body=JSON.parse(text)}catch{return reply({error:'请求格式不正确'},400)}
  const {action,id,entry,expectedVersion}=body;
  if(!['save','delete','restore'].includes(action)||!validId(id))return reply({error:'操作或记录编号不正确'},400);
  if(version!==(expectedVersion||null))return reply({error:'另一设备已修改健康专题文章。请重新读取后核对再保存，当前输入已保留。',conflict:true},409);
  const index=entries.findIndex(item=>item.id===id),old=entries[index];
  const updated=new Date(Math.max(Date.now(),Date.parse(version||'')+1||0)).toISOString();
  if(action==='save'){
   if(!entry||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>200||!['资料','思考'].includes(entry.kind)||typeof entry.content!=='string'||entry.content.length>100000)return reply({error:'请填写标题；标题最多200字，正文最多十万字。'},400);
   if(old?.deletedAt)return reply({error:'该篇已删除，请先从回收站恢复。',conflict:true},409);
   if(index<0&&entries.length>=1000)return reply({error:'专题文章记录已达到容量上限'},400);
   const saved={id,title:entry.title.trim(),kind:entry.kind,content:entry.content,createdAt:old?.createdAt||updated,updatedAt:updated,deletedAt:null};
   if(index<0)entries.push(saved);else entries[index]=saved;
  }else{
   if(!old)return reply({error:'未找到这篇专题文章记录'},404);
   entries[index]={...old,deletedAt:action==='delete'?updated:null,updatedAt:updated};
  }
  const payload=JSON.stringify(entries);if(payload.length>4000000)return reply({error:'专题文章内容已达到容量上限'},413);
  const result=row?await db.prepare('UPDATE reed_connections SET value=?,updated=? WHERE id=? AND updated=?').bind(payload,updated,key,version).run():await db.prepare('INSERT INTO reed_connections(id,value,updated) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(key,payload,updated).run();
  if(!result.meta?.changes)return reply({error:'保存冲突；云端内容未覆盖，请重新读取。',conflict:true},409);
  const check=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(key).first();
  if(!check||check.updated!==updated||check.value!==payload)return reply({error:'保存后核对失败，请重新读取核实'},503);
  return reply({entries,version:updated,verified:true});
 }catch(error){return reply({error:error.message||'专题文章内容保存失败'},503)}
}
