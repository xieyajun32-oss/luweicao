export async function readyDB(env){if(!env.PRIVATE_DB)throw Error('请先绑定独立的 D1 数据库 PRIVATE_DB');await env.PRIVATE_DB.batch([
 env.PRIVATE_DB.prepare('CREATE TABLE IF NOT EXISTS reed_connections (id TEXT PRIMARY KEY,value TEXT NOT NULL,updated TEXT NOT NULL)'),
 env.PRIVATE_DB.prepare('CREATE TABLE IF NOT EXISTS reed_inbox (id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated TEXT NOT NULL)')]);return env.PRIVATE_DB}
export async function saveConnection(env,id,value){const db=await readyDB(env);await db.prepare('INSERT INTO reed_connections(id,value,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated').bind(id,value,new Date().toISOString()).run()}
export async function loadConnection(env,id){return (await(await readyDB(env)).prepare('SELECT value FROM reed_connections WHERE id=?').bind(id).first())?.value||null}
const enc=new TextEncoder();
async function encryptionKey(env){if(!env.OURA_CLIENT_SECRET)throw Error('Oura 应用尚未配置');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(env.OURA_CLIENT_SECRET+'|'+env.OWNER_LOGIN_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const bytes=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
export async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12));return JSON.stringify({iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),enc.encode(JSON.stringify(value))))})}
export async function unseal(env,value){const x=JSON.parse(value);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(x.iv)},await encryptionKey(env),bytes(x.data))))}
