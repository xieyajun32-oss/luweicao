import {reply} from '../../../lib/owner-auth.js';
import {readyDB} from '../../../lib/private-db.js';

async function materialDB(env){
 const base=await readyDB(env),db=typeof base.withSession==='function'?base.withSession('first-primary'):base;
 await db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS reed_material_history (id INTEGER PRIMARY KEY AUTOINCREMENT,item_id TEXT NOT NULL,version TEXT NOT NULL,payload TEXT NOT NULL,recorded_at TEXT NOT NULL)'),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_material_before_update BEFORE UPDATE ON reed_inbox WHEN json_extract(OLD.payload,'$.source') IS NOT 'Oura' AND OLD.payload<>NEW.payload BEGIN INSERT INTO reed_material_history(item_id,version,payload,recorded_at) VALUES(OLD.id,OLD.updated,OLD.payload,strftime('%Y-%m-%dT%H:%M:%fZ','now')); END"),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_material_history_no_update BEFORE UPDATE ON reed_material_history BEGIN SELECT RAISE(ABORT,'Material history is append only'); END"),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_material_history_no_delete BEFORE DELETE ON reed_material_history BEGIN SELECT RAISE(ABORT,'Material history is append only'); END")
 ]);return db;
}
function dateValid(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value}
export async function onRequest({env,request}){
 try{
  if(request.method!=='PATCH')return reply({error:'请求方法不支持'},405);
  const text=await request.text();if(text.length>1100000)return reply({error:'资料过长，请分次编辑'},413);
  const {id,expected,action,changes,value}=JSON.parse(text);
  if(typeof id!=='string'||!/^[a-zA-Z0-9:_-]{1,180}$/.test(id)||typeof expected!=='string'||!expected)return reply({error:'请先同步并核对资料版本'},400);
  if(!['edit','trash','restore','reading'].includes(action))return reply({error:'资料操作不支持'},400);
  if(action==='edit'&&(!changes||typeof changes.title!=='string'||changes.title.length>300||typeof changes.text!=='string'||changes.text.length>800000||!dateValid(changes.date)||typeof changes.readingNotes!=='string'||changes.readingNotes.length>30000))return reply({error:'请核对标题、日期、正文及阅读笔记'},400);
  if(action==='reading'&&typeof value!=='boolean')return reply({error:'专栏设置不正确'},400);
  const db=await materialDB(env),row=await db.prepare('SELECT payload,updated FROM reed_inbox WHERE id=?').bind(id).first();
  if(!row)return reply({error:'原资料未找到，未创建替代资料'},404);
  if(row.updated!==expected)return reply({error:'这篇资料已有新版本，原输入已保留，请重新读取后核对。',conflict:true},409);
  const item=JSON.parse(row.payload);if(item.source==='Oura')return reply({error:'此入口仅编辑本人提交的资料，不改写设备原始数据'},403);
  if(item.deletedAt&&action!=='restore')return reply({error:'资料已在回收站，请先恢复'},409);
  if(action==='edit'){if(item.text!==changes.text)item.analysisNeedsReview=Boolean(item.analysis);for(const key of ['title','text','date','readingNotes'])item[key]=changes[key];if(item.analysis?.documentDate&&item.date!==JSON.parse(row.payload).date)item.analysis={...item.analysis,documentDate:item.date}}
  if(action==='reading')item.readingBook=value;
  if(action==='trash'){item.statusBeforeDelete=item.status||'待整理';item.deletedAt=new Date().toISOString();item.status='已删除'}
  if(action==='restore'){if(!item.deletedAt)return reply({error:'这篇资料不在回收站'},409);item.status=item.statusBeforeDelete||'待整理';delete item.deletedAt;delete item.statusBeforeDelete}
  const updated=new Date(Math.max(Date.now(),(Date.parse(row.updated)||0)+1)).toISOString(),payload=JSON.stringify(item);
  const result=await db.prepare('UPDATE reed_inbox SET payload=?,updated=? WHERE id=? AND updated=?').bind(payload,updated,id,row.updated).run();
  if(!result.meta?.changes)return reply({error:'保存期间出现新版本，未覆盖其他修改。',conflict:true},409);
  const check=await db.prepare('SELECT payload,updated FROM reed_inbox WHERE id=?').bind(id).first();
  if(!check||check.updated!==updated||check.payload!==payload)return reply({error:'保存后发现新版本，请重新同步核对，输入保留'},409);
  return reply({item:{...item,serverUpdated:updated},verified:true,backupVerified:true});
 }catch(error){return reply({error:error.message||'资料操作失败，原记录保留'},503)}
}
