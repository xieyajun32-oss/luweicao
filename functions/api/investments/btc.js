import {reply} from '../../../lib/owner-auth.js';
import {readyDB} from '../../../lib/private-db.js';

const recordKey='btc-investment-plan';
async function protectedDB(env){
 const base=await readyDB(env),db=typeof base.withSession==='function'?base.withSession('first-primary'):base;
 await db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS reed_btc_history (id INTEGER PRIMARY KEY AUTOINCREMENT,version TEXT NOT NULL,payload TEXT NOT NULL,recorded_at TEXT NOT NULL,reason TEXT NOT NULL)'),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_btc_before_update BEFORE UPDATE ON reed_connections WHEN OLD.id='btc-investment-plan' AND OLD.value<>NEW.value BEGIN INSERT INTO reed_btc_history(version,payload,recorded_at,reason) VALUES(OLD.updated,OLD.value,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'before-update'); END"),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_btc_before_delete BEFORE DELETE ON reed_connections WHEN OLD.id='btc-investment-plan' BEGIN INSERT INTO reed_btc_history(version,payload,recorded_at,reason) VALUES(OLD.updated,OLD.value,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'before-delete'); END"),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_btc_history_no_update BEFORE UPDATE ON reed_btc_history BEGIN SELECT RAISE(ABORT,'BTC history is append only'); END"),
  db.prepare("CREATE TRIGGER IF NOT EXISTS reed_btc_history_no_delete BEFORE DELETE ON reed_btc_history BEGIN SELECT RAISE(ABORT,'BTC history is append only'); END")]);
 return db;
}
async function snapshotCurrent(db){await db.prepare("INSERT INTO reed_btc_history(version,payload,recorded_at,reason) SELECT updated,value,?, 'verified-current' FROM reed_connections WHERE id=? AND NOT EXISTS(SELECT 1 FROM reed_btc_history h WHERE h.version=reed_connections.updated AND h.payload=reed_connections.value)").bind(new Date().toISOString(),recordKey).run()}
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const optionalNumber=value=>value===null||value===''||value===undefined||Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000000;
function validPlan(plan){
 if(!plan||typeof plan!=='object'||!Array.isArray(plan.entries)||(plan.specialEntries!==undefined&&!Array.isArray(plan.specialEntries))||plan.entries.length+(plan.specialEntries?.length||0)>2000)return false;
 const ids=new Set();
 return [...plan.entries,...(plan.specialEntries||[])].every(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id)||ids.has(row.id)||!validDate(row.date)||typeof row.executed!=='boolean')return false;
  ids.add(row.id);
  return ['btcPrice','jinjinMultiple','ma200Shares','executionPrice','amount'].every(key=>optionalNumber(row[key]))&&typeof (row.note??'')==='string'&&(row.note??'').length<=500&&['condition','strategy'].every(key=>row[key]===undefined||typeof row[key]==='string'&&row[key].length<=500)&&(row.fundingSource===undefined||['定投资金','额外资金'].includes(row.fundingSource));
 });
}

export async function onRequest({env,request}){
 try{
  const db=await protectedDB(env);
  if(request.method==='GET'){
   await snapshotCurrent(db);const params=new URL(request.url).searchParams;
   if(params.has('snapshot')){const id=params.get('snapshot');if(!/^[1-9]\d*$/.test(id))return reply({error:'版本编号不正确'},400);const row=await db.prepare('SELECT id,version,payload,recorded_at,reason FROM reed_btc_history WHERE id=?').bind(Number(id)).first();return row?reply({snapshot:{id:row.id,version:row.version,recordedAt:row.recorded_at,reason:row.reason,plan:JSON.parse(row.payload)}}):reply({error:'该版本未找到，未改动当前数据'},404)}
   if(params.get('history')==='1'){const before=params.get('before')||String(Number.MAX_SAFE_INTEGER);if(!/^\d+$/.test(before))return reply({error:'分页参数不正确'},400);const rows=(await db.prepare("SELECT id,version,recorded_at,reason,json_array_length(payload,'$.entries') AS entries,coalesce(json_array_length(payload,'$.specialEntries'),0) AS specialEntries FROM reed_btc_history WHERE id<? ORDER BY id DESC LIMIT 21").bind(Number(before)).all()).results||[];return reply({history:rows.slice(0,20),next:rows.length>20?rows[19].id:null})}
   const row=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(recordKey).first();
   if(!row&&await db.prepare('SELECT id FROM reed_btc_history LIMIT 1').first())return reply({error:'当前BTC记录缺失，但已有保存历史，已停止新建覆盖；请查看保存版本并核对。',historyAvailable:true},503);
   return reply({plan:row?JSON.parse(row.value):null,version:row?.updated||null});
  }
  if(request.method!=='PUT')return reply({error:'请求方法不支持'},405);
  const text=await request.text();if(text.length>500000)return reply({error:'执行记录太多'},413);
  const {plan,expectedVersion}=JSON.parse(text);
  if(!validPlan(plan))return reply({error:'BTC计划或执行记录格式不正确'},400);
  const existing=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(recordKey).first();
  if(!existing&&await db.prepare('SELECT id FROM reed_btc_history LIMIT 1').first())return reply({error:'已有历史版本但当前记录缺失，已阻止重新初始化，请先核对历史。',conflict:true},409);
  if((existing?.updated||null)!==(expectedVersion||null))return reply({error:'另一设备已更新 BTC 记录；已保留云端数据，请重新读取后再保存。',conflict:true},409);
  if(existing){const old=JSON.parse(existing.value);for(const table of ['entries','specialEntries']){const ids=new Set((plan[table]||[]).map(r=>r.id));if((old[table]||[]).some(r=>!ids.has(r.id)))return reply({error:'本次内容缺少云端已有记录，已阻止整表覆盖；请先核对版本和备份。',conflict:true},409)}for(const key of Object.keys(old))if(!(key in plan))return reply({error:'本次内容缺少已保存的字段，已阻止覆盖。',conflict:true},409);for(const table of ['entries','specialEntries']){const oldRows=new Map((old[table]||[]).map(r=>[r.id,r]));for(const row of plan[table]||[])for(const key of Object.keys(oldRows.get(row.id)||{}))if(!(key in row))return reply({error:'本次记录缺少原有字段，已阻止覆盖。',conflict:true},409)}}
  const updated=new Date(Math.max(Date.now(),(Date.parse(existing?.updated)||0)+1)).toISOString(),payload=JSON.stringify(plan);
  const result=existing
   ? await db.prepare('UPDATE reed_connections SET value=?,updated=? WHERE id=? AND updated=?').bind(payload,updated,recordKey,existing.updated).run()
   : await db.prepare('INSERT INTO reed_connections(id,value,updated) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM reed_btc_history) ON CONFLICT(id) DO NOTHING').bind(recordKey,payload,updated).run();
  if(!result.meta?.changes)return reply({error:'保存冲突；云端内容未覆盖。',conflict:true},409);
  await snapshotCurrent(db);
  const check=await db.prepare('SELECT value,updated FROM reed_connections WHERE id=?').bind(recordKey).first();
  if(!check||check.updated!==updated||check.value!==payload)return reply({error:'保存后核对失败，请重新读取'},503);
  return reply({version:updated,verified:true,backupVerified:true});
 }catch(error){return reply({error:error.message||'BTC记录保存失败'},503)}
}

